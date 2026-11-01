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

export default function ChatHeader() {
  const { selectedChatId, setSelectedChatId, activeChatObj, handleToggleChatLogging } = useApp();

  return (
    <div className="p-3 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setSelectedChatId(null)}
          className="md:hidden text-sm px-2 py-1 rounded bg-[#2a3942]"
        >
          &larr;
        </button>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">
            {activeChatObj?.sender_name || selectedChatId}
          </h3>
          <p className="text-[11px] text-[#8696a0] truncate">{selectedChatId}</p>
        </div>
      </div>

      {activeChatObj && (
        <button
          onClick={() =>
            handleToggleChatLogging(activeChatObj.chat_id, activeChatObj.logging_enabled)
          }
          className={`text-xs px-3 py-1.5 rounded font-medium transition ${
            activeChatObj.logging_enabled
              ? 'bg-[#00a884] text-[#0b141a]'
              : 'bg-red-500/20 text-red-400 border border-red-500/40'
          }`}
        >
          {activeChatObj.logging_enabled ? '● Logging ON' : '○ Logging Muted'}
        </button>
      )}
    </div>
  );
}
