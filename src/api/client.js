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

export const API_BASE = 'http://127.0.0.1:3000';

export function getMediaDownloadUrl(mediaPath, fileName) {
  if (!mediaPath) return '';
  const cleanPath = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
  return `${API_BASE}/api/media/download?file=${encodeURIComponent(cleanPath)}&name=${encodeURIComponent(fileName || '')}`;
}

export async function getStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function getChats() {
  try {
    const res = await fetch(`${API_BASE}/api/chats`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function getChatMessages(chatId) {
  try {
    const res = await fetch(`${API_BASE}/api/chats/${encodeURIComponent(chatId)}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function loginPhone(phone) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function switchAccount(phone) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function logoutAccount(phone, purgeData = false) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, purgeData })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function deleteAccount(phone) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function toggleChatLogging(chatId, enable) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, enable })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function archiveChat(chatId, archived) {
  try {
    const res = await fetch(`${API_BASE}/api/chats/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, archived })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function getPresence(jid) {
  try {
    const res = await fetch(`${API_BASE}/api/presence/${encodeURIComponent(jid)}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function trackPresence(jid, enable) {
  try {
    const res = await fetch(`${API_BASE}/api/presence/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jid, enable })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function getTrackingMode() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/tracking-mode`);
    return await res.json();
  } catch (e) {
    return { mode: 'passive' };
  }
}

export async function setTrackingMode(mode) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/tracking-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function clearStorage() {
  try {
    const res = await fetch(`${API_BASE}/api/storage/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}
