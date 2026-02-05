import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// Get backend URL based on environment
const getBackendUrl = () => {
  // In production, backend serves frontend from same origin
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  // In development, use environment variable or default
  return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};

const BACKEND_URL = getBackendUrl();

function App() {
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
  const [connectionDetails, setConnectionDetails] = useState({});
  const messagesEndRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    console.log('🔌 Connecting to:', BACKEND_URL);
    console.log('Environment:', import.meta.env.MODE);
    
    const newSocket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: false,
      withCredentials: false
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket.IO Connected!', {
        id: newSocket.id,
        transport: newSocket.io.engine.transport.name,
        url: BACKEND_URL
      });
      
      setIsConnected(true);
      setConnectionError('');
      setUserStatus('connected');
      setConnectionDetails({
        id: newSocket.id,
        transport: newSocket.io.engine.transport.name,
        connectedAt: new Date().toISOString()
      });
    });

    newSocket.on('connected', (data) => {
      console.log('Server welcome:', data);
      setUserStatus('ready');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', {
        message: error.message,
        description: error.description,
        type: error.type
      });
      
      setIsConnected(false);
      setConnectionError(`Connection failed: ${error.message}`);
      setUserStatus('error');
      
      // Try reconnection
      setTimeout(() => {
        if (newSocket && !newSocket.connected) {
          console.log('Attempting reconnection...');
          newSocket.connect();
        }
      }, 2000);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('⚠️ Disconnected:', reason);
      setIsConnected(false);
      setUserStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        setTimeout(() => {
          newSocket.connect();
        }, 1000);
      }
    });

    newSocket.on('user_registered', (data) => {
      console.log('User registered:', data);
      setUserStatus('registered');
    });

    newSocket.on('receive_message', (msg) => {
      console.log('Message received:', msg);
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('room_history', (data) => {
      console.log('Room history:', data);
      setMessages(data.messages || []);
    });

    newSocket.on('rooms_list', (data) => {
      console.log('Rooms list updated:', data);
      setRooms(data);
    });

    newSocket.on('user_joined', (data) => {
      console.log('User joined room:', data);
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        type: 'system',
        message: `${data.user} joined the room`,
        timestamp: new Date().toISOString()
      }]);
      
      // Update room user count
      setRooms(prev => prev.map(room => 
        room.name === data.room 
          ? { ...room, userCount: data.userCount }
          : room
      ));
    });

    newSocket.on('user_left', (data) => {
      console.log('User left room:', data);
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        type: 'system',
        message: `${data.user} left the room`,
        timestamp: new Date().toISOString()
      }]);
      
      // Update room user count
      setRooms(prev => prev.map(room => 
        room.name === data.room 
          ? { ...room, userCount: data.userCount }
          : room
      ));
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      alert(`Error: ${error.message}`);
    });

    newSocket.on('pong', (data) => {
      console.log('Pong received:', data);
    });

    setSocket(newSocket);

    return () => {
      console.log('Cleaning up socket connection');
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch rooms when connected
  useEffect(() => {
    if (isConnected && socket) {
      socket.emit('get_rooms');
    }
  }, [isConnected, socket]);

  const handleSetUsername = () => {
    if (username.trim() && socket) {
      socket.emit('register_user', username.trim());
      setUserStatus('registering');
    }
  };

  const handleCreateRoom = () => {
    if (newRoomName.trim() && socket) {
      socket.emit('join_room', newRoomName.trim());
      setCurrentRoom(newRoomName.trim());
      setNewRoomName('');
    }
  };

  const handleJoinRoom = (roomName) => {
    if (socket) {
      socket.emit('join_room', roomName);
      setCurrentRoom(roomName);
      setMessages([]);
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && currentRoom && socket && isConnected) {
      socket.emit('send_message', {
        room: currentRoom,
        message: message.trim()
      });
      setMessage('');
    }
  };

  const handleLeaveRoom = () => {
    if (currentRoom && socket) {
      socket.emit('leave_room', currentRoom);
      setCurrentRoom('');
      setMessages([]);
    }
  };

  const handleGetRooms = () => {
    if (socket) {
      socket.emit('get_rooms');
    }
  };

  const handleTestConnection = () => {
    if (socket) {
      socket.emit('ping', { clientTime: Date.now(), test: 'connection' });
      alert('Ping sent to server. Check console for response.');
    }
  };

  const handleReconnect = () => {
    if (socket) {
      socket.disconnect();
      setTimeout(() => {
        socket.connect();
      }, 500);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="user-section">
          <h2>💬 Chat App</h2>
          
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? '✅ Connected' : '❌ Disconnected'}
            {connectionError && <div className="error-message">{connectionError}</div>}
          </div>
          
          {!username ? (
            <div className="username-input">
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSetUsername()}
                disabled={!isConnected}
              />
              <button 
                onClick={handleSetUsername}
                disabled={!isConnected || !username.trim()}
              >
                Set Username
              </button>
            </div>
          ) : (
            <div className="user-info">
              <span className="user-avatar">👤</span>
              <div className="user-details">
                <strong>{username}</strong>
                <span className="user-status">{userStatus}</span>
              </div>
            </div>
          )}
          
          <div className="server-info">
            <div className="info-row">
              <span className="info-label">Backend:</span>
              <code className="info-value">{BACKEND_URL}</code>
            </div>
            <div className="info-row">
              <span className="info-label">Mode:</span>
              <span className="info-value">{import.meta.env.MODE}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Socket ID:</span>
              <span className="info-value">{connectionDetails.id || 'Not connected'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Transport:</span>
              <span className="info-value">{connectionDetails.transport || 'None'}</span>
            </div>
            
            <div className="action-buttons">
              <button 
                onClick={handleTestConnection} 
                className="test-btn"
                disabled={!isConnected}
              >
                Test Connection
              </button>
              <button 
                onClick={handleReconnect} 
                className="reconnect-btn"
              >
                Reconnect
              </button>
            </div>
          </div>
        </div>

        <div className="rooms-section">
          <h3>📁 Chat Rooms</h3>
          
          <button 
            onClick={handleGetRooms} 
            className="refresh-btn" 
            disabled={!isConnected}
            title="Refresh rooms list"
          >
            🔄 Refresh Rooms
          </button>
          
          <div className="create-room">
            <input
              type="text"
              placeholder="New room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
              disabled={!isConnected}
            />
            <button 
              onClick={handleCreateRoom} 
              disabled={!isConnected || !newRoomName.trim()}
            >
              Create
            </button>
          </div>
          
          <div className="rooms-list">
            {rooms.length === 0 ? (
              <div className="no-rooms">
                <p>No rooms available</p>
                <p className="hint">Create the first room!</p>
              </div>
            ) : (
              rooms.map(room => (
                <div
                  key={room.name}
                  className={`room-item ${currentRoom === room.name ? 'active' : ''}`}
                  onClick={() => handleJoinRoom(room.name)}
                  title={`${room.userCount} users, ${room.messageCount} messages`}
                >
                  <div className="room-info">
                    <span className="room-name"># {room.name}</span>
                    <div className="room-stats">
                      <span className="room-users">👥 {room.userCount}</span>
                      <span className="room-messages">💬 {room.messageCount}</span>
                    </div>
                  </div>
                  {currentRoom === room.name && (
                    <span className="active-indicator" title="Currently in this room">●</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="troubleshooting">
          <h4>🔧 Connection Info</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className={`info-value ${isConnected ? 'success' : 'error'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">User:</span>
              <span className="info-value">{username || 'Not set'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Rooms:</span>
              <span className="info-value">{rooms.length}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Environment:</span>
              <span className="info-value">{import.meta.env.MODE}</span>
            </div>
          </div>
          
          {connectionError && (
            <div className="error-box">
              <div className="error-header">
                <span className="error-icon">⚠️</span>
                <strong>Connection Error</strong>
              </div>
              <p className="error-detail">{connectionError}</p>
              <button onClick={handleReconnect} className="reconnect-btn-small">
                🔄 Try Again
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="chat-area">
        {currentRoom ? (
          <>
            <div className="chat-header">
              <div className="chat-title">
                <h3># {currentRoom}</h3>
                <div className="room-meta">
                  <span className="room-user-count">
                    👥 {rooms.find(r => r.name === currentRoom)?.userCount || 0} online
                  </span>
                  <span className="room-message-count">
                    💬 {messages.filter(m => m.type !== 'system').length} messages
                  </span>
                </div>
              </div>
              <button onClick={handleLeaveRoom} className="leave-btn" title="Leave this room">
                Leave Room
              </button>
            </div>
            
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="empty-messages">
                  <div className="empty-icon">💬</div>
                  <h4>No messages yet</h4>
                  <p className="hint">Start the conversation!</p>
                  <p className="sub-hint">Messages will appear here</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`message ${msg.type === 'system' ? 'system' : ''}`}>
                    {msg.type === 'system' ? (
                      <div className="system-message">
                        <span className="system-icon">📢</span>
                        <span className="system-text">{msg.message}</span>
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="message-header">
                          <div className="message-user-info">
                            <span className="message-user">
                              {msg.user}
                              {msg.userId === socket?.id && <span className="you-tag">(you)</span>}
                            </span>
                            <span className="message-time">{formatTime(msg.timestamp)}</span>
                          </div>
                        </div>
                        <div className="message-content">{msg.message}</div>
                      </>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="message-input">
              <input
                type="text"
                placeholder={isConnected ? `Message #${currentRoom}...` : "Connecting to server..."}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={!isConnected || !currentRoom}
                maxLength={500}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!message.trim() || !isConnected || !currentRoom}
                className="send-btn"
                title="Send message (Enter)"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <div className="welcome-header">
                <h1>💬 Welcome to Chat App!</h1>
                <p className="welcome-subtitle">Real-time messaging with Socket.IO</p>
              </div>
              
              <div className="welcome-steps">
                <div className="step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Set Your Username</h4>
                    <p>Enter a username in the sidebar to get started</p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Join or Create a Room</h4>
                    <p>Select an existing room or create a new one</p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Start Chatting</h4>
                    <p>Send messages in real-time to everyone in the room</p>
                  </div>
                </div>
              </div>
              
              <div className="connection-panel">
                <h3>🔌 Connection Status</h3>
                <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                  <span className="indicator-dot"></span>
                  {isConnected ? '✅ Connected to server' : '❌ Not connected to server'}
                </div>
                
                <div className="server-details">
                  <div className="detail-row">
                    <span className="detail-label">Backend Server:</span>
                    <code className="detail-value">{BACKEND_URL}</code>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Socket Status:</span>
                    <span className={`detail-value ${socket ? 'success' : 'error'}`}>
                      {socket ? 'Initialized' : 'Not initialized'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Connection:</span>
                    <span className={`detail-value ${isConnected ? 'success' : 'error'}`}>
                      {isConnected ? '✅ Established' : '❌ Failed'}
                    </span>
                  </div>
                  
                  {connectionError && (
                    <div className="error-details">
                      <div className="error-title">
                        <span className="error-icon">⚠️</span>
                        <strong>Connection Error</strong>
                      </div>
                      <p className="error-message">{connectionError}</p>
                      <button onClick={handleReconnect} className="reconnect-btn-large">
                        🔄 Reconnect Now
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="quick-actions">
                  <button 
                    onClick={handleTestConnection} 
                    className="action-btn"
                    disabled={!isConnected}
                  >
                    Test Connection
                  </button>
                  <button 
                    onClick={handleGetRooms} 
                    className="action-btn" 
                    disabled={!isConnected}
                  >
                    Load Rooms
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;