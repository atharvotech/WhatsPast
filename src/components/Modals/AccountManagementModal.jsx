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
import { useApp } from '../../context/AppContext';
import { logoutAccount, deleteAccount } from '../../api/client';
import Avatar from '../shared/Avatar';

export default function AccountManagementModal({ onClose }) {
  const {
    systemStatus,
    handleSwitchAccount,
    handleStartPairing,
    phoneInput,
    setPhoneInput,
    setShowAddAccount
  } = useApp();

  const [confirmLogoutPhone, setConfirmLogoutPhone] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showAddNewForm, setShowAddNewForm] = useState(false);

  const accounts = systemStatus.accounts || (systemStatus.users || []).map((u) => ({
    phone: u,
    isActive: u === systemStatus.activeUser,
    status: u === systemStatus.activeUser ? systemStatus.status : 'saved',
    chatCount: 0,
    msgCount: 0
  }));

  const handleLogout = async (phone, purgeData = false) => {
    setLoadingAction(true);
    await logoutAccount(phone, purgeData);
    setLoadingAction(false);
    setConfirmLogoutPhone(null);
  };

  const handleDelete = async (phone) => {
    if (confirm(`Permanently delete profile +${phone} and all its intercepted local messages?`)) {
      setLoadingAction(true);
      await deleteAccount(phone);
      setLoadingAction(false);
      setConfirmLogoutPhone(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 select-none">
      <div className="bg-[#111b21] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-modal">
        {/* Header */}
        <div className="px-5 py-4 bg-[#202c33] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a884]/20 border border-[#00a884]/30 flex items-center justify-center text-xl text-[#00a884] shadow-sm">
              👤
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-[#e9edef] leading-tight">
                WhatsApp Account Management
              </h3>
              <p className="text-xs text-[#8696a0]">
                Switch profiles, logout sessions, or link multiple accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#111b21]/60 hover:bg-[#111b21] active:scale-95 text-[#8696a0] hover:text-white flex items-center justify-center transition"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Active Auto-Resume Info */}
          <div className="p-3 bg-[#202c33]/70 rounded-xl border border-white/5 flex items-center justify-between text-xs text-[#8696a0]">
            <span>Last remembered profile auto-loads on app start.</span>
            {systemStatus.activeUser && (
              <span className="text-[#00a884] font-medium font-mono">
                +{systemStatus.activeUser}
              </span>
            )}
          </div>

          {/* Accounts List */}
          <div className="space-y-2.5">
            <span className="text-[11px] text-[#8696a0] uppercase tracking-wider block font-semibold">
              Saved Profiles ({accounts.length})
            </span>

            {accounts.length === 0 ? (
              <div className="p-6 text-center bg-[#202c33]/50 rounded-xl border border-white/5">
                <p className="text-sm text-[#e9edef] font-medium">No accounts linked yet</p>
                <p className="text-xs text-[#8696a0] mt-1">
                  Link your WhatsApp phone number below to start intercepting.
                </p>
              </div>
            ) : (
              accounts.map((acc) => {
                const isActive = acc.isActive;
                const isLoggingOut = confirmLogoutPhone === acc.phone;

                return (
                  <div
                    key={acc.phone}
                    className={`p-3.5 rounded-xl border transition-all duration-200 ${
                      isActive
                        ? 'bg-[#202c33] border-[#00a884]/60 shadow-lg shadow-[#00a884]/5'
                        : 'bg-[#202c33]/60 hover:bg-[#202c33] border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <Avatar
                            jid={`${acc.phone}@s.whatsapp.net`}
                            name={acc.phone}
                            size="10"
                          />
                          {isActive && (
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#202c33] ${
                                systemStatus.status === 'connected'
                                  ? 'bg-[#00a884] pulse-glow'
                                  : 'bg-amber-400 animate-pulse'
                              }`}
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#e9edef] font-mono truncate">
                              +{acc.phone}
                            </span>
                            {isActive && (
                              <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] font-bold px-2 py-0.5 rounded-full border border-[#00a884]/30">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#8696a0] mt-0.5">
                            <span className="capitalize">{acc.status}</span>
                            {acc.chatCount > 0 && (
                              <span>• {acc.chatCount} chats</span>
                            )}
                            {acc.msgCount > 0 && (
                              <span>• {acc.msgCount} msgs</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isActive && (
                          <button
                            onClick={() => {
                              handleSwitchAccount(acc.phone);
                              onClose();
                            }}
                            disabled={loadingAction}
                            className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#029070] text-[#0b141a] font-semibold text-xs transition active:scale-95 shadow"
                          >
                            Switch
                          </button>
                        )}

                        <button
                          onClick={() => setConfirmLogoutPhone(isLoggingOut ? null : acc.phone)}
                          disabled={loadingAction}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium transition active:scale-95"
                          title="Log out and unpair session"
                        >
                          Logout
                        </button>
                      </div>
                    </div>

                    {/* Confirmation Drawer for Logout */}
                    {isLoggingOut && (
                      <div className="mt-3 pt-3 border-t border-white/5 animate-fadeIn">
                        <p className="text-xs text-red-300 mb-2.5 leading-relaxed">
                          Cleanly logout +{acc.phone}? This revokes the WhatsApp session credentials and disconnects the socket.
                        </p>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setConfirmLogoutPhone(null)}
                            className="px-3 py-1 rounded text-xs bg-white/5 hover:bg-white/10 text-[#8696a0]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleLogout(acc.phone, false)}
                            disabled={loadingAction}
                            className="px-3 py-1 rounded text-xs bg-red-500/80 hover:bg-red-500 text-white font-medium"
                          >
                            Logout (Keep Logs)
                          </button>
                          <button
                            onClick={() => handleDelete(acc.phone)}
                            disabled={loadingAction}
                            className="px-3 py-1 rounded text-xs bg-red-700 hover:bg-red-800 text-white font-medium"
                          >
                            Wipe &amp; Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Link New WhatsApp Profile Section */}
          <div className="pt-2">
            {!showAddNewForm ? (
              <button
                onClick={() => setShowAddNewForm(true)}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#00a884]/50 hover:border-[#00a884] bg-[#00a884]/5 hover:bg-[#00a884]/10 text-[#00a884] font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-98"
              >
                <span>➕</span>
                <span>Link Another WhatsApp Profile (Pairing Code)</span>
              </button>
            ) : (
              <div className="p-4 bg-[#202c33] rounded-xl border border-white/10 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#e9edef]">
                    Link New Phone Number
                  </span>
                  <button
                    onClick={() => setShowAddNewForm(false)}
                    className="text-xs text-[#8696a0] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    handleStartPairing(e);
                    setShowAddNewForm(false);
                    onClose();
                  }}
                  className="space-y-2"
                >
                  <input
                    type="text"
                    placeholder="e.g. 919876543210 (with country code)"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full bg-[#111b21] text-sm px-3.5 py-2 rounded-lg border border-[#2a3942] focus:border-[#00a884] outline-none font-mono"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddNewForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-[#8696a0]"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={!phoneInput.trim()}
                      className="px-4 py-1.5 rounded-lg text-xs bg-[#00a884] hover:bg-[#029070] text-[#0b141a] font-bold shadow transition disabled:opacity-50"
                    >
                      Get Pairing Code
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

