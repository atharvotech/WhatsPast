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

    const fetchMessages = async () => {
      const data = await getChatMessages(selectedChatId);
      if (data) setMessages(data);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1800);
    return () => clearInterval(interval);
  }, [selectedChatId]);

  return { messages };
}
