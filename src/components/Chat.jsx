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
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  
  const socketRef = useRef();
  const messagesEndRef = useRef();
  const typingTimeoutRef = useRef();
  const reconnectTimeoutRef = useRef();

  // Get socket URL with fallbacks
  const getSocketUrl = () => {
    // Debug info
    console.log('🔍 Getting socket URL...');
    console.log('   Current hostname:', window.location.hostname);
    console.log('   Current origin:', window.location.origin);
    console.log('   VITE_SOCKET_URL:', import.meta.env.VITE_SOCKET_URL);
    
    // Priority 1: Environment variable
    if (import.meta.env.VITE_SOCKET_URL) {
      const url = import.meta.env.VITE_SOCKET_URL;
      console.log('✅ Using environment variable:', url);
      return url;
    }
    
    // Priority 2: Local development
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '') {
      console.log('🖥️  Local development detected, using localhost:3000');
      return 'http://localhost:3000';
    }
    
    // Priority 3: Firebase hosting (your app)
    if (window.location.hostname.includes('firebase') || 
        window.location.hostname.includes('web.app')) {
      console.log('🔥 Firebase hosting detected');
      // For Firebase, we need a publicly accessible backend
      // This will fail unless you've deployed backend
      return window.location.origin.replace('https://chat-app-2293e', 'https://your-backend-url');
    }
    
    // Fallback: Try to infer from current location
    console.log('🌍 Using current origin as fallback');
    return window.location.origin;
  };

  // Initialize socket connection
  const initializeSocket = () => {
    console.log('🚀 Initializing socket connection...');
    
    // Clean up previous socket if exists
    if (socketRef.current) {
      console.log('🧹 Cleaning up previous socket connection');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    const socketUrl = getSocketUrl();
    console.log('🔌 Connecting to:', socketUrl);
    setConnectionStatus('connecting');

    // Create new socket connection
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      query: {
        clientType: 'web',
        username: username,
        timestamp: Date.now()
      }
    });

    // ========== CONNECTION EVENTS ==========
    socketRef.current.on('connect', () => {
      console.log('✅ SOCKET CONNECTED!');
      console.log('   Socket ID:', socketRef.current.id);
      console.log('   Transport:', socketRef.current.io.engine.transport.name);
      setConnected(true);
      setConnectionStatus('connected');
      setRetryCount(0);
      
      // Send connection info to server
      socketRef.current.emit('client_info', {
        username,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    });

    socketRef.current.on('server_connected', (data) => {
      console.log('✅ Server confirmed connection:', data);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ SOCKET CONNECTION ERROR:');
      console.error('   Message:', err.message);
      console.error('   Type:', err.type || 'unknown');
      console.error('   Description:', err.description || 'none');
      console.error('   Context:', err.context || 'none');
      
      setConnected(false);
      setConnectionStatus('error');
      
      // Auto-retry after delay
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      
      if (newRetryCount <= 5) {
        console.log(`🔄 Retrying connection (attempt ${newRetryCount}/5) in 3s...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          initializeSocket();
        }, 3000);
      } else {
        console.error('🚫 Max retries reached. Please check server.');
        setConnectionStatus('failed');
      }
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('🔌 SOCKET DISCONNECTED. Reason:', reason);
      setConnected(false);
      setConnectionStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, need to manually reconnect
        console.log('🔄 Server disconnected us, reconnecting...');
        setTimeout(() => {
          socketRef.current.connect();
        }, 1000);
      }
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      setConnectionStatus('connected');
      setConnected(true);
    });

    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      setConnectionStatus(`reconnecting (attempt ${attemptNumber})`);
    });

    socketRef.current.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error);
    });

    socketRef.current.on('reconnect_failed', () => {
      console.error('🚫 Reconnection failed');
      setConnectionStatus('failed');
    });

    socketRef.current.on('error', (error) => {
      console.error('💥 Socket error:', error);
    });

    socketRef.current.on('ping', () => {
      console.log('🏓 Ping received');
    });

    socketRef.current.on('pong', (data) => {
      console.log('🏓 Pong received:', data);
    });

    // ========== ROOM EVENTS ==========
    socketRef.current.on('room_list', (roomList) => {
      console.log('📋 Room list received:', roomList.length, 'rooms');
      setRooms(roomList);
    });

    socketRef.current.on('room_joined', (data) => {
      console.log('🚪 Joined room:', data.roomName, '(ID:', data.roomId + ')');
      console.log('   Previous messages:', data.previousMessages?.length || 0);
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
      alert(`Join error: ${data.message}`);
    });

    socketRef.current.on('room_update', (data) => {
      console.log('🔄 Room update:', data.roomId, 'users:', data.userCount);
      setRooms(prev => prev.map(room => 
        room.id === data.roomId 
          ? { ...room, userCount: data.userCount, hasPassword: data.hasPassword }
          : room
      ));
    });

    socketRef.current.on('new_room', (newRoom) => {
      console.log('📁 New room created:', newRoom.name);
      setRooms(prev => [...prev, newRoom]);
    });

    socketRef.current.on('auto_join', (data) => {
      console.log('🤖 Auto-joining created room:', data.roomName);
      joinRoomWithPassword(data.roomId, data.roomName, '');
    });

    socketRef.current.on('create_error', (data) => {
      console.error('❌ Create room error:', data.message);
      alert(`Create room error: ${data.message}`);
    });

    // ========== MESSAGE EVENTS ==========
    socketRef.current.on('message', (message) => {
      console.log('📨 Message received:', {
        from: message.username,
        type: message.type,
        text: message.type === 'text' ? message.text.substring(0, 50) + '...' : 'File: ' + message.fileName
      });
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
    });

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

    // Debug: Log all events
    socketRef.current.onAny((event, ...args) => {
      if (!event.includes('typing') && !event.includes('ping') && !event.includes('pong')) {
        console.log(`📡 Socket event [${event}]:`, args.length > 0 ? args[0] : 'no data');
      }
    });
  };

  useEffect(() => {
    console.log('🎯 Chat component mounted for user:', username);
    console.log('📍 Current URL:', window.location.href);
    
    // Initialize socket connection
    initializeSocket();

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up chat component...');
      
      // Clear timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Disconnect socket
      if (socketRef.current) {
        console.log('🔌 Disconnecting socket...');
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
    };
  }, [username]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end' 
      });
    }, 100);
  };

  const joinRoomWithPassword = (roomId, roomName, password) => {
    if (!socketRef.current || !connected) {
      console.error('❌ Cannot join room: Socket not connected');
      alert('Not connected to server. Please wait...');
      return;
    }

    console.log(`🔑 Joining room ${roomId} with password (hidden)`);
    socketRef.current.emit('join_room', { 
      roomId, 
      username, 
      password 
    });
  };

  const joinRoom = (room) => {
    console.log(`🚀 Attempting to join room: ${room.name} (${room.id})`);
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
    console.log('🏗️ Creating new room:', roomData.roomName);
    if (socketRef.current && connected) {
      socketRef.current.emit('create_room', roomData);
    } else {
      console.error('❌ Cannot create room: Not connected');
      alert('Not connected to server. Please wait for connection...');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) {
      console.log('⚠️ Message empty, not sending');
      return;
    }
    
    if (!socketRef.current || !connected || !currentRoom) {
      console.error('❌ Cannot send message: Not connected to room');
      alert('Not connected to chat room. Please join a room first.');
      return;
    }

    console.log('📤 Sending message:', input.trim().substring(0, 50) + '...');
    socketRef.current.emit('message', {
      roomId: currentRoom,
      text: input.trim()
    });
    setInput('');
    stopTyping();
  };

  const handleFileUpload = (fileData) => {
    console.log('📎 File upload initiated:', fileData.fileName);
    if (!socketRef.current || !connected || !currentRoom) {
      console.error('❌ Cannot upload file: Not connected to room');
      alert('Not connected to chat room. Please join a room first.');
      return;
    }

    socketRef.current.emit('file_upload', {
      roomId: currentRoom,
      ...fileData
    });
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

  const manualReconnect = () => {
    console.log('🔄 Manual reconnection requested');
    setRetryCount(0);
    setConnectionStatus('reconnecting');
    initializeSocket();
  };

  const testConnection = () => {
    console.log('🧪 Testing connection...');
    console.log('Socket exists:', !!socketRef.current);
    console.log('Socket connected:', socketRef.current?.connected);
    console.log('Socket ID:', socketRef.current?.id);
    
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('test_ping', { 
        test: 'connection_test',
        time: Date.now() 
      });
      alert('✅ Socket appears connected. Check console for details.');
    } else {
      alert('❌ Socket not connected. Check console for details.');
    }
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
            <div className="connection-status-indicator">
              <span className={`status-dot ${connectionStatus === 'connected' ? 'connected' : 
                               connectionStatus === 'connecting' ? 'connecting' : 
                               connectionStatus.includes('reconnecting') ? 'reconnecting' : 
                               'disconnected'}`}></span>
              <span className="status-text">
                {connectionStatus === 'connected' ? '✅ Connected' :
                 connectionStatus === 'connecting' ? '🔄 Connecting...' :
                 connectionStatus.includes('reconnecting') ? '🔄 Reconnecting...' :
                 connectionStatus === 'error' ? '❌ Connection Error' :
                 connectionStatus === 'failed' ? '❌ Connection Failed' :
                 '🔌 Disconnected'}
              </span>
            </div>
            {retryCount > 0 && (
              <div className="retry-count">
                Retry attempts: {retryCount}
              </div>
            )}
          </div>
        </div>

        <div className="connection-controls">
          <button 
            onClick={manualReconnect}
            className="reconnect-btn"
            disabled={connectionStatus === 'connecting' || connectionStatus.includes('reconnecting')}
          >
            {connectionStatus === 'connecting' || connectionStatus.includes('reconnecting') 
              ? 'Connecting...' 
              : 'Reconnect'}
          </button>
          <button 
            onClick={testConnection}
            className="test-btn"
          >
            Test Connection
          </button>
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
                  placeholder={connected && currentRoom ? "Type a message..." : "Connect to a room first..."}
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
              
              <div className="connection-debug">
                <h3>🔧 Connection Status</h3>
                <div className="debug-info">
                  <p><strong>Status:</strong> <span className={connectionStatus === 'connected' ? 'debug-success' : 'debug-error'}>
                    {connectionStatus}
                  </span></p>
                  <p><strong>Retry Count:</strong> {retryCount}</p>
                  <p><strong>Socket:</strong> {socketRef.current ? 'Initialized' : 'Not initialized'}</p>
                  <p><strong>Connected:</strong> {connected ? 'Yes' : 'No'}</p>
                  <p><strong>Environment URL:</strong> {import.meta.env.VITE_SOCKET_URL || 'Not set'}</p>
                </div>
                
                {!connected && (
                  <div className="troubleshooting">
                    <h4>🔍 Troubleshooting</h4>
                    <ol>
                      <li>Make sure backend server is running (check terminal)</li>
                      <li>Check if port 3000 is accessible</li>
                      <li>Try the "Reconnect" button above</li>
                      <li>Check browser console (F12) for errors</li>
                      <li>Make sure CORS is configured on backend</li>
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
};

export default Chat;