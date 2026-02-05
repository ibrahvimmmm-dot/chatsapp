const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Allow all origins for testing (you can restrict later)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Chat server is running',
    socket: 'Connect via Socket.IO client',
    timestamp: new Date().toISOString()
  });
});

// Socket.IO setup - Allow all origins
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Store active users
const users = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Register user
  socket.on('register_user', (username) => {
    users.set(socket.id, { username, rooms: new Set() });
    console.log(`User registered: ${username}`);
    socket.emit('user_registered', { userId: socket.id, username });
  });

  // Create or join room
  socket.on('join_room', (roomName) => {
    if (!rooms.has(roomName)) {
      rooms.set(roomName, {
        name: roomName,
        users: new Set(),
        messages: []
      });
    }
    
    const room = rooms.get(roomName);
    room.users.add(socket.id);
    
    const user = users.get(socket.id);
    if (user) {
      user.rooms.add(roomName);
    }
    
    socket.join(roomName);
    
    // Send room history
    socket.emit('room_history', {
      room: roomName,
      messages: room.messages.slice(-50)
    });
    
    // Notify others
    socket.to(roomName).emit('user_joined', {
      room: roomName,
      user: user?.username || socket.id
    });
    
    console.log(`${user?.username || socket.id} joined ${roomName}`);
  });

  // Send message
  socket.on('send_message', ({ room, message }) => {
    const user = users.get(socket.id);
    
    if (!rooms.has(room)) return;
    
    const roomData = rooms.get(room);
    const messageData = {
      id: Date.now(),
      user: user?.username || 'Anonymous',
      message,
      timestamp: new Date().toISOString()
    };
    
    roomData.messages.push(messageData);
    io.to(room).emit('receive_message', messageData);
  });

  // Leave room
  socket.on('leave_room', (roomName) => {
    socket.leave(roomName);
    
    const room = rooms.get(roomName);
    if (room) {
      room.users.delete(socket.id);
    }
    
    const user = users.get(socket.id);
    if (user) {
      user.rooms.delete(roomName);
    }
    
    socket.to(roomName).emit('user_left', {
      room: roomName,
      user: user?.username || socket.id
    });
  });

  // Get all rooms
  socket.on('get_rooms', () => {
    const roomList = Array.from(rooms.values()).map(room => ({
      name: room.name,
      userCount: room.users.size
    }));
    socket.emit('rooms_list', roomList);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    console.log(`User disconnected: ${user?.username || socket.id}`);
    users.delete(socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Health: http://0.0.0.0:${PORT}`);
});