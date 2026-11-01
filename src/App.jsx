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
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import PurgeModal from './components/Modals/PurgeModal';

export default function App() {
  return (
    <AppProvider>
      <div className="flex h-screen w-screen bg-[#0b141a] text-[#e9edef] overflow-hidden select-none">
        <Sidebar />
        <ChatView />
        <PurgeModal />
      </div>
    </AppProvider>
  );
}
