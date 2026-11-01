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

import React, { useState } from 'react';
import { getMediaDownloadUrl } from '../../api/client';
import { formatFileSize } from '../../utils/format';
import PdfModal from '../Modals/PdfModal';

function getFileBadgeInfo(fileName = '', mime = '') {
  const ext = fileName.split('.').pop().toLowerCase();
  if (ext === 'pdf' || mime.includes('pdf')) {
    return { ext: 'PDF', bg: 'bg-red-500/20 text-red-400 border-red-500/30', isPdf: true };
  }
  if (['doc', 'docx'].includes(ext) || mime.includes('word')) {
    return { ext: 'DOC', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30', isPdf: false };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) {
    return { ext: 'XLS', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', isPdf: false };
  }
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation')) {
    return { ext: 'PPT', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', isPdf: false };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return { ext: 'ZIP', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30', isPdf: false };
  }
  return { ext: (ext || 'FILE').slice(0, 4).toUpperCase(), bg: 'bg-slate-500/20 text-slate-300 border-slate-500/30', isPdf: false };
}

export default function DocumentCard({ msg }) {
  const [showPdfModal, setShowPdfModal] = useState(false);

  const rawFileName = msg.file_name || (msg.media_path ? msg.media_path.split('_').slice(3).join('_') : 'document');
  const badgeInfo = getFileBadgeInfo(rawFileName, msg.mimetype);
  const downloadUrl = msg.media_path ? getMediaDownloadUrl(msg.media_path, rawFileName) : null;

  const handleCardClick = (e) => {
    // If it's a PDF and downloaded on disk, clicking the card opens the full viewer modal
    if (badgeInfo.isPdf && msg.media_path) {
      e.preventDefault();
      setShowPdfModal(true);
    }
  };

  return (
    <>
      <div className="my-1.5">
        <div
          onClick={handleCardClick}
          className={`group flex items-center justify-between gap-3 p-2.5 rounded-xl border border-white/10 bg-[#111b21]/75 hover:bg-[#111b21] transition shadow-sm select-none ${
            badgeInfo.isPdf && msg.media_path ? 'cursor-pointer' : ''
          }`}
        >
          {/* File Type Badge / Icon */}
          <div
            className={`w-11 h-11 rounded-lg border flex flex-col items-center justify-center shrink-0 font-bold text-xs tracking-wider ${badgeInfo.bg}`}
          >
            <svg className="w-4 h-4 mb-0.5 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-[9px] font-extrabold leading-none">{badgeInfo.ext}</span>
          </div>

          {/* Document metadata */}
          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-semibold text-[#e9edef] group-hover:text-white truncate">
              {rawFileName}
            </h4>
            <div className="flex items-center gap-1.5 text-[10.5px] text-[#8696a0] mt-0.5 font-mono">
              {msg.file_size ? <span>{formatFileSize(msg.file_size)}</span> : null}
              {msg.page_count ? <span>• {msg.page_count} pages</span> : null}
              {badgeInfo.isPdf && msg.media_path && (
                <span className="text-[#00a884] font-sans font-medium group-hover:underline ml-1">
                  Click to read
                </span>
              )}
            </div>
          </div>

          {/* Action: Direct Download */}
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download={rawFileName}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 p-2 rounded-full bg-white/5 hover:bg-[#00a884] hover:text-white text-[#8696a0] transition shadow-sm"
              title={`Download ${rawFileName}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          ) : (
            <div className="text-[10px] text-amber-400">Offline</div>
          )}
        </div>

        {/* Optional caption if present */}
        {msg.caption && msg.caption !== rawFileName && (
          <p className="mt-1.5 text-[12.5px] text-[#e9edef] whitespace-pre-wrap break-words px-1">
            {msg.caption}
          </p>
        )}
      </div>

      {/* PDF Modal Reader */}
      {showPdfModal && (
        <PdfModal
          doc={{
            media_path: msg.media_path,
            file_name: rawFileName,
            file_size: msg.file_size,
            page_count: msg.page_count
          }}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </>
  );
}

