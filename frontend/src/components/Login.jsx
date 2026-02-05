import { useState } from 'react';

const Login = ({ onLogin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onLogin(name.trim());
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>💬 Enhanced Chat App</h1>
          <p className="login-subtitle">Real-time messaging with advanced features</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Enter Your Display Name</label>
            <input
              id="username"
              type="text"
              placeholder="Choose a display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <small>This name will be visible to other users</small>
          </div>
          
          <div className="features-list">
            <h3>✨ Advanced Features:</h3>
            <ul>
              <li><strong>🔒 Password-protected rooms</strong> - Create private spaces</li>
              <li><strong>📎 File & image sharing</strong> - Share files up to 5MB</li>
              <li><strong>💬 Multiple rooms</strong> - Join different conversations</li>
              <li><strong>👥 User presence</strong> - See who's online</li>
              <li><strong>✏️ Typing indicators</strong> - Know when others are typing</li>
              <li><strong>💾 Message history</strong> - Never lose your conversations</li>
            </ul>
          </div>
          
          <button type="submit" className="login-button">
            Enter Chat
          </button>
          
          <p className="disclaimer">
            By entering, you agree to use this chat responsibly. 
            Be respectful to other users.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;