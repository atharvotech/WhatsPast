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
    <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-[#0b141a]`}>
      {!selectedChatId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center text-3xl mb-3">
            🛡️
          </div>
          <h2 className="text-lg font-semibold text-[#e9edef]">WA Shakti Interceptor Ready</h2>
          <p className="text-xs text-[#8696a0] max-w-md mt-1">
            Captures real-time &amp; offline-queued messages, full edit revisions, deleted messages
            (Anti-Revoke), View-Once photos, stickers, and locked/archived chats.
          </p>
        </div>
      ) : (
        <>
          <ChatHeader />
          <MessageList messages={messages} />
        </>
      )}
    </div>
  );
}
