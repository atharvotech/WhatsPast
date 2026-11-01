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

export default function SearchBar() {
  const { searchQuery, setSearchQuery } = useApp();

  return (
    <div className="px-3 py-2 bg-[#111b21]">
      <div className="relative flex items-center">
        <span className="absolute left-3 text-[#8696a0] pointer-events-none">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search or start new search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#202c33] text-[13px] text-[#e9edef] pl-9 pr-8 py-1.5 rounded-lg outline-none placeholder-[#8696a0] focus:ring-1 focus:ring-[#00a884] transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 text-[#8696a0] hover:text-[#e9edef] text-sm"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
