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
