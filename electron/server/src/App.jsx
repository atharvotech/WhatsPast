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

import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://127.0.0.1:3000';

export default function App() {
    const [systemStatus, setSystemStatus] = useState({
        activeUser: null,
        users: [],
        status: 'disconnected',
        pairingCode: null,
        lastError: null
    });

    const [chats, setChats] = useState([]);
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'archived' | 'locked'
    const [searchQuery, setSearchQuery] = useState('');

    // Modals & Auth Inputs
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [showPurgeModal, setShowPurgeModal] = useState(false);

    const messagesEndRef = useRef(null);

    // Poll Backend Status & Chat List
    useEffect(() => {
        const fetchCoreData = async () => {
            try {
                const statusRes = await fetch(`${API_BASE}/api/status`);
                const statusData = await statusRes.json();
                setSystemStatus(statusData);

                if (statusData.activeUser) {
                    const chatsRes = await fetch(`${API_BASE}/api/chats`);
                    const chatsData = await chatsRes.json();
                    setChats(chatsData);
                }
            } catch (e) {
                // Backend booting
            }
        };

        fetchCoreData();
        const interval = setInterval(fetchCoreData, 2000);
        return () => clearInterval(interval);
    }, []);

    // Poll Active Chat Messages
    useEffect(() => {
        if (!selectedChatId) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/chats/${encodeURIComponent(selectedChatId)}`);
                const data = await res.json();
                setMessages(data);
            } catch (e) { }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 1800);
        return () => clearInterval(interval);
    }, [selectedChatId]);

    const handleStartPairing = async (e) => {
        e.preventDefault();
        if (!phoneInput.trim()) return;
        await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneInput.trim() })
        });
        setPhoneInput('');
        setShowAddAccount(false);
    };

    const handleSwitchAccount = async (phone) => {
        if (phone === '__NEW__') {
            setShowAddAccount(true);
            return;
        }
        setSelectedChatId(null);
        await fetch(`${API_BASE}/api/auth/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
    };

    const handleToggleChatLogging = async (chatId, currentStatus) => {
        await fetch(`${API_BASE}/api/settings/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, enable: !currentStatus })
        });
        setChats((prev) =>
            prev.map((c) => (c.chat_id === chatId ? { ...c, logging_enabled: !currentStatus } : c))
        );
    };

    const handlePurgeCache = async () => {
        await fetch(`${API_BASE}/api/storage/clear`, { method: 'POST' });
        setMessages([]);
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

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex h-screen w-screen bg-[#0b141a] text-[#e9edef] overflow-hidden select-none">
            {/* LEFT SIDEBAR: ACCOUNTS, TABS & CHAT LIST */}
            <div
                className={`${selectedChatId ? 'hidden md:flex' : 'flex'
                    } flex-col w-full md:w-[380px] lg:w-[420px] border-r border-[#222d34] bg-[#111b21]`}
            >
                {/* Top Header */}
                <div className="p-3 bg-[#202c33] flex items-center justify-between border-b border-[#222d34]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center font-bold text-[#0b141a] text-sm shadow">
                            ⚡
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm tracking-wide">WA SHAKTI</span>
                                <span
                                    className={`w-2 h-2 rounded-full ${systemStatus.status === 'connected'
                                            ? 'bg-[#00a884]'
                                            : systemStatus.status === 'pairing' || systemStatus.status === 'connecting'
                                                ? 'bg-amber-400 animate-pulse'
                                                : 'bg-red-500'
                                        }`}
                                />
                            </div>
                            <p className="text-[11px] text-[#8696a0] capitalize">{systemStatus.status}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={systemStatus.activeUser || ''}
                            onChange={(e) => handleSwitchAccount(e.target.value)}
                            className="bg-[#111b21] text-xs text-[#e9edef] px-2.5 py-1.5 rounded border border-[#2a3942] outline-none"
                        >
                            <option value="" disabled>
                                Select Account
                            </option>
                            {systemStatus.users.map((u) => (
                                <option key={u} value={u}>
                                    +{u}
                                </option>
                            ))}
                            <option value="__NEW__">+ Link New Number</option>
                        </select>

                        <button
                            onClick={() => setShowPurgeModal(true)}
                            title="Purge Local Logs & Media"
                            className="p-1.5 rounded bg-[#2a3942] hover:bg-red-500/20 text-red-400 text-xs transition"
                        >
                            🗑️
                        </button>
                    </div>
                </div>

                {/* Pairing Code Banner */}
                {(systemStatus.pairingCode || showAddAccount || !systemStatus.activeUser) && (
                    <div className="p-3.5 bg-[#182229] border-b border-[#2a3942]">
                        {systemStatus.pairingCode ? (
                            <div className="text-center">
                                <p className="text-xs text-[#8696a0] mb-1">
                                    Enter this 8-digit code in WhatsApp &rarr; Linked Devices:
                                </p>
                                <div className="text-2xl font-mono font-bold tracking-widest text-[#00a884] bg-[#111b21] py-2 rounded border border-[#00a884]/40">
                                    {systemStatus.pairingCode}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleStartPairing} className="flex flex-col gap-2">
                                <label className="text-xs text-[#8696a0]">
                                    Link WhatsApp Number (with country code, e.g. 919876543210):
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="919876543210"
                                        value={phoneInput}
                                        onChange={(e) => setPhoneInput(e.target.value)}
                                        className="flex-1 bg-[#202c33] text-sm px-3 py-1.5 rounded border border-[#2a3942] outline-none focus:border-[#00a884]"
                                    />
                                    <button
                                        type="submit"
                                        className="bg-[#00a884] text-[#0b141a] font-semibold text-xs px-3.5 py-1.5 rounded hover:bg-[#06cf9c] transition"
                                    >
                                        Get Code
                                    </button>
                                </div>
                            </form>
                        )}
                        {systemStatus.lastError && (
                            <p className="text-[11px] text-red-400 mt-1.5">{systemStatus.lastError}</p>
                        )}
                    </div>
                )}

                {/* Search Input */}
                <div className="p-2 bg-[#111b21]">
                    <input
                        type="text"
                        placeholder="Search intercepted chats or messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#202c33] text-xs text-[#e9edef] px-3 py-2 rounded-lg outline-none placeholder-[#8696a0]"
                    />
                </div>

                {/* Filter Tabs: All / Archived / Locked */}
                <div className="flex px-2 pb-2 gap-1.5 border-b border-[#222d34]">
                    {[
                        { id: 'all', label: 'All Chats' },
                        { id: 'archived', label: '📦 Archived' },
                        { id: 'locked', label: '🔒 Locked' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${activeTab === tab.id
                                    ? 'bg-[#00a884] text-[#0b141a] font-semibold'
                                    : 'bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/60">
                    {filteredChats.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#8696a0]">
                            No intercepted chats in this tab yet.
                        </div>
                    ) : (
                        filteredChats.map((chat) => (
                            <div
                                key={chat.chat_id}
                                onClick={() => setSelectedChatId(chat.chat_id)}
                                className={`p-3 flex items-center justify-between cursor-pointer hover:bg-[#202c33]/70 transition ${selectedChatId === chat.chat_id ? 'bg-[#2a3942]' : ''
                                    }`}
                            >
                                <div className="min-w-0 flex-1 pr-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-sm truncate">{chat.sender_name}</span>
                                        {chat.is_group && (
                                            <span className="text-[10px] bg-[#202c33] text-[#00a884] px-1.5 py-0.5 rounded">
                                                GROUP
                                            </span>
                                        )}
                                        {chat.locked && <span className="text-xs">🔒</span>}
                                        {chat.archived && <span className="text-xs">📦</span>}
                                    </div>
                                    <p className="text-xs text-[#8696a0] truncate mt-0.5">
                                        {chat.latest_sender ? `${chat.latest_sender}: ` : ''}
                                        {chat.latest_text}
                                    </p>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] text-[#8696a0]">{formatTime(chat.timestamp)}</span>
                                    <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded ${chat.logging_enabled
                                                ? 'bg-[#00a884]/20 text-[#00a884]'
                                                : 'bg-red-500/20 text-red-400'
                                            }`}
                                    >
                                        {chat.logging_enabled ? `${chat.message_count} logs` : 'Muted'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: INTERCEPTED MESSAGE STREAM */}
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
                        {/* Chat Header */}
                        <div className="p-3 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <button
                                    onClick={() => setSelectedChatId(null)}
                                    className="md:hidden text-sm px-2 py-1 rounded bg-[#2a3942]"
                                >
                                    &larr;
                                </button>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-sm truncate">
                                        {activeChatObj?.sender_name || selectedChatId}
                                    </h3>
                                    <p className="text-[11px] text-[#8696a0] truncate">{selectedChatId}</p>
                                </div>
                            </div>

                            {activeChatObj && (
                                <button
                                    onClick={() =>
                                        handleToggleChatLogging(activeChatObj.chat_id, activeChatObj.logging_enabled)
                                    }
                                    className={`text-xs px-3 py-1.5 rounded font-medium transition ${activeChatObj.logging_enabled
                                            ? 'bg-[#00a884] text-[#0b141a]'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/40'
                                        }`}
                                >
                                    {activeChatObj.logging_enabled ? '● Logging ON' : '○ Logging Muted'}
                                </button>
                            )}
                        </div>

                        {/* Messages Container */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${msg.from_me ? 'items-end' : 'items-start'}`}
                                >
                                    <div
                                        className={`max-w-[82%] md:max-w-[68%] rounded-lg p-2.5 shadow ${msg.is_deleted
                                                ? 'bg-red-950/60 border border-red-500/50'
                                                : msg.from_me
                                                    ? 'bg-[#005c4b]'
                                                    : 'bg-[#202c33]'
                                            }`}
                                    >
                                        {/* Sender Name + JID Header */}
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
                                                        🚫 DELETED FOR EVERYONE
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Media Rendering: Stickers & Images */}
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

                                        {/* Latest Message Text */}
                                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">
                                            {msg.latest_text}
                                        </p>

                                        {/* Edit Revision History Box */}
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

                                        {/* Timestamp Footer */}
                                        <div className="text-right mt-1">
                                            <span className="text-[10px] text-[#8696a0]">{formatTime(msg.timestamp)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </>
                )}
            </div>

            {/* PURGE CONFIRMATION MODAL */}
            {showPurgeModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#202c33] border border-[#2a3942] rounded-lg max-w-sm w-full p-5">
                        <h3 className="text-base font-bold text-red-400">Wipe Local Interceptor Cache?</h3>
                        <p className="text-xs text-[#8696a0] mt-2 leading-relaxed">
                            This will delete all locally logged messages and downloaded media for{' '}
                            <strong>+{systemStatus.activeUser}</strong> without affecting your main phone&apos;s
                            WhatsApp chats or unlinking your session.
                        </p>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setShowPurgeModal(false)}
                                className="px-3 py-1.5 rounded text-xs bg-[#2a3942] hover:bg-[#374852]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePurgeCache}
                                className="px-3 py-1.5 rounded text-xs bg-red-500 text-white font-semibold hover:bg-red-600"
                            >
                                Yes, Wipe Cache
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}