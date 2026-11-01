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
import Header from './Header';
import PairingBanner from './PairingBanner';
import SearchBar from './SearchBar';
import TabBar from './TabBar';
import ChatList from './ChatList';

export default function Sidebar() {
  const { selectedChatId } = useApp();

  return (
    <div
      className={`absolute inset-0 md:relative md:inset-auto flex flex-col w-full md:w-[380px] lg:w-[420px] h-full overflow-hidden border-r border-white/[0.06] bg-[#111b21] select-none z-10 md:z-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selectedChatId
          ? '-translate-x-[20%] opacity-0 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto'
          : 'translate-x-0 opacity-100 pointer-events-auto'
      }`}
    >
      <Header />
      <PairingBanner />
      <SearchBar />
      <TabBar />
      <ChatList />
    </div>
  );
}
