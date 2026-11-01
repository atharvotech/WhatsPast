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

export default function PairingBanner() {
  const {
    systemStatus,
    showAddAccount,
    phoneInput,
    setPhoneInput,
    handleStartPairing
  } = useApp();

  const { pairingCode, activeUser, lastError } = systemStatus;

  if (!pairingCode && !showAddAccount && activeUser) return null;

  return (
    <div className="p-3.5 bg-[#182229] border-b border-[#2a3942]">
      {pairingCode ? (
        <div className="text-center">
          <p className="text-xs text-[#8696a0] mb-1">
            Enter this 8-digit code in WhatsApp &rarr; Linked Devices:
          </p>
          <div className="text-2xl font-mono font-bold tracking-widest text-[#00a884] bg-[#111b21] py-2 rounded border border-[#00a884]/40">
            {pairingCode}
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
      {lastError && (
        <p className="text-[11px] text-red-400 mt-1.5">{lastError}</p>
      )}
    </div>
  );
}
