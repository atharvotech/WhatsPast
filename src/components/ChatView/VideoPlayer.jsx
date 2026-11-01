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

import React, { useState, useRef, useEffect } from 'react';
import { API_BASE, getMediaDownloadUrl } from '../../api/client';
import { formatMediaDuration, formatFileSize } from '../../utils/format';

const SPEEDS = [1, 1.5, 2];

export default function VideoPlayer({ msg }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(msg.duration || 0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);

  const hideControlsTimer = useRef(null);

  // Check if mediaPath is a video file or fallback thumbnail
  const isVideoFile = msg.media_path && !msg.media_path.endsWith('.jpg') && !msg.media_path.endsWith('.jpeg') && !msg.media_path.endsWith('.png');
  const videoSrc = isVideoFile ? `${API_BASE}${msg.media_path}` : null;
  const posterSrc = msg.thumbnail_path
    ? `${API_BASE}${msg.thumbnail_path}`
    : (!isVideoFile && msg.media_path ? `${API_BASE}${msg.media_path}` : null);

  const fileName = msg.file_name || `video_${msg.id}.mp4`;
  const downloadUrl = getMediaDownloadUrl(msg.media_path || msg.thumbnail_path, fileName);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => setHasError(true));
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || msg.duration || 0);
    setHasError(false);
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const cycleSpeed = (e) => {
    e?.stopPropagation();
    const nextIdx = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIdx);
    const newSpeed = SPEEDS[nextIdx];
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
    }
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = (e) => {
    e?.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else if (videoRef.current && videoRef.current.webkitEnterFullscreen) {
        videoRef.current.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // If this message was saved before video downloads or video stream is missing, show thumbnail card with fallback info
  if (!isVideoFile) {
    return (
      <div className="my-1.5 rounded-lg overflow-hidden border border-white/10 bg-black/40">
        {posterSrc ? (
          <div className="relative group">
            <img
              src={posterSrc}
              alt="Video thumbnail"
              className="max-h-60 w-full object-cover rounded-t-lg"
            />
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-3 text-center">
              <div className="w-12 h-12 rounded-full bg-black/70 flex items-center justify-center text-white/80 mb-2 border border-white/20">
                <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-[11px] bg-black/80 text-amber-300 font-semibold px-2.5 py-1 rounded-full border border-amber-500/30">
                Thumbnail only (legacy message)
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#2a3942] rounded-lg text-xs text-[#8696a0] flex items-center gap-2">
            <span>🎥</span> Video file not stored
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative my-1.5 rounded-xl overflow-hidden bg-black border border-white/10 shadow-lg select-none group"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onError={() => setHasError(true)}
        className="w-full max-h-[380px] object-contain cursor-pointer bg-black"
      />

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-10 h-10 border-3 border-[#00a884] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* WhatsApp-Style Big Play Button (when paused) */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 hover:bg-[#00a884] text-white flex items-center justify-center transition-all duration-200 shadow-xl border border-white/20 hover:scale-105"
          aria-label="Play video"
        >
          <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Duration badge when paused and controls hidden */}
      {!isPlaying && duration > 0 && !showControls && (
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[10.5px] font-mono text-white/90">
          {formatMediaDuration(duration)}
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-3 text-center">
          <span className="text-xl mb-1">⚠️</span>
          <p className="text-xs text-red-300 font-medium">Failed to decode video stream</p>
          <a
            href={downloadUrl}
            download={fileName}
            className="mt-2 text-[11px] text-[#00a884] hover:underline"
          >
            Download video directly
          </a>
        </div>
      )}

      {/* WhatsApp Control Bar Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-3 pt-6 pb-2 transition-opacity duration-200 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber / Seek Slider */}
        <div className="relative flex items-center mb-1 group/slider">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-[#00a884] hover:h-1.5 transition-all"
            style={{
              background: `linear-gradient(to right, #00a884 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%)`
            }}
          />
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between text-white/90 text-xs">
          {/* Left: Play/Pause, Volume, Timers */}
          <div className="flex items-center gap-2.5">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="p-1 hover:text-[#00a884] transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Mute / Unmute */}
            <button
              onClick={toggleMute}
              className="p-1 hover:text-[#00a884] transition"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {/* Timers */}
            <span className="font-mono text-[11px] text-white/80">
              {formatMediaDuration(currentTime)} / {formatMediaDuration(duration)}
            </span>
          </div>

          {/* Right: Speed, Download, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Speed toggle (1x / 1.5x / 2x) */}
            <button
              onClick={cycleSpeed}
              className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-white/10 hover:bg-[#00a884] hover:text-white transition"
              title="Playback speed"
            >
              {SPEEDS[speedIndex]}x
            </button>

            {/* Direct Download */}
            <a
              href={downloadUrl}
              download={fileName}
              className="p-1 hover:text-[#00a884] transition"
              title={`Download video (${formatFileSize(msg.file_size)})`}
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:text-[#00a884] transition"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

