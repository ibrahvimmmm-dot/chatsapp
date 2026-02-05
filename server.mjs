import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('join', (username) => {
    socket.username = username;
    console.log(`👋 ${username} joined`);
    
    // Notify others
    socket.broadcast.emit('user-joined', username);
    
    // Send welcome message
    socket.emit('message', {
      username: 'System',
      text: `Welcome ${username}!`,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('message', (text) => {
    console.log(`💬 ${socket.username || 'Anonymous'}: ${text}`);
    
    io.emit('message', {
      username: socket.username || 'Anonymous',
      text: text,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.username || socket.id);
    if (socket.username) {
      socket.broadcast.emit('user-left', socket.username);
    }
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Chat server: http://localhost:${PORT}`);
});