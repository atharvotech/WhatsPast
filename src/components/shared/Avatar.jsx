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

import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../api/client';

// Deterministic WhatsApp-style colors for contact initials
const AVATAR_COLORS = [
  '#00a884', '#1f7a8c', '#53bdeb', '#7f66ff',
  '#e26d5c', '#e76f51', '#f4a261', '#2a9d8f',
  '#388e3c', '#d81b60', '#8e24aa', '#3949ab'
];

function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Avatar({ jid, name = '', size = '10' }) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setHasError(false);
  }, [jid]);

  const sizeClasses = {
    '7': 'w-7 h-7 text-[11px]',
    '8': 'w-8 h-8 text-xs',
    '10': 'w-10 h-10 text-sm',
    '12': 'w-12 h-12 text-base'
  }[size] || 'w-10 h-10 text-sm';

  const initial = (name || '?').trim()[0]?.toUpperCase() || '?';
  const bg = avatarColor(name || jid);

  if (!jid || hasError) {
    return (
      <div
        className={`${sizeClasses} rounded-full flex items-center justify-center shrink-0 font-bold text-white select-none shadow-sm ring-1 ring-white/10`}
        style={{ backgroundColor: bg }}
      >
        {initial}
      </div>
    );
  }

  const pfpUrl = `${API_BASE}/api/profile-pic/${encodeURIComponent(jid)}`;

  return (
    <div
      className={`${sizeClasses} relative rounded-full shrink-0 select-none shadow-sm ring-1 ring-white/10 overflow-hidden`}
    >
      {/* Background with initial while profile photo loads */}
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center font-bold text-white"
          style={{ backgroundColor: bg }}
        >
          {initial}
        </div>
      )}
      <img
        src={pfpUrl}
        alt={name}
        className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
