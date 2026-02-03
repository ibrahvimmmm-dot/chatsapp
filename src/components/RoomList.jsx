import { useState } from 'react';

const RoomList = ({ rooms, currentRoom, onJoinRoom, onCreateRoom, username }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoomId, setNewRoomId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (newRoomId.trim() && newRoomName.trim()) {
      if (roomPassword !== confirmPassword) {
        alert('Passwords do not match!');
        return;
      }
      
      onCreateRoom({
        roomId: newRoomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        roomName: newRoomName.trim(),
        password: roomPassword,
        creator: username
      });
      
      setNewRoomId('');
      setNewRoomName('');
      setRoomPassword('');
      setConfirmPassword('');
      setShowCreateForm(false);
    }
  };

  const getRoomIcon = (hasPassword) => {
    return hasPassword ? '🔒' : '💬';
  };

  return (
    <div className="room-list-container">
      <div className="room-list-header">
        <h3>💬 Chat Rooms</h3>
        <button 
          className="new-room-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ New Room'}
        </button>
      </div>

      {showCreateForm && (
        <form className="create-room-form" onSubmit={handleCreateRoom}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Room ID (e.g., gaming)"
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
              required
            />
            <small>Used in URL: /room/{newRoomId || 'room-id'}</small>
          </div>
          
          <div className="form-group">
            <input
              type="text"
              placeholder="Room Name (e.g., Gaming Chat)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              placeholder="Password (optional)"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
            />
            <small>Leave empty for public room</small>
          </div>
          
          {roomPassword && (
            <div className="form-group">
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={roomPassword.length > 0}
              />
            </div>
          )}
          
          <button type="submit" className="create-btn">
            {roomPassword ? 'Create Private Room' : 'Create Public Room'}
          </button>
        </form>
      )}

      <div className="rooms-grid">
        {rooms.map((room) => (
          <div 
            key={room.id}
            className={`room-card ${currentRoom === room.id ? 'active' : ''}`}
            onClick={() => onJoinRoom(room)}
          >
            <div className="room-info">
              <div className="room-title">
                <span className="room-icon">{getRoomIcon(room.hasPassword)}</span>
                <h4>{room.name}</h4>
                {room.hasPassword && <span className="lock-badge">Private</span>}
              </div>
              <p className="room-id">#{room.id}</p>
              <p className="room-creator">Created by: {room.creator}</p>
            </div>
            <div className="room-stats">
              <span className="user-count">👥 {room.userCount}</span>
            </div>
          </div>
        ))}
        
        {rooms.length === 0 && (
          <div className="no-rooms">
            <p>No rooms available. Create the first one!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomList;