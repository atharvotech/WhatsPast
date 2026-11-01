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
import Avatar from '../shared/Avatar';

export default function ChatList() {
  const { filteredChats, selectedChatId, setSelectedChatId, activeTab } = useApp();

  if (filteredChats.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8 select-none">
        <div className="w-16 h-16 rounded-full bg-[#202c33] border border-white/5 flex items-center justify-center text-3xl shadow-lg">
          {activeTab === 'archived' ? '📦' : '💬'}
        </div>
        <p className="text-sm font-semibold text-[#e9edef]">
          {activeTab === 'archived' ? 'No archived chats' : 'No chats intercepted yet'}
        </p>
        <p className="text-xs text-[#8696a0] max-w-[220px] leading-relaxed">
          {activeTab === 'archived'
            ? 'Chats archived in WhatsApp or inside WhatsPast will stay organized here.'
            : 'Incoming and outgoing WhatsApp messages will appear here in real-time.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
      {filteredChats.map((chat) => {
        const isActive = selectedChatId === chat.chat_id;
        const isDeleted = chat.latest_text?.startsWith('🚫');

        return (
          <div
            key={chat.chat_id}
            onClick={() => setSelectedChatId(chat.chat_id)}
            className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-all duration-150 select-none relative group ${
              isActive
                ? 'bg-[#2a3942] border-l-[3.5px] border-[#00a884]'
                : 'hover:bg-[#202c33]/70 active:bg-[#202c33]'
            }`}
          >
            {/* Contact Avatar with online glow dot */}
            <div className="relative shrink-0">
              <Avatar jid={chat.chat_id} name={chat.sender_name} size="12" />
              {chat.is_online && (
                <span
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00a884] ring-2 ring-[#111b21] shadow-lg pulse-glow"
                  title="Online now"
                />
              )}
            </div>

            {/* Chat info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-[14px] text-[#e9edef] group-hover:text-white truncate flex items-center gap-1.5 leading-tight">
                  <span className="truncate">{chat.sender_name}</span>
                  {chat.is_group && (
                    <span className="text-[9.5px] bg-[#202c33] text-[#00a884] px-1.5 py-0.2 rounded font-medium border border-white/5 shrink-0">
                      Group
                    </span>
                  )}
                  {chat.archived && (
                    <span className="text-[10.5px] shrink-0" title="Archived">
                      📦
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] shrink-0 font-medium ${
                    chat.message_count > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'
                  }`}
                >
                  {formatTime(chat.timestamp)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-[12.5px] truncate flex-1 leading-normal ${
                    isDeleted ? 'text-red-400 font-medium italic' : 'text-[#8696a0]'
                  }`}
                >
                  {chat.latest_sender && !chat.is_group ? `${chat.latest_sender}: ` : ''}
                  {chat.latest_text}
                </p>

                {chat.message_count > 0 && (
                  <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                    {chat.message_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
