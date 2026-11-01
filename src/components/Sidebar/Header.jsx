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
import Avatar from '../shared/Avatar';
import TrackingSettingsModal from '../Modals/TrackingSettingsModal';
import AccountManagementModal from '../Modals/AccountManagementModal';

export default function Header() {
  const { systemStatus, handleSwitchAccount, setShowPurgeModal } = useApp();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  return (
    <>
      <div className="p-3 glass-header flex items-center justify-between border-b border-white/[0.06] shadow-sm select-none shrink-0">
        {/* Left: Avatar + Title (Clicking opens Account Management) */}
        <div
          onClick={() => setShowAccountModal(true)}
          className="flex items-center gap-2 sm:gap-2.5 min-w-0 cursor-pointer group"
          title="Manage WhatsApp Accounts & Logouts"
        >
          {systemStatus.activeUser ? (
            <div className="relative shrink-0">
              <Avatar
                jid={`${systemStatus.activeUser}@s.whatsapp.net`}
                name={systemStatus.activeUser}
                size="8"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#202c33] ${
                  systemStatus.status === 'connected'
                    ? 'bg-[#00a884] pulse-glow'
                    : systemStatus.status === 'pairing' || systemStatus.status === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center font-bold text-[#0b141a] text-sm shadow shrink-0">
              ⚡
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-sm tracking-wide truncate group-hover:text-[#00a884] transition">
                WA SHAKTI
              </span>
            </div>
            <p className="text-[11px] text-[#8696a0] capitalize truncate flex items-center gap-1">
              <span>{systemStatus.status}</span>
              {systemStatus.activeUser && (
                <span className="font-mono text-[#00a884]/80">
                  (+{systemStatus.activeUser.slice(-4)})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Action Icons: Accounts, 24/7 Settings, Purge */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Quick Account Switcher / Management button */}
          <button
            onClick={() => setShowAccountModal(true)}
            title="Account Management (Switch Profile, Clean Logout, Link New)"
            className="px-2 py-1.5 rounded-lg bg-[#2a3942] hover:bg-[#32424b] active:scale-95 text-xs text-[#e9edef] transition flex items-center gap-1 font-mono border border-white/5"
          >
            <span>👤</span>
            <span className="hidden sm:inline max-w-[80px] truncate">
              {systemStatus.activeUser ? `+${systemStatus.activeUser.slice(0, 5)}...` : 'Accounts'}
            </span>
          </button>

          {/* Tracking Mode & Android Background Protection Settings */}
          <button
            onClick={() => setShowSettingsModal(true)}
            title="Tracking Mode (24/7 Live vs Passive) & Android Background Protection"
            className="p-1.5 rounded-lg bg-[#2a3942] hover:bg-[#32424b] active:scale-95 text-[#e9edef] text-xs transition border border-white/5"
          >
            ⚙️
          </button>

          {/* Purge Local Logs Button */}
          <button
            onClick={() => setShowPurgeModal(true)}
            title="Purge Local Logs & Media"
            className="p-1.5 rounded-lg bg-[#2a3942] hover:bg-red-500/20 active:scale-95 text-red-400 text-xs transition border border-white/5"
          >
            🗑️
          </button>
        </div>
      </div>

      {showSettingsModal && (
        <TrackingSettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {showAccountModal && (
        <AccountManagementModal onClose={() => setShowAccountModal(false)} />
      )}
    </>
  );
}
