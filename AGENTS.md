# WA Shakti — Agent Context & Codebase Guide

> **Read this file first** before touching any code. It gives you a complete mental model
> of the project so you can continue development without asking the user for context.

---

## 🧠 What This Project Is

**WA Shakti** is a WhatsApp message interceptor & logger built on top of the
[Baileys](https://github.com/WhiskeySockets/Baileys) library. It links to a WhatsApp account
via a **pairing code** (no QR scan), then silently captures:

- All incoming & outgoing text messages (real-time + history sync)
- Images, stickers, audio, video, documents, location, contacts
- **Anti-revoke** — deleted messages are flagged but preserved
- **Edit history** — every revision of an edited message is stored
- **View-once media** — saved to disk before expiry
- Archived and locked (LID) chats

It targets **three deployment targets** from one codebase:
| Target | Command | Output |
|--------|---------|--------|
| Web browser | `npm run dev:web` | Vite dev server on :5173 |
| Desktop (Electron) | `npm run start:electron` | Electron window + embedded server |
| Android (Capacitor) | `npm run sync:apk` | Capacitor Android project |

---

## 🗂️ Project Structure

```
Documents/
├── server/
│   └── index.js           ← Express + Baileys backend (Node.js)
├── src/
│   ├── main.jsx           ← React entry point (do not modify)
│   ├── App.jsx            ← Root layout: AppProvider + Sidebar + ChatView + PurgeModal
│   ├── api/
│   │   └── client.js      ← ALL HTTP calls to the backend live here
│   ├── utils/
│   │   └── format.js      ← formatTime(ts), formatDate(ts)
│   ├── context/
│   │   └── AppContext.jsx ← Global React state + all handler functions
│   ├── hooks/
│   │   └── useMessages.js ← Polling hook for messages in selected chat
│   └── components/
│       ├── Sidebar/
│       │   ├── index.jsx      ← Full sidebar assembly
│       │   ├── Header.jsx     ← Logo + status dot + account switcher + purge btn
│       │   ├── PairingBanner.jsx  ← Pairing code display OR phone input form
│       │   ├── SearchBar.jsx  ← Chat search input
│       │   ├── TabBar.jsx     ← All / Archived / Locked tabs
│       │   └── ChatList.jsx   ← Scrollable list of intercepted chats
│       ├── ChatView/
│       │   ├── index.jsx      ← Right panel: empty state OR header+messages
│       │   ├── ChatHeader.jsx ← Chat name + JID + logging toggle button
│       │   ├── MessageList.jsx ← Scrollable list + auto-scroll anchor
│       │   └── MessageBubble.jsx ← Single message card with all features
│       └── Modals/
│           └── PurgeModal.jsx ← Confirm-wipe dialog
├── electron/
│   └── main.js            ← Electron shell (tray, window, embeds server)
├── index.html             ← Tailwind CDN loaded here
├── vite.config.js         ← Vite config (base: './', port: 5173)
├── capacitor.config.json  ← Capacitor config (androidScheme: http)
└── package.json           ← Scripts + deps
```

---

## 🔌 Backend API (`server/index.js`)

The backend is an **Express server on `http://127.0.0.1:3000`**.

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | `{ activeUser, users[], status, pairingCode, lastError }` |
| `POST` | `/api/auth/login` | `{ phone }` → starts pairing session, generates 8-digit code |
| `POST` | `/api/auth/switch` | `{ phone }` → switch to a saved account |
| `POST` | `/api/auth/logout` | `{ phone?, purgeData? }` → cleanly logout and revoke session |
| `POST` | `/api/auth/delete` | `{ phone }` → permanently wipe credentials and local database |
| `GET` | `/api/chats` | Returns array of chat summary objects (sorted newest first) |
| `GET` | `/api/chats/:chatId` | Returns array of message objects for a chat (sorted oldest first) |
| `POST` | `/api/chats/archive` | `{ chat_id, archived }` → toggle archived status for a chat |
| `POST` | `/api/settings/toggle` | `{ chat_id, enable }` → enable/disable logging for a chat |
| `GET` | `/api/settings/tracking-mode` | Returns `{ mode: 'live' \| 'passive' }` |
| `POST` | `/api/settings/tracking-mode` | `{ mode }` → switch between 'live' (24/7) and 'passive' |
| `POST` | `/api/storage/clear` | Wipes all messages for activeUser (keeps auth) |
| `GET` | `/api/profile-pic/:jid` | Fetches & caches WhatsApp profile picture with LID fallback |
| `GET` | `/api/presence/:jid` | Returns presence, lastSeen, today/total online time & sessions |
| `POST` | `/api/presence/track` | `{ jid, enable }` → start/stop tracking online hours for contact |
| `GET` | `/media/:filename` | Static file server for downloaded media |
| `GET` | `/api/media/download` | Serves media files with attachment headers for one-click downloading |

### Connection States (`status` field)
- `disconnected` — not linked
- `pairing` — waiting for user to enter code on phone
- `connecting` — reconnecting after code accepted (code 515)
- `connected` — fully linked and receiving messages

### Data Storage
- **Auth sessions**: `~/.wa-shakti-data/users_data/auth_{phone}/` (Baileys multi-file auth)
- **Database**: `~/.wa-shakti-data/users_data/db_{phone}.json`
- **Media**: `~/.wa-shakti-data/media/`

### Database Schema (`db_{phone}.json`)
```json
{
  "chats": {
    "{chatId}": {
      "chat_id": "919876543210@s.whatsapp.net",
      "name": "Contact Name",
      "is_group": false,
      "archived": false,
      "locked": false,
      "last_timestamp": 1730000000
    }
  },
  "contacts": {
    "919876543210@s.whatsapp.net": "Contact Name"
  },
  "messages": {
    "{chatId}": [
      {
        "id": "ABCDEF123456",
        "chat_id": "919876543210@s.whatsapp.net",
        "sender_jid": "919876543210@s.whatsapp.net",
        "sender_name": "Contact Name",
        "from_me": false,
        "message_type": "text",
        "original_text": "Hello",
        "latest_text": "Hello",
        "edit_history": [],
        "is_deleted": false,
        "is_view_once": false,
        "media_path": null,
        "timestamp": 1730000000
      }
    ]
  },
  "settings": {
    "{chatId}": false
  }
}
```

> `settings[chatId] === false` means logging is **muted** for that chat.  
> Absence of a key means logging is **enabled** (default).

---

## ⚛️ Frontend Architecture

### State Flow
```
AppContext (source of truth)
├── systemStatus  ← polled every 2000ms from /api/status
├── chats         ← polled every 2000ms from /api/chats (when connected)
├── selectedChatId
├── activeTab     ('all' | 'archived' | 'locked')
├── searchQuery
├── showPurgeModal
├── showAddAccount
├── phoneInput
├── filteredChats (computed)
└── activeChatObj (computed)

useMessages(selectedChatId)  ← polled every 1800ms from /api/chats/:id
└── messages[]
```

### Component State Access
All components use `useApp()` hook from `AppContext` — **no prop drilling**.  
Only `MessageBubble` receives a `msg` prop (it's a pure display component).  
Only `MessageList` receives a `messages` prop (passed from ChatView/index.jsx).

### API Layer
All fetch calls go through `src/api/client.js`. Never use raw `fetch` in components.  
`API_BASE` is exported from `client.js` and used for media URLs in `MessageBubble`.

---

## 🎨 UI Design System

**Color palette** (WhatsApp Web dark theme):
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#0b141a` | Main background |
| `bg-sidebar` | `#111b21` | Sidebar background |
| `bg-elevated` | `#202c33` | Chat bubbles (incoming), headers |
| `bg-input` | `#2a3942` | Input areas, active states |
| `accent` | `#00a884` | Green accent (WA brand) |
| `text-primary` | `#e9edef` | Primary text |
| `text-secondary` | `#8696a0` | Secondary/muted text |
| `bg-sent` | `#005c4b` | Sent message bubble |

**Styling**: Tailwind CSS loaded via CDN in `index.html` — no build step needed for styles.

---

## 🔑 Key Business Logic

### Message Deduplication
- `type: 'append'` (history sync) → skip if `msg.id` already in `chatMsgs`
- `type: 'notify'` (real-time) → skip if already stored, but update sender_name if improved

### Name Resolution Priority
`resolveSenderName()` in `server/index.js`:
1. `db.contacts[jid]` (non-numeric saved name)
2. `db.chats[jid].name` (non-numeric chat name)
3. `msg.pushName` (WA-provided display name → also stored to contacts)
4. Raw phone number from JID

### JID Normalization
WhatsApp JIDs look like `919876543210:5@s.whatsapp.net` (multi-device device suffix).  
`normalizeJid()` strips the `:5` device part → `919876543210@s.whatsapp.net`.

### Session Management
- Fresh pairing → always wipes `auth_{phone}/` folder entirely (prevents Bad MAC errors)
- Code 515 on disconnect → pairing accepted, reconnect without wiping auth
- Code 401 → logged out → wipe auth folder + set status disconnected
- Any other close → retry after 4 seconds

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `@whiskeysockets/baileys` v6.7.x | WhatsApp Web protocol client |
| `express` | Backend HTTP server |
| `cors` | CORS for frontend ↔ backend |
| `pino` | Logger (used silently in Baileys) |
| `react` v18 | Frontend framework |
| `vite` v5 | Frontend bundler |
| `@vitejs/plugin-react` | Vite React transform |
| `electron` v31 | Desktop shell |
| `@capacitor/core` v6 | Mobile bridge |

---

## 🚀 Running the App

```bash
# Terminal 1 — backend
npm run server

# Terminal 2 — frontend (web)
npm run dev:web
# then open http://localhost:5173

# Desktop (after building frontend)
npm run build:web && npm run start:electron

# Android
npm run sync:apk
```

---

## ⚠️ Known Constraints & Gotchas

1. **Bad MAC errors** — appear after re-pairing with same number. Auth folder is now always wiped on new pairing. To manually fix: `rm -rf ~/.wa-shakti-data/users_data/auth_{phone}`
2. **Network offline** — `fetchLatestBaileysVersion()` fails silently, falls back to bundled version `[2, 3000, 1043857760]`
3. **Tailwind via CDN** — no purge/tree-shaking, all classes available but bundle is large. Fine for desktop/web, might need local Tailwind for production APK.
4. **Port 3000** — backend is hardcoded to `127.0.0.1:3000`. Frontend uses `API_BASE = 'http://127.0.0.1:3000'` in `src/api/client.js`.
5. **Single active user** — only one WhatsApp account can be actively connected at a time. Multiple saved accounts are supported via the account switcher.
6. **`messages.upsert` queue** — each batch runs as an independent promise (not chained) so a failure in one batch doesn't block subsequent messages.

---

## 🛣️ Planned / Incomplete Features (Continue Here)

- [ ] Export chat logs as CSV/JSON
- [ ] Search within a specific chat's messages
- [ ] Notification badge count in sidebar
- [ ] Group member name resolution (beyond pushName)
- [x] Video/audio inline player in ChatView (video, audio, PDF preview, document cards, speed toggle, scrubber)
- [ ] Dark/light theme toggle
- [ ] Settings page (port config, data directory override)
- [ ] Multi-account simultaneous connections

