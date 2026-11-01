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

import React, { useState, useRef } from 'react';
import { API_BASE, getMediaDownloadUrl } from '../../api/client';
import { formatMediaDuration, formatFileSize } from '../../utils/format';

const SPEEDS = [1, 1.5, 2];

export default function AudioPlayer({ msg }) {
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(msg.duration || 0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  const audioSrc = msg.media_path ? `${API_BASE}${msg.media_path}` : null;
  const fileName = msg.file_name || `audio_${msg.id}.${msg.is_ptt ? 'ogg' : 'mp3'}`;
  const downloadUrl = getMediaDownloadUrl(msg.media_path, fileName);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setHasError(true));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || msg.duration || 0);
    setHasError(false);
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const cycleSpeed = (e) => {
    e?.stopPropagation();
    const nextIdx = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIdx);
    const newSpeed = SPEEDS[nextIdx];
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  if (!audioSrc) {
    return (
      <div className="my-1.5 flex items-center gap-3 bg-[#111b21]/60 rounded-xl px-3.5 py-2.5 border border-white/5">
        <span className="text-xl">{msg.is_ptt ? '🎤' : '🎵'}</span>
        <div className="flex-1">
          <p className="text-xs text-[#8696a0]">
            {msg.is_ptt ? 'Voice note stream not stored' : 'Audio stream not stored'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-1.5 bg-[#111b21]/70 hover:bg-[#111b21] transition rounded-2xl px-3 py-2 border border-white/5 shadow-sm select-none">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setHasError(true)}
      />

      <div className="flex items-center gap-3">
        {/* Play / Pause circular button */}
        <button
          onClick={togglePlay}
          className="shrink-0 w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#029070] text-white flex items-center justify-center shadow transition-transform active:scale-95"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Scrubber + Waveform simulation */}
        <div className="flex-1 min-w-0">
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#00a884]"
              style={{
                background: `linear-gradient(to right, #00a884 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.15) ${(currentTime / (duration || 1)) * 100}%)`
              }}
            />
          </div>

          {/* Time & Size labels */}
          <div className="flex items-center justify-between text-[10px] text-[#8696a0] mt-1 font-mono">
            <span>{formatMediaDuration(isPlaying ? currentTime : duration)}</span>
            <div className="flex items-center gap-1.5">
              {msg.is_ptt ? (
                <span className="text-[#00a884] font-medium flex items-center gap-0.5">
                  <span>🎤</span> PTT
                </span>
              ) : (
                <span>{formatFileSize(msg.file_size)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Speed toggle */}
        <button
          onClick={cycleSpeed}
          className="shrink-0 px-2 py-1 rounded-full text-[10.5px] font-bold bg-white/10 hover:bg-white/20 text-[#00a884] transition"
          title="Playback speed"
        >
          {SPEEDS[speedIndex]}x
        </button>

        {/* Direct Download */}
        <a
          href={downloadUrl}
          download={fileName}
          className="shrink-0 p-1 text-[#8696a0] hover:text-[#00a884] transition"
          title="Download audio"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>

      {hasError && (
        <div className="mt-1 text-[10px] text-red-400">
          Unable to play format. <a href={downloadUrl} className="underline text-[#00a884]">Download file</a>
        </div>
      )}
    </div>
  );
}

