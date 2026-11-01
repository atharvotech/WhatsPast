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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#202c33] border border-[#2a3942] rounded-lg max-w-sm w-full p-5">
        <h3 className="text-base font-bold text-red-400">Wipe Local Interceptor Cache?</h3>
        <p className="text-xs text-[#8696a0] mt-2 leading-relaxed">
          This will delete all locally logged messages and downloaded media for{' '}
          <strong>+{systemStatus.activeUser}</strong> without affecting your main phone&apos;s
          WhatsApp chats.
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
  );
}
