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

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getPresence } from '../../api/client';
import Avatar from '../shared/Avatar';
import PresenceModal from '../Modals/PresenceModal';

function formatDuration(seconds = 0) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  return `${mins}m`;
}

function formatLastSeen(ts) {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? `today at ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

export default function ChatHeader() {
  const {
    selectedChatId,
    setSelectedChatId,
    activeChatObj,
    handleToggleChatLogging,
    handleToggleArchiveChat
  } = useApp();

  const [presence, setPresence] = useState(null);
  const [showPresenceModal, setShowPresenceModal] = useState(false);

  const jidNum = selectedChatId?.split('@')[0] || '';
  const isGroup = activeChatObj?.is_group;
  const isArchived = Boolean(activeChatObj?.archived);

  // Poll presence status for the active contact
  useEffect(() => {
    if (!selectedChatId || isGroup) {
      setPresence(null);
      return;
    }

    let isMounted = true;
    const fetchPresence = async () => {
      const res = await getPresence(selectedChatId);
      if (isMounted && res) setPresence(res);
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedChatId, isGroup]);

  const isOnline = presence?.status === 'online';

  const handleBack = () => {
    if (window.history.state?.chatId) {
      window.history.back();
    } else {
      setSelectedChatId(null);
    }
  };

  return (
    <div className="px-3 sm:px-4 py-2.5 glass-header border-b border-white/[0.06] flex items-center justify-between gap-2 sm:gap-3 shadow-md select-none z-10 shrink-0">
      {/* Left: back button (mobile) + avatar + name + status */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={handleBack}
          className="md:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-full hover:bg-[#2a3942] active:bg-[#32424b] text-[#aebac1] transition shrink-0"
          title="Back to chat list"
          aria-label="Back to chat list"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div onClick={() => !isGroup && setShowPresenceModal(true)} className="cursor-pointer shrink-0">
          <Avatar jid={selectedChatId} name={activeChatObj?.sender_name || jidNum} size="10" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3
              onClick={() => !isGroup && setShowPresenceModal(true)}
              className="font-semibold text-[14px] text-[#e9edef] truncate leading-tight cursor-pointer hover:underline"
            >
              {activeChatObj?.sender_name || jidNum}
            </h3>
            {isArchived && (
              <span className="text-[10px] bg-[#111b21] text-[#8696a0] px-1.5 py-0.2 rounded-full border border-white/5 shrink-0">
                Archived
              </span>
            )}
          </div>

          {/* Subtitle: Live Presence (Online / Last Seen / Messages logged) */}
          <div className="flex items-center gap-1.5 text-[11px] truncate leading-tight mt-0.5">
            {isGroup ? (
              <span className="text-[#8696a0]">Group · {jidNum}</span>
            ) : isOnline ? (
              <span className="text-[#00a884] font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse" />
                online
              </span>
            ) : presence?.lastSeen ? (
              <span className="text-[#8696a0]">last seen {formatLastSeen(presence.lastSeen)}</span>
            ) : (
              <span className="text-[#8696a0]">{jidNum}</span>
            )}

            {/* Quick Online duration badge if contact was tracked */}
            {!isGroup && presence?.todayOnlineSeconds > 0 && (
              <button
                onClick={() => setShowPresenceModal(true)}
                className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-[#111b21] text-[#00a884] px-1.5 py-0.2 rounded border border-[#00a884]/30 hover:bg-[#00a884]/10 transition"
                title="Total online time logged today"
              >
                <span>🕒 {formatDuration(presence.todayOnlineSeconds)}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right actions: Track Presence + Archive toggle + Logging toggle */}
      {activeChatObj && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Track Presence Button (Direct Message Chats) */}
          {!isGroup && (
            <button
              onClick={() => setShowPresenceModal(true)}
              className={`flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full font-medium transition ${
                presence?.isTracking
                  ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40 hover:bg-[#00a884]/30'
                  : 'bg-[#111b21] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] border border-white/5'
              }`}
              title="Track online hours & last seen status"
            >
              <span>{presence?.isTracking ? '📡' : '🕒'}</span>
              <span className="hidden sm:inline">
                {presence?.isTracking ? 'Tracking' : 'Track'}
              </span>
            </button>
          )}

          {/* Archive / Unarchive toggle */}
          <button
            onClick={() => handleToggleArchiveChat(activeChatObj.chat_id, isArchived)}
            className={`flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full font-medium transition ${
              isArchived
                ? 'bg-[#2a3942] text-[#00a884] hover:bg-[#32424b]'
                : 'bg-[#111b21] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] border border-white/5'
            }`}
            title={isArchived ? 'Move to All Chats' : 'Move to Archived Chats'}
          >
            <span>📦</span>
            <span className="hidden sm:inline">{isArchived ? 'Unarchive' : 'Archive'}</span>
          </button>

          {/* Logging ON / Muted toggle */}
          <button
            onClick={() => handleToggleChatLogging(activeChatObj.chat_id, activeChatObj.logging_enabled)}
            className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-full font-medium transition ${
              activeChatObj.logging_enabled
                ? 'bg-[#00a884]/15 text-[#00a884] hover:bg-[#00a884]/25 border border-[#00a884]/30'
                : 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
            }`}
            title={activeChatObj.logging_enabled ? 'Mute logging for this chat' : 'Enable logging for this chat'}
          >
            <span className={`w-2 h-2 rounded-full ${activeChatObj.logging_enabled ? 'bg-[#00a884]' : 'bg-red-400'}`} />
            <span className="hidden sm:inline">{activeChatObj.logging_enabled ? 'Logging ON' : 'Muted'}</span>
          </button>
        </div>
      )}

      {/* Online Hours / Presence Stats Modal */}
      {showPresenceModal && selectedChatId && (
        <PresenceModal
          jid={selectedChatId}
          name={activeChatObj?.sender_name || jidNum}
          onClose={() => setShowPresenceModal(false)}
        />
      )}
    </div>
  );
}
