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

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getStatus,
  getChats,
  loginPhone,
  switchAccount,
  toggleChatLogging,
  clearStorage
} from '../api/client';

export const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [systemStatus, setSystemStatus] = useState({
    activeUser: null,
    users: [],
    status: 'disconnected',
    pairingCode: null,
    lastError: null
  });

  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCoreData = async () => {
      const statusData = await getStatus();
      if (statusData) {
        setSystemStatus(statusData);
        if (statusData.activeUser) {
          const chatsData = await getChats();
          if (chatsData) setChats(chatsData);
        }
      }
    };

    fetchCoreData();
    const interval = setInterval(fetchCoreData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStartPairing = async (e) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    await loginPhone(phoneInput.trim());
    setPhoneInput('');
    setShowAddAccount(false);
  };

  const handleSwitchAccount = async (phone) => {
    if (phone === '__NEW__') {
      setShowAddAccount(true);
      return;
    }
    setSelectedChatId(null);
    await switchAccount(phone);
  };

  const handleToggleChatLogging = async (chatId, currentStatus) => {
    await toggleChatLogging(chatId, !currentStatus);
    setChats((prev) =>
      prev.map((c) => (c.chat_id === chatId ? { ...c, logging_enabled: !currentStatus } : c))
    );
  };

  const handlePurgeCache = async () => {
    await clearStorage();
    setChats([]);
    setSelectedChatId(null);
    setShowPurgeModal(false);
  };

  const filteredChats = chats.filter((chat) => {
    const matchesSearch =
      chat.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.chat_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.latest_text?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'archived') return chat.archived;
    if (activeTab === 'locked') return chat.locked;
    return !chat.archived && !chat.locked;
  });

  const activeChatObj = chats.find((c) => c.chat_id === selectedChatId);

  return (
    <AppContext.Provider
      value={{
        systemStatus,
        chats,
        selectedChatId,
        setSelectedChatId,
        showPurgeModal,
        setShowPurgeModal,
        showAddAccount,
        setShowAddAccount,
        phoneInput,
        setPhoneInput,
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        handleStartPairing,
        handleSwitchAccount,
        handleToggleChatLogging,
        handlePurgeCache,
        filteredChats,
        activeChatObj
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
