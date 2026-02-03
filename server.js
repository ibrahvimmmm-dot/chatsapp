const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);

// Allow all origins for now (we'll restrict later)
const io = new Server(server, {
  cors: {
    origin: "*", // Allow ALL origins temporarily
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Create data directory
const dataDir = path.join(__dirname, 'data');
const messagesFile = path.join(dataDir, 'messages.json');
const roomsFile = path.join(dataDir, 'rooms.json');

// Default rooms
const rooms = {
  'general': { 
    name: 'General Chat', 
    password: null, 
    creator: 'system',
    users: [], 
    messages: [] 
  },
  'random': { 
    name: 'Random Talk', 
    password: null,
    creator: 'system',
    users: [], 
    messages: [] 
  },
  'tech': { 
    name: 'Tech Talk', 
    password: null,
    creator: 'system',
    users: [], 
    messages: [] 
  }
};

const users = {};

// Load saved data
async function loadData() {
  try {
    await fs.access(dataDir);
    
    // Load messages
    const messagesData = await fs.readFile(messagesFile, 'utf8');
    const savedMessages = JSON.parse(messagesData);
    
    // Load rooms
    const roomsData = await fs.readFile(roomsFile, 'utf8');
    const savedRooms = JSON.parse(roomsData);
    
    // Merge saved data
    Object.keys(savedMessages).forEach(roomId => {
      if (rooms[roomId]) {
        rooms[roomId].messages = savedMessages[roomId] || [];
      }
    });
    
    Object.keys(savedRooms).forEach(roomId => {
      rooms[roomId] = savedRooms[roomId];
    });
    
    console.log('✅ Loaded saved data');
  } catch (err) {
    console.log('📁 No saved data found, starting fresh');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(messagesFile, JSON.stringify({}));
    await fs.writeFile(roomsFile, JSON.stringify({}));
  }
}

// Save data
async function saveData() {
  try {
    const messagesToSave = {};
    Object.keys(rooms).forEach(roomId => {
      messagesToSave[roomId] = rooms[roomId].messages.slice(-100);
    });
    await fs.writeFile(messagesFile, JSON.stringify(messagesToSave, null, 2));
    
    const roomsToSave = {};
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      roomsToSave[roomId] = {
        name: room.name,
        password: room.password,
        creator: room.creator,
        users: [],
        messages: []
      };
    });
    await fs.writeFile(roomsFile, JSON.stringify(roomsToSave, null, 2));
    
    console.log('💾 Data saved');
  } catch (err) {
    console.error('❌ Error saving data:', err);
  }
}

// Save every 30 seconds
setInterval(saveData, 30000);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Send room list
  socket.emit('room_list', Object.entries(rooms).map(([id, room]) => ({
    id,
    name: room.name,
    userCount: room.users.length,
    hasPassword: !!room.password,
    creator: room.creator
  })));

  // Join room
  socket.on('join_room', async ({ roomId, username, password }) => {
    console.log(`👤 ${username} trying to join ${roomId}`);
    
    if (!rooms[roomId]) {
      socket.emit('join_error', { message: 'Room does not exist' });
      return;
    }

    const room = rooms[roomId];
    
    // Check password
    if (room.password) {
      try {
        const passwordMatch = await bcrypt.compare(password, room.password);
        if (!passwordMatch) {
          socket.emit('join_error', { message: 'Incorrect password' });
          return;
        }
      } catch (err) {
        console.error('Password check error:', err);
        socket.emit('join_error', { message: 'Server error' });
        return;
      }
    }

    // Leave previous room
    if (users[socket.id] && users[socket.id].currentRoom) {
      const oldRoom = users[socket.id].currentRoom;
      const index = rooms[oldRoom].users.indexOf(socket.id);
      if (index > -1) {
        rooms[oldRoom].users.splice(index, 1);
        socket.leave(oldRoom);
        io.to(oldRoom).emit('user_left', {
          username: users[socket.id].username,
          roomId: oldRoom
        });
        io.to(oldRoom).emit('room_update', {
          roomId: oldRoom,
          userCount: rooms[oldRoom].users.length
        });
      }
    }

    // Join new room
    socket.join(roomId);
    users[socket.id] = { username, currentRoom: roomId };
    rooms[roomId].users.push(socket.id);

    // Send room info
    socket.emit('room_joined', {
      roomId,
      roomName: rooms[roomId].name,
      previousMessages: rooms[roomId].messages.slice(-50)
    });

    // Notify others
    socket.to(roomId).emit('user_joined', {
      username,
      roomId
    });

    // Update room list
    io.emit('room_update', {
      roomId,
      userCount: rooms[roomId].users.length,
      hasPassword: !!rooms[roomId].password
    });

    console.log(`✅ ${username} joined room: ${roomId}`);
  });

  // Create room
  socket.on('create_room', async ({ roomId, roomName, password, creator }) => {
    console.log(`🏗️ Creating room: ${roomName} (${roomId}) by ${creator}`);
    
    if (rooms[roomId]) {
      socket.emit('create_error', { message: 'Room already exists' });
      return;
    }

    let hashedPassword = null;
    if (password && password.trim()) {
      try {
        hashedPassword = await bcrypt.hash(password.trim(), 10);
      } catch (err) {
        console.error('Password hash error:', err);
        socket.emit('create_error', { message: 'Server error' });
        return;
      }
    }

    rooms[roomId] = { 
      name: roomName, 
      password: hashedPassword,
      creator: creator,
      users: [], 
      messages: [] 
    };

    io.emit('new_room', {
      id: roomId,
      name: roomName,
      userCount: 0,
      hasPassword: !!hashedPassword,
      creator: creator
    });

    console.log(`✅ New room created: ${roomName} (${roomId})`);
    
    // Auto-join creator
    socket.emit('auto_join', { roomId, roomName });
  });

  // Handle messages
  socket.on('message', ({ roomId, text }) => {
    if (!rooms[roomId] || !users[socket.id]) {
      console.log('Message rejected - no room or user');
      return;
    }

    const messageData = {
      id: Date.now() + Math.random(),
      username: users[socket.id].username,
      text,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now(),
      type: 'text'
    };

    rooms[roomId].messages.push(messageData);
    io.to(roomId).emit('message', messageData);
    console.log(`💬 ${messageData.username} in ${roomId}: ${text}`);
  });

  // Handle file uploads
  socket.on('file_upload', ({ roomId, fileData, fileName, fileType }) => {
    if (!rooms[roomId] || !users[socket.id]) return;

    const messageData = {
      id: Date.now() + Math.random(),
      username: users[socket.id].username,
      fileName,
      fileData,
      fileType,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now(),
      type: 'file'
    };

    rooms[roomId].messages.push(messageData);
    io.to(roomId).emit('message', messageData);
    console.log(`📎 ${messageData.username} uploaded: ${fileName}`);
  });

  // Handle typing
  socket.on('typing', ({ roomId, isTyping }) => {
    if (!rooms[roomId] || !users[socket.id]) return;
    
    socket.to(roomId).emit('user_typing', {
      username: users[socket.id].username,
      isTyping
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      const roomId = user.currentRoom;
      if (roomId && rooms[roomId]) {
        const index = rooms[roomId].users.indexOf(socket.id);
        if (index > -1) {
          rooms[roomId].users.splice(index, 1);
          
          io.to(roomId).emit('user_left', {
            username: user.username,
            roomId
          });
          
          io.emit('room_update', {
            roomId,
            userCount: rooms[roomId].users.length,
            hasPassword: !!rooms[roomId].password
          });
          
          console.log(`👋 ${user.username} left: ${roomId}`);
        }
      }
      delete users[socket.id];
    }
    console.log('❌ User disconnected:', socket.id);
  });
});

// Add health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    rooms: Object.keys(rooms).length,
    connectedUsers: Object.keys(users).length,
    totalMessages: Object.values(rooms).reduce((sum, room) => sum + room.messages.length, 0)
  });
});

// Add root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Chat API Server',
    endpoints: {
      health: '/health',
      websocket: '/socket.io/',
      status: 'online'
    }
  });
});

// Start server
loadData().then(() => {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🌍 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Root endpoint: http://localhost:${PORT}/`);
  });
});

// Save on exit
process.on('SIGINT', async () => {
  console.log('\n💾 Saving data before exit...');
  await saveData();
  process.exit(0);
});