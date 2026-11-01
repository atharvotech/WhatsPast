# WhatsPast ⚡
### Universal Offline-First WhatsApp Interceptor, Anti-Revoke Archive & 24/7 Presence Tracker

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Protocol](https://img.shields.io/badge/Protocol-Baileys%206.7-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20%2F%20No%20Cloud-00a884?style=for-the-badge)](https://github.com/atharvotech/whatspast)

<p align="center">
  <b>View what vanished.</b> An open-source, multi-platform intelligence tool and offline logger that intercepts, archives, and recovers deleted, edited, archived, and view-once WhatsApp messages in real time.
</p>

[Key Features](#-key-features) •
[Architecture](#-system-architecture) •
[Quick Start](#-quick-start) •
[Android 24/7 Setup](#-android-247-background-tracking-guide) •
[REST API](#-rest-api-documentation) •
[Project Structure](#-project-structure) •
[License](#-license)

</div>

---

## 📖 Overview

**WhatsPast** (powered by the **WA Shakti** engine) pairs directly with any WhatsApp account via a secure, official **pairing code** (no camera or QR code scan required). Once paired as a multi-device companion, it silently intercepts all messaging events across your chats, preserving incoming and outgoing media, deleted messages, revision histories, and presence statuses locally on your own machine.

Built with an offline-first architecture, WhatsPast ensures that **100% of your data remains on your personal hardware** (`~/.wa-shakti-data/`). Zero data is sent to external servers or cloud databases.

---

## ✨ Key Features

### 🚫 Real-Time Anti-Revoke
- Automatically intercepts and preserves messages revoked by the sender (*"This message was deleted"*).
- Visual deleted badge with the original text, timestamp, and sender details permanently intact.

### ✏️ Edit Revision Timeline
- Audits and stores every individual edit made to any WhatsApp message.
- Interactive edit history modal displaying the entire timeline of revisions with precise timestamps.

### 👁️ View-Once Media Vault
- Automatically captures and downloads expiring view-once photos, videos, and audio notes to disk before WhatsApp self-destructs them.

### 🎬 Built-in Rich Media Suite (WhatsApp-Grade)
- **Inline Video Player**: Custom controls with play/pause, time scrubber, volume, playback speed multiplier (`0.5x`, `1x`, `1.25x`, `1.5x`, `2x`), and direct one-click download.
- **Audio & Voice Note Player**: Custom audio player with seek slider, duration formatting, and speed toggles.
- **Fullscreen PDF Viewer**: Multi-page PDF previewer with direct navigation, zoom controls, and attachment download.
- **Document Cards**: MIME-aware document badges (PDF, DOCX, ZIP, APK, etc.) with accurate file sizes and download buttons.
- **Offline Playback**: All cached media plays seamlessly even when the backend is offline or disconnected.

### ⏱️ Contact Presence & Online Hours Tracker
- Real-time contact presence detection (`available`, `unavailable`, `composing`).
- Comprehensive presence session log tracking exact connect/disconnect intervals.
- Cumulative metrics: **Today's Online Time** vs. **Total Historical Online Time**.
- Selectively enable or disable presence tracking per contact.

### 🔋 Android 24/7 Termux-Grade Background Service
- Native Android Foreground Service (`BackgroundTrackingService.java`) with persistent notification.
- CPU partial wake lock (`PowerManager.PARTIAL_WAKE_LOCK`) and battery optimization exemption.
- `BOOT_COMPLETED` broadcast receiver automatically restarts tracking when your phone reboots.
- User-switchable tracking modes:
  - **Live Tracking (24/7)**: Keeps the background service running continuously to record every presence change and message.
  - **Passive Tracking**: Logs data only while the application is actively open, saving maximum battery.

### 👥 Multi-Account Switcher & Clean Lifecycle
- Add, store, and manage multiple WhatsApp profiles simultaneously.
- Clean logout endpoint with the option to revoke credentials or completely wipe local databases.
- Auto-remembers the last active profile so you never have to re-select on startup.

### 🗃️ Archived, Locked (LID) & Custom Muting
- Unified contact resolution for WhatsApp LID (`@lid`) and Phone JIDs (`@s.whatsapp.net`).
- Dedicated navigation tabs: **All Chats**, **Archived**, and **Locked**.
- Individual chat mute toggle to selectively exclude high-volume conversations from intercept logging.

### 🎨 Native WhatsApp Web Theme & Mobile-Responsive UX
- Pixel-perfect dark theme adhering to WhatsApp Web specifications (`#0b141a`, `#111b21`, `#202c33`, `#2a3942`, `#00a884`).
- Optimized for mobile: dynamic viewport height (`100dvh`), notch/safe-area insets, and native Android gesture/hardware back button support.
- Spring-physics page transitions between chat lists and conversation views.
- Instant bottom scroll on chat load (zero top-to-bottom scroll flight) with a floating "Scroll to Bottom" button for older messages.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph WhatsApp["WhatsApp Network"]
        WA[WhatsApp Multi-Device Servers]
    end

    subgraph Backend["WA Shakti Backend (Node.js :3000)"]
        BL[Baileys WebSocket Engine]
        AUTH[Multi-File Auth Manager]
        PRES[Presence Tracker & Session Logger]
        MEDIA[Media Downloader & Decryptor]
        ROUTER[Express REST & Static Media API]
    end

    subgraph Storage["Local Storage (~/.wa-shakti-data/)"]
        CREDS[auth_{phone}/ Credentials]
        DB[db_{phone}.json Messages & Chats]
        FILES[media/ Decrypted Media Files]
    end

    subgraph Clients["Universal Clients"]
        WEB[Vite Web App :5173]
        ELEC[Electron 31 Desktop App]
        ANDR[Android App + Foreground Service]
    end

    WA <-->|Secure WebSocket| BL
    BL --> AUTH
    BL --> PRES
    BL --> MEDIA
    AUTH <--> CREDS
    BL --> ROUTER
    ROUTER <--> DB
    MEDIA --> FILES
    ROUTER --> FILES

    ROUTER <-->|REST API /media| WEB
    ROUTER <-->|REST API /media| ELEC
    ROUTER <-->|REST API /media| ANDR
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- *(For Android)*: Android Studio & Android SDK 33+

### 1. Installation

Clone the repository and install all dependencies:
```bash
git clone https://github.com/atharvotech/whatspast.git
cd whatspast
npm install
```

### 2. Run in Web Browser
Open two terminal windows:

```bash
# Terminal 1 — Start the WA Shakti backend server
npm run server
```

```bash
# Terminal 2 — Start the Vite frontend dev server
npm run dev:web
```

Navigate to `http://localhost:5173` in your browser.

### 3. Run as Desktop Application (Electron)
Build the web assets and launch the Electron desktop shell (includes system tray integration):
```bash
npm run build:web && npm run start:electron
```

To build a standalone Windows installer (`.exe`):
```bash
npm run build:exe
```

### 4. Build for Android (Capacitor)
Sync web assets and open the Android project in Android Studio:
```bash
npm run sync:apk
npx cap open android
```
From Android Studio, connect your phone or emulator and click **Run** (or execute `./gradlew assembleDebug` inside the `android/` directory).

---

## 📱 How to Pair Your Account

1. Start the application (Web, Desktop, or Android).
2. Enter your international phone number with country code (e.g., `919876543210` for India, `12025550123` for US).
3. Click **Generate Pairing Code**.
4. An 8-digit code (e.g., `ABCD-1234`) will appear on screen.
5. On your phone:
   - Open **WhatsApp** → Tap **Settings** (or 3 dots) → **Linked Devices**
   - Tap **Link a Device**
   - Tap **Link with phone number instead** at the bottom of the screen
   - Enter the 8-digit code displayed in WhatsPast.
6. Once connected, your chats and messages will synchronize automatically.

---

## 🔋 Android 24/7 Background Tracking Guide

Android's battery management aggressively kills background processes. To ensure **WhatsPast** tracks messages and presence 24/7 without being killed (similar to Termux), configure your device as follows:

### 1. In-App Tracking Mode
- Click the **Gear icon** in the top navigation bar.
- Select **Live Tracking (24/7)** to enable the persistent foreground service and wake lock.

### 2. Device Battery Optimizations

| Manufacturer | Settings Required |
|--------------|-------------------|
| **Samsung (OneUI)** | **Settings** → **Apps** → **WhatsPast** → **Battery** → Select **Unrestricted**.<br>**Device Care** → **Battery** → **Background usage limits** → Add to **Never sleeping apps**. |
| **Xiaomi / Redmi / POCO (MIUI / HyperOS)** | **Settings** → **Apps** → **Manage Apps** → **WhatsPast**:<br>1. Enable **Autostart**.<br>2. Set **Battery saver** to **No restrictions**.<br>3. Open Recent Apps, long-press WhatsPast and tap the **Lock** icon. |
| **OnePlus / OPPO / Realme (OxygenOS / ColorOS)** | **Settings** → **Apps** → **WhatsPast** → **Battery usage** → Enable **Allow background activity** & **Allow auto-launch**.<br>Lock the app card in the Recent Apps menu. |
| **Stock Android / Pixel / Motorola** | **Settings** → **Apps** → **WhatsPast** → **App battery usage** → Set to **Unrestricted**. |

---

## 🔌 REST API Documentation

The backend exposes an Express REST API on `http://127.0.0.1:3000`.

### Authentication & Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Current connection state, active user, saved accounts list, pairing code, and last error. |
| `POST` | `/api/auth/login` | `{ "phone": "919876543210" }` — Initiates pairing session and returns 8-digit code. |
| `POST` | `/api/auth/switch` | `{ "phone": "919876543210" }` — Switches active session to a saved profile. |
| `POST` | `/api/auth/logout` | `{ "phone": "...", "purgeData": false }` — Disconnects and cleanly revokes credentials. |
| `POST` | `/api/auth/delete` | `{ "phone": "..." }` — Permanently wipes credentials and local database. |

### Chats & Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chats` | Returns array of intercepted chat summaries (sorted newest first). |
| `GET` | `/api/chats/:chatId` | Returns all messages for a specific chat (sorted oldest first). |
| `POST` | `/api/chats/archive` | `{ "chat_id": "...", "archived": true }` — Toggles archived status. |
| `POST` | `/api/settings/toggle` | `{ "chat_id": "...", "enable": false }` — Mutes or unmutes interception for a chat. |

### Presence & Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/presence/:jid` | Returns real-time status, last seen, today's online duration, total online duration, and session logs. |
| `POST` | `/api/presence/track` | `{ "jid": "...", "enable": true }` — Starts/stops active presence tracking for a contact. |
| `GET` | `/api/settings/tracking-mode` | Returns `{ "mode": "live" \| "passive" }`. |
| `POST` | `/api/settings/tracking-mode` | `{ "mode": "live" \| "passive" }` — Updates tracking mode. |

### Media & Storage
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/media/:filename` | Streams local media files with HTTP 206 partial content support for video/audio scrubbing. |
| `GET` | `/api/media/download` | `?file=filename&name=custom.ext` — Serves file with download attachment headers. |
| `GET` | `/api/profile-pic/:jid` | Fetches, caches, and serves profile pictures with LID resolution. |
| `POST` | `/api/storage/clear` | Wipes all messages for the active profile while preserving authentication. |

---

## 📁 Project Structure

```
whatspast/
├── android/                   # Native Android Project (Capacitor)
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml # Permissions (WakeLock, BootCompleted, ForegroundService)
│   │   └── java/.../washakti/
│   │       ├── BackgroundTrackingService.java  # Persistent foreground service
│   │       ├── BootReceiver.java               # Auto-restart on device boot
│   │       ├── MainActivity.java               # Native Android entry point
│   │       └── TrackingPlugin.java             # Bridge between web & native service
├── electron/
│   └── main.js                # Electron shell with system tray & embedded server
├── server/
│   └── index.js               # Express + Baileys WhatsApp backend engine
├── src/                       # React 18 Frontend
│   ├── api/
│   │   └── client.js          # Centralized API client for all backend calls
│   ├── components/
│   │   ├── ChatView/
│   │   │   ├── AudioPlayer.jsx   # Custom waveform/scrubber audio player
│   │   │   ├── ChatHeader.jsx    # Contact info, presence status, logging toggle
│   │   │   ├── DocumentCard.jsx  # MIME document preview and download card
│   │   │   ├── MessageBubble.jsx # Message renderer (anti-revoke, edits, media)
│   │   │   ├── MessageList.jsx   # Instant-bottom list with floating scroll badge
│   │   │   ├── VideoPlayer.jsx   # Custom video player with speed and scrubber
│   │   │   └── index.jsx         # Chat view container
│   │   ├── Modals/
│   │   │   ├── AccountManagementModal.jsx # Multi-account switcher & clean logout
│   │   │   ├── PdfModal.jsx               # Multi-page PDF previewer
│   │   │   ├── PresenceModal.jsx          # Online hours and session history
│   │   │   ├── PurgeModal.jsx             # Database purge confirmation
│   │   │   └── TrackingSettingsModal.jsx  # 24/7 Live vs. Passive tracking toggle
│   │   ├── Sidebar/
│   │   │   ├── ChatList.jsx      # Filtered & sorted contact list
│   │   │   ├── Header.jsx        # App header, account switcher, settings
│   │   │   ├── PairingBanner.jsx # 8-digit pairing code UI
│   │   │   ├── SearchBar.jsx     # Search input
│   │   │   ├── TabBar.jsx        # All / Archived / Locked tabs
│   │   │   └── index.jsx         # Sidebar container
│   │   └── shared/
│   │       └── Avatar.jsx        # Cached profile picture with fallback initials
│   ├── context/
│   │   └── AppContext.jsx     # Global state (system status, chats, active chat)
│   ├── hooks/
│   │   └── useMessages.js     # Chat message polling hook
│   ├── utils/
│   │   └── format.js          # Time, date, and byte formatting utilities
│   ├── App.jsx                # Layout root with mobile spring transitions
│   └── main.jsx               # React DOM entry point
├── index.html                 # HTML shell with Tailwind CDN
├── vite.config.js             # Vite bundler configuration
├── capacitor.config.json      # Capacitor configuration
├── LICENSE                    # GNU General Public License v3.0
└── package.json               # Scripts & dependencies
```

---

## 🔒 Security & Privacy Notice

- **100% Local**: All WhatsApp messages, encryption keys, and downloaded media files are stored strictly on your local device under `~/.wa-shakti-data/`.
- **No Cloud Relay**: WhatsPast contains **zero external telemetry**, analytics, or cloud relays. Your data never touches any server other than WhatsApp's official multi-device infrastructure.
- **Credential Protection**: The `.gitignore` is configured to ensure session keys (`auth_*`), database records (`db_*.json`), and decrypted files (`media/`) can never be accidentally committed to git.

---

## ⚖️ Disclaimer & Ethical Use

WhatsPast is intended strictly for:
1. Personal data backup and message recovery for accounts you own.
2. Forensic analysis and security research on WhatsApp multi-device protocols.
3. Auditing and record-keeping in accordance with applicable local laws and privacy regulations.

The authors do not endorse or encourage unauthorized interception of communications. Use responsibly.

---

## 📄 License

```
Copyright (C) 2026 Atharv Shukla (atharvotech)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```
