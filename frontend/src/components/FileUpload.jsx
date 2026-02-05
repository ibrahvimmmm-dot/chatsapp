import { useState } from 'react';

const FileUpload = ({ onFileUpload, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file) => {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      onFileUpload({
        fileData: e.target.result,
        fileName: file.name,
        fileType: file.type
      });
      setUploading(false);
    };
    
    reader.onerror = () => {
      alert('Error reading file');
      setUploading(false);
    };
    
    reader.readAsDataURL(file);
  };

  return (
    <div className="file-upload-container">
      <label 
        className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          style={{ display: 'none' }}
          id="file-upload"
        />
        
        <div className="file-upload-content">
          {uploading ? (
            <>
              <div className="upload-spinner"></div>
              <p className="file-upload-text">Uploading...</p>
            </>
          ) : (
            <>
              <svg className="file-icon" viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              <p className="file-upload-text">Drag & drop files or click to upload</p>
              <p className="file-upload-hint">Max size: 5MB</p>
            </>
          )}
        </div>
      </label>
      
      <button 
        className="browse-button"
        onClick={() => document.getElementById('file-upload').click()}
        disabled={disabled || uploading}
      >
        {uploading ? 'Uploading...' : 'Browse Files'}
      </button>
    </div>
  );
};

export default FileUpload;