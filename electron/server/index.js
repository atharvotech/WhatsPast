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

// --- 1. WINDOWS NTFS LOCK SHIELDS ---
process.on('uncaughtException', (err) => {
    if (err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES')) {
        console.warn('[NTFS-Shield] Ignored transient file lock:', err.message);
        return;
    }
    console.error('[UncaughtException]', err);
});

process.on('unhandledRejection', (reason) => {
    if (reason && (reason.code === 'EPERM' || reason.code === 'EBUSY')) {
        console.warn('[NTFS-Shield] Ignored transient promise lock:', reason.message);
        return;
    }
    console.error('[UnhandledRejection]', reason);
});

// --- 2. WRITABLE STORAGE DIRECTORY RESOLVER ---
function getWritableBaseDir() {
    if (process.env.WA_DATA_DIR) return process.env.WA_DATA_DIR;
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, 'WA-Shakti-Data');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'WA-Shakti-Data');
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

// --- 3. IN-MEMORY DB CACHE & DEBOUNCED WRITER ---
const dbMemoryCache = {};
const dbWriteTimers = {};

function getDbPath(phone) {
    return path.join(USERS_DIR, `db_${phone}.json`);
}

function getAuthPath(phone) {
    return path.join(USERS_DIR, `auth_${phone}`);
}

function createEmptyDB() {
    return {
        chats: {},      // chatId -> { chat_id, name, archived, locked, is_group, last_timestamp }
        contacts: {},   // jid -> name
        messages: {},   // chatId -> [ messageObjects ]
        settings: {}    // chatId -> boolean (true = logging enabled)
    };
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
        } catch (e) {
            console.error(`[DB] Corrupted DB for ${phone}, initializing fresh cache.`);
        }
    }
    dbMemoryCache[phone] = createEmptyDB();
    return dbMemoryCache[phone];
}

function writeDB(phone, immediate = false) {
    if (!phone || !dbMemoryCache[phone]) return;

    const flushToDisk = () => {
        try {
            const file = getDbPath(phone);
            const tempFile = `${file}.tmp`;
            fs.writeFileSync(tempFile, JSON.stringify(dbMemoryCache[phone], null, 2), 'utf-8');
            fs.renameSync(tempFile, file);
        } catch (e) {
            try {
                fs.writeFileSync(getDbPath(phone), JSON.stringify(dbMemoryCache[phone], null, 2), 'utf-8');
            } catch (_) { }
        }
    };

    if (immediate) {
        if (dbWriteTimers[phone]) clearTimeout(dbWriteTimers[phone]);
        flushToDisk();
        return;
    }

    if (dbWriteTimers[phone]) clearTimeout(dbWriteTimers[phone]);
    dbWriteTimers[phone] = setTimeout(flushToDisk, 800);
}

// --- 4. MESSAGE UNWRAPPER & HELPERS ---
function unwrapMessage(message) {
    if (!message) return { content: null, isViewOnce: false };
    let isViewOnce = false;
    let curr = message;

    // Peel nested wrappers recursively
    for (let i = 0; i < 6; i++) {
        if (!curr) break;
        if (curr.ephemeralMessage?.message) {
            curr = curr.ephemeralMessage.message;
            continue;
        }
        if (curr.viewOnceMessage?.message) {
            isViewOnce = true;
            curr = curr.viewOnceMessage.message;
            continue;
        }
        if (curr.viewOnceMessageV2?.message) {
            isViewOnce = true;
            curr = curr.viewOnceMessageV2.message;
            continue;
        }
        if (curr.viewOnceMessageV2Extension?.message) {
            isViewOnce = true;
            curr = curr.viewOnceMessageV2Extension.message;
            continue;
        }
        if (curr.deviceSentMessage?.message) {
            curr = curr.deviceSentMessage.message;
            continue;
        }
        if (curr.documentWithCaptionMessage?.message) {
            curr = curr.documentWithCaptionMessage.message;
            continue;
        }
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

function normalizeJid(jid) {
    if (!jid) return '';
    return jid.replace(/:\d+@/, '@');
}

function formatJidNumber(jid) {
    if (!jid) return 'Unknown';
    return normalizeJid(jid).split('@')[0];
}

// --- 5. GLOBAL RUNTIME STATE ---
let sock = null;
let activeUser = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'pairing' | 'connected'
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
        if (name.startsWith('auth_')) phones.add(name.replace('auth_', ''));
        if (name.startsWith('db_') && name.endsWith('.json')) {
            phones.add(name.replace('db_', '').replace('.json', ''));
        }
    });
    return Array.from(phones);
}

function resolveSenderName(db, jid, pushName, fromMe) {
    const cleanJid = normalizeJid(jid);
    if (fromMe) return 'You';
    if (db.contacts[cleanJid]) return db.contacts[cleanJid];
    if (db.chats[cleanJid]?.name) return db.chats[cleanJid].name;
    if (pushName && pushName.trim()) {
        db.contacts[cleanJid] = pushName.trim();
        return pushName.trim();
    }
    return formatJidNumber(cleanJid);
}

// --- 6. SEQUENTIAL MESSAGE UPSERT PROCESSOR (HANDLES OFFLINE BURSTS) ---
let upsertQueue = Promise.resolve();

function enqueueMessagesUpsert(phone, upsertPayload, activeSock) {
    upsertQueue = upsertQueue
        .then(async () => {
            await processMessagesBatch(phone, upsertPayload, activeSock);
        })
        .catch((err) => console.error('[UpsertQueue Error]', err));
}

async function processMessagesBatch(phone, { messages, type }, activeSock) {
    if (!messages || !Array.isArray(messages)) return;
    const db = readDB(phone);
    let dbChanged = false;

    for (const msg of messages) {
        try {
            if (!msg.key || !msg.key.remoteJid) continue;
            const chatId = msg.key.remoteJid;
            if (chatId === 'status@broadcast') continue;

            // Respect per-chat logging mute toggle
            if (db.settings[chatId] === false) continue;

            const isGroup = chatId.endsWith('@g.us');
            const fromMe = Boolean(msg.key.fromMe);
            const rawSenderJid = isGroup
                ? msg.key.participant || msg.participant || (fromMe ? activeSock?.user?.id : chatId)
                : fromMe
                    ? activeSock?.user?.id || 'me'
                    : chatId;
            const senderJid = normalizeJid(rawSenderJid);
            const senderName = resolveSenderName(db, senderJid, msg.pushName, fromMe);

            const msgTimestamp = Number(msg.messageTimestamp || Math.floor(Date.now() / 1000));
            const isoTime = new Date(msgTimestamp * 1000).toISOString();

            // Ensure chat metadata exists
            if (!db.chats[chatId]) {
                db.chats[chatId] = {
                    chat_id: chatId,
                    name: isGroup ? formatJidNumber(chatId) : (!fromMe && msg.pushName ? msg.pushName : formatJidNumber(chatId)),
                    is_group: isGroup,
                    archived: false,
                    locked: chatId.endsWith('@lid'),
                    last_timestamp: msgTimestamp
                };
            } else {
                if (!isGroup && !fromMe && msg.pushName && db.chats[chatId].name === formatJidNumber(chatId)) {
                    db.chats[chatId].name = msg.pushName;
                }
                if (msgTimestamp > (db.chats[chatId].last_timestamp || 0)) {
                    db.chats[chatId].last_timestamp = msgTimestamp;
                }
            }

            if (!db.messages[chatId]) db.messages[chatId] = [];
            const chatMsgs = db.messages[chatId];

            const { content, isViewOnce } = unwrapMessage(msg.message);
            if (!content) continue;

            // --- CASE A: PROTOCOL MESSAGE (EDITS & ANTI-DELETE / REVOKE) ---
            const proto = content.protocolMessage;
            if (proto) {
                const targetId = proto.key?.id;

                // 1. Anti-Delete (REVOKE: type === 0)
                if (proto.type === 0 && targetId) {
                    let existing = chatMsgs.find((m) => m.id === targetId);
                    if (existing) {
                        existing.is_deleted = true;
                        existing.deleted_at = new Date().toISOString();
                    } else {
                        // Out-of-order offline guard: create stub if original wasn't stored
                        chatMsgs.push({
                            id: targetId,
                            chat_id: chatId,
                            sender_jid: senderJid,
                            sender_name: senderName,
                            from_me: fromMe,
                            message_type: 'text',
                            original_text: '[Deleted before initial sync completed]',
                            latest_text: '[Deleted before initial sync completed]',
                            edit_history: [],
                            is_deleted: true,
                            deleted_at: new Date().toISOString(),
                            is_view_once: false,
                            media_path: null,
                            timestamp: msgTimestamp
                        });
                    }
                    dbChanged = true;
                    continue;
                }

                // 2. Edit Interception (EDITED_MESSAGE: type === 14 or editedMessage field)
                if ((proto.type === 14 || proto.editedMessage) && targetId) {
                    const { content: editedInner } = unwrapMessage(proto.editedMessage);
                    const newText = extractTextFromContent(editedInner) || '[Edited Media/Empty]';
                    let existing = chatMsgs.find((m) => m.id === targetId);

                    if (existing) {
                        if (existing.latest_text !== newText) {
                            if (!existing.edit_history) existing.edit_history = [];
                            if (existing.edit_history.length === 0) {
                                existing.edit_history.push({
                                    text: existing.original_text,
                                    time: new Date(existing.timestamp * 1000).toISOString()
                                });
                            }
                            existing.edit_history.push({ text: newText, time: isoTime });
                            existing.latest_text = newText;
                        }
                    } else {
                        // Out-of-order offline stub
                        chatMsgs.push({
                            id: targetId,
                            chat_id: chatId,
                            sender_jid: senderJid,
                            sender_name: senderName,
                            from_me: fromMe,
                            message_type: 'text',
                            original_text: '[Original uncaptured — Edited while offline]',
                            latest_text: newText,
                            edit_history: [
                                { text: '[Original uncaptured]', time: isoTime },
                                { text: newText, time: isoTime }
                            ],
                            is_deleted: false,
                            is_view_once: false,
                            media_path: null,
                            timestamp: msgTimestamp
                        });
                    }
                    dbChanged = true;
                    continue;
                }
                continue;
            }

            // Also check messageStubType === 1 (REVOKE stub in some Baileys versions)
            if (msg.messageStubType === 1 && msg.key?.id) {
                let existing = chatMsgs.find((m) => m.id === msg.key.id);
                if (existing) {
                    existing.is_deleted = true;
                    existing.deleted_at = new Date().toISOString();
                    dbChanged = true;
                }
                continue;
            }

            // --- CASE B: STANDARD / MEDIA / VIEW-ONCE MESSAGE ---
            const msgId = msg.key.id;
            let existingMsg = chatMsgs.find((m) => m.id === msgId);

            let messageType = 'text';
            let mediaPath = null;
            let textContent = extractTextFromContent(content);

            // Image Extraction (Standard + View-Once)
            if (content.imageMessage) {
                messageType = 'image';
                const fileName = `img_${phone}_${msgId}.jpg`;
                const fullPath = path.join(MEDIA_DIR, fileName);
                if (!fs.existsSync(fullPath)) {
                    try {
                        const buffer = await downloadMediaMessage(
                            msg,
                            'buffer',
                            {},
                            { logger: pino({ level: 'silent' }), reuploadRequest: activeSock?.updateMediaMessage }
                        );
                        fs.writeFileSync(fullPath, buffer);
                        mediaPath = `/media/${fileName}`;
                    } catch (dlErr) {
                        console.warn(`[Media] Could not download image ${msgId}:`, dlErr.message);
                    }
                } else {
                    mediaPath = `/media/${fileName}`;
                }
                if (!textContent) textContent = isViewOnce ? '👁️ [View-Once Photo]' : '📷 [Photo]';
            }
            // Sticker Extraction (.webp)
            else if (content.stickerMessage) {
                messageType = 'sticker';
                const fileName = `stk_${phone}_${msgId}.webp`;
                const fullPath = path.join(MEDIA_DIR, fileName);
                if (!fs.existsSync(fullPath)) {
                    try {
                        const buffer = await downloadMediaMessage(
                            msg,
                            'buffer',
                            {},
                            { logger: pino({ level: 'silent' }), reuploadRequest: activeSock?.updateMediaMessage }
                        );
                        fs.writeFileSync(fullPath, buffer);
                        mediaPath = `/media/${fileName}`;
                    } catch (dlErr) {
                        console.warn(`[Media] Could not download sticker ${msgId}:`, dlErr.message);
                    }
                } else {
                    mediaPath = `/media/${fileName}`;
                }
                textContent = '🏷️ [Sticker]';
            }
            // Audio / Video / Document Fallbacks
            else if (content.videoMessage) {
                messageType = 'video';
                if (!textContent) textContent = isViewOnce ? '👁️ [View-Once Video]' : '🎥 [Video]';
            } else if (content.audioMessage) {
                messageType = 'audio';
                textContent = content.audioMessage.ptt ? '🎤 [Voice Note]' : '🎵 [Audio]';
            } else if (content.documentMessage) {
                messageType = 'document';
                textContent = `📄 ${content.documentMessage.fileName || '[Document]'}`;
            }

            if (!textContent && !mediaPath) continue;

            if (existingMsg) {
                // If an out-of-order edit stub arrived earlier, backfill the original message!
                if (existingMsg.original_text.startsWith('[Original uncaptured')) {
                    existingMsg.original_text = textContent;
                    if (existingMsg.edit_history?.length > 0) {
                        existingMsg.edit_history[0].text = textContent;
                    }
                }
                if (mediaPath && !existingMsg.media_path) existingMsg.media_path = mediaPath;
            } else {
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
            }

            dbChanged = true;
        } catch (innerErr) {
            console.error('[MessageParse Error]', innerErr);
        }
    }

    if (dbChanged) writeDB(phone);
}

// --- 7. BAILEYS SOCKET INITIALIZER ---
async function startWhatsAppSession(phone, requestNewPairingCode = false) {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (sock) {
        try {
            sock.ev.removeAllListeners();
            sock.ws.close();
        } catch (_) { }
        sock = null;
    }

    activeUser = cleanPhone;
    connectionStatus = 'connecting';
    lastError = null;
    isPairingMode = requestNewPairingCode;
    pairingCodeRequested = false;
    if (requestNewPairingCode) pairingCode = null;

    const authFolder = getAuthPath(cleanPhone);
    if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // Sequential Promise Queue for creds.json to prevent Windows NTFS EPERM crash
    let credsQueue = Promise.resolve();
    const safeSaveCreds = () => {
        credsQueue = credsQueue
            .then(async () => {
                await saveCreds();
            })
            .catch((err) => {
                console.warn('[safeSaveCreds] Transient lock ignored:', err.message);
            });
    };

    let version = [2, 3000, 1015901307];
    try {
        const latest = await fetchLatestBaileysVersion();
        version = latest.version;
    } catch (_) {
        console.log('[WA-Shakti] Using fallback WhatsApp Web version:', version);
    }

    const currentSock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS('Chrome'),
        syncFullHistory: true,
        markOnlineOnConnect: false, // Prevents muting phone push notifications!
        generateHighQualityLinkPreview: false
    });

    sock = currentSock;

    currentSock.ev.on('creds.update', safeSaveCreds);

    // Contacts & History Sync Listeners
    currentSock.ev.on('contacts.upsert', (contacts) => {
        const db = readDB(cleanPhone);
        contacts.forEach((c) => {
            const jid = normalizeJid(c.id);
            const name = c.name || c.notify || c.verifiedName;
            if (jid && name) {
                db.contacts[jid] = name;
                if (db.chats[jid] && !jid.endsWith('@g.us')) db.chats[jid].name = name;
            }
        });
        writeDB(cleanPhone);
    });

    currentSock.ev.on('contacts.update', (updates) => {
        const db = readDB(cleanPhone);
        updates.forEach((c) => {
            const jid = normalizeJid(c.id);
            const name = c.name || c.notify || c.verifiedName;
            if (jid && name) {
                db.contacts[jid] = name;
                if (db.chats[jid] && !jid.endsWith('@g.us')) db.chats[jid].name = name;
            }
        });
        writeDB(cleanPhone);
    });

    currentSock.ev.on('chats.upsert', (chats) => {
        const db = readDB(cleanPhone);
        chats.forEach((ch) => {
            if (!ch.id || ch.id === 'status@broadcast') return;
            const existing = db.chats[ch.id] || {
                chat_id: ch.id,
                name: ch.name || db.contacts[normalizeJid(ch.id)] || formatJidNumber(ch.id),
                is_group: ch.id.endsWith('@g.us'),
                archived: false,
                locked: ch.id.endsWith('@lid'),
                last_timestamp: Number(ch.conversationTimestamp || 0)
            };
            if (ch.name) existing.name = ch.name;
            if (typeof ch.archived === 'boolean') existing.archived = ch.archived;
            if (typeof ch.locked === 'boolean' || ch.id.endsWith('@lid')) {
                existing.locked = Boolean(ch.locked || ch.id.endsWith('@lid'));
            }
            db.chats[ch.id] = existing;
        });
        writeDB(cleanPhone);
    });

    currentSock.ev.on('chats.update', (updates) => {
        const db = readDB(cleanPhone);
        updates.forEach((u) => {
            if (!u.id || !db.chats[u.id]) return;
            if (typeof u.archived === 'boolean') db.chats[u.id].archived = u.archived;
            if (typeof u.locked === 'boolean') db.chats[u.id].locked = u.locked;
            if (u.name) db.chats[u.id].name = u.name;
        });
        writeDB(cleanPhone);
    });

    currentSock.ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
        const db = readDB(cleanPhone);
        if (contacts) {
            contacts.forEach((c) => {
                const jid = normalizeJid(c.id);
                const name = c.name || c.notify;
                if (jid && name) db.contacts[jid] = name;
            });
        }
        if (chats) {
            chats.forEach((ch) => {
                if (!ch.id || ch.id === 'status@broadcast') return;
                db.chats[ch.id] = {
                    chat_id: ch.id,
                    name: ch.name || db.contacts[normalizeJid(ch.id)] || formatJidNumber(ch.id),
                    is_group: ch.id.endsWith('@g.us'),
                    archived: Boolean(ch.archived),
                    locked: Boolean(ch.locked || ch.id.endsWith('@lid')),
                    last_timestamp: Number(ch.conversationTimestamp || 0)
                };
            });
        }
        writeDB(cleanPhone);
        if (messages && messages.length > 0) {
            enqueueMessagesUpsert(cleanPhone, { messages, type: 'history' }, currentSock);
        }
    });

    // Live + Offline Queue ('append') Message Listener
    currentSock.ev.on('messages.upsert', (payload) => {
        enqueueMessagesUpsert(cleanPhone, payload, currentSock);
    });

    // Connection & Pairing Code Lifecycle
    currentSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (
            isPairingMode &&
            !currentSock.authState.creds.registered &&
            !pairingCodeRequested &&
            (connection === 'connecting' || qr)
        ) {
            pairingCodeRequested = true;
            connectionStatus = 'pairing';
            setTimeout(async () => {
                try {
                    if (sock !== currentSock) return;
                    const code = await currentSock.requestPairingCode(cleanPhone);
                    pairingCode = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(`[WA-Shakti] Pairing Code for ${cleanPhone}: ${pairingCode}`);
                } catch (err) {
                    lastError = `Pairing Error: ${err.message}`;
                    pairingCodeRequested = false;
                }
            }, 1500);
        }

        if (connection === 'open') {
            connectionStatus = 'connected';
            pairingCode = null;
            isPairingMode = false;
            lastError = null;
            console.log(`[WA-Shakti] Connected as ${cleanPhone}`);

            // Keep phone notifications active by signaling unavailable presence
            try {
                await currentSock.sendPresenceUpdate('unavailable');
            } catch (_) { }

            // Fetch group subject names
            try {
                const groups = await currentSock.groupFetchAllParticipating();
                const db = readDB(cleanPhone);
                Object.values(groups).forEach((g) => {
                    if (g.id && g.subject) {
                        if (!db.chats[g.id]) {
                            db.chats[g.id] = {
                                chat_id: g.id,
                                name: g.subject,
                                is_group: true,
                                archived: false,
                                locked: false,
                                last_timestamp: 0
                            };
                        } else {
                            db.chats[g.id].name = g.subject;
                        }
                    }
                });
                writeDB(cleanPhone);
            } catch (_) { }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message || 'Connection closed';
            console.log(`[WA-Shakti] Connection closed (${statusCode}): ${reason}`);

            if (statusCode === DisconnectReason.loggedOut) {
                connectionStatus = 'disconnected';
                pairingCode = null;
                lastError = 'Session logged out from primary phone. Re-pair required.';
                try {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                } catch (_) { }
                return;
            }

            // Status 515 (restartRequired) immediately after pairing code acceptance
            if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
                console.log('[WA-Shakti] Restart required after pairing (515), reconnecting...');
                reconnectTimer = setTimeout(() => startWhatsAppSession(cleanPhone, false), 1500);
                return;
            }

            // Standard auto-reconnect with 3.5s backoff
            connectionStatus = 'connecting';
            reconnectTimer = setTimeout(() => {
                startWhatsAppSession(cleanPhone, isPairingMode && !currentSock.authState.creds.registered);
            }, 3500);
        }
    });
}

// --- 8. EXPRESS API SERVER (127.0.0.1:3000) ---
const app = express();
app.use(cors());
app.use(express.json());
app.use('/media', express.static(MEDIA_DIR));

app.get('/api/status', (req, res) => {
    res.json({
        activeUser,
        users: getSavedUsers(),
        status: connectionStatus,
        pairingCode,
        lastError,
        dataDir: BASE_DATA_DIR
    });
});

app.post('/api/auth/login', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number with country code is required' });
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // If re-pairing an unauthenticated folder, clear stale creds first
    const authFolder = getAuthPath(cleanPhone);
    const credsFile = path.join(authFolder, 'creds.json');
    if (fs.existsSync(credsFile)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
            if (!creds.registered) fs.rmSync(authFolder, { recursive: true, force: true });
        } catch (_) { }
    }

    await startWhatsAppSession(cleanPhone, true);
    res.json({ ok: true, activeUser: cleanPhone });
});

app.post('/api/auth/switch', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    await startWhatsAppSession(cleanPhone, false);
    res.json({ ok: true, activeUser: cleanPhone });
});

app.get('/api/chats', (req, res) => {
    if (!activeUser) return res.json([]);
    const db = readDB(activeUser);

    const chatList = Object.keys(db.messages)
        .map((chatId) => {
            const msgs = db.messages[chatId] || [];
            if (msgs.length === 0 && !db.chats[chatId]) return null;
            const lastMsg = msgs[msgs.length - 1];
            const meta = db.chats[chatId] || {};
            const isGroup = chatId.endsWith('@g.us');

            const displayName =
                meta.name ||
                db.contacts[normalizeJid(chatId)] ||
                (!isGroup && lastMsg && !lastMsg.from_me ? lastMsg.sender_name : null) ||
                formatJidNumber(chatId);

            return {
                chat_id: chatId,
                sender_name: displayName,
                latest_sender: lastMsg ? lastMsg.sender_name : '',
                latest_text: lastMsg
                    ? `${lastMsg.is_deleted ? '🚫 ' : ''}${lastMsg.latest_text}`
                    : 'No messages logged yet',
                timestamp: lastMsg ? lastMsg.timestamp : meta.last_timestamp || 0,
                message_count: msgs.length,
                is_group: isGroup,
                archived: Boolean(meta.archived),
                locked: Boolean(meta.locked || chatId.endsWith('@lid')),
                logging_enabled: db.settings[chatId] !== false
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.timestamp - a.timestamp);

    res.json(chatList);
});

app.get('/api/chats/:chatId', (req, res) => {
    if (!activeUser) return res.json([]);
    const db = readDB(activeUser);
    const chatId = decodeURIComponent(req.params.chatId);
    const msgs = db.messages[chatId] || [];
    res.json(msgs.slice().sort((a, b) => a.timestamp - b.timestamp));
});

app.post('/api/settings/toggle', (req, res) => {
    if (!activeUser) return res.status(400).json({ error: 'No active user' });
    const { chat_id, enable } = req.body;
    const db = readDB(activeUser);
    db.settings[chat_id] = Boolean(enable);
    writeDB(activeUser, true);
    res.json({ ok: true, chat_id, logging_enabled: db.settings[chat_id] });
});

app.post('/api/storage/clear', (req, res) => {
    if (!activeUser) return res.status(400).json({ error: 'No active user' });
    const db = readDB(activeUser);
    db.messages = {};
    writeDB(activeUser, true);

    if (fs.existsSync(MEDIA_DIR)) {
        fs.readdirSync(MEDIA_DIR).forEach((file) => {
            if (file.includes(`_${activeUser}_`)) {
                try {
                    fs.unlinkSync(path.join(MEDIA_DIR, file));
                } catch (_) { }
            }
        });
    }
    res.json({ ok: true });
});

const PORT = 3000;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`[WA-Shakti] Backend listening on http://127.0.0.1:${PORT}`);
    const existingUsers = getSavedUsers();
    if (existingUsers.length > 0) {
        const firstRegistered = existingUsers.find((u) => {
            const credsFile = path.join(getAuthPath(u), 'creds.json');
            if (!fs.existsSync(credsFile)) return false;
            try {
                return JSON.parse(fs.readFileSync(credsFile, 'utf-8')).registered;
            } catch (_) {
                return false;
            }
        });
        if (firstRegistered) {
            console.log(`[WA-Shakti] Auto-booting saved session for ${firstRegistered}`);
            startWhatsAppSession(firstRegistered, false);
        }
    }
});