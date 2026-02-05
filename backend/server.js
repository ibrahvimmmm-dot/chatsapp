const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://chatsapp-production.up.railway.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, check allowed origins
    if (allowedOrigins.includes(origin) || origin.includes('.railway.app')) {
      return callback(null, true);
    }
    
    const msg = 'CORS policy: Not allowed';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  
  // Log for debugging
  console.log(`📦 Production mode: Serving frontend from ${frontendPath}`);
  
  // Serve static files
  app.use(express.static(frontendPath, {
    maxAge: '1y',
    etag: true,
    index: false
  }));
  
  // API routes (must come before catch-all)
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'Chat server is running',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });
  
  app.get('/api/info', (req, res) => {
    res.json({
      service: 'Chat App Backend',
      version: '1.0.0',
      socket: 'Socket.IO ready',
      frontend: 'Served from /dist'
    });
  });
  
  // Catch-all route for SPA - must be last
  app.get('*', (req, res, next) => {
    // Don't serve HTML for API or socket.io routes
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    
    // For all other routes, serve index.html
    res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('Error loading application');
      }
    });
  });
} else {
  // Development mode - only API routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'Chat server is running (dev mode)',
      environment: 'development',
      timestamp: new Date().toISOString()
    });
  });
  
  app.get('/api/info', (req, res) => {
    res.json({
      service: 'Chat App Backend',
      version: '1.0.0',
      mode: 'development',
      note: 'Frontend runs separately on :5173'
    });
  });
}

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow all in development
      if (process.env.NODE_ENV !== 'production' || !origin) {
        return callback(null, true);
      }
      
      // In production, check allowed origins
      if (allowedOrigins.includes(origin) || origin.includes('.railway.app')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'], // Polling first for Railway compatibility
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  cookie: false
});

// Store connected users and rooms
const users = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
  const socketId = socket.id;
  console.log(`✅ User connected: ${socketId}`);
  
  // Send immediate connection confirmation
  socket.emit('connected', { 
    message: 'Connected to chat server',
    socketId: socketId,
    timestamp: new Date().toISOString(),
    serverTime: Date.now()
  });

  // Register user
  socket.on('register_user', (username) => {
    const safeUsername = (username || `User_${socketId.slice(0, 6)}`).trim();
    const userData = {
      username: safeUsername,
      socketId: socketId,
      rooms: new Set(),
      connectedAt: new Date().toISOString(),
      lastActivity: Date.now()
    };
    
    users.set(socketId, userData);
    console.log(`👤 User registered: ${safeUsername} (${socketId})`);
    
    socket.emit('user_registered', { 
      userId: socketId, 
      username: safeUsername,
      message: 'Registration successful'
    });
    
    // Send available rooms
    const roomList = Array.from(rooms.values()).map(room => ({
      name: room.name,
      userCount: room.users.size,
      messageCount: room.messages.length
    }));
    socket.emit('rooms_list', roomList);
  });

  // Create or join room
  socket.on('join_room', (roomName) => {
    if (!roomName || typeof roomName !== 'string' || roomName.trim() === '') {
      socket.emit('error', { message: 'Valid room name is required' });
      return;
    }
    
    const room = roomName.trim();
    const user = users.get(socketId);
    
    if (!user) {
      socket.emit('error', { message: 'Please register first' });
      return;
    }
    
    // Create room if it doesn't exist
    if (!rooms.has(room)) {
      rooms.set(room, {
        name: room,
        users: new Set(),
        messages: [],
        createdAt: new Date().toISOString()
      });
      console.log(`🚪 Room created: ${room} by ${user.username}`);
    }
    
    const roomData = rooms.get(room);
    
    // Join room
    roomData.users.add(socketId);
    user.rooms.add(room);
    user.lastActivity = Date.now();
    
    socket.join(room);
    
    // Send room history (last 100 messages)
    socket.emit('room_history', {
      room: room,
      messages: roomData.messages.slice(-100),
      userCount: roomData.users.size,
      joinedAt: new Date().toISOString()
    });
    
    // Notify others in the room
    socket.to(room).emit('user_joined', {
      room: room,
      user: user.username,
      userId: socketId,
      timestamp: new Date().toISOString(),
      userCount: roomData.users.size
    });
    
    console.log(`👉 ${user.username} joined ${room} (${roomData.users.size} users)`);
  });

  // Send message
  socket.on('send_message', ({ room, message }) => {
    if (!room || !message || typeof message !== 'string') {
      socket.emit('error', { message: 'Room and valid message are required' });
      return;
    }
    
    const user = users.get(socketId);
    const roomData = rooms.get(room);
    
    if (!user) {
      socket.emit('error', { message: 'Please register first' });
      return;
    }
    
    if (!roomData) {
      socket.emit('error', { message: 'Room does not exist' });
      return;
    }
    
    if (!roomData.users.has(socketId)) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }
    
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return;
    }
    
    const messageData = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      user: user.username,
      userId: socketId,
      message: trimmedMessage,
      room: room,
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    };
    
    // Store message (limit to 1000 messages per room)
    roomData.messages.push(messageData);
    if (roomData.messages.length > 1000) {
      roomData.messages = roomData.messages.slice(-500);
    }
    
    // Update user activity
    user.lastActivity = Date.now();
    
    // Broadcast to room (including sender for consistency)
    io.to(room).emit('receive_message', messageData);
    console.log(`💬 ${room}: ${user.username}: ${trimmedMessage.substring(0, 50)}${trimmedMessage.length > 50 ? '...' : ''}`);
  });

  // Get all rooms
  socket.on('get_rooms', () => {
    const roomList = Array.from(rooms.values()).map(room => ({
      name: room.name,
      userCount: room.users.size,
      messageCount: room.messages.length
    }));
    socket.emit('rooms_list', roomList);
  });

  // Leave room
  socket.on('leave_room', (roomName) => {
    const room = rooms.get(roomName);
    const user = users.get(socketId);
    
    if (room && user) {
      room.users.delete(socketId);
      user.rooms.delete(roomName);
      socket.leave(roomName);
      
      socket.to(roomName).emit('user_left', {
        room: roomName,
        user: user.username,
        userId: socketId,
        timestamp: new Date().toISOString(),
        userCount: room.users.size
      });
      
      console.log(`👋 ${user.username} left ${roomName} (${room.users.size} users left)`);
    }
  });

  // Ping/pong for connection health
  socket.on('ping', (data) => {
    socket.emit('pong', {
      ...data,
      serverTime: Date.now(),
      latency: Date.now() - (data.clientTime || Date.now())
    });
  });

  // Disconnect handler
  socket.on('disconnect', (reason) => {
    const user = users.get(socketId);
    console.log(`❌ User disconnected: ${user?.username || socketId} (${reason})`);
    
    // Remove from all rooms
    if (user) {
      user.rooms.forEach(roomName => {
        const room = rooms.get(roomName);
        if (room) {
          room.users.delete(socketId);
          socket.to(roomName).emit('user_left', {
            room: roomName,
            user: user.username,
            userId: socketId,
            reason: 'disconnected',
            timestamp: new Date().toISOString(),
            userCount: room.users.size
          });
        }
      });
    }
    
    users.delete(socketId);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(err.status || 500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `API endpoint ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`
  🚀 Chat App Server Started
  ==========================
  📡 Port: ${PORT}
  🌐 Host: ${HOST}
  ⚡ Environment: ${process.env.NODE_ENV || 'development'}
  🔗 Health: http://${HOST}:${PORT}/api/health
  🔗 Info: http://${HOST}:${PORT}/api/info
  📦 Frontend: ${process.env.NODE_ENV === 'production' ? 'Served from /dist' : 'Running separately on :5173'}
  ⚡ Socket.IO: Ready for connections
  ==========================
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

module.exports = { app, server, io };