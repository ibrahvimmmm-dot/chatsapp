import { useState } from 'react';

const PasswordModal = ({ roomName, onSubmit, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    onSubmit(password);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>🔒 Enter Room Password</h3>
          <p>"{roomName}" is password protected</p>
        </div>
        
        <form onSubmit={handleSubmit} className="password-form">
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter room password"
              autoFocus
              required
            />
            {error && <p className="error-message">{error}</p>}
          </div>
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Join Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;