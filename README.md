# WhatsPast ⚡

> **View what vanished.** An open-source Electron application that locally logs and recovers deleted, edited, archived, and locked WhatsApp messages.

WhatsPast pairs directly with your WhatsApp account via a secure pairing code (no QR scan required) and intercepts messages offline-first on your local machine.

---

## ✨ Features

- 🚫 **Anti-Revoke**: Preserves messages deleted by senders ("This message was deleted").
- ✏️ **Edit Revisions**: Tracks and displays complete revision history for edited messages.
- 👁️ **View-Once Preservation**: Safely captures and caches view-once media before it expires.
- 📦 **Archived & Locked Chats**: Intercepts and organizes archived and locked chats.
- 📷 **Rich Media Support**: Automatically saves incoming/outgoing images, stickers, voice notes, audio, video, documents, and locations.
- 🛡️ **Offline & Private**: All data is stored locally on your device (`~/.wa-shakti-data/` or `%APPDATA%/WA-Shakti-Data`). Nothing is sent to external cloud servers.
- 🖥️ **Universal Deployment**: Run as a Web App, Native Desktop App (Electron with system tray), or Android App (Capacitor).

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Backend Server
```bash
npm run server
```
The server will start listening on `http://127.0.0.1:3000`.

### 3. Run the Frontend (Web Dev)
In a separate terminal:
```bash
npm run dev:web
```
Open your browser at `http://localhost:5173`.

### 4. Run as Desktop Application (Electron)
```bash
npm run build:web && npm run start:electron
```

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys), Pino
- **Frontend**: React 18, Vite, Tailwind CSS
- **Desktop Shell**: Electron 31 (System tray integration, background listener)
- **Mobile Support**: Capacitor 6

---

## 📄 License

Copyright (C) 2026 Atharv Shukla (atharvotech).

This project is open-source software licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for the full legal text.

