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
import { getTrackingMode, setTrackingMode } from '../../api/client';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Safe Capacitor plugin accessor (null in browser/electron)
const NativeTracking = Capacitor.isNativePlatform()
  ? registerPlugin('TrackingPlugin')
  : null;

export default function TrackingSettingsModal({ onClose }) {
  const [mode, setMode] = useState('passive');
  const [saving, setSaving] = useState(false);
  const [batteryIgnored, setBatteryIgnored] = useState(false);
  const [expandedOem, setExpandedOem] = useState(null);

  useEffect(() => {
    getTrackingMode().then((res) => {
      if (res?.mode) setMode(res.mode);
    });

    if (NativeTracking?.isBatteryOptimizationIgnored) {
      NativeTracking.isBatteryOptimizationIgnored().then((res) => {
        setBatteryIgnored(Boolean(res?.ignored));
      });
    }
  }, []);

  const handleSelectMode = async (newMode) => {
    setSaving(true);
    setMode(newMode);
    await setTrackingMode(newMode);

    // Call native Android background service if running on phone
    if (NativeTracking?.setTrackingMode) {
      try {
        await NativeTracking.setTrackingMode({ mode: newMode });
      } catch (_) {}
    }
    setSaving(false);
  };

  const handleRequestBatteryExemption = async () => {
    if (NativeTracking?.requestBatteryOptimizationExemption) {
      try {
        await NativeTracking.requestBatteryOptimizationExemption();
      } catch (_) {}
    } else {
      alert('On Android, go to: Settings → Apps → WhatsPast → Battery → Set to "Unrestricted"');
    }
  };

  const handleOpenAutostart = async () => {
    if (NativeTracking?.openAutostartSettings) {
      try {
        await NativeTracking.openAutostartSettings();
      } catch (_) {}
    } else {
      alert('Open your phone\'s Security / Settings app and enable "Autostart" for WhatsPast.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4">
      <div className="bg-[#111b21] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-modal">
        {/* Header */}
        <div className="px-5 py-4 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚙️</span>
            <div>
              <h3 className="font-bold text-[15px] text-[#e9edef]">Tracking &amp; Background Mode</h3>
              <p className="text-xs text-[#8696a0]">Configure 24/7 background execution &amp; battery saver</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#111b21]/60 hover:bg-[#111b21] text-[#8696a0] hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Mode Selector Cards */}
          <div className="space-y-2.5">
            <span className="text-[11px] text-[#8696a0] uppercase tracking-wider block font-semibold">
              Select Tracking Mode
            </span>

            {/* 1. Live Tracking (24/7) */}
            <div
              onClick={() => handleSelectMode('live')}
              className={`p-4 rounded-xl cursor-pointer border transition-all ${
                mode === 'live'
                  ? 'bg-[#00a884]/15 border-[#00a884] ring-1 ring-[#00a884]/50'
                  : 'bg-[#202c33] border-white/5 hover:bg-[#25323a]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center text-xl shrink-0">
                    ⚡
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-[14px] text-[#e9edef]">Live Tracking (24/7 Background)</h4>
                      <span className="text-[10px] bg-[#00a884] text-[#0b141a] font-bold px-1.5 py-0.2 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-[#8696a0] mt-1 leading-relaxed">
                      Continuous background interceptor (Termux architecture). Holds a CPU WakeLock &amp; low-priority status notification.
                      Tracks last seen, online sessions, and deletes 24/7 even when phone screen is locked or app is closed.
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="tracking_mode"
                  checked={mode === 'live'}
                  onChange={() => handleSelectMode('live')}
                  className="mt-1 accent-[#00a884]"
                />
              </div>
            </div>

            {/* 2. Passive Tracking (App Open Only) */}
            <div
              onClick={() => handleSelectMode('passive')}
              className={`p-4 rounded-xl cursor-pointer border transition-all ${
                mode === 'passive'
                  ? 'bg-[#00a884]/15 border-[#00a884] ring-1 ring-[#00a884]/50'
                  : 'bg-[#202c33] border-white/5 hover:bg-[#25323a]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2a3942] text-[#8696a0] flex items-center justify-center text-xl shrink-0">
                    🔋
                  </div>
                  <div>
                    <h4 className="font-bold text-[14px] text-[#e9edef]">Passive Tracking (App Open Only)</h4>
                    <p className="text-xs text-[#8696a0] mt-1 leading-relaxed">
                      Battery-saver mode. Only captures messages and checks presence while you have the app open. Automatically sleeps when minimized.
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="tracking_mode"
                  checked={mode === 'passive'}
                  onChange={() => handleSelectMode('passive')}
                  className="mt-1 accent-[#00a884]"
                />
              </div>
            </div>
          </div>

          {/* Android Background Survival Section (Termux Config) */}
          <div className="p-4 bg-[#202c33] rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e9edef] flex items-center gap-1.5">
                <span>🛡️</span> Android 24/7 Background Protection
              </span>
              <span className="text-[10px] text-[#8696a0]">Termux-grade</span>
            </div>

            <p className="text-xs text-[#8696a0] leading-relaxed">
              Android and manufacturers (MIUI, OneUI, ColorOS, Vivo) aggressively kill background apps unless exempted.
              Configure the two settings below for uninterrupted 24/7 logging:
            </p>

            {/* 1. Battery Optimization Whitelist */}
            <div className="p-3 rounded-lg bg-[#111b21] flex items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-[#e9edef] block">1. Battery Optimization</span>
                <span className="text-[11px] text-[#8696a0]">
                  {batteryIgnored ? '✅ Unrestricted (exempted from Doze)' : 'Set to "Unrestricted" so Android never sleeps CPU'}
                </span>
              </div>
              <button
                onClick={handleRequestBatteryExemption}
                className="px-3 py-1.5 bg-[#2a3942] hover:bg-[#00a884] hover:text-[#0b141a] text-[#e9edef] rounded-lg font-medium transition text-xs shrink-0"
              >
                {batteryIgnored ? 'Verified' : 'Exempt Battery'}
              </button>
            </div>

            {/* 2. OEM Autostart & Recent Lock */}
            <div className="p-3 rounded-lg bg-[#111b21] flex items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-[#e9edef] block">2. Manufacturer Autostart</span>
                <span className="text-[11px] text-[#8696a0]">
                  Enable autostart for Xiaomi, Samsung, Oppo, Vivo, OnePlus
                </span>
              </div>
              <button
                onClick={handleOpenAutostart}
                className="px-3 py-1.5 bg-[#2a3942] hover:bg-[#00a884] hover:text-[#0b141a] text-[#e9edef] rounded-lg font-medium transition text-xs shrink-0"
              >
                Open Autostart
              </button>
            </div>

            {/* Quick Tips for OneUI & MIUI */}
            <div className="text-[11px] text-[#8696a0] bg-black/20 p-2.5 rounded-lg space-y-1">
              <strong className="text-[#00a884] block font-semibold">💡 Lock in Recent Apps (Critical):</strong>
              <p>
                Open Android Recent Apps (multitask view) → tap and hold the WhatsPast card → tap the <strong>Lock 🔒</strong> icon.
                This prevents your phone's task killer from swiping it away when clearing RAM.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#202c33] border-t border-[#222d34] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#8696a0]">
            Current mode: <strong className="text-[#00a884] capitalize">{mode} Tracking</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#00a884]/90 text-[#0b141a] font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

