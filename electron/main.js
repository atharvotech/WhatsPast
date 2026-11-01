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

const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let keepAliveInTray = true;

process.env.WA_DATA_DIR = path.join(app.getPath('userData'), 'WA-Shakti-Data');
require('../server/index.js');

function createTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="#00a884"/>
    <path d="M11 16l3 3 7-7" stroke="#0b141a" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 850,
    minHeight: 600,
    title: 'WA Shakti — Universal Interceptor',
    backgroundColor: '#0b141a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  if (app.isPackaged || require('fs').existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting && keepAliveInTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function setupTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('WA Shakti — Interceptor Active');

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open WA Shakti Dashboard',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Keep Alive in Tray on Close (24x7 Shield)',
        type: 'checkbox',
        checked: keepAliveInTray,
        click: (item) => {
          keepAliveInTray = item.checked;
          updateMenu();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit WA Shakti Completely',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateMenu();
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupTray();
});

app.on('before-quit', () => {
  isQuitting = true;
});
