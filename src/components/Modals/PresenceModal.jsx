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
import { getPresence, trackPresence } from '../../api/client';
import Avatar from '../shared/Avatar';

function formatDuration(seconds = 0) {
  const secs = Math.max(0, Math.round(seconds));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const remSecs = secs % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m ${remSecs > 0 ? remSecs + 's' : ''}`.trim();
  return `${mins}m ${remSecs > 0 ? remSecs + 's' : ''}`.trim();
}

function formatExactTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getSessionDayKey(ts) {
  const d = new Date(ts * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sessionDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((today - sessionDay) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PresenceModal({ jid, name, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [dayFilter, setDayFilter] = useState('all'); // 'all' | 'today' | 'yesterday'
  const [liveNow, setLiveNow] = useState(Math.floor(Date.now() / 1000));

  const fetchStats = async () => {
    if (!jid) return;
    const res = await getPresence(jid);
    if (res) setData(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    const ticker = setInterval(() => setLiveNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(ticker);
    };
  }, [jid]);

  const handleToggleTracking = async () => {
    setToggling(true);
    const nextState = !data?.isTracking;
    await trackPresence(jid, nextState);
    await fetchStats();
    setToggling(false);
  };

  const isOnline = data?.status === 'online';
  const allSessions = data?.sessions || [];

  // Group sessions by day
  const groupedByDay = {};
  for (const s of allSessions) {
    const day = getSessionDayKey(s.start);
    if (!groupedByDay[day]) groupedByDay[day] = { day, sessions: [], totalSeconds: 0 };
    groupedByDay[day].sessions.push(s);
    groupedByDay[day].totalSeconds += (s.durationSeconds || 0);
  }

  // Filter groups according to active dayFilter
  const visibleGroups = Object.values(groupedByDay).filter((g) => {
    if (dayFilter === 'today') return g.day === 'Today';
    if (dayFilter === 'yesterday') return g.day === 'Yesterday';
    return true;
  });

  // Export complete session history as CSV
  const handleExportCSV = () => {
    if (allSessions.length === 0) return;
    const headers = ['Contact Name', 'JID', 'Date', 'Came Online', 'Went Offline', 'Duration (Seconds)', 'Duration (Formatted)'];
    const rows = allSessions.map((s) => {
      const d = new Date(s.start * 1000);
      const dateStr = d.toLocaleDateString();
      const startTime = formatExactTime(s.start);
      const endTime = formatExactTime(s.end);
      const durSec = s.durationSeconds || 0;
      const durText = formatDuration(durSec);
      return [
        `"${(name || '').replace(/"/g, '""')}"`,
        `"${jid}"`,
        `"${dateStr}"`,
        `"${startTime}"`,
        `"${endTime}"`,
        durSec,
        `"${durText}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presence_Log_${(name || jid).replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Live duration of currently active session
  const activeSessionSeconds = isOnline && data?.currentSessionStart
    ? Math.max(0, liveNow - data.currentSessionStart)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4">
      <div className="bg-[#111b21] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-modal">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar jid={jid} name={name} size="10" />
            <div className="min-w-0">
              <h3 className="font-bold text-[15px] text-[#e9edef] truncate">{name}</h3>
              <p className="text-xs text-[#8696a0] truncate">{jid?.split('@')[0]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#111b21]/60 hover:bg-[#111b21] text-[#8696a0] hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Modal content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Live Status Card */}
          <div className="bg-[#202c33] rounded-xl p-4 border border-white/5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-[#8696a0] uppercase tracking-wider block font-semibold mb-1">
                  Current Status
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      isOnline ? 'bg-[#00a884] animate-pulse shadow-md shadow-[#00a884]/40' : 'bg-[#8696a0]'
                    }`}
                  />
                  <span className={`font-bold text-base ${isOnline ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                    {isOnline ? 'Online Now' : 'Offline'}
                  </span>
                </div>
                {data?.lastSeen && !isOnline && (
                  <p className="text-xs text-[#8696a0] mt-1">
                    Last seen: {formatExactTime(data.lastSeen)} ({getSessionDayKey(data.lastSeen)})
                  </p>
                )}
              </div>

              {/* Tracking Button */}
              <button
                onClick={handleToggleTracking}
                disabled={toggling}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
                  data?.isTracking
                    ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40 hover:bg-[#00a884]/30'
                    : 'bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#32424b]'
                }`}
              >
                <span>{data?.isTracking ? '📡' : '⏸️'}</span>
                <span>{data?.isTracking ? 'Tracking Active' : 'Start Tracking'}</span>
              </button>
            </div>

            {/* Currently online ticker */}
            {isOnline && activeSessionSeconds > 0 && (
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-[#00a884] font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
                  Active Session Duration:
                </span>
                <span className="font-bold text-[#00a884] text-sm">
                  {formatDuration(activeSessionSeconds)}
                </span>
              </div>
            )}
          </div>

          {/* Aggregate Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#202c33] rounded-xl p-3.5 border border-white/5">
              <span className="text-[11px] text-[#8696a0] block font-medium">Online Today</span>
              <p className="text-2xl font-bold text-[#00a884] mt-1">
                {formatDuration(data?.todaySeconds || 0)}
              </p>
              <span className="text-[10px] text-[#8696a0]">
                {groupedByDay['Today']?.sessions?.length || 0} session(s) today
              </span>
            </div>

            <div className="bg-[#202c33] rounded-xl p-3.5 border border-white/5">
              <span className="text-[11px] text-[#8696a0] block font-medium">All-Time Tracked</span>
              <p className="text-2xl font-bold text-[#e9edef] mt-1">
                {formatDuration(data?.totalSeconds || 0)}
              </p>
              <span className="text-[10px] text-[#8696a0]">
                {allSessions.length} total session(s) logged
              </span>
            </div>
          </div>

          {/* Full Session History Section */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h4 className="text-xs font-bold text-[#e9edef] uppercase tracking-wider">
                Full Online Activity Log ({allSessions.length})
              </h4>
              <div className="flex items-center gap-1.5">
                {/* Day Filter Pills */}
                <div className="flex bg-[#202c33] rounded-lg p-0.5 text-[11px]">
                  <button
                    onClick={() => setDayFilter('all')}
                    className={`px-2 py-0.5 rounded ${dayFilter === 'all' ? 'bg-[#00a884] text-[#0b141a] font-bold' : 'text-[#8696a0]'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setDayFilter('today')}
                    className={`px-2 py-0.5 rounded ${dayFilter === 'today' ? 'bg-[#00a884] text-[#0b141a] font-bold' : 'text-[#8696a0]'}`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setDayFilter('yesterday')}
                    className={`px-2 py-0.5 rounded ${dayFilter === 'yesterday' ? 'bg-[#00a884] text-[#0b141a] font-bold' : 'text-[#8696a0]'}`}
                  >
                    Yesterday
                  </button>
                </div>

                {/* CSV Export */}
                {allSessions.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="text-[11px] bg-[#2a3942] hover:bg-[#32424b] text-[#e9edef] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition"
                    title="Export session log to CSV spreadsheet"
                  >
                    <span>📥</span>
                    <span>Export CSV</span>
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#8696a0]">Loading presence logs...</div>
            ) : allSessions.length === 0 ? (
              <div className="p-8 bg-[#202c33] rounded-xl text-center text-xs text-[#8696a0] border border-white/5 space-y-1">
                <p className="font-semibold text-sm text-[#e9edef]">No online sessions recorded yet</p>
                <p>
                  {data?.isTracking
                    ? 'Tracking is active! Every time this contact opens WhatsApp, the exact start time, end time, and total minutes will be logged here.'
                    : 'Click "Start Tracking" above to begin monitoring and recording when this contact comes online.'}
                </p>
              </div>
            ) : visibleGroups.length === 0 ? (
              <div className="p-6 bg-[#202c33] rounded-xl text-center text-xs text-[#8696a0] border border-white/5">
                No sessions recorded for {dayFilter === 'today' ? 'Today' : 'Yesterday'}.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {visibleGroups.map((group) => (
                  <div key={group.day} className="space-y-1.5">
                    {/* Day Group Header */}
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#8696a0] px-1 pt-1">
                      <span>{group.day}</span>
                      <span className="text-[#00a884]">
                        {group.sessions.length} session(s) · {formatDuration(group.totalSeconds)}
                      </span>
                    </div>

                    {/* Session Rows */}
                    {group.sessions.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-[#202c33] border border-white/5 flex items-center justify-between text-xs hover:bg-[#25323a] transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-[#00a884] shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#e9edef] font-semibold">
                                {formatExactTime(s.start)}
                              </span>
                              <span className="text-[#8696a0]">→</span>
                              <span className="text-[#e9edef] font-semibold">
                                {formatExactTime(s.end)}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#8696a0] block">
                              Came online at {formatExactTime(s.start)}, offline at {formatExactTime(s.end)}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] bg-[#00a884]/15 text-[#00a884] font-bold px-2 py-0.5 rounded-full shrink-0">
                          {formatDuration(s.durationSeconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#202c33] border-t border-[#222d34] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#8696a0]">
            🔒 Silent local tracking · Sessions saved to disk permanently
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2a3942] hover:bg-[#32424b] text-[#e9edef] font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
