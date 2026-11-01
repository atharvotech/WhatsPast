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

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getStatus,
  getChats,
  loginPhone,
  switchAccount,
  toggleChatLogging,
  archiveChat,
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
  const [selectedChatId, setSelectedChatIdState] = useState(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile & Android History Back Integration
  const setSelectedChatId = useCallback((chatId) => {
    setSelectedChatIdState(chatId);
    if (chatId) {
      try {
        window.history.pushState({ chatId }, '');
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setSelectedChatIdState(null);
    };

    const handleBackButton = (e) => {
      if (selectedChatId) {
        e?.preventDefault?.();
        setSelectedChatIdState(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('backbutton', handleBackButton);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('backbutton', handleBackButton);
    };
  }, [selectedChatId]);

  useEffect(() => {
    let isMounted = true;
    const fetchCoreData = async () => {
      const statusData = await getStatus();
      if (!isMounted) return;

      if (statusData) {
        setSystemStatus(statusData);
        if (statusData.activeUser) {
          const chatsData = await getChats();
          if (isMounted && chatsData) setChats(chatsData);
        }
      }
    };

    fetchCoreData();
    const interval = setInterval(fetchCoreData, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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
    setSelectedChatIdState(null);
    await switchAccount(phone);
  };

  const handleToggleChatLogging = async (chatId, currentStatus) => {
    await toggleChatLogging(chatId, !currentStatus);
    setChats((prev) =>
      prev.map((c) => (c.chat_id === chatId ? { ...c, logging_enabled: !currentStatus } : c))
    );
  };

  const handleToggleArchiveChat = async (chatId, currentArchived) => {
    const nextArchived = !currentArchived;
    await archiveChat(chatId, nextArchived);
    setChats((prev) =>
      prev.map((c) => (c.chat_id === chatId ? { ...c, archived: nextArchived } : c))
    );
  };

  const handlePurgeCache = async () => {
    await clearStorage();
    setChats([]);
    setSelectedChatIdState(null);
    setShowPurgeModal(false);
  };

  const filteredChats = chats.filter((chat) => {
    const matchesSearch =
      chat.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.chat_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.latest_text?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Explicitly match only the chats for the active tab
    if (activeTab === 'archived') return Boolean(chat.archived);
    // 'all' tab: show everything that is NOT archived
    return !chat.archived;
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
        handleToggleArchiveChat,
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
