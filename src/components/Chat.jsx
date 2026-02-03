import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import FileUpload from './FileUpload';
import RoomList from './RoomList';
import PasswordModal from './PasswordModal';

const Chat = ({ username }) => {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [passwordModal, setPasswordModal] = useState(null);
  const [joinError, setJoinError] = useState('');
  
  const socketRef = useRef();
  const messagesEndRef = useRef();
  const typingTimeoutRef = useRef();

  // Get socket URL from environment or use current origin
  const getSocketUrl = () => {
    if (import.meta.env.VITE_SOCKET_URL) {
      return import.meta.env.VITE_SOCKET_URL;
    }
    // In development, Vite proxy handles it. In production, use same origin or env var
    return window.location.origin;
  };

  useEffect(() => {
    console.log('🔗 Connecting to server...');
    
    const socketUrl = getSocketUrl();
    console.log('Socket URL:', socketUrl);
    
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Connection events
    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
      setConnected(true);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ Connection error:', err.message);
      setConnected(false);
    });

    socketRef.current.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
      setConnected(false);
    });

    // Room events
    socketRef.current.on('room_list', (roomList) => {
      console.log('📋 Room list received:', roomList);
      setRooms(roomList);
    });

    socketRef.current.on('room_joined', (data) => {
      console.log('🚪 Joined room:', data);
      setCurrentRoom(data.roomId);
      setRoomName(data.roomName);
      setMessages(data.previousMessages || []);
      setPasswordModal(null);
      setJoinError('');
      scrollToBottom();
    });

    socketRef.current.on('join_error', (data) => {
      console.error('❌ Join error:', data.message);
      setJoinError(data.message);
    });

    socketRef.current.on('room_update', (data) => {
      setRooms(prev => prev.map(room => 
        room.id === data.roomId 
          ? { ...room, userCount: data.userCount, hasPassword: data.hasPassword }
          : room
      ));
    });

    socketRef.current.on('new_room', (newRoom) => {
      console.log('📁 New room created:', newRoom);
      setRooms(prev => [...prev, newRoom]);
    });

    socketRef.current.on('auto_join', (data) => {
      console.log('🤖 Auto-joining created room:', data);
      joinRoomWithPassword(data.roomId, data.roomName, '');
    });

    socketRef.current.on('create_error', (data) => {
      alert(`❌ Create room error: ${data.message}`);
    });

    // Message events
    socketRef.current.on('message', (message) => {
      console.log('📨 Received message:', message);
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });

    socketRef.current.on('user_joined', (data) => {
      console.log(`👋 ${data.username} joined room ${data.roomId}`);
      setMessages(prev => [...prev, {
        id: Date.now(),
        username: 'System',
        text: `${data.username} joined the room`,
        time: new Date().toLocaleTimeString(),
        type: 'system'
      }]);
      scrollToBottom();
    });

    socketRef.current.on('user_left', (data) => {
      console.log(`👋 ${data.username} left room ${data.roomId}`);
      setMessages(prev => [...prev, {
        id: Date.now(),
        username: 'System',
        text: `${data.username} left the room`,
        time: new Date().toLocaleTimeString(),
        type: 'system'
      }]);
      scrollToBottom();
    });

    // Typing indicator
    socketRef.current.on('user_typing', (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.add(data.username);
          return Array.from(newSet);
        });
      } else {
        setTypingUsers(prev => prev.filter(user => user !== data.username));
      }
    });

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [username]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const joinRoomWithPassword = (roomId, roomName, password) => {
    if (socketRef.current && connected) {
      console.log(`🔑 Joining room ${roomId} with password`);
      socketRef.current.emit('join_room', { 
        roomId, 
        username, 
        password 
      });
    } else {
      alert('⚠️ Not connected to server. Please refresh the page.');
    }
  };

  const joinRoom = (room) => {
    console.log(`🚀 Attempting to join room: ${room.name}`);
    if (room.hasPassword) {
      console.log('🔒 Room requires password');
      setPasswordModal({
        roomId: room.id,
        roomName: room.name
      });
    } else {
      joinRoomWithPassword(room.id, room.name, '');
    }
  };

  const handlePasswordSubmit = (password) => {
    console.log('🔑 Password submitted for room:', passwordModal?.roomName);
    if (passwordModal) {
      joinRoomWithPassword(passwordModal.roomId, passwordModal.roomName, password);
    }
  };

  const createRoom = (roomData) => {
    console.log('🏗️ Creating new room:', roomData);
    if (socketRef.current && connected) {
      socketRef.current.emit('create_room', roomData);
    } else {
      alert('⚠️ Not connected to server. Please refresh the page.');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() && socketRef.current && connected && currentRoom) {
      console.log('📤 Sending message:', input.trim());
      socketRef.current.emit('message', {
        roomId: currentRoom,
        text: input.trim()
      });
      setInput('');
      stopTyping();
    }
  };

  const handleFileUpload = (fileData) => {
    console.log('📎 File upload:', fileData.fileName);
    if (socketRef.current && connected && currentRoom) {
      socketRef.current.emit('file_upload', {
        roomId: currentRoom,
        ...fileData
      });
    }
  };

  const handleTyping = () => {
    if (!isTyping && socketRef.current && connected && currentRoom) {
      setIsTyping(true);
      socketRef.current.emit('typing', {
        roomId: currentRoom,
        isTyping: true
      });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && socketRef.current && connected && currentRoom) {
        setIsTyping(false);
        socketRef.current.emit('typing', {
          roomId: currentRoom,
          isTyping: false
        });
      }
    }, 1000);
  };

  const stopTyping = () => {
    if (isTyping && socketRef.current && connected && currentRoom) {
      setIsTyping(false);
      socketRef.current.emit('typing', {
        roomId: currentRoom,
        isTyping: false
      });
    }
    clearTimeout(typingTimeoutRef.current);
  };

  const renderMessage = (msg) => {
    if (msg.type === 'system') {
      return (
        <div key={msg.id} className="message system">
          <div className="message-text">{msg.text}</div>
        </div>
      );
    }

    if (msg.type === 'file') {
      const isImage = msg.fileType.startsWith('image/');
      
      return (
        <div 
          key={msg.id} 
          className={`message ${msg.username === username ? 'sent' : 'received'}`}
        >
          <div className="message-header">
            <strong>{msg.username}</strong>
            <span>{msg.time}</span>
          </div>
          <div className="file-message">
            <div className="file-info">
              <svg className="file-icon-small" viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              <span className="file-name">{msg.fileName}</span>
            </div>
            
            {isImage ? (
              <div className="image-preview">
                <img 
                  src={msg.fileData} 
                  alt={msg.fileName}
                  onClick={() => window.open(msg.fileData, '_blank')}
                />
                <a 
                  href={msg.fileData} 
                  download={msg.fileName}
                  className="download-btn"
                >
                  Download
                </a>
              </div>
            ) : (
              <a 
                href={msg.fileData} 
                download={msg.fileName}
                className="download-btn"
              >
                Download File
              </a>
            )}
          </div>
        </div>
      );
    }

    // Regular text message
    return (
      <div 
        key={msg.id} 
        className={`message ${msg.username === username ? 'sent' : 'received'}`}
      >
        <div className="message-header">
          <strong>{msg.username}</strong>
          <span>{msg.time}</span>
        </div>
        <div className="message-text">{msg.text}</div>
      </div>
    );
  };

  return (
    <div className="chat-app">
      {passwordModal && (
        <PasswordModal
          roomName={passwordModal.roomName}
          onSubmit={handlePasswordSubmit}
          onCancel={() => {
            console.log('❌ Password modal cancelled');
            setPasswordModal(null);
            setJoinError('');
          }}
        />
      )}

      <div className="sidebar">
        <div className="user-info">
          <div className="avatar">{username.charAt(0).toUpperCase()}</div>
          <div className="user-details">
            <h3>{username}</h3>
            <p className={`status ${connected ? 'online' : 'offline'}`}>
              {connected ? '✅ Online' : '❌ Offline'}
            </p>
          </div>
        </div>

        <RoomList
          rooms={rooms}
          currentRoom={currentRoom}
          onJoinRoom={joinRoom}
          onCreateRoom={createRoom}
          username={username}
        />
      </div>

      <div className="main-chat">
        {currentRoom ? (
          <>
            <div className="chat-header">
              <div className="room-info">
                <h2>
                  {rooms.find(r => r.id === currentRoom)?.hasPassword ? '🔒 ' : '💬 '}
                  {roomName}
                </h2>
                <p className="room-id">Room: {currentRoom}</p>
              </div>
              <div className="room-stats">
                <span className="user-count">👥 {rooms.find(r => r.id === currentRoom)?.userCount || 0} users</span>
                {rooms.find(r => r.id === currentRoom)?.hasPassword && (
                  <span className="private-badge">Private</span>
                )}
              </div>
            </div>

            {joinError && (
              <div className="error-banner">
                ❌ {joinError}
              </div>
            )}

            <div className="messages-container">
              <div className="messages">
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map(renderMessage)
                )}
                <div ref={messagesEndRef} />
              </div>

              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
            </div>

            <div className="input-area">
              <FileUpload 
                onFileUpload={handleFileUpload}
                disabled={!connected || !currentRoom}
              />
              
              <form onSubmit={sendMessage} className="message-form">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    handleTyping();
                  }}
                  onBlur={stopTyping}
                  placeholder="Type a message..."
                  disabled={!connected || !currentRoom}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e);
                    }
                  }}
                />
                <button 
                  type="submit" 
                  disabled={!connected || !currentRoom || !input.trim()}
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="room-selector">
            <div className="welcome-message">
              <h2>👋 Welcome, {username}!</h2>
              <p>Select a chat room from the sidebar to start messaging.</p>
              <div className="connection-status">
                <p>Status: <span className={connected ? 'connected' : 'disconnected'}>
                  {connected ? 'Connected to server ✓' : 'Connecting to server...'}
                </span></p>
              </div>
              
              <div className="feature-highlights">
                <h3>✨ Features:</h3>
                <ul>
                  <li>🔒 Password-protected rooms</li>
                  <li>📎 File and image sharing</li>
                  <li>💬 Multiple chat rooms</li>
                  <li>👥 Real-time user presence</li>
                  <li>✏️ Typing indicators</li>
                  <li>💾 Message history</li>
                </ul>
              </div>

              {!connected && (
                <div className="connection-help">
                  <p>If connection fails:</p>
                  <ol>
                    <li>Check if backend server is running</li>
                    <li>Refresh the page</li>
                    <li>Check browser console for errors (F12)</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;