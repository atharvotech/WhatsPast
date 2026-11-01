/*
 * WhatsPast — View what vanished. An open-source Electron app that locally logs 
 * and recovers deleted, edited, archived, and locked WhatsApp messages.
 * 
 * Copyright (C) 2026 Atharv Shukla <atharvotech>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://gnu.org>.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  Browsers
} = require('@whiskeysockets/baileys');

process.on('uncaughtException', (err) => {
  if (err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES')) return;
  console.error('[UncaughtException]', err);
});

process.on('unhandledRejection', (reason) => {
  if (reason && (reason.code === 'EPERM' || reason.code === 'EBUSY')) return;
  console.error('[UnhandledRejection]', reason);
});

function getWritableBaseDir() {
  if (process.env.WA_DATA_DIR) return process.env.WA_DATA_DIR;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'WA-Shakti-Data');
  }
  return path.join(os.homedir(), '.wa-shakti-data');
}

const BASE_DATA_DIR = getWritableBaseDir();
const USERS_DIR = path.join(BASE_DATA_DIR, 'users_data');
const MEDIA_DIR = path.join(BASE_DATA_DIR, 'media');

[BASE_DATA_DIR, USERS_DIR, MEDIA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

console.log('[WA-Shakti] Storage Base Path:', BASE_DATA_DIR);

const dbMemoryCache = {};
const dbWriteTimers = {};

function getDbPath(phone) { return path.join(USERS_DIR, `db_${phone}.json`); }
function getAuthPath(phone) { return path.join(USERS_DIR, `auth_${phone}`); }

function createEmptyDB() {
  return { chats: {}, contacts: {}, messages: {}, settings: {} };
}

function readDB(phone) {
  if (!phone) return createEmptyDB();
  if (dbMemoryCache[phone]) return dbMemoryCache[phone];
  const file = getDbPath(phone);
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      dbMemoryCache[phone] = {
        chats: parsed.chats || {},
        contacts: parsed.contacts || {},
        messages: parsed.messages || {},
        settings: parsed.settings || {}
      };
      return dbMemoryCache[phone];
    } catch (e) {}
  }
  dbMemoryCache[phone] = createEmptyDB();
  return dbMemoryCache[phone];
}

function writeDB(phone, immediate = false) {
  if (!phone || !dbMemoryCache[phone]) return;
  const flushToDisk = () => {
    try {
      const file = getDbPath(phone);
      fs.writeFileSync(file, JSON.stringify(dbMemoryCache[phone], null, 2), 'utf-8');
    } catch (_) {}
  };
  if (immediate) {
    if (dbWriteTimers[phone]) clearTimeout(dbWriteTimers[phone]);
    flushToDisk();
    return;
  }
  if (dbWriteTimers[phone]) clearTimeout(dbWriteTimers[phone]);
  dbWriteTimers[phone] = setTimeout(flushToDisk, 800);
}

function unwrapMessage(message) {
  if (!message) return { content: null, isViewOnce: false };
  let isViewOnce = false;
  let curr = message;
  for (let i = 0; i < 6; i++) {
    if (!curr) break;
    if (curr.ephemeralMessage?.message) { curr = curr.ephemeralMessage.message; continue; }
    if (curr.viewOnceMessage?.message) { isViewOnce = true; curr = curr.viewOnceMessage.message; continue; }
    if (curr.viewOnceMessageV2?.message) { isViewOnce = true; curr = curr.viewOnceMessageV2.message; continue; }
    if (curr.viewOnceMessageV2Extension?.message) { isViewOnce = true; curr = curr.viewOnceMessageV2Extension.message; continue; }
    if (curr.deviceSentMessage?.message) { curr = curr.deviceSentMessage.message; continue; }
    if (curr.documentWithCaptionMessage?.message) { curr = curr.documentWithCaptionMessage.message; continue; }
    break;
  }
  return { content: curr, isViewOnce };
}

function extractTextFromContent(content) {
  if (!content) return '';
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    ''
  );
}

function normalizeJid(jid) { return jid ? jid.replace(/:\d+@/, '@') : ''; }
function formatJidNumber(jid) { return jid ? normalizeJid(jid).split('@')[0] : 'Unknown'; }

let sock = null;
let activeUser = null;
let connectionStatus = 'disconnected';
let pairingCode = null;
let lastError = null;
let isPairingMode = false;
let pairingCodeRequested = false;
let reconnectTimer = null;

function getSavedUsers() {
  if (!fs.existsSync(USERS_DIR)) return [];
  const entries = fs.readdirSync(USERS_DIR);
  const phones = new Set();
  entries.forEach((name) => {
    if (name.startsWith('auth_')) {
      const p = name.replace('auth_', '');
      const credsFile = path.join(USERS_DIR, name, 'creds.json');
      if (fs.existsSync(credsFile)) {
        try {
          if (JSON.parse(fs.readFileSync(credsFile, 'utf-8')).registered) phones.add(p);
        } catch (_) {}
      }
    }
    if (name.startsWith('db_') && name.endsWith('.json')) phones.add(name.replace('db_', '').replace('.json', ''));
  });
  return Array.from(phones);
}

function resolveSenderName(db, jid, pushName, fromMe) {
  const cleanJid = normalizeJid(jid);
  if (fromMe) return 'You';
  // Priority: saved contact name > chat name > pushName (store it) > phone number
  if (db.contacts[cleanJid] && !/^\d+$/.test(db.contacts[cleanJid])) return db.contacts[cleanJid];
  if (db.chats[cleanJid]?.name && !/^\d+$/.test(db.chats[cleanJid].name)) return db.chats[cleanJid].name;
  if (pushName && pushName.trim()) {
    db.contacts[cleanJid] = pushName.trim();
    return pushName.trim();
  }
  // Fall back to whatever is stored even if numeric
  if (db.contacts[cleanJid]) return db.contacts[cleanJid];
  if (db.chats[cleanJid]?.name) return db.chats[cleanJid].name;
  return formatJidNumber(cleanJid);
}

function enqueueMessagesUpsert(phone, upsertPayload, activeSock) {
  // Each call chains its own isolated promise — a failure never kills the queue
  const task = processMessagesBatch(phone, upsertPayload, activeSock)
    .catch((err) => console.error('[UpsertQueue Error]', err));
  return task;
}

async function processMessagesBatch(phone, { messages, type }, activeSock) {
  if (!messages || !Array.isArray(messages)) return;
  const isRealtime = type === 'notify';
  const db = readDB(phone);
  let dbChanged = false;

  for (const msg of messages) {
    try {
      if (!msg.key || !msg.key.remoteJid) continue;
      const chatId = msg.key.remoteJid;
      if (chatId === 'status@broadcast') continue;
      if (db.settings[chatId] === false) continue;

      const isGroup = chatId.endsWith('@g.us');
      const fromMe = Boolean(msg.key.fromMe);
      const rawSenderJid = isGroup
        ? msg.key.participant || msg.participant || (fromMe ? activeSock?.user?.id : chatId)
        : fromMe ? activeSock?.user?.id || 'me' : chatId;
      const senderJid = normalizeJid(rawSenderJid);
      const msgTimestamp = Number(msg.messageTimestamp || Math.floor(Date.now() / 1000));
      const isoTime = new Date(msgTimestamp * 1000).toISOString();

      // Always store pushName into contacts so names appear properly
      if (!fromMe && msg.pushName && msg.pushName.trim()) {
        db.contacts[senderJid] = msg.pushName.trim();
        // Also update the chat name if it was previously just a number
        const existingChat = db.chats[chatId];
        if (existingChat && !isGroup) {
          const currentName = existingChat.name || '';
          // Replace numeric-only names with the real pushName
          if (!currentName || /^\d+$/.test(currentName)) {
            existingChat.name = msg.pushName.trim();
          }
        }
        dbChanged = true;
      }

      const senderName = resolveSenderName(db, senderJid, msg.pushName, fromMe);

      if (!db.chats[chatId]) {
        db.chats[chatId] = {
          chat_id: chatId,
          name: isGroup
            ? formatJidNumber(chatId)
            : (!fromMe && msg.pushName ? msg.pushName.trim() : formatJidNumber(chatId)),
          is_group: isGroup,
          archived: false,
          locked: chatId.endsWith('@lid'),
          last_timestamp: msgTimestamp
        };
        dbChanged = true;
      } else if (msgTimestamp > (db.chats[chatId].last_timestamp || 0)) {
        db.chats[chatId].last_timestamp = msgTimestamp;
        dbChanged = true;
      }

      if (!db.messages[chatId]) db.messages[chatId] = [];
      const chatMsgs = db.messages[chatId];

      const { content, isViewOnce } = unwrapMessage(msg.message);
      if (!content) {
        if (isRealtime) console.log(`[WA-Shakti] No content for msg ${msg.key.id} in ${chatId}`);
        continue;
      }

      const proto = content.protocolMessage;
      if (proto) {
        const targetId = proto.key?.id;
        if (proto.type === 0 && targetId) {
          let existing = chatMsgs.find((m) => m.id === targetId);
          if (existing) {
            existing.is_deleted = true;
            existing.deleted_at = new Date().toISOString();
          }
          dbChanged = true;
          continue;
        }
        if ((proto.type === 14 || proto.editedMessage) && targetId) {
          const { content: editedInner } = unwrapMessage(proto.editedMessage);
          const newText = extractTextFromContent(editedInner) || '[Edited]';
          let existing = chatMsgs.find((m) => m.id === targetId);
          if (existing && existing.latest_text !== newText) {
            if (!existing.edit_history) existing.edit_history = [];
            if (existing.edit_history.length === 0) {
              existing.edit_history.push({
                text: existing.original_text,
                time: new Date(existing.timestamp * 1000).toISOString()
              });
            }
            existing.edit_history.push({ text: newText, time: isoTime });
            existing.latest_text = newText;
            dbChanged = true;
          }
          continue;
        }
        continue;
      }

      // Skip reactions — they don't produce a standalone message
      if (content.reactionMessage) continue;

      const msgId = msg.key.id;
      // For real-time messages (notify), always process even if we think we've seen it
      // For history sync (append), deduplicate
      if (!isRealtime && chatMsgs.some((m) => m.id === msgId)) continue;
      if (isRealtime && chatMsgs.some((m) => m.id === msgId)) {
        // Already stored — just update name if it improved
        const existing = chatMsgs.find((m) => m.id === msgId);
        if (existing && msg.pushName && existing.sender_name !== msg.pushName.trim()) {
          existing.sender_name = msg.pushName.trim();
          dbChanged = true;
        }
        continue;
      }

      let messageType = 'text';
      let mediaPath = null;
      let textContent = extractTextFromContent(content);

      if (content.imageMessage) {
        messageType = 'image';
        const fileName = `img_${phone}_${msgId}.jpg`;
        const fullPath = path.join(MEDIA_DIR, fileName);
        if (!fs.existsSync(fullPath)) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
            fs.writeFileSync(fullPath, buffer);
            mediaPath = `/media/${fileName}`;
          } catch (_) {}
        } else {
          mediaPath = `/media/${fileName}`;
        }
        if (!textContent) textContent = isViewOnce ? '👁️ [View-Once Photo]' : '📷 [Photo]';
      } else if (content.stickerMessage) {
        messageType = 'sticker';
        const fileName = `stk_${phone}_${msgId}.webp`;
        const fullPath = path.join(MEDIA_DIR, fileName);
        if (!fs.existsSync(fullPath)) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
            fs.writeFileSync(fullPath, buffer);
            mediaPath = `/media/${fileName}`;
          } catch (_) {}
        } else {
          mediaPath = `/media/${fileName}`;
        }
        textContent = '🏷️ [Sticker]';
      } else if (content.audioMessage) {
        messageType = 'audio';
        textContent = content.audioMessage.ptt ? '🎤 [Voice Note]' : '🎵 [Audio]';
      } else if (content.videoMessage) {
        messageType = 'video';
        textContent = content.videoMessage.caption || '🎥 [Video]';
      } else if (content.documentMessage) {
        messageType = 'document';
        textContent = content.documentMessage.caption || `📄 [Document: ${content.documentMessage.fileName || 'file'}]`;
      } else if (content.locationMessage) {
        messageType = 'location';
        textContent = `📍 [Location: ${content.locationMessage.degreesLatitude?.toFixed(4)}, ${content.locationMessage.degreesLongitude?.toFixed(4)}]`;
      } else if (content.contactMessage) {
        messageType = 'contact';
        textContent = `👤 [Contact: ${content.contactMessage.displayName || 'Unknown'}]`;
      } else if (content.contactsArrayMessage) {
        messageType = 'contact';
        textContent = `👥 [Contacts: ${content.contactsArrayMessage.contacts?.length || '?'} shared]`;
      }

      // For real-time notify messages, log even if content is empty (helps debug)
      if (!textContent && !mediaPath) {
        if (isRealtime) {
          console.log(`[WA-Shakti] Unhandled message type in ${chatId}:`, Object.keys(content).join(', '));
        }
        continue;
      }

      if (isRealtime) {
        console.log(`[WA-Shakti] ✅ New message from ${senderName} in ${chatId}: "${textContent?.slice(0, 50)}"`);
      }

      chatMsgs.push({
        id: msgId,
        chat_id: chatId,
        sender_jid: senderJid,
        sender_name: senderName,
        from_me: fromMe,
        message_type: messageType,
        original_text: textContent,
        latest_text: textContent,
        edit_history: [],
        is_deleted: false,
        is_view_once: isViewOnce,
        media_path: mediaPath,
        timestamp: msgTimestamp
      });
      dbChanged = true;
    } catch (err) {
      console.error('[WA-Shakti] Error processing message:', err.message);
    }
  }

  if (dbChanged) writeDB(phone);
}

async function startWhatsAppSession(phone, requestNewPairingCode = false) {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try { sock.ev.removeAllListeners(); sock.ws.close(); } catch (_) {}
    sock = null;
  }

  const authFolder = getAuthPath(cleanPhone);

  // Always wipe the auth folder for a fresh pairing to prevent stale Signal session Bad MAC errors
  if (requestNewPairingCode && fs.existsSync(authFolder)) {
    try { fs.rmSync(authFolder, { recursive: true, force: true }); } catch (_) {}
  }

  if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });

  activeUser = cleanPhone;
  connectionStatus = requestNewPairingCode ? 'pairing' : 'connecting';
  lastError = null;
  isPairingMode = requestNewPairingCode;
  pairingCodeRequested = false;
  if (requestNewPairingCode) pairingCode = null;

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  let credsQueue = Promise.resolve();
  const safeSaveCreds = () => {
    credsQueue = credsQueue.then(() => saveCreds()).catch(() => {});
  };

  let version = [2, 3000, 1043857760]; // Baileys bundled fallback
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log('[WA-Shakti] Using WA Web version:', version);
  } catch (_) {
    console.log('[WA-Shakti] Using WA Web version (offline fallback):', version);
  }

  const currentSock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: true,
    markOnlineOnConnect: false
  });

  sock = currentSock;
  currentSock.ev.on('creds.update', safeSaveCreds);
  currentSock.ev.on('messages.upsert', (payload) => enqueueMessagesUpsert(cleanPhone, payload, currentSock));

  // Keep contact names in sync when WA pushes contact updates
  currentSock.ev.on('contacts.update', (updates) => {
    const db = readDB(cleanPhone);
    let changed = false;
    for (const update of updates) {
      if (!update.id) continue;
      const jid = normalizeJid(update.id);
      const name = update.name || update.notify;
      if (name && name.trim()) {
        db.contacts[jid] = name.trim();
        // Also patch chat name if it was still a raw number
        if (db.chats[update.id] && /^\d+$/.test(db.chats[update.id].name || '')) {
          db.chats[update.id].name = name.trim();
        }
        changed = true;
      }
    }
    if (changed) writeDB(cleanPhone);
  });

  // Keep chat metadata (name, archive status) in sync
  currentSock.ev.on('chats.update', (updates) => {
    const db = readDB(cleanPhone);
    let changed = false;
    for (const update of updates) {
      if (!update.id || update.id === 'status@broadcast') continue;
      if (!db.chats[update.id]) continue;
      if (update.name) { db.chats[update.id].name = update.name; changed = true; }
      if (update.archived !== undefined) { db.chats[update.id].archived = Boolean(update.archived); changed = true; }
    }
    if (changed) writeDB(cleanPhone);
  });

  currentSock.ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
    const db = readDB(cleanPhone);
    if (contacts) {
      contacts.forEach((c) => {
        const jid = normalizeJid(c.id);
        const name = c.name || c.notify;
        if (jid && name && name.trim()) db.contacts[jid] = name.trim();
      });
    }
    if (chats) {
      chats.forEach((ch) => {
        if (!ch.id || ch.id === 'status@broadcast') return;
        const jid = normalizeJid(ch.id);
        // Resolve name: chat.name first, then contact lookup, then number
        const resolvedName = ch.name || db.contacts[jid] || formatJidNumber(ch.id);
        db.chats[ch.id] = {
          chat_id: ch.id,
          name: resolvedName,
          is_group: ch.id.endsWith('@g.us'),
          archived: Boolean(ch.archived),
          locked: Boolean(ch.locked || ch.id.endsWith('@lid')),
          last_timestamp: Number(ch.conversationTimestamp || 0)
        };
      });
    }
    writeDB(cleanPhone);
    if (messages?.length > 0) enqueueMessagesUpsert(cleanPhone, { messages, type: 'append' }, currentSock);
  });

  currentSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log('[WA-Shakti] Connection update:', { connection, hasQr: Boolean(qr) });

    // Wait strictly for QR emission before requesting the 8-digit pairing code
    if (qr && isPairingMode && !currentSock.authState.creds.registered && !pairingCodeRequested) {
      pairingCodeRequested = true;
      connectionStatus = 'pairing';
      try {
        console.log(`[WA-Shakti] Requesting pairing code for ${cleanPhone}...`);
        const code = await currentSock.requestPairingCode(cleanPhone);
        pairingCode = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`\n========================================`);
        console.log(`[WA-Shakti] PAIRING CODE: ${pairingCode}`);
        console.log(`========================================\n`);
      } catch (err) {
        console.error('[WA-Shakti] Pairing code error:', err.message);
        lastError = `Pairing Failed: ${err.message}`;
        pairingCodeRequested = false;
      }
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      pairingCode = null;
      isPairingMode = false;
      lastError = null;
      console.log(`[WA-Shakti] Successfully connected as +${cleanPhone}`);
      try { await currentSock.sendPresenceUpdate('unavailable'); } catch (_) {}
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errMsg = lastDisconnect?.error?.message || 'Closed';
      console.log(`[WA-Shakti] Socket closed (code: ${statusCode}): ${errMsg}`);

      if (statusCode === DisconnectReason.loggedOut) {
        connectionStatus = 'disconnected';
        pairingCode = null;
        lastError = 'Logged out from phone.';
        try { fs.rmSync(authFolder, { recursive: true, force: true }); } catch (_) {}
        return;
      }

      if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
        console.log('[WA-Shakti] Pairing accepted (515)! Reconnecting session...');
        reconnectTimer = setTimeout(() => startWhatsAppSession(cleanPhone, false), 1200);
        return;
      }

      // Do not kill an active pairing code screen unless the user isn't pairing
      if (isPairingMode && pairingCode) {
        console.log('[WA-Shakti] Pairing session timed out, waiting for user retry.');
        connectionStatus = 'disconnected';
        lastError = 'Pairing code expired. Click Get Code again.';
        return;
      }

      connectionStatus = 'connecting';
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        startWhatsAppSession(cleanPhone, false);
      }, 4000);
    }
  });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/media', express.static(MEDIA_DIR));

app.get('/api/status', (req, res) => {
  res.json({ activeUser, users: getSavedUsers(), status: connectionStatus, pairingCode, lastError });
});

app.post('/api/auth/login', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 10) {
    lastError = 'Include country code (e.g. 919876543210)';
    return res.status(400).json({ error: lastError });
  }
  await startWhatsAppSession(cleanPhone, true);
  res.json({ ok: true, activeUser: cleanPhone });
});

app.post('/api/auth/switch', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  await startWhatsAppSession(phone.replace(/[^0-9]/g, ''), false);
  res.json({ ok: true });
});

app.get('/api/chats', (req, res) => {
  if (!activeUser) return res.json([]);
  const db = readDB(activeUser);
  const chatList = Object.keys(db.messages).map((chatId) => {
    const msgs = db.messages[chatId] || [];
    if (msgs.length === 0) return null;
    const lastMsg = msgs[msgs.length - 1];
    const meta = db.chats[chatId] || {};
    const normalizedChatJid = normalizeJid(chatId);

    // Resolve display name: prefer contacts map > chat meta name > number
    let displayName = db.contacts[normalizedChatJid] || meta.name || formatJidNumber(chatId);
    // If it's still just a number string, see if any message has a better pushName stored
    if (/^\d+$/.test(displayName)) {
      const firstIncoming = msgs.find((m) => !m.from_me && m.sender_name && !/^\d+$/.test(m.sender_name));
      if (firstIncoming) displayName = firstIncoming.sender_name;
    }

    return {
      chat_id: chatId,
      sender_name: displayName,
      latest_sender: lastMsg.sender_name,
      latest_text: `${lastMsg.is_deleted ? '🚫 ' : ''}${lastMsg.latest_text}`,
      timestamp: lastMsg.timestamp,
      message_count: msgs.length,
      is_group: chatId.endsWith('@g.us'),
      archived: Boolean(meta.archived),
      locked: Boolean(meta.locked || chatId.endsWith('@lid')),
      logging_enabled: db.settings[chatId] !== false
    };
  }).filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);
  res.json(chatList);
});

app.get('/api/chats/:chatId', (req, res) => {
  if (!activeUser) return res.json([]);
  const db = readDB(activeUser);
  const chatId = decodeURIComponent(req.params.chatId);
  res.json((db.messages[chatId] || []).slice().sort((a, b) => a.timestamp - b.timestamp));
});

app.post('/api/settings/toggle', (req, res) => {
  if (!activeUser) return res.status(400).json({ error: 'No active user' });
  const { chat_id, enable } = req.body;
  const db = readDB(activeUser);
  db.settings[chat_id] = Boolean(enable);
  writeDB(activeUser, true);
  res.json({ ok: true });
});

app.post('/api/storage/clear', (req, res) => {
  if (!activeUser) return res.status(400).json({ error: 'No active user' });
  const db = readDB(activeUser);
  db.messages = {};
  writeDB(activeUser, true);
  res.json({ ok: true });
});

app.listen(3000, '127.0.0.1', () => {
  console.log('[WA-Shakti] Backend LIVE on http://127.0.0.1:3000');
});
