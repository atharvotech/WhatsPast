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
import { API_BASE } from '../../api/client';
import { formatTime } from '../../utils/format';

export default function MessageBubble({ msg }) {
  return (
    <div className={`flex flex-col ${msg.from_me ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[82%] md:max-w-[68%] rounded-lg p-2.5 shadow ${
          msg.is_deleted
            ? 'bg-red-950/60 border border-red-500/50'
            : msg.from_me
            ? 'bg-[#005c4b]'
            : 'bg-[#202c33]'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-1 border-b border-white/10 pb-1">
          <span className="text-[11px] font-bold text-[#00a884]">
            {msg.sender_name}{' '}
            <span className="font-normal text-[#8696a0]">
              ({msg.sender_jid?.split('@')[0]})
            </span>
          </span>
          <div className="flex items-center gap-1">
            {msg.is_view_once && (
              <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                👁️ VIEW-ONCE
              </span>
            )}
            {msg.is_deleted && (
              <span className="text-[10px] bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded font-semibold">
                🚫 DELETED
              </span>
            )}
          </div>
        </div>

        {msg.media_path && msg.message_type === 'sticker' && (
          <img
            src={`${API_BASE}${msg.media_path}`}
            alt="Sticker"
            className="w-32 h-32 object-contain my-1"
          />
        )}

        {msg.media_path && msg.message_type === 'image' && (
          <a
            href={`${API_BASE}${msg.media_path}`}
            target="_blank"
            rel="noreferrer"
            className="block my-1.5"
          >
            <img
              src={`${API_BASE}${msg.media_path}`}
              alt="Intercepted Media"
              className="max-h-72 rounded border border-white/10 object-cover"
            />
          </a>
        )}

        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">
          {msg.latest_text}
        </p>

        {msg.edit_history && msg.edit_history.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/15 bg-black/25 rounded p-2 space-y-1">
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
              ✏️ Edit Revision History ({msg.edit_history.length})
            </p>
            {msg.edit_history.map((rev, idx) => (
              <div key={idx} className="text-xs text-[#d1d7db] flex justify-between gap-3">
                <span className="select-text">
                  <strong className="text-[#8696a0]">Rev {idx + 1}:</strong> {rev.text}
                </span>
                <span className="text-[10px] text-[#8696a0] shrink-0">
                  {new Date(rev.time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="text-right mt-1">
          <span className="text-[10px] text-[#8696a0]">{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}
