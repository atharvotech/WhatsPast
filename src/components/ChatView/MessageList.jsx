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

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { formatDate } from '../../utils/format';

function DateSeparator({ timestamp }) {
  const d = new Date(timestamp * 1000);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  let label;
  if (diffDays === 0) label = 'Today';
  else if (diffDays === 1) label = 'Yesterday';
  else label = formatDate(timestamp);

  return (
    <div className="flex items-center justify-center my-3 select-none">
      <span className="bg-[#182229]/95 text-[#8696a0] text-[11px] font-medium px-3.5 py-1 rounded-full shadow border border-white/5">
        {label}
      </span>
    </div>
  );
}

export default function MessageList({ messages = [], chatId }) {
  const containerRef = useRef(null);
  const currentChatIdRef = useRef(chatId);
  const prevMsgCountRef = useRef(messages.length);
  const isNearBottomRef = useRef(true);

  const [isReady, setIsReady] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [unreadNewCount, setUnreadNewCount] = useState(0);

  // Instant positioning when chat opens or changes (zero top-to-bottom scroll jank)
  useLayoutEffect(() => {
    const isNewChat = currentChatIdRef.current !== chatId;
    if (isNewChat) {
      currentChatIdRef.current = chatId;
      setIsReady(false);
      prevMsgCountRef.current = 0;
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setUnreadNewCount(0);
    }

    if (containerRef.current && messages.length > 0) {
      // Force instantaneous jump to the bottom before paint
      containerRef.current.scrollTop = containerRef.current.scrollHeight;

      // Reveal container on next micro-tick after pinning scroll
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
        setIsReady(true);
      });
    } else if (messages.length === 0) {
      setIsReady(true);
    }
  }, [chatId, messages.length > 0]);

  // Handle incoming messages while chat is open
  useEffect(() => {
    if (!isReady || !containerRef.current) return;

    const countDiff = messages.length - prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;

    if (countDiff > 0) {
      if (isNearBottomRef.current) {
        // User is currently at the bottom: smoothly glide down
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        });
        setUnreadNewCount(0);
      } else {
        // User is reading history higher up: do NOT pull them down; show WhatsApp unread badge!
        setUnreadNewCount((prev) => prev + countDiff);
        setShowScrollBottomBtn(true);
      }
    }
  }, [messages, isReady]);

  // Track scroll position to know if user is reading past messages
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNear = distanceFromBottom < 120;

    isNearBottomRef.current = isNear;
    setShowScrollBottomBtn(!isNear);

    if (isNear) {
      setUnreadNewCount(0);
    }
  };

  const scrollToBottom = () => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    });
    setUnreadNewCount(0);
    setShowScrollBottomBtn(false);
  };

  // Group messages by calendar date
  const items = [];
  let lastDateKey = null;
  for (const msg of messages) {
    const d = new Date((msg.timestamp || 0) * 1000);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dateKey !== lastDateKey) {
      items.push({ type: 'date', timestamp: msg.timestamp, key: `date-${dateKey}` });
      lastDateKey = dateKey;
    }
    items.push({ type: 'msg', msg, key: msg.id });
  }

  return (
    <div className="relative flex-1 h-full min-h-0 flex flex-col overflow-hidden">
      {/* Scrollable Chat Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-1 transition-opacity duration-150 ${
          isReady ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
        }}
      >
        {items.map((item) =>
          item.type === 'date' ? (
            <DateSeparator key={item.key} timestamp={item.timestamp} />
          ) : (
            <MessageBubble key={item.key} msg={item.msg} />
          )
        )}
      </div>

      {/* WhatsApp Floating "Scroll to Bottom" Button */}
      {showScrollBottomBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-30 w-11 h-11 rounded-full bg-[#202c33]/95 backdrop-blur-md hover:bg-[#2a3942] active:scale-90 text-[#aebac1] hover:text-white flex items-center justify-center shadow-2xl border border-white/10 animate-float-in transition-all duration-200 hover:shadow-[0_8px_25px_rgba(0,0,0,0.5)]"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <svg className="w-5 h-5 ml-px" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>

          {/* New unread messages badge */}
          {unreadNewCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-[#00a884] text-[#0b141a] text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-lg border border-[#111b21] animate-bounce">
              {unreadNewCount > 99 ? '99+' : unreadNewCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
