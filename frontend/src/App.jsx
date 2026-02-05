import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import './App.css';

// Determine backend URL based on environment
const getBackendUrl = () => {
  // In production, backend serves frontend from same origin
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  // In development, use localhost:3000
  return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};

const BACKEND_URL = getBackendUrl();

function App() {
  // State variables
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [userStatus, setUserStatus] = useState('disconnected');
  const [isRegistered, setIsRegistered] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Refs
  const messagesEndRef = useRef(null);
  const usernameInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const roomNameInputRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    console.log('🔌 Connecting to backend:', BACKEND_URL);
    
    const newSocket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'], // Polling first for better compatibility
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: true,
      autoConnect: true
    });

    // ===== CONNECTION EVENTS =====
    newSocket.on('connect', () => {
      console.log('✅ Socket.IO Connected! ID:', newSocket.id);
      setIsConnected(true);
      setConnectionError('');
      setUserStatus('connected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      setIsConnected(false);
      setConnectionError(`Connection failed: ${error.message}`);
      setUserStatus('error');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('⚠️ Disconnected:', reason);
      setIsConnected(false);
      setUserStatus('disconnected');
    });

    // ===== CHAT EVENTS =====
    newSocket.on('welcome', (data) => {
      console.log('👋 Server welcome:', data);
      setUserStatus('ready');
    });

    newSocket.on('user_registered', (data) => {
      console.log('✅ User registered:', data);
      if (data.success) {
        setIsRegistered(true);
        setCurrentUser(data);
        setUserStatus('registered');
        // Auto-focus room input after registration
        if (roomNameInputRef.current) {
          setTimeout(() => roomNameInputRef.current.focus(), 100);
        }
      }
    });

    newSocket.on('rooms_list', (data) => {
      console.log('🚪 Rooms list:', data);
      setRooms(data || []);
    });

    newSocket.on('room_joined', (data) => {
      console.log('✅ Joined room:', data);
      setMessages(data.history || []);
      setUserStatus('in_room');
      // Auto-focus message input
      if (messageInputRef.current) {
        setTimeout(() => messageInputRef.current.focus(), 100);
      }
    });

    newSocket.on('new_message', (msg) => {
      console.log('📨 New message:', msg);
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('user_joined', (data) => {
      console.log('👤 User joined:', data);
      setMessages(prev => [...prev, {
        id: Date.now() + '-system-join',
        type: 'system',
        message: data.message || `${data.user} joined the room`,
        timestamp: data.timestamp
      }]);
    });

    newSocket.on('user_left', (data) => {
      console.log('👋 User left:', data);
      setMessages(prev => [...prev, {
        id: Date.now() + '-system-left',
        type: 'system',
        message: data.message || `${data.user} left the room`,
        timestamp: data.timestamp
      }]);
    });

    newSocket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      alert(`Error: ${error.message}`);
    });

    newSocket.on('test_response', (data) => {
      console.log('✅ Test response:', data);
      alert(`Server test successful: ${data.response}`);
    });

    newSocket.on('user_info', (data) => {
      console.log('👤 User info:', data);
    });

    setSocket(newSocket);

    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up socket connection');
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus username input on load
  useEffect(() => {
    if (!username && usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, [username]);

  // Handle username submission
  const handleSetUsername = useCallback(() => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      alert('Please enter a username');
      return;
    }
    
    if (!socket || !isConnected) {
      alert('Not connected to server. Please wait...');
      return;
    }
    
    console.log('📝 Registering user:', trimmedUsername);
    socket.emit('register_user', trimmedUsername);
    setUserStatus('registering');
  }, [username, socket, isConnected]);

  // Handle username input key press
  const handleUsernameKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSetUsername();
    }
  }, [handleSetUsername]);

  // Create or join room
  const handleCreateRoom = useCallback(() => {
    const trimmedRoomName = newRoomName.trim();
    
    if (!trimmedRoomName) {
      alert('Please enter a room name');
      return;
    }
    
    if (!socket || !isConnected) {
      alert('Not connected to server');
      return;
    }
    
    if (!isRegistered) {
      alert('Please set a username first!');
      if (usernameInputRef.current) {
        usernameInputRef.current.focus();
      }
      return;
    }
    
    console.log('🚪 Creating/joining room:', trimmedRoomName);
    socket.emit('join_room', trimmedRoomName);
    setCurrentRoom(trimmedRoomName);
    setNewRoomName('');
  }, [newRoomName, socket, isConnected, isRegistered]);

  // Handle room name input key press
  const handleRoomNameKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleCreateRoom();
    }
  }, [handleCreateRoom]);

  // Join existing room
  const handleJoinRoom = useCallback((roomName) => {
    if (!socket || !isConnected) {
      alert('Not connected to server');
      return;
    }
    
    if (!isRegistered) {
      alert('Please set a username first!');
      if (usernameInputRef.current) {
        usernameInputRef.current.focus();
      }
      return;
    }
    
    console.log('🚪 Joining room:', roomName);
    socket.emit('join_room', roomName);
    setCurrentRoom(roomName);
  }, [socket, isConnected, isRegistered]);

  // Send message
  const handleSendMessage = useCallback(() => {
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage) {
      alert('Please enter a message');
      return;
    }
    
    if (!socket || !isConnected) {
      alert('Not connected to server');
      return;
    }
    
    if (!isRegistered) {
      alert('Please set a username first!');
      return;
    }
    
    if (!currentRoom) {
      alert('Please join a room first!');
      return;
    }
    
    console.log('💬 Sending message to', currentRoom, ':', trimmedMessage);
    socket.emit('send_message', {
      room: currentRoom,
      message: trimmedMessage
    });
    
    // Clear input and refocus
    setMessage('');
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [message, currentRoom, socket, isConnected, isRegistered]);

  // Handle message input key press
  const handleMessageKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Leave current room
  const handleLeaveRoom = useCallback(() => {
    if (!socket || !currentRoom) return;
    
    console.log('🚪 Leaving room:', currentRoom);
    socket.emit('leave_room', currentRoom);
    setCurrentRoom('');
    setMessages([]);
    setUserStatus('registered');
  }, [socket, currentRoom]);

  // Refresh rooms list
  const handleGetRooms = useCallback(() => {
    if (socket && isConnected) {
      console.log('🔄 Refreshing rooms list');
      socket.emit('get_rooms');
    }
  }, [socket, isConnected]);

  // Test connection
  const handleTestConnection = useCallback(() => {
    if (socket) {
      console.log('🔍 Testing connection...');
      socket.emit('test', { 
        message: 'Connection test from frontend',
        timestamp: Date.now() 
      });
    }
  }, [socket]);

  // Ping server
  const handlePing = useCallback(() => {
    if (socket) {
      socket.emit('ping');
      socket.once('pong', (data) => {
        alert(`Pong! Server time: ${new Date(data.timestamp).toLocaleTimeString()}`);
      });
    }
  }, [socket]);

  // Reconnect
  const handleReconnect = useCallback(() => {
    if (socket) {
      console.log('🔄 Attempting to reconnect...');
      socket.connect();
    }
  }, [socket]);

  // Format time for display
  const formatTime = useCallback((timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (e) {
      return '';
    }
  }, []);

  return (
    <div className="app">
      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        {/* User Section */}
        <div className="user-section">
          <h2>💬 Chat App</h2>
          
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </span>
            {connectionError && (
              <div className="error-message">{connectionError}</div>
            )}
          </div>
          
          {/* Username Input / User Info */}
          {!isRegistered ? (
            <div className="username-input">
              <input
                ref={usernameInputRef}
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleUsernameKeyPress}
                disabled={!isConnected}
                maxLength={20}
              />
              <button 
                onClick={handleSetUsername}
                disabled={!username.trim() || !isConnected || userStatus === 'registering'}
                className="register-btn"
              >
                {userStatus === 'registering' ? 'Registering...' : 'Register'}
              </button>
            </div>
          ) : (
            <div className="user-info">
              <div className="user-avatar">👤</div>
              <div className="user-details">
                <h3>{currentUser?.username || username}</h3>
                <div className="user-stats">
                  <span className="stat-badge">Connected</span>
                  <span className="stat-badge">Room: {currentRoom ? currentRoom : 'None'}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Server Info */}
          <div className="server-info">
            <div className="info-row">
              <span className="info-label">Backend:</span>
              <code className="info-value">{BACKEND_URL}</code>
            </div>
            <div className="info-row">
              <span className="info-label">Status:</span>
              <span className={`info-value ${userStatus}`}>{userStatus}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Socket:</span>
              <span className="info-value">
                {socket?.id ? socket.id.slice(0, 8) + '...' : 'Not connected'}
              </span>
            </div>
            
            {/* Action Buttons */}
            <div className="action-buttons">
              <button 
                onClick={handleTestConnection}
                disabled={!isConnected}
                className="action-btn test-btn"
                title="Test server connection"
              >
                Test
              </button>
              <button 
                onClick={handlePing}
                disabled={!isConnected}
                className="action-btn ping-btn"
                title="Ping server"
              >
                Ping
              </button>
              <button 
                onClick={handleReconnect}
                className="action-btn reconnect-btn"
                title="Reconnect to server"
              >
                Reconnect
              </button>
            </div>
          </div>
        </div>

        {/* Rooms Section */}
        <div className="rooms-section">
          <div className="section-header">
            <h3>📁 Chat Rooms</h3>
            <button 
              onClick={handleGetRooms}
              disabled={!isConnected}
              className="icon-btn refresh-btn"
              title="Refresh rooms list"
            >
              🔄
            </button>
          </div>
          
          {/* Create Room */}
          <div className="create-room">
            <input
              ref={roomNameInputRef}
              type="text"
              placeholder="Enter room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyPress={handleRoomNameKeyPress}
              disabled={!isConnected || !isRegistered}
            />
            <button 
              onClick={handleCreateRoom}
              disabled={!newRoomName.trim() || !isConnected || !isRegistered}
              className="create-btn"
            >
              Create/Join
            </button>
          </div>
          
          {/* Rooms List */}
          <div className="rooms-list">
            {rooms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <p className="empty-title">No rooms yet</p>
                <p className="empty-subtitle">
                  {isRegistered ? 'Create the first room!' : 'Register to create rooms'}
                </p>
              </div>
            ) : (
              rooms.map(room => (
                <div
                  key={room.name}
                  className={`room-item ${currentRoom === room.name ? 'active' : ''}`}
                  onClick={() => handleJoinRoom(room.name)}
                >
                  <div className="room-icon">#</div>
                  <div className="room-details">
                    <span className="room-name">{room.name}</span>
                    <div className="room-stats">
                      <span className="room-stat">
                        <span className="stat-icon">👤</span>
                        {room.userCount || 0}
                      </span>
                      <span className="room-stat">
                        <span className="stat-icon">💬</span>
                        {room.messageCount || 0}
                      </span>
                    </div>
                  </div>
                  {currentRoom === room.name && (
                    <div className="active-indicator">●</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Connection Panel */}
        <div className="connection-panel">
          <h4>📊 Connection Status</h4>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Backend:</span>
              <span className="status-value success">{isConnected ? 'Online' : 'Offline'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">User:</span>
              <span className="status-value">{isRegistered ? 'Registered' : 'Guest'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Current Room:</span>
              <span className="status-value">{currentRoom || 'None'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Messages:</span>
              <span className="status-value">{messages.filter(m => m.type !== 'system').length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CHAT AREA ===== */}
      <div className="chat-area">
        {currentRoom ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-title">
                <h2># {currentRoom}</h2>
                <div className="room-info">
                  <span className="room-meta">
                    <span className="meta-icon">👤</span>
                    {rooms.find(r => r.name === currentRoom)?.userCount || 0} online
                  </span>
                  <span className="room-meta">
                    <span className="meta-icon">💬</span>
                    {messages.filter(m => m.type !== 'system').length} messages
                  </span>
                </div>
              </div>
              <button 
                onClick={handleLeaveRoom}
                className="leave-btn"
                title="Leave room"
              >
                Leave Room
              </button>
            </div>
            
            {/* Messages Container */}
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <div className="empty-chat-icon">💭</div>
                  <h3>No messages yet</h3>
                  <p>Be the first to start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`message ${msg.type === 'system' ? 'system' : ''} ${msg.userId === socket?.id ? 'own' : ''}`}
                  >
                    {msg.type === 'system' ? (
                      <div className="system-message">
                        <span className="system-icon">📢</span>
                        <span className="system-text">{msg.message}</span>
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="message-header">
                          <span className="message-user">
                            {msg.user}
                            {msg.userId === socket?.id && <span className="you-badge">You</span>}
                          </span>
                          <span className="message-time">{formatTime(msg.timestamp)}</span>
                        </div>
                        <div className="message-content">{msg.message}</div>
                      </>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="message-input-area">
              <input
                ref={messageInputRef}
                type="text"
                placeholder={
                  !isConnected ? "Connecting to server..." :
                  !isRegistered ? "Please register to chat" :
                  !currentRoom ? "Join a room to chat" :
                  "Type your message here..."
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleMessageKeyPress}
                disabled={!isConnected || !isRegistered || !currentRoom}
                className="message-input"
                maxLength={500}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!message.trim() || !isConnected || !isRegistered || !currentRoom}
                className="send-btn"
                title="Send message"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="welcome-screen">
            <div className="welcome-content">
              <div className="welcome-header">
                <h1>Welcome to Chat App! 🎉</h1>
                <p className="welcome-subtitle">Real-time chatting made simple and fun</p>
              </div>
              
              <div className="welcome-steps">
                <div className="step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Set Your Username</h4>
                    <p>Enter a unique username in the sidebar to get started</p>
                  </div>
                </div>
                
                <div className="step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Join or Create a Room</h4>
                    <p>Select from existing rooms or create your own private space</p>
                  </div>
                </div>
                
                <div className="step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Start Chatting!</h4>
                    <p>Send messages in real-time and enjoy the conversation</p>
                  </div>
                </div>
              </div>
              
              <div className="connection-card">
                <h3>🔗 Connection Status</h3>
                
                <div className={`connection-status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
                  {isConnected ? '✅ Connected to Server' : '❌ Not Connected'}
                </div>
                
                <div className="connection-details">
                  <div className="detail">
                    <span className="detail-label">Backend Server:</span>
                    <code className="detail-value">{BACKEND_URL}</code>
                  </div>
                  
                  <div className="detail">
                    <span className="detail-label">Socket Status:</span>
                    <span className={`detail-value ${socket ? 'ready' : 'not-ready'}`}>
                      {socket ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>
                  
                  <div className="detail">
                    <span className="detail-label">User Status:</span>
                    <span className={`detail-value ${isRegistered ? 'registered' : 'guest'}`}>
                      {isRegistered ? (currentUser?.username || username) : 'Guest'}
                    </span>
                  </div>
                </div>
                
                {connectionError && (
                  <div className="error-card">
                    <div className="error-header">
                      <span className="error-icon">⚠️</span>
                      <h4>Connection Error</h4>
                    </div>
                    <p className="error-message">{connectionError}</p>
                    <div className="error-actions">
                      <button onClick={handleReconnect} className="reconnect-btn-large">
                        🔄 Try Reconnecting
                      </button>
                      <button onClick={handleTestConnection} className="test-btn-large">
                        🔍 Test Connection
                      </button>
                    </div>
                  </div>
                )}
                
                {!connectionError && !isConnected && (
                  <div className="connection-help">
                    <p>If you're having trouble connecting:</p>
                    <ol>
                      <li>Make sure the backend server is running</li>
                      <li>Check your internet connection</li>
                      <li>Try refreshing the page</li>
                      <li>Click "Reconnect" in the sidebar</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;