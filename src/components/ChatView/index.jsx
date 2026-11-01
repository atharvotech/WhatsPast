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
import { useMessages } from '../../hooks/useMessages';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';

export default function ChatView() {
  const { selectedChatId } = useApp();
  const { messages } = useMessages(selectedChatId);

  return (
    <div
      className={`absolute inset-0 md:relative md:inset-auto flex flex-col flex-1 bg-[#0b141a] border-l border-white/[0.06] h-full overflow-hidden z-20 md:z-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selectedChatId
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : 'translate-x-full opacity-0 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto'
      }`}
    >
      {!selectedChatId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
          <div className="w-20 h-20 rounded-full bg-[#202c33] border border-white/5 flex items-center justify-center text-4xl mb-4 shadow-xl ring-1 ring-white/5">
            ⚡
          </div>
          <h2 className="text-xl font-bold text-[#e9edef] tracking-wide">WhatsPast Web</h2>
          <p className="text-[13px] text-[#8696a0] max-w-sm mt-2 leading-relaxed">
            Select a chat from the sidebar to inspect intercepted messages, recovered deleted texts,
            photos, videos, stickers, and complete edit history.
          </p>
          <div className="mt-8 flex items-center gap-1.5 text-[11px] text-[#8696a0]">
            <span>🔒</span>
            <span>Local &amp; End-to-end Decrypted Storage</span>
          </div>
        </div>
      ) : (
        <>
          <ChatHeader />
          <MessageList messages={messages} chatId={selectedChatId} />
        </>
      )}
    </div>
  );
}
