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

export default function TabBar() {
  const { activeTab, setActiveTab, chats } = useApp();

  const allCount = chats.filter((c) => !c.archived).length;
  const archivedCount = chats.filter((c) => c.archived).length;

  const tabs = [
    { id: 'all', label: 'All Chats', count: allCount, icon: '💬' },
    { id: 'archived', label: 'Archived', count: archivedCount, icon: '📦' }
  ];

  return (
    <div className="flex px-3 pb-2.5 pt-0.5 gap-2 border-b border-white/[0.06] select-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
              isActive
                ? 'bg-[#00a884] text-[#0b141a] shadow-md shadow-[#00a884]/20'
                : 'bg-[#202c33]/70 hover:bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] border border-white/[0.04]'
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                  isActive
                    ? 'bg-[#0b141a]/20 text-[#0b141a]'
                    : 'bg-[#111b21] text-[#8696a0] border border-white/5'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
