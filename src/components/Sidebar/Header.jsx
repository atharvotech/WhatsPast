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

import React from 'react';
import { useApp } from '../../context/AppContext';

export default function Header() {
  const { systemStatus, handleSwitchAccount, setShowPurgeModal } = useApp();

  return (
    <div className="p-3 bg-[#202c33] flex items-center justify-between border-b border-[#222d34]">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center font-bold text-[#0b141a] text-sm shadow">
          ⚡
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide">WA SHAKTI</span>
            <span
              className={`w-2 h-2 rounded-full ${
                systemStatus.status === 'connected'
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
  );
}
