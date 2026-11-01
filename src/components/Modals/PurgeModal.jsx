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

export default function PurgeModal() {
  const { showPurgeModal, setShowPurgeModal, handlePurgeCache, systemStatus } = useApp();

  if (!showPurgeModal) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-[#202c33] border border-white/10 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-modal select-none">
        <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center text-xl mb-3 border border-red-500/20">
          🗑️
        </div>
        <h3 className="text-base font-bold text-red-400">Wipe Local Interceptor Cache?</h3>
        <p className="text-xs text-[#8696a0] mt-2 leading-relaxed">
          This will delete all locally logged messages and downloaded media for{' '}
          <strong className="text-[#e9edef]">+{systemStatus.activeUser}</strong> without affecting your main phone&apos;s
          WhatsApp chats.
        </p>
        <div className="flex justify-end gap-2.5 mt-5">
          <button
            onClick={() => setShowPurgeModal(false)}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#2a3942] hover:bg-[#374852] text-[#e9edef] transition active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handlePurgeCache}
            className="px-3.5 py-2 rounded-xl text-xs bg-red-500 text-white font-semibold hover:bg-red-600 transition shadow-lg shadow-red-500/25 active:scale-95"
          >
            Yes, Wipe Cache
          </button>
        </div>
      </div>
    </div>
  );
}
