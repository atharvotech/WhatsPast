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

import React, { useState } from 'react';
import { API_BASE, getMediaDownloadUrl } from '../../api/client';
import { formatTime, formatFileSize } from '../../utils/format';
import Avatar from '../shared/Avatar';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import DocumentCard from './DocumentCard';

// Distinct colors for participant names in group messages
const SENDER_COLORS = [
  '#00a884', '#53bdeb', '#e5c07b', '#e06c75',
  '#98c379', '#c678dd', '#d19a66', '#4fa6e2'
];

function getSenderColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

function isInternalPlaceholder(text = '') {
  if (!text) return true;
  return /^(📷|🏷️|🎤|🎵|🎥|📄|📍|👤|👥)\s*\[.*\]$/.test(text.trim());
}

export default function MessageBubble({ msg }) {
  const [collapsedEdits, setCollapsedEdits] = useState(false);
  const hasEdits = msg.edit_history && msg.edit_history.length > 0;

  const showText =
    !hasEdits &&
    msg.latest_text &&
    msg.message_type !== 'sticker' &&
    msg.message_type !== 'document' &&
    !(msg.message_type === 'video' && isInternalPlaceholder(msg.latest_text)) &&
    !(msg.message_type === 'audio' && isInternalPlaceholder(msg.latest_text)) &&
    !(msg.message_type === 'image' && isInternalPlaceholder(msg.latest_text));

  const imageDownloadUrl = msg.media_path
    ? getMediaDownloadUrl(msg.media_path, `photo_${msg.id}.jpg`)
    : null;

  return (
    <div
      className={`flex items-end gap-2 my-1 animate-bubble ${
        msg.from_me ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Contact avatar on incoming messages */}
      {!msg.from_me && (
        <div className="shrink-0 mb-1 select-none">
          <Avatar jid={msg.sender_jid} name={msg.sender_name} size="8" />
        </div>
      )}

      {/* Bubble container */}
      <div
        className={`relative max-w-[88%] sm:max-w-[72%] md:max-w-[64%] rounded-2xl px-3 pt-2 pb-1.5 shadow-md text-sm transition-all duration-150 ${
          msg.is_deleted
            ? 'bg-red-950/70 border border-red-500/40 text-red-100 shadow-[0_2px_12px_rgba(239,68,68,0.15)]'
            : msg.from_me
            ? 'bg-[#005c4b] text-[#e9edef] rounded-br-sm shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
            : 'bg-[#202c33] text-[#e9edef] rounded-bl-sm border border-white/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
        }`}
      >
        {/* Sender name for received messages in group or direct */}
        {!msg.from_me && (
          <div className="flex items-center justify-between gap-2 mb-1 border-b border-white/[0.06] pb-1 select-none">
            <span
              className="font-bold text-[11.5px] truncate leading-tight"
              style={{ color: getSenderColor(msg.sender_name) }}
            >
              {msg.sender_name}
            </span>
            <span className="text-[10px] text-[#8696a0] font-mono truncate">
              {msg.sender_jid?.split('@')[0]}
            </span>
          </div>
        )}

        {/* Status badges */}
        {(msg.is_deleted || msg.is_view_once || hasEdits) && (
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap select-none">
            {msg.is_deleted && (
              <span className="text-[10px] bg-red-500/25 text-red-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-500/30">
                <span>🚫</span> DELETED MESSAGE
              </span>
            )}
            {msg.is_view_once && (
              <span className="text-[10px] bg-purple-500/25 text-purple-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-500/30">
                <span>👁️</span> VIEW-ONCE
              </span>
            )}
            {hasEdits && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/30">
                <span>✏️</span> EDITED ({msg.edit_history.length} versions)
              </span>
            )}
          </div>
        )}

        {/* ── Media display ── */}

        {/* Sticker */}
        {msg.message_type === 'sticker' && msg.media_path && (
          <div className="my-1">
            <img
              src={`${API_BASE}${msg.media_path}`}
              alt="Sticker"
              className="w-32 h-32 object-contain"
              loading="lazy"
            />
          </div>
        )}

        {/* Photo */}
        {msg.message_type === 'image' && (
          <div className="my-1.5 group/photo relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
            {msg.media_path ? (
              <>
                <a href={`${API_BASE}${msg.media_path}`} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={`${API_BASE}${msg.media_path}`}
                    alt="Intercepted photo"
                    className="max-h-80 w-full object-cover hover:scale-[1.015] transition duration-200"
                    loading="lazy"
                  />
                </a>
                {/* Photo quick download button */}
                {imageDownloadUrl && (
                  <a
                    href={imageDownloadUrl}
                    download={`photo_${msg.id}.jpg`}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-[#00a884] text-white opacity-0 group-hover/photo:opacity-100 transition shadow-lg backdrop-blur-sm"
                    title={`Download photo (${formatFileSize(msg.file_size)})`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                )}
              </>
            ) : (
              <div className="p-3 bg-[#2a3942] rounded-lg text-xs text-[#8696a0] flex items-center gap-2">
                <span>📷</span> Photo file unavailable on disk
              </div>
            )}
          </div>
        )}

        {/* Video Player */}
        {msg.message_type === 'video' && <VideoPlayer msg={msg} />}

        {/* Audio / Voice Note Player */}
        {msg.message_type === 'audio' && <AudioPlayer msg={msg} />}

        {/* Document / PDF Card & Reader */}
        {msg.message_type === 'document' && <DocumentCard msg={msg} />}

        {/* ── Text Content / Caption ── */}
        {showText && (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words select-text my-0.5">
            {msg.latest_text}
          </p>
        )}

        {/* ── Complete Edit History (shows EVERY single version) ── */}
        {hasEdits && (
          <div className="my-1.5 select-none">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-amber-400">
                Edit Revision Timeline:
              </span>
              <button
                onClick={() => setCollapsedEdits((v) => !v)}
                className="text-[10px] text-[#8696a0] hover:text-[#e9edef] underline transition"
              >
                {collapsedEdits ? 'Show all versions' : 'Collapse'}
              </button>
            </div>

            {!collapsedEdits ? (
              <div className="space-y-1.5 border-l-2 border-amber-500/40 pl-2.5">
                {msg.edit_history.map((rev, idx) => {
                  const isOriginal = idx === 0;
                  const isLatest = idx === msg.edit_history.length - 1;
                  const revTime = rev.time
                    ? new Date(rev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg transition ${
                        isLatest
                          ? 'bg-[#00a884]/15 border border-[#00a884]/30 shadow-sm'
                          : isOriginal
                          ? 'bg-black/25 border border-white/5'
                          : 'bg-amber-500/10 border border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isLatest
                              ? 'text-[#00a884]'
                              : isOriginal
                              ? 'text-[#8696a0]'
                              : 'text-amber-400'
                          }`}
                        >
                          {isOriginal
                            ? '1. Original Text'
                            : isLatest
                            ? `${idx + 1}. Latest Version`
                            : `${idx + 1}. Revision ${idx}`}
                        </span>
                        {revTime && <span className="text-[9.5px] text-[#8696a0] font-mono">{revTime}</span>}
                      </div>
                      <p
                        className={`text-[12.5px] leading-relaxed whitespace-pre-wrap break-words select-text ${
                          isOriginal && !isLatest ? 'text-[#8696a0] line-through' : 'text-[#e9edef]'
                        }`}
                      >
                        {rev.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-[#00a884]/15 border border-[#00a884]/30">
                <span className="text-[10px] font-bold text-[#00a884] block mb-0.5">
                  Latest Version:
                </span>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words select-text">
                  {msg.latest_text}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Timestamp + double checkmark ── */}
        <div className="flex items-center justify-end gap-1 mt-0.5 select-none opacity-85 hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-[#8696a0] font-mono">{formatTime(msg.timestamp)}</span>
          {msg.from_me && (
            <svg className="w-3.5 h-3.5 text-[#53bdeb]" viewBox="0 0 16 11" fill="currentColor">
              <path d="M11.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.085 0l-3-3.228A.75.75 0 1 1 1.59 4.516l2.456 2.64L10.01.678a.75.75 0 0 1 1.06-.025z" />
              <path d="M14.571.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.085 0L5.5 6.478a.75.75 0 1 1 1.1-1.02l1.013 1.09 5.897-6.87a.75.75 0 0 1 1.06-.025z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
