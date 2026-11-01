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

import { useState, useEffect } from 'react';
import { getChatMessages } from '../api/client';

export function useMessages(selectedChatId) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const fetchMessages = async () => {
      const data = await getChatMessages(selectedChatId);
      if (!isMounted || !data) return;

      setMessages((prev) => {
        // Compare to prevent useless re-render loops on mobile polling
        if (prev.length === data.length && prev.length > 0) {
          const prevLast = prev[prev.length - 1];
          const newLast = data[data.length - 1];
          if (
            prevLast.id === newLast.id &&
            prevLast.latest_text === newLast.latest_text &&
            prevLast.edit_history?.length === newLast.edit_history?.length &&
            prevLast.is_deleted === newLast.is_deleted &&
            prevLast.media_path === newLast.media_path
          ) {
            return prev;
          }
        }
        return data;
      });
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1800);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedChatId]);

  return { messages };
}
