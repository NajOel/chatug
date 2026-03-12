require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const Filter = require('bad-words');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.set('trust proxy', 1);
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

const filter = new Filter();

// ─── In-Memory State ──────────────────────────────────────────────────────────
const waitingUsers = [];      // queue of users waiting to be matched
const activeRooms = {};       // roomId -> { users: [socketId, socketId], ... }
const userProfiles = {};      // socketId -> profile object
const reportedUsers = {};     // socketId -> count
const bannedSockets = new Set();

// ─── Matching Algorithm ───────────────────────────────────────────────────────
function scoreMatch(a, b) {
  let score = 0;
  if (a.language === b.language) score += 40;
  if (a.university && b.university && a.university === b.university) score += 30;
  const sharedInterests = (a.interests || []).filter(i => (b.interests || []).includes(i));
  score += sharedInterests.length * 10;
  if (a.city && b.city && a.city === b.city) score += 15;
  return score;
}

function findBestMatch(profile, queue) {
  if (queue.length === 0) return null;

  // Filter out users they've already talked to
  const candidates = queue.filter(u =>
    u.socketId !== profile.socketId &&
    !(profile.skipList || []).includes(u.socketId)
  );

  if (candidates.length === 0) return queue[0] || null;

  let best = candidates[0];
  let bestScore = scoreMatch(profile, candidates[0]);

  for (const candidate of candidates) {
    const s = scoreMatch(profile, candidate);
    if (s > bestScore) { bestScore = s; best = candidate; }
  }

  return best;
}

// ─── Profanity & Moderation ───────────────────────────────────────────────────
function moderateMessage(text) {
  try { return filter.clean(text); } catch { return text; }
}

function checkAbuse(socketId) {
  reportedUsers[socketId] = (reportedUsers[socketId] || 0) + 1;
  if (reportedUsers[socketId] >= 3) {
    bannedSockets.add(socketId);
    return true;
  }
  return false;
}

// ─── Socket.IO Logic ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  if (bannedSockets.has(socket.id)) {
    socket.emit('banned', { message: 'You have been banned due to multiple reports.' });
    socket.disconnect();
    return;
  }

  console.log(`[+] Connected: ${socket.id}`);

  socket.on('set_profile', (profile) => {
    userProfiles[socket.id] = {
      socketId: socket.id,
      name: profile.name || 'Anonymous',
      language: profile.language || 'English',
      interests: profile.interests || [],
      city: profile.city || '',
      university: profile.university || '',
      gender: profile.gender || '',
      isPremium: profile.isPremium || false,
      skipList: [],
    };
    socket.emit('profile_set', { ok: true });
  });

  socket.on('find_match', () => {
    const profile = userProfiles[socket.id];
    if (!profile) return socket.emit('error', { message: 'Set profile first' });

    // Remove from any existing room
    leaveCurrentRoom(socket);

    // Check if already waiting
    const alreadyWaiting = waitingUsers.find(u => u.socketId === socket.id);
    if (!alreadyWaiting) {
      const match = findBestMatch(profile, waitingUsers);

      if (match) {
        // Remove match from queue
        const idx = waitingUsers.findIndex(u => u.socketId === match.socketId);
        if (idx !== -1) waitingUsers.splice(idx, 1);

        const roomId = uuidv4();
        activeRooms[roomId] = {
          users: [socket.id, match.socketId],
          createdAt: Date.now(),
        };

        socket.join(roomId);
        io.sockets.sockets.get(match.socketId)?.join(roomId);

        userProfiles[socket.id].currentRoom = roomId;
        userProfiles[match.socketId].currentRoom = roomId;

        io.to(roomId).emit('match_found', {
          roomId,
          partnerLanguage: match.language,
          partnerInterests: match.interests,
          partnerUniversity: match.university,
        });

        console.log(`[~] Room created: ${roomId}`);
      } else {
        waitingUsers.push(profile);
        socket.emit('waiting', { position: waitingUsers.length });
      }
    }
  });

  socket.on('send_message', ({ roomId, text }) => {
    if (!text || text.trim().length === 0) return;
    const clean = moderateMessage(text.substring(0, 500));
    socket.to(roomId).emit('receive_message', {
      text: clean,
      senderId: socket.id,
      timestamp: Date.now(),
    });
  });

  socket.on('skip', () => {
    const profile = userProfiles[socket.id];
    if (!profile) return;

    const roomId = profile.currentRoom;
    if (roomId && activeRooms[roomId]) {
      const partner = activeRooms[roomId].users.find(id => id !== socket.id);
      if (partner) {
        io.sockets.sockets.get(partner)?.emit('partner_skipped');
        profile.skipList = [...(profile.skipList || []), partner];
      }
      leaveCurrentRoom(socket);
    }
    // Auto re-queue
    socket.emit('waiting', { position: waitingUsers.length + 1 });
    waitingUsers.push(profile);
  });

  socket.on('report_user', ({ roomId, reason }) => {
    const room = activeRooms[roomId];
    if (!room) return;
    const partner = room.users.find(id => id !== socket.id);
    if (partner) {
      const banned = checkAbuse(partner);
      if (banned) {
        io.sockets.sockets.get(partner)?.emit('banned', { message: 'You have been banned.' });
        io.sockets.sockets.get(partner)?.disconnect();
      }
    }
    socket.emit('report_received', { ok: true });
  });

  socket.on('send_gift', ({ roomId, gift }) => {
    const gifts = {
      rose:   { emoji: '🌹', name: 'Rose',  price: 1000 },
      fire:   { emoji: '🔥', name: 'Fire',  price: 2000 },
      crown:  { emoji: '👑', name: 'Crown', price: 5000 },
    };
    const g = gifts[gift];
    if (!g) return;
    socket.to(roomId).emit('receive_gift', { ...g, from: socket.id });
  });

  // ── WebRTC Signaling ──
  socket.on('webrtc_offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('webrtc_offer', { offer, from: socket.id });
  });
  socket.on('webrtc_answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('webrtc_answer', { answer, from: socket.id });
  });
  socket.on('webrtc_ice', ({ roomId, candidate }) => {
    socket.to(roomId).emit('webrtc_ice', { candidate, from: socket.id });
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    leaveCurrentRoom(socket);
    const wIdx = waitingUsers.findIndex(u => u.socketId === socket.id);
    if (wIdx !== -1) waitingUsers.splice(wIdx, 1);
    delete userProfiles[socket.id];
  });

  function leaveCurrentRoom(sock) {
    const profile = userProfiles[sock.id];
    if (!profile?.currentRoom) return;
    const roomId = profile.currentRoom;
    const room = activeRooms[roomId];
    if (room) {
      const partner = room.users.find(id => id !== sock.id);
      if (partner) io.sockets.sockets.get(partner)?.emit('partner_left');
      delete activeRooms[roomId];
    }
    sock.leave(roomId);
    profile.currentRoom = null;
  }
});

// ─── REST Endpoints ───────────────────────────────────────────────────────────
app.get('/api/stats', (_, res) => {
  res.json({
    online: Object.keys(userProfiles).length,
    waiting: waitingUsers.length,
    activeRooms: Object.keys(activeRooms).length,
  });
});

app.post('/api/payment/initiate', (req, res) => {
  // Stub – integrate MTN MoMo / Airtel Money SDKs here
  const { phone, amount, network, purpose } = req.body;
  console.log(`Payment request: ${network} ${phone} UGX ${amount} for ${purpose}`);
  res.json({ status: 'pending', transactionId: uuidv4(), message: 'Payment initiated (sandbox)' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 ChatUG Backend running on port ${PORT}`));
