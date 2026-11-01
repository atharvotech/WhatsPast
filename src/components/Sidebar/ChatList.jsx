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

import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatTime } from '../../utils/format';

export default function ChatList() {
  const { filteredChats, selectedChatId, setSelectedChatId } = useApp();

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/60">
      {filteredChats.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#8696a0]">
          No intercepted chats in this tab yet.
        </div>
      ) : (
        filteredChats.map((chat) => (
          <div
            key={chat.chat_id}
            onClick={() => setSelectedChatId(chat.chat_id)}
            className={`p-3 flex items-center justify-between cursor-pointer hover:bg-[#202c33]/70 transition ${
              selectedChatId === chat.chat_id ? 'bg-[#2a3942]' : ''
            }`}
          >
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate">{chat.sender_name}</span>
                {chat.is_group && (
                  <span className="text-[10px] bg-[#202c33] text-[#00a884] px-1.5 py-0.5 rounded">
                    GROUP
                  </span>
                )}
                {chat.locked && <span className="text-xs">🔒</span>}
                {chat.archived && <span className="text-xs">📦</span>}
              </div>
              <p className="text-xs text-[#8696a0] truncate mt-0.5">
                {chat.latest_sender ? `${chat.latest_sender}: ` : ''}
                {chat.latest_text}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-[#8696a0]">{formatTime(chat.timestamp)}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  chat.logging_enabled
                    ? 'bg-[#00a884]/20 text-[#00a884]'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {chat.logging_enabled ? `${chat.message_count} logs` : 'Muted'}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
