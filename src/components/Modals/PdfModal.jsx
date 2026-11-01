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

import React, { useEffect } from 'react';
import { API_BASE, getMediaDownloadUrl } from '../../api/client';
import { formatFileSize } from '../../utils/format';

export default function PdfModal({ doc, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!doc) return null;

  const pdfUrl = `${API_BASE}${doc.media_path}`;
  const fileName = doc.file_name || 'document.pdf';
  const downloadUrl = getMediaDownloadUrl(doc.media_path, fileName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      {/* Modal Dialog Window */}
      <div className="relative w-full max-w-5xl h-[92vh] flex flex-col bg-[#111b21] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-modal">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#202c33] border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-xs shrink-0">
              PDF
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#e9edef] truncate max-w-md sm:max-w-xl">
                {fileName}
              </h3>
              <p className="text-[11px] text-[#8696a0]">
                {formatFileSize(doc.file_size)}
                {doc.page_count ? ` • ${doc.page_count} pages` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Open in New Window */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#8696a0] hover:text-[#e9edef] transition text-xs flex items-center gap-1.5"
              title="Open in new window"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="hidden sm:inline">New Tab</span>
            </a>

            {/* Download Button */}
            <a
              href={downloadUrl}
              download={fileName}
              className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#029070] text-white font-medium transition text-xs flex items-center gap-1.5 shadow"
              title="Download document"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download</span>
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF Frame */}
        <div className="flex-1 w-full h-full bg-[#0b141a] relative">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0`}
            title={fileName}
            className="w-full h-full border-0"
          />

          {/* Fallback notice if iframe preview fails */}
          <div className="absolute inset-x-0 bottom-3 text-center pointer-events-none">
            <span className="text-[11px] bg-black/80 text-[#8696a0] px-3 py-1 rounded-full border border-white/10">
              If PDF does not display in browser, use the Download button above
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

