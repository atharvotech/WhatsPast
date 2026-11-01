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

const TABS = [
  { id: 'all', label: 'All Chats' },
  { id: 'archived', label: '📦 Archived' },
  { id: 'locked', label: '🔒 Locked' }
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useApp();

  return (
    <div className="flex px-2 pb-2 gap-1.5 border-b border-[#222d34]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
            activeTab === tab.id
              ? 'bg-[#00a884] text-[#0b141a] font-semibold'
              : 'bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
