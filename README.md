# 💬 ChatUG – Uganda's Random Chat Platform

A mobile-first random chat platform for Uganda. Connect with strangers for text, voice, and video chat. Inspired by Omegle but built for Ugandan youth.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone & Install
```bash
git clone <your-repo>
cd chatug
npm install          # installs root dev deps (concurrently)
npm run setup        # installs backend + frontend deps
```

### 2. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env if needed
```

### 3. Run (Both servers)
```bash
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000

---

## 📁 Project Structure

```
chatug/
├── backend/
│   ├── src/
│   │   └── server.js          # Express + Socket.IO + matching
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── context/
│   │   │   └── SocketContext.jsx    # Socket.IO global state
│   │   ├── hooks/
│   │   │   └── useWebRTC.js         # WebRTC peer connections
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Landing / profile setup
│   │   │   └── Chat.jsx             # Chat room
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
└── package.json
```

---

## 🎯 Features

| Feature | Status |
|---|---|
| Random text matching | ✅ |
| Language filter (English/Luganda/Swahili) | ✅ |
| Interest tags | ✅ |
| Campus channels (Makerere, Kyambogo, MUBS, UCU) | ✅ |
| City/location filter | ✅ |
| Voice chat (WebRTC) | ✅ |
| Video chat (WebRTC) | ✅ |
| Skip / Next partner | ✅ |
| Report & moderation | ✅ |
| Profanity filter | ✅ |
| Auto-ban after 3 reports | ✅ |
| Digital gifts (Rose, Fire, Crown) | ✅ |
| Gift animations | ✅ |
| Mobile-first dark UI | ✅ |
| WhatsApp/Telegram invite | ✅ |
| Online counter | ✅ |
| MTN MoMo payment (stub) | 🔧 |
| Airtel Money payment (stub) | 🔧 |
| AI nudity moderation | 🔧 |

---

## 💳 Payment Integration

The payment endpoint is stubbed at `POST /api/payment/initiate`.

To integrate **MTN MoMo**:
1. Sign up at https://momodeveloper.mtn.com
2. Get API key & collection subscription key
3. Replace the stub in `backend/src/server.js`

To integrate **Airtel Money Uganda**:
1. Sign up at https://developers.airtel.africa
2. Use the Collections API
3. Replace stub similarly

---

## 🔒 Moderation

- Profanity filter runs on every message (`bad-words` library)
- Users can report partners (reason logged)
- Auto-ban after 3 reports from different users
- TODO: Add Google Vision API or AWS Rekognition for nudity detection in video

---

## ⚡ Scaling

For production with thousands of users:

1. **Redis adapter** for Socket.IO (multiple Node instances):
   ```bash
   npm install @socket.io/redis-adapter ioredis
   ```

2. **PostgreSQL** for persistent user data & bans:
   ```bash
   npm install pg
   ```

3. **TURN server** for WebRTC behind NAT (Twilio NTS or Coturn):
   ```js
   iceServers: [{ urls: 'turn:your-turn-server', username: '...', credential: '...' }]
   ```

4. **Nginx** reverse proxy for SSL + load balancing

5. **PM2** for process management:
   ```bash
   npm install -g pm2
   pm2 start backend/src/server.js --name chatug-backend
   ```

---

## 📱 Mobile Deployment

The frontend is a PWA-ready React app. To deploy:

```bash
cd frontend && npm run build
# Deploy the build/ folder to any static host (Netlify, Vercel, Firebase Hosting)
```

---

## 🌍 Naming

Consider: **ChatUG**, **TalkUG**, **ConnectUG**, **KampalaTalk**, **JinjaChat**

---

## 📞 Contact & Support

Built for Uganda 🇺🇬
