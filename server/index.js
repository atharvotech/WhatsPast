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

const CONFIG_FILE = path.join(BASE_DATA_DIR, 'config.json');

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (_) {}
  return { lastActiveUser: null };
}

function writeConfig(data) {
  try {
    const cur = readConfig();
    const updated = { ...cur, ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
  } catch (err) {
    console.error('[WA-Shakti] Failed to write config:', err.message);
  }
}

function createEmptyDB() {
  return { chats: {}, contacts: {}, messages: {}, settings: {}, lidMap: {}, presence: {} };
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
        settings: parsed.settings || {},
        lidMap: parsed.lidMap || {},
        presence: parsed.presence || {}
      };
      return dbMemoryCache[phone];
    } catch (e) {}
  }
  dbMemoryCache[phone] = createEmptyDB();
  return dbMemoryCache[phone];
}

function autoDiscoverLidMappings(db) {
  if (!db.lidMap) db.lidMap = {};
  let changed = false;

  // 1. Discover from messages where remoteJid is @lid and sender_jid has @s.whatsapp.net
  for (const cid of Object.keys(db.messages || {})) {
    if (cid.endsWith('@lid')) {
      const msgs = db.messages[cid];
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          if (!m.from_me && m.sender_jid && m.sender_jid.endsWith('@s.whatsapp.net')) {
            const cleanPhone = normalizeJid(m.sender_jid);
            if (!db.lidMap[cid] || !db.lidMap[cleanPhone]) {
              db.lidMap[cid] = cleanPhone;
              db.lidMap[cleanPhone] = cid;
              changed = true;
            }
            break;
          }
        }
      }
    }
  }

  // 2. Discover by matching non-numeric contact names between LID chats and Phone contacts/chats
  const nameToPhone = {};
  for (const cJid of Object.keys(db.contacts || {})) {
    if (cJid.endsWith('@s.whatsapp.net')) {
      const name = db.contacts[cJid];
      if (name && !/^\d+$/.test(name)) nameToPhone[name.trim().toLowerCase()] = normalizeJid(cJid);
    }
  }
  for (const cJid of Object.keys(db.chats || {})) {
    if (cJid.endsWith('@s.whatsapp.net')) {
      const name = db.chats[cJid]?.name;
      if (name && !/^\d+$/.test(name) && !nameToPhone[name.trim().toLowerCase()]) {
        nameToPhone[name.trim().toLowerCase()] = normalizeJid(cJid);
      }
    }
  }

  for (const cid of Object.keys(db.chats || {})) {
    if (cid.endsWith('@lid') && !db.lidMap[cid]) {
      const name = db.chats[cid]?.name;
      if (name && nameToPhone[name.trim().toLowerCase()]) {
        const pJid = nameToPhone[name.trim().toLowerCase()];
        db.lidMap[cid] = pJid;
        db.lidMap[pJid] = cid;
        changed = true;
      }
    }
  }

  // 3. Bidirectionally cross-sync archived flags across ALL linked pairs
  for (const key of Object.keys(db.chats || {})) {
    const cleanKey = normalizeJid(key);
    const linked = db.lidMap[key] || db.lidMap[cleanKey];
    if (linked) {
      const cleanLinked = normalizeJid(linked);
      const isArch = Boolean(
        db.chats[key]?.archived ||
        db.chats[cleanKey]?.archived ||
        db.chats[linked]?.archived ||
        db.chats[cleanLinked]?.archived
      );
      if (isArch) {
        if (db.chats[key] && !db.chats[key].archived) { db.chats[key].archived = true; changed = true; }
        if (db.chats[cleanKey] && !db.chats[cleanKey].archived) { db.chats[cleanKey].archived = true; changed = true; }
        if (db.chats[linked] && !db.chats[linked].archived) { db.chats[linked].archived = true; changed = true; }
        if (db.chats[cleanLinked] && !db.chats[cleanLinked].archived) { db.chats[cleanLinked].archived = true; changed = true; }
      }
    }
  }

  return changed;
}

/**
 * One-time migration run at startup (and after history sync):
 *  - Resets any wrongly-set locked:true flags that came from the old @lid heuristic
 *  - Back-fills sender_name and contacts map from any intercepted messages
 *  - Cross-syncs archived flags and contact names between phone JID and @lid JID
 *
 * NOTE: @lid JIDs are real user DM chats (WhatsApp's "Linked Identity" privacy system).
 * They are NOT internal device identifiers. Do NOT delete them.
 */
function migrateDB(phone) {
  const db = readDB(phone);
  let changed = autoDiscoverLidMappings(db);
  if (!db.lidMap) { db.lidMap = {}; changed = true; }

  // 1. Reset wrongly-set locked flags — only keep locked:true for chats
  //    that Baileys explicitly marked as locked (ch.locked).
  for (const key of Object.keys(db.chats)) {
    if (db.chats[key].locked === true) {
      db.chats[key].locked = false;
      changed = true;
    }
    // Also ensure archived is a proper boolean (not undefined/null)
    if (typeof db.chats[key].archived !== 'boolean') {
      db.chats[key].archived = false;
      changed = true;
    }
    // If linked chat is archived, ensure this chat is marked archived too
    const linked = db.lidMap[key];
    if (linked && db.chats[linked] && db.chats[linked].archived) {
      if (!db.chats[key].archived) {
        db.chats[key].archived = true;
        changed = true;
      }
    }
  }

  // 2. Back-fill contacts map from any message pushNames / sender_names
  for (const chatId of Object.keys(db.messages)) {
    const msgs = db.messages[chatId];
    if (!Array.isArray(msgs)) continue;
    for (const m of msgs) {
      if (!m.from_me && m.sender_jid && m.sender_name && !/^\d+$/.test(m.sender_name)) {
        if (!db.contacts[m.sender_jid] || /^\d+$/.test(db.contacts[m.sender_jid])) {
          db.contacts[m.sender_jid] = m.sender_name;
          changed = true;
        }
        const linked = db.lidMap[m.sender_jid];
        if (linked && (!db.contacts[linked] || /^\d+$/.test(db.contacts[linked]))) {
          db.contacts[linked] = m.sender_name;
          changed = true;
        }
      }
    }
  }

  // 3. Back-fill sender names in stored messages using current contacts map
  for (const chatId of Object.keys(db.messages)) {
    const msgs = db.messages[chatId];
    if (!Array.isArray(msgs)) continue;
    for (const m of msgs) {
      if (m.from_me || !m.sender_jid) continue;
      const linked = db.lidMap[m.sender_jid];
      const betterName = db.contacts[m.sender_jid] || (linked ? db.contacts[linked] : null);
      if (betterName && !/^\d+$/.test(betterName) && betterName !== m.sender_name) {
        m.sender_name = betterName;
        changed = true;
      }
    }
  }

  // 4. Update chat display names from contacts if chat name was numeric
  for (const key of Object.keys(db.chats)) {
    const curName = db.chats[key].name || '';
    if (!curName || /^\d+$/.test(curName)) {
      const linked = db.lidMap[key];
      const betterName = db.contacts[key] || (linked ? db.contacts[linked] : null);
      if (betterName && !/^\d+$/.test(betterName)) {
        db.chats[key].name = betterName;
        changed = true;
      }
    }
  }

  if (changed) writeDB(phone, true);
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

function getPresenceStats(entry, now = Math.floor(Date.now() / 1000)) {
  if (!entry) {
    return {
      status: 'offline',
      presence: 'unknown',
      lastSeen: null,
      totalSeconds: 0,
      todaySeconds: 0,
      sessions: [],
      isTracking: false
    };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayTs = Math.floor(startOfDay.getTime() / 1000);

  let totalSeconds = 0;
  let todaySeconds = 0;
  const sessions = Array.isArray(entry.sessions) ? [...entry.sessions] : [];

  for (const s of sessions) {
    const dur = Number(s.durationSeconds || 0);
    totalSeconds += dur;
    if (s.end >= startOfDayTs) {
      const todayPortion = s.end - Math.max(s.start, startOfDayTs);
      todaySeconds += Math.max(0, todayPortion);
    }
  }

  const isOnline = entry.lastKnownPresence === 'available' || entry.lastKnownPresence === 'composing' || entry.lastKnownPresence === 'recording';
  if (isOnline && entry.currentSessionStart) {
    const activeDuration = Math.max(0, now - entry.currentSessionStart);
    totalSeconds += activeDuration;
    const todayActive = now - Math.max(entry.currentSessionStart, startOfDayTs);
    todaySeconds += Math.max(0, todayActive);
  }

  return {
    status: isOnline ? 'online' : 'offline',
    presence: entry.lastKnownPresence || 'unknown',
    lastSeen: entry.lastSeen || (isOnline ? null : (entry.sessions.length > 0 ? entry.sessions[entry.sessions.length - 1].end : entry.lastUpdated)),
    totalSeconds,
    todaySeconds,
    sessions: sessions.slice().reverse(), // Complete session history, newest first
    currentSessionStart: isOnline ? (entry.currentSessionStart || now) : null,
    isTracking: Boolean(entry.isTracking)
  };
}

function updateContactPresence(db, targetJid, pData, now = Math.floor(Date.now() / 1000)) {
  if (!db.presence) db.presence = {};
  const clean = normalizeJid(targetJid);
  const linked = db.lidMap?.[clean];
  const keys = [clean];
  if (linked && !keys.includes(linked)) keys.push(linked);

  let changed = false;
  for (const key of keys) {
    if (!db.presence[key]) {
      db.presence[key] = {
        isTracking: false,
        lastKnownPresence: 'unknown',
        lastSeen: null,
        lastUpdated: now,
        sessions: [],
        currentSessionStart: null
      };
    }
    const entry = db.presence[key];
    const prevPresence = entry.lastKnownPresence;
    const newPresence = pData.lastKnownPresence || prevPresence;

    if (pData.lastSeen) entry.lastSeen = pData.lastSeen;
    entry.lastKnownPresence = newPresence;
    entry.lastUpdated = now;

    const isOnline = newPresence === 'available' || newPresence === 'composing' || newPresence === 'recording';
    const wasOnline = prevPresence === 'available' || prevPresence === 'composing' || prevPresence === 'recording';

    if (isOnline && !wasOnline) {
      entry.currentSessionStart = now;
      changed = true;
    } else if (!isOnline && wasOnline && entry.currentSessionStart) {
      const dur = Math.max(1, now - entry.currentSessionStart);
      entry.sessions.push({ start: entry.currentSessionStart, end: now, durationSeconds: dur });
      entry.currentSessionStart = null;
      changed = true;
    }
  }
  return changed;
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
    if (curr.editedMessage?.message) { curr = curr.editedMessage.message; continue; }
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

async function downloadMediaBuffer(msg, content) {
  try {
    return await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
  } catch (err1) {
    try {
      return await downloadMediaMessage({ key: msg.key, message: content }, 'buffer', {}, { logger: pino({ level: 'silent' }) });
    } catch (err2) {
      return null;
    }
  }
}

let sock = null;
let activeUser = null;
let connectionStatus = 'disconnected';
let pairingCode = null;
let lastError = null;
let isPairingMode = false;
let pairingCodeRequested = false;
let reconnectTimer = null;
let presencePollInterval = null;

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
  const linkedJid = db.lidMap?.[cleanJid];

  // Priority: saved contact name (for cleanJid or linked) > chat name > pushName > phone number
  if (db.contacts[cleanJid] && !/^\d+$/.test(db.contacts[cleanJid])) return db.contacts[cleanJid];
  if (linkedJid && db.contacts[linkedJid] && !/^\d+$/.test(db.contacts[linkedJid])) return db.contacts[linkedJid];

  if (db.chats[cleanJid]?.name && !/^\d+$/.test(db.chats[cleanJid].name)) return db.chats[cleanJid].name;
  if (linkedJid && db.chats[linkedJid]?.name && !/^\d+$/.test(db.chats[linkedJid].name)) return db.chats[linkedJid].name;

  if (pushName && pushName.trim()) {
    const cleanPush = pushName.trim();
    db.contacts[cleanJid] = cleanPush;
    if (linkedJid) db.contacts[linkedJid] = cleanPush;
    return cleanPush;
  }

  // Fall back to whatever is stored even if numeric
  if (db.contacts[cleanJid]) return db.contacts[cleanJid];
  if (linkedJid && db.contacts[linkedJid]) return db.contacts[linkedJid];
  if (db.chats[cleanJid]?.name) return db.chats[cleanJid].name;
  if (linkedJid && db.chats[linkedJid]?.name) return db.chats[linkedJid].name;

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
        const cleanPush = msg.pushName.trim();
        db.contacts[senderJid] = cleanPush;
        const linked = db.lidMap?.[senderJid];
        if (linked) db.contacts[linked] = cleanPush;

        // Also update the chat name if it was previously just a number
        const existingChat = db.chats[chatId];
        if (existingChat && !isGroup) {
          const currentName = existingChat.name || '';
          // Replace numeric-only names with the real pushName
          if (!currentName || /^\d+$/.test(currentName)) {
            existingChat.name = cleanPush;
          }
        }
        dbChanged = true;
      }

      // If contact just sent a message, record their presence as available/online
      if (!fromMe && senderJid) {
        if (updateContactPresence(db, senderJid, { lastKnownPresence: 'available' }, msgTimestamp)) {
          dbChanged = true;
        }
      }

      const senderName = resolveSenderName(db, senderJid, msg.pushName, fromMe);

      if (!db.chats[chatId]) {
        // Inherit archived status from linked chat if available
        const linkedChat = db.lidMap?.[chatId] ? db.chats[db.lidMap[chatId]] : null;
        const isArch = Boolean(linkedChat?.archived);

        db.chats[chatId] = {
          chat_id: chatId,
          name: isGroup
            ? formatJidNumber(chatId)
            : (!fromMe && msg.pushName ? msg.pushName.trim() : formatJidNumber(chatId)),
          is_group: isGroup,
          archived: isArch,
          locked: false,
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
          // Look up target message in current chat or across all chats
          let existing = chatMsgs.find((m) => m.id === targetId);
          if (!existing) {
            for (const cid of Object.keys(db.messages)) {
              const found = db.messages[cid]?.find((m) => m.id === targetId);
              if (found) { existing = found; break; }
            }
          }
          if (existing) {
            existing.is_deleted = true;
            existing.deleted_at = new Date().toISOString();
            dbChanged = true;
          }
          continue;
        }
        if ((proto.type === 14 || proto.editedMessage) && targetId) {
          const { content: editedInner } = unwrapMessage(proto.editedMessage);
          const newText = extractTextFromContent(editedInner) || '[Edited]';

          // Look up target message in current chat or across all chats
          let existing = chatMsgs.find((m) => m.id === targetId);
          if (!existing) {
            for (const cid of Object.keys(db.messages)) {
              const found = db.messages[cid]?.find((m) => m.id === targetId);
              if (found) { existing = found; break; }
            }
          }

          if (existing) {
            if (!existing.edit_history) existing.edit_history = [];
            // If this is the first edit, record the original version
            if (existing.edit_history.length === 0) {
              existing.edit_history.push({
                text: existing.original_text || existing.latest_text,
                time: new Date((existing.timestamp || msgTimestamp) * 1000).toISOString()
              });
            }
            // Append this revision if not duplicate of the last recorded revision
            const lastRev = existing.edit_history[existing.edit_history.length - 1];
            if (!lastRev || lastRev.text !== newText) {
              existing.edit_history.push({ text: newText, time: isoTime });
            }
            existing.latest_text = newText;
            dbChanged = true;
          } else {
            // Target message was sent before interceptor was running; still capture the edit!
            chatMsgs.push({
              id: targetId,
              chat_id: chatId,
              sender_jid: senderJid,
              sender_name: senderName,
              from_me: fromMe,
              message_type: 'text',
              original_text: '[Original unintercepted]',
              latest_text: newText,
              edit_history: [
                { text: '[Original unintercepted]', time: isoTime },
                { text: newText, time: isoTime }
              ],
              is_deleted: false,
              is_view_once: false,
              media_path: null,
              timestamp: msgTimestamp
            });
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
      let extraMediaMeta = {};

      if (content.imageMessage) {
        messageType = 'image';
        const fileName = `img_${phone}_${msgId}.jpg`;
        const fullPath = path.join(MEDIA_DIR, fileName);
        if (!fs.existsSync(fullPath)) {
          const buffer = await downloadMediaBuffer(msg, content);
          if (buffer && buffer.length > 0) {
            fs.writeFileSync(fullPath, buffer);
            mediaPath = `/media/${fileName}`;
          }
        } else {
          mediaPath = `/media/${fileName}`;
        }
        extraMediaMeta = {
          file_size: Number(content.imageMessage.fileLength || 0),
          mimetype: content.imageMessage.mimetype || 'image/jpeg',
          caption: content.imageMessage.caption || ''
        };
        if (!textContent) textContent = isViewOnce ? '👁️ [View-Once Photo]' : '📷 [Photo]';
      } else if (content.stickerMessage) {
        messageType = 'sticker';
        const fileName = `stk_${phone}_${msgId}.webp`;
        const fullPath = path.join(MEDIA_DIR, fileName);
        if (!fs.existsSync(fullPath)) {
          const buffer = await downloadMediaBuffer(msg, content);
          if (buffer && buffer.length > 0) {
            fs.writeFileSync(fullPath, buffer);
            mediaPath = `/media/${fileName}`;
          }
        } else {
          mediaPath = `/media/${fileName}`;
        }
        extraMediaMeta = {
          file_size: Number(content.stickerMessage.fileLength || 0),
          mimetype: content.stickerMessage.mimetype || 'image/webp'
        };
        textContent = '🏷️ [Sticker]';
      } else if (content.audioMessage) {
        messageType = 'audio';
        const isPtt = Boolean(content.audioMessage.ptt);
        const aMime = content.audioMessage.mimetype || (isPtt ? 'audio/ogg; codecs=opus' : 'audio/mpeg');
        let ext = 'ogg';
        if (aMime.includes('mp4') || aMime.includes('m4a')) ext = 'm4a';
        else if (aMime.includes('mpeg') || aMime.includes('mp3')) ext = 'mp3';
        else if (aMime.includes('wav')) ext = 'wav';
        else if (aMime.includes('ogg') || aMime.includes('opus')) ext = 'ogg';
        else if (isPtt) ext = 'ogg';

        const fileName = `aud_${phone}_${msgId}.${ext}`;
        const fullPath = path.join(MEDIA_DIR, fileName);

        if (!fs.existsSync(fullPath)) {
          const buffer = await downloadMediaBuffer(msg, content);
          if (buffer && buffer.length > 0) {
            fs.writeFileSync(fullPath, buffer);
            mediaPath = `/media/${fileName}`;
          }
        } else {
          mediaPath = `/media/${fileName}`;
        }

        extraMediaMeta = {
          is_ptt: isPtt,
          duration: Number(content.audioMessage.seconds || 0),
          file_size: Number(content.audioMessage.fileLength || 0),
          mimetype: aMime,
          waveform: content.audioMessage.waveform ? Buffer.from(content.audioMessage.waveform).toString('base64') : null
        };

        textContent = isPtt ? '🎤 [Voice Note]' : '🎵 [Audio]';
      } else if (content.videoMessage) {
        messageType = 'video';
        const vMime = content.videoMessage.mimetype || 'video/mp4';
        const ext = vMime.includes('webm') ? 'webm' : (vMime.includes('3gpp') ? '3gp' : 'mp4');
        const fileName = `vid_${phone}_${msgId}.${ext}`;
        const fullPath = path.join(MEDIA_DIR, fileName);

        // Save thumbnail if available
        let thumbPath = null;
        const thumbData = content.videoMessage.jpegThumbnail;
        if (thumbData && thumbData.length > 0) {
          const thumbFileName = `vid_thumb_${phone}_${msgId}.jpg`;
          const thumbFullPath = path.join(MEDIA_DIR, thumbFileName);
          if (!fs.existsSync(thumbFullPath)) {
            try {
              fs.writeFileSync(thumbFullPath, Buffer.from(thumbData));
              thumbPath = `/media/${thumbFileName}`;
            } catch (_) {}
          } else {
            thumbPath = `/media/${thumbFileName}`;
          }
        }

        if (!fs.existsSync(fullPath)) {
          const buffer = await downloadMediaBuffer(msg, content);
          if (buffer && buffer.length > 0) {
            fs.writeFileSync(fullPath, buffer);
            mediaPath = `/media/${fileName}`;
          }
        } else {
          mediaPath = `/media/${fileName}`;
        }

        // If video download failed but thumbnail exists, fallback to thumbPath for display
        if (!mediaPath && thumbPath) {
          mediaPath = thumbPath;
        }

        extraMediaMeta = {
          thumbnail_path: thumbPath,
          duration: Number(content.videoMessage.seconds || 0),
          file_size: Number(content.videoMessage.fileLength || 0),
          mimetype: vMime,
          caption: content.videoMessage.caption || ''
        };

        textContent = content.videoMessage.caption || (isViewOnce ? '👁️ [View-Once Video]' : '🎥 [Video]');
      } else if (content.documentMessage) {
        messageType = 'document';
        const rawFileName = content.documentMessage.fileName || 'document.pdf';
        const dMime = content.documentMessage.mimetype || 'application/pdf';
        const safeBaseName = path.basename(rawFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `doc_${phone}_${msgId}_${safeBaseName}`;
        const fullPath = path.join(MEDIA_DIR, fileName);

        if (!fs.existsSync(fullPath)) {
          const buffer = await downloadMediaBuffer(msg, content);
          if (buffer && buffer.length > 0) {
            fs.writeFileSync(fullPath, buffer);
            mediaPath = `/media/${fileName}`;
          }
        } else {
          mediaPath = `/media/${fileName}`;
        }

        let thumbPath = null;
        const thumbData = content.documentMessage.jpegThumbnail;
        if (thumbData && thumbData.length > 0) {
          const thumbFileName = `doc_thumb_${phone}_${msgId}.jpg`;
          const thumbFullPath = path.join(MEDIA_DIR, thumbFileName);
          if (!fs.existsSync(thumbFullPath)) {
            try {
              fs.writeFileSync(thumbFullPath, Buffer.from(thumbData));
              thumbPath = `/media/${thumbFileName}`;
            } catch (_) {}
          } else {
            thumbPath = `/media/${thumbFileName}`;
          }
        }

        extraMediaMeta = {
          file_name: rawFileName,
          file_size: Number(content.documentMessage.fileLength || 0),
          mimetype: dMime,
          page_count: Number(content.documentMessage.pageCount || 0) || null,
          title: content.documentMessage.title || '',
          thumbnail_path: thumbPath
        };

        textContent = content.documentMessage.caption || rawFileName;
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
        timestamp: msgTimestamp,
        ...extraMediaMeta
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
  writeConfig({ lastActiveUser: cleanPhone });
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

  // Live presence updates: available (online), unavailable (offline), composing, recording, lastSeen
  currentSock.ev.on('presence.update', ({ id, presences }) => {
    if (!presences) return;
    const db = readDB(cleanPhone);
    let changed = false;
    const now = Math.floor(Date.now() / 1000);

    for (const [participant, pData] of Object.entries(presences)) {
      const rawTarget = participant || id;
      if (!rawTarget || rawTarget === 'status@broadcast') continue;
      if (updateContactPresence(db, rawTarget, pData, now)) {
        changed = true;
      }
    }
    if (changed) writeDB(cleanPhone);
  });

  // Keep contact names in sync when WA pushes contact updates
  currentSock.ev.on('contacts.update', (updates) => {
    const db = readDB(cleanPhone);
    let changed = false;
    for (const update of updates) {
      if (!update.id) continue;
      const jid = normalizeJid(update.id);
      const name = update.name || update.notify;
      const lid = update.lid ? normalizeJid(update.lid) : null;
      if (name && name.trim()) {
        const cleanName = name.trim();
        db.contacts[jid] = cleanName;
        if (lid) db.contacts[lid] = cleanName;
        if (jid && lid) {
          if (!db.lidMap) db.lidMap = {};
          db.lidMap[jid] = lid;
          db.lidMap[lid] = jid;
        }
        // Also patch chat name if it was still a raw number
        if (db.chats[update.id] && /^\d+$/.test(db.chats[update.id].name || '')) {
          db.chats[update.id].name = cleanName;
        }
        if (lid && db.chats[lid] && /^\d+$/.test(db.chats[lid].name || '')) {
          db.chats[lid].name = cleanName;
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
      const jid = normalizeJid(update.id);
      const isArch = update.archived !== undefined ? Boolean(update.archived) : (update.archive !== undefined ? Boolean(update.archive) : undefined);
      if (!db.chats[jid]) {
        db.chats[jid] = {
          chat_id: jid,
          name: update.name || db.contacts[jid] || formatJidNumber(jid),
          is_group: jid.endsWith('@g.us'),
          archived: isArch !== undefined ? isArch : false,
          locked: false,
          last_timestamp: 0
        };
        changed = true;
      }
      if (update.name) { db.chats[jid].name = update.name; changed = true; }
      if (isArch !== undefined) {
        db.chats[jid].archived = isArch;
        const linked = db.lidMap?.[jid];
        if (linked && db.chats[linked]) db.chats[linked].archived = isArch;
        changed = true;
      }
    }
    if (changed) writeDB(cleanPhone);
  });

  // Handle incoming new chats batch
  currentSock.ev.on('chats.upsert', (newChats) => {
    const db = readDB(cleanPhone);
    let changed = false;
    for (const ch of newChats) {
      if (!ch.id || ch.id === 'status@broadcast') return;
      const jid = normalizeJid(ch.id);
      const isArch = Boolean(ch.archived ?? ch.archive);
      if (!db.chats[jid]) {
        db.chats[jid] = {
          chat_id: jid,
          name: ch.name || db.contacts[jid] || formatJidNumber(jid),
          is_group: jid.endsWith('@g.us'),
          archived: isArch,
          locked: Boolean(ch.locked),
          last_timestamp: Number(ch.conversationTimestamp || 0)
        };
        changed = true;
      } else {
        if (ch.archived !== undefined || ch.archive !== undefined) {
          db.chats[jid].archived = isArch;
          const linked = db.lidMap?.[jid];
          if (linked && db.chats[linked]) db.chats[linked].archived = isArch;
          changed = true;
        }
        if (ch.name) { db.chats[jid].name = ch.name; changed = true; }
      }
    }
    if (changed) writeDB(cleanPhone);
  });

  currentSock.ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
    const db = readDB(cleanPhone);
    if (!db.lidMap) db.lidMap = {};

    if (contacts) {
      contacts.forEach((c) => {
        const jid = normalizeJid(c.id);
        const name = c.name || c.notify;
        const lid = c.lid ? normalizeJid(c.lid) : null;
        if (jid && name && name.trim()) db.contacts[jid] = name.trim();
        if (lid && name && name.trim()) db.contacts[lid] = name.trim();
        if (jid && lid) {
          db.lidMap[jid] = lid;
          db.lidMap[lid] = jid;
        }
      });
    }
    if (chats) {
      chats.forEach((ch) => {
        if (!ch.id || ch.id === 'status@broadcast') return;
        const jid = normalizeJid(ch.id);
        const resolvedName = ch.name || db.contacts[jid] || formatJidNumber(ch.id);
        const isArch = Boolean(ch.archived ?? ch.archive);
        db.chats[ch.id] = {
          chat_id: ch.id,
          name: resolvedName,
          is_group: ch.id.endsWith('@g.us'),
          archived: isArch,
          locked: Boolean(ch.locked),
          last_timestamp: Number(ch.conversationTimestamp || 0)
        };
        const linked = db.lidMap[ch.id];
        if (linked && db.chats[linked]) db.chats[linked].archived = isArch;
      });
    }
    // After contacts are loaded, run migration to back-fill stored message sender names
    migrateDB(cleanPhone);
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
      // Run migration on every connect to clean stale data from previous server versions
      migrateDB(cleanPhone);
      try { await currentSock.sendPresenceUpdate('unavailable'); } catch (_) {}

      // Keep presence subscriptions active for all tracked contacts
      const subscribeTracked = () => {
        if (!currentSock || connectionStatus !== 'connected') return;
        const db = readDB(cleanPhone);
        const presence = db.presence || {};
        for (const [tJid, data] of Object.entries(presence)) {
          if (data && data.isTracking) {
            try { currentSock.presenceSubscribe(tJid); } catch (_) {}
          }
        }
      };
      subscribeTracked();
      if (presencePollInterval) clearInterval(presencePollInterval);
      presencePollInterval = setInterval(subscribeTracked, 30000);
    }

    if (connection === 'close') {
      if (presencePollInterval) {
        clearInterval(presencePollInterval);
        presencePollInterval = null;
      }
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

app.get('/api/media/download', (req, res) => {
  const fileParam = req.query.file;
  const nameParam = req.query.name;
  if (!fileParam) return res.status(400).send('File parameter required');
  const sanitized = path.basename(fileParam);
  const full = path.join(MEDIA_DIR, sanitized);
  if (!fs.existsSync(full)) {
    return res.status(404).send('File not found');
  }
  res.download(full, nameParam || sanitized);
});

app.get('/api/status', (req, res) => {
  const users = getSavedUsers();
  const cfg = readConfig();

  const accounts = users.map((u) => {
    const credsFile = path.join(USERS_DIR, `auth_${u}`, 'creds.json');
    let registered = false;
    if (fs.existsSync(credsFile)) {
      try { registered = Boolean(JSON.parse(fs.readFileSync(credsFile, 'utf-8')).registered); } catch (_) {}
    }
    const dbFile = getDbPath(u);
    let msgCount = 0;
    let chatCount = 0;
    if (fs.existsSync(dbFile)) {
      try {
        const uDb = readDB(u);
        chatCount = Object.keys(uDb.chats || {}).length;
        for (const cid of Object.keys(uDb.messages || {})) {
          msgCount += (uDb.messages[cid]?.length || 0);
        }
      } catch (_) {}
    }
    return {
      phone: u,
      registered,
      chatCount,
      msgCount,
      isActive: u === activeUser,
      status: u === activeUser ? connectionStatus : (registered ? 'saved' : 'unregistered')
    };
  });

  res.json({
    activeUser,
    users,
    accounts,
    lastActiveUser: cfg.lastActiveUser,
    status: connectionStatus,
    pairingCode,
    lastError
  });
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
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  await startWhatsAppSession(cleanPhone, false);
  res.json({ ok: true });
});

app.post('/api/auth/logout', async (req, res) => {
  const targetPhone = (req.body?.phone || activeUser || '').replace(/[^0-9]/g, '');
  if (!targetPhone) {
    return res.status(400).json({ error: 'No phone provided to logout' });
  }

  console.log(`[WA-Shakti] Cleanly logging out profile: +${targetPhone}`);

  // Disconnect socket if this was the active session
  if (activeUser === targetPhone && sock) {
    try {
      sock.ev.removeAllListeners();
      sock.ws.close();
    } catch (_) {}
    sock = null;
    activeUser = null;
    connectionStatus = 'disconnected';
    pairingCode = null;
  }

  // Delete multi-file auth credentials folder
  const authFolder = getAuthPath(targetPhone);
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
    } catch (err) {
      console.error(`[WA-Shakti] Error deleting auth folder for +${targetPhone}:`, err.message);
    }
  }

  // If purgeData requested, wipe messages db too
  if (req.body?.purgeData) {
    const dbFile = getDbPath(targetPhone);
    if (fs.existsSync(dbFile)) {
      try { fs.unlinkSync(dbFile); } catch (_) {}
    }
    delete dbMemoryCache[targetPhone];
  }

  // Update last active user in config
  const remainingUsers = getSavedUsers();
  const nextUser = remainingUsers.find((u) => u !== targetPhone) || null;
  writeConfig({ lastActiveUser: nextUser });

  // Auto-switch to next saved user if available
  if (nextUser && !activeUser) {
    startWhatsAppSession(nextUser, false).catch(() => {});
  }

  res.json({
    ok: true,
    loggedOut: targetPhone,
    activeUser,
    users: remainingUsers
  });
});

app.post('/api/auth/delete', async (req, res) => {
  const targetPhone = (req.body?.phone || activeUser || '').replace(/[^0-9]/g, '');
  if (!targetPhone) return res.status(400).json({ error: 'Phone required' });

  console.log(`[WA-Shakti] Permanently deleting profile and local database: +${targetPhone}`);

  if (activeUser === targetPhone && sock) {
    try { sock.ev.removeAllListeners(); sock.ws.close(); } catch (_) {}
    sock = null;
    activeUser = null;
    connectionStatus = 'disconnected';
    pairingCode = null;
  }

  const authFolder = getAuthPath(targetPhone);
  if (fs.existsSync(authFolder)) {
    try { fs.rmSync(authFolder, { recursive: true, force: true }); } catch (_) {}
  }
  const dbFile = getDbPath(targetPhone);
  if (fs.existsSync(dbFile)) {
    try { fs.unlinkSync(dbFile); } catch (_) {}
  }
  delete dbMemoryCache[targetPhone];

  const remainingUsers = getSavedUsers();
  const nextUser = remainingUsers.find((u) => u !== targetPhone) || null;
  writeConfig({ lastActiveUser: nextUser });

  if (nextUser && !activeUser) {
    startWhatsAppSession(nextUser, false).catch(() => {});
  }

  res.json({ ok: true, deleted: targetPhone, activeUser, users: remainingUsers });
});

app.get('/api/chats', (req, res) => {
  if (!activeUser) return res.json([]);
  const db = readDB(activeUser);

  // Auto-discover any missing LID <-> Phone mappings and sync archived state
  autoDiscoverLidMappings(db);

  // Collect all known chat IDs from both messages and chats metadata
  const allChatIds = new Set([
    ...Object.keys(db.messages || {}),
    ...Object.keys(db.chats || {})
  ]);

  const seenUnifiedKeys = new Set();
  const chatList = [];

  for (const chatId of allChatIds) {
    if (!chatId || chatId === 'status@broadcast') continue;
    const cleanId = normalizeJid(chatId);
    const linkedId = db.lidMap?.[chatId] || db.lidMap?.[cleanId];
    const cleanLinked = linkedId ? normalizeJid(linkedId) : null;

    // Use a unified canonical key for this contact to prevent duplicate/split chats
    const canonicalKey = cleanId.endsWith('@s.whatsapp.net')
      ? cleanId
      : (cleanLinked || cleanId);

    if (seenUnifiedKeys.has(canonicalKey)) continue;
    seenUnifiedKeys.add(canonicalKey);
    if (cleanLinked) seenUnifiedKeys.add(cleanLinked);
    seenUnifiedKeys.add(cleanId);
    seenUnifiedKeys.add(chatId);

    // Group related IDs for this contact
    const relatedIds = new Set([chatId, cleanId]);
    if (linkedId) relatedIds.add(linkedId);
    if (cleanLinked) relatedIds.add(cleanLinked);

    // Merge messages from all related IDs
    let combinedMsgs = [];
    let isArchived = false;
    let isLocked = false;
    let loggingEnabled = true;
    let metaName = '';
    let lastMetaTimestamp = 0;

    for (const rId of relatedIds) {
      if (db.messages[rId]) {
        combinedMsgs = combinedMsgs.concat(db.messages[rId]);
      }
      const cMeta = db.chats[rId];
      if (cMeta) {
        if (cMeta.archived) isArchived = true;
        if (cMeta.locked) isLocked = true;
        if (cMeta.name && !/^\d+$/.test(cMeta.name)) metaName = cMeta.name;
        if ((cMeta.last_timestamp || 0) > lastMetaTimestamp) lastMetaTimestamp = cMeta.last_timestamp;
      }
      if (db.settings[rId] === false) loggingEnabled = false;
    }

    // Deduplicate messages by message ID
    const seenMsgIds = new Set();
    const uniqueMsgs = [];
    for (const m of combinedMsgs) {
      if (!seenMsgIds.has(m.id)) {
        seenMsgIds.add(m.id);
        uniqueMsgs.push(m);
      }
    }
    uniqueMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const lastMsg = uniqueMsgs.length > 0 ? uniqueMsgs[uniqueMsgs.length - 1] : null;
    const timestamp = lastMsg?.timestamp || lastMetaTimestamp || 0;

    // Resolve best display name
    let displayName =
      db.contacts[canonicalKey] ||
      (cleanLinked ? db.contacts[cleanLinked] : null) ||
      db.contacts[cleanId] ||
      metaName ||
      formatJidNumber(canonicalKey);

    if (/^\d+$/.test(displayName)) {
      const firstIncoming = uniqueMsgs.find((m) => !m.from_me && m.sender_name && !/^\d+$/.test(m.sender_name));
      if (firstIncoming) displayName = firstIncoming.sender_name;
    }

    let latestSender = lastMsg ? lastMsg.sender_name : '';
    if (lastMsg && !lastMsg.from_me) {
      const sJid = normalizeJid(lastMsg.sender_jid || '');
      const sLinked = db.lidMap?.[sJid];
      const betterLatest = db.contacts[sJid] || (sLinked ? db.contacts[sLinked] : null);
      if (betterLatest && !/^\d+$/.test(betterLatest)) latestSender = betterLatest;
    }

    const pEntry = db.presence?.[canonicalKey] || (cleanLinked ? db.presence?.[cleanLinked] : null) || db.presence?.[cleanId];
    const isOnline = pEntry ? (pEntry.lastKnownPresence === 'available' || pEntry.lastKnownPresence === 'composing') : false;

    // Active primary chat ID: preserve the ID that actively holds the intercepted messages
    const primaryChatId = uniqueMsgs.length > 0
      ? (db.messages[chatId]?.length > 0 ? chatId : (cleanLinked && db.messages[cleanLinked]?.length > 0 ? cleanLinked : canonicalKey))
      : canonicalKey;

    chatList.push({
      chat_id: primaryChatId,
      canonical_jid: canonicalKey,
      sender_name: displayName,
      latest_sender: latestSender,
      latest_text: lastMsg
        ? `${lastMsg.is_deleted ? '🚫 ' : ''}${lastMsg.latest_text}`
        : '(No messages intercepted yet)',
      timestamp: timestamp,
      message_count: uniqueMsgs.length,
      is_group: canonicalKey.endsWith('@g.us'),
      archived: isArchived,
      locked: isLocked,
      is_online: isOnline,
      is_tracking: Boolean(pEntry?.isTracking),
      logging_enabled: loggingEnabled
    });
  }

  chatList.sort((a, b) => b.timestamp - a.timestamp);
  res.json(chatList);
});

app.get('/api/chats/:chatId', (req, res) => {
  if (!activeUser) return res.json([]);
  const db = readDB(activeUser);
  const chatId = decodeURIComponent(req.params.chatId);
  const cleanId = normalizeJid(chatId);
  const linked = db.lidMap?.[chatId] || db.lidMap?.[cleanId];

  let rawMsgs = (db.messages[chatId] || []).slice();
  if (linked && db.messages[linked]) {
    rawMsgs = rawMsgs.concat(db.messages[linked]);
  }

  const seenIds = new Set();
  const unique = [];
  for (const m of rawMsgs) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      unique.push(m);
    }
  }
  unique.sort((a, b) => a.timestamp - b.timestamp);

  const resolved = unique.map((m) => {
    if (m.from_me) return m;
    const sJid = normalizeJid(m.sender_jid || '');
    const sLinked = db.lidMap?.[sJid];
    const betterName = db.contacts[sJid] || (sLinked ? db.contacts[sLinked] : null);
    if (betterName && !/^\d+$/.test(betterName) && betterName !== m.sender_name) {
      return { ...m, sender_name: betterName };
    }
    return m;
  });

  res.json(resolved);
});

app.post('/api/chats/archive', (req, res) => {
  if (!activeUser) return res.status(400).json({ error: 'No active user' });
  const { chat_id, archived } = req.body;
  if (!chat_id) return res.status(400).json({ error: 'chat_id required' });
  const db = readDB(activeUser);
  const isArch = Boolean(archived);
  const cleanId = normalizeJid(chat_id);
  const linked = db.lidMap?.[chat_id] || db.lidMap?.[cleanId];

  const keys = new Set([chat_id, cleanId]);
  if (linked) {
    keys.add(linked);
    keys.add(normalizeJid(linked));
  }

  for (const k of keys) {
    if (!db.chats[k]) {
      db.chats[k] = { chat_id: k, name: formatJidNumber(k), archived: isArch, locked: false, last_timestamp: 0 };
    } else {
      db.chats[k].archived = isArch;
    }
  }

  writeDB(activeUser, true);
  res.json({ ok: true, chat_id, archived: isArch });
});

app.post('/api/settings/toggle', (req, res) => {
  if (!activeUser) return res.status(400).json({ error: 'No active user' });
  const { chat_id, enable } = req.body;
  const db = readDB(activeUser);
  db.settings[chat_id] = Boolean(enable);
  writeDB(activeUser, true);
  res.json({ ok: true });
});

app.get('/api/settings/tracking-mode', (req, res) => {
  if (!activeUser) return res.json({ mode: 'passive' });
  const db = readDB(activeUser);
  const mode = db.settings?.tracking_mode || 'passive';
  res.json({ mode });
});

app.post('/api/settings/tracking-mode', (req, res) => {
  if (!activeUser) return res.status(400).json({ error: 'No active user' });
  const { mode } = req.body;
  const validMode = mode === 'live' ? 'live' : 'passive';
  const db = readDB(activeUser);
  if (!db.settings) db.settings = {};
  db.settings.tracking_mode = validMode;
  writeDB(activeUser, true);
  res.json({ ok: true, mode: validMode });
});

// Profile picture cache: jid → { path, fetchedAt }
const profilePicCache = {};

app.get('/api/profile-pic/:jid', async (req, res) => {
  if (!activeUser || !sock) return res.status(503).json({ error: 'Not connected' });
  const rawJid = decodeURIComponent(req.params.jid);
  const db = readDB(activeUser);

  // Try candidate JIDs: raw JID, normalized JID, linked JID from lidMap
  const candidates = [rawJid];
  const normalized = normalizeJid(rawJid);
  if (!candidates.includes(normalized)) candidates.push(normalized);

  const linked = db.lidMap?.[rawJid] || db.lidMap?.[normalized];
  if (linked && !candidates.includes(linked)) candidates.push(linked);

  // If this is an LID without a linked phone JID yet, look inside messages for the sender phone JID
  if (rawJid.endsWith('@lid') && !linked) {
    const msgs = db.messages[rawJid] || [];
    for (const m of msgs) {
      if (m.sender_jid && m.sender_jid.endsWith('@s.whatsapp.net')) {
        const pJid = normalizeJid(m.sender_jid);
        if (!candidates.includes(pJid)) candidates.push(pJid);
        break;
      }
    }
  }

  // Check if we already have a valid downloaded image on disk (size > 100 bytes)
  for (const candidate of candidates) {
    const fileName = `pfp_${candidate.replace(/[^a-z0-9]/gi, '_')}.jpg`;
    const filePath = path.join(MEDIA_DIR, fileName);
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > 100 && Date.now() - stats.mtimeMs < 7 * 86400000) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.sendFile(filePath);
        }
      } catch (_) {}
    }
  }

  let url = null;
  for (const candidate of candidates) {
    // 1. Try 'image' (high-res)
    try {
      url = await sock.profilePictureUrl(candidate, 'image', 5000);
      if (url) break;
    } catch (_) {}
    // 2. Fall back to 'preview' (thumbnail — available for almost all contacts with a photo)
    try {
      url = await sock.profilePictureUrl(candidate, 'preview', 5000);
      if (url) break;
    } catch (_) {}
  }

  if (!url) return res.status(404).json({ error: 'No pic' });

  try {
    const fileName = `pfp_${rawJid.replace(/[^a-z0-9]/gi, '_')}.jpg`;
    const filePath = path.join(MEDIA_DIR, fileName);

    // Use native Node.js fetch to seamlessly follow Facebook/WhatsApp CDN redirects
    const resp = await fetch(url);
    if (!resp.ok) return res.status(404).json({ error: 'Failed downloading from CDN' });

    const arrayBuf = await resp.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    if (buf.length < 100) return res.status(404).json({ error: 'Invalid image data' });

    fs.writeFileSync(filePath, buf);
    if (linked) {
      const linkedFileName = `pfp_${linked.replace(/[^a-z0-9]/gi, '_')}.jpg`;
      try { fs.writeFileSync(path.join(MEDIA_DIR, linkedFileName), buf); } catch (_) {}
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  } catch (err) {
    res.status(404).json({ error: 'Download error' });
  }
});

app.get('/api/presence/:jid', (req, res) => {
  if (!activeUser) return res.status(400).json({ error: 'No active user' });
  const rawJid = decodeURIComponent(req.params.jid);
  const clean = normalizeJid(rawJid);
  const db = readDB(activeUser);
  const linked = db.lidMap?.[clean];

  const entry = db.presence?.[clean] || (linked ? db.presence?.[linked] : null);
  const stats = getPresenceStats(entry);

  // If tracking is active and socket is connected, trigger a fresh presence subscription
  if (entry && entry.isTracking && sock && connectionStatus === 'connected') {
    try { sock.presenceSubscribe(clean); } catch (_) {}
    if (linked) {
      try { sock.presenceSubscribe(linked); } catch (_) {}
    }
  }

  res.json({
    jid: clean,
    ...stats
  });
});

app.post('/api/presence/track', async (req, res) => {
  if (!activeUser || !sock) return res.status(503).json({ error: 'Not connected' });
  const { jid, enable } = req.body;
  if (!jid) return res.status(400).json({ error: 'JID required' });
  const clean = normalizeJid(jid);
  const db = readDB(activeUser);
  if (!db.presence) db.presence = {};
  const linked = db.lidMap?.[clean];
  const keys = [clean];
  if (linked && !keys.includes(linked)) keys.push(linked);

  const shouldTrack = Boolean(enable);
  for (const key of keys) {
    if (!db.presence[key]) {
      db.presence[key] = {
        isTracking: shouldTrack,
        lastKnownPresence: 'unknown',
        lastSeen: null,
        lastUpdated: Math.floor(Date.now() / 1000),
        sessions: [],
        currentSessionStart: null
      };
    } else {
      db.presence[key].isTracking = shouldTrack;
    }
  }

  writeDB(activeUser, true);

  if (shouldTrack) {
    try { await sock.presenceSubscribe(clean); } catch (_) {}
    if (linked) {
      try { await sock.presenceSubscribe(linked); } catch (_) {}
    }
  }

  res.json({ ok: true, jid: clean, isTracking: shouldTrack });
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

  // Automatically reconnect to last active user profile on server startup
  try {
    const cfg = readConfig();
    const saved = getSavedUsers();
    const resumeTarget = (cfg.lastActiveUser && saved.includes(cfg.lastActiveUser))
      ? cfg.lastActiveUser
      : (saved.length > 0 ? saved[0] : null);

    if (resumeTarget) {
      console.log(`[WA-Shakti] Auto-resuming remembered profile on startup: +${resumeTarget}`);
      startWhatsAppSession(resumeTarget, false).catch((e) => {
        console.error('[WA-Shakti] Startup auto-resume error:', e.message);
      });
    }
  } catch (err) {
    console.error('[WA-Shakti] Startup auto-resume failed:', err.message);
  }
});
