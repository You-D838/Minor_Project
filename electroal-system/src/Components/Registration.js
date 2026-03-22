import React, { useState } from 'react';
import '../Styles/Registration.css';

function Registration() {
  const [formData, setFormData] = useState({
    name: '', VoterID: '', phone: '', address: '', photo: null
  });
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, photo: file });
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPreview(null);
    setFormData({ ...formData, photo: null });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Replace setTimeout with real API call when backend is ready
    setTimeout(() => {
      setMessage({
        text: '✅ Voter registered successfully! ID: #' + Math.floor(Math.random() * 10000),
        type: 'success'
      });
      setLoading(false);
      setTimeout(() => {
        setFormData({ name: '', VoterID: '', phone: '', address: '', photo: null });
        setPreview(null);
        setMessage({ text: '', type: '' });
      }, 3000);
    }, 1200);
  };

  return (
    <div className="registration-container">
      <div className="registration-card">
        <div className="reg-header">
          <h1>Voter Registration</h1>
          <p>Register new voters to the electoral database</p>
        </div>

        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input type="text" name="name" value={formData.name}
                onChange={handleChange} placeholder="Enter full name" required />
            </div>
            <div className="form-group">
              <label>Voter ID *</label>
              <input type="text" name="Voter ID" value={formData.VoterID}
                onChange={handleChange} placeholder="Enter voter ID number" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number *</label>
              <input type="tel" name="phone" value={formData.phone}
                onChange={handleChange} placeholder="Enter phone number" required />
            </div>
            <div className="form-group">
              <label>Address *</label>
              <input type="text" name="address" value={formData.address}
                onChange={handleChange} placeholder="Enter address" required />
            </div>
          </div>

          <div className="form-group photo-upload">
            <label>Voter Photo *</label>
            <div className="upload-area">
              <input type="file" accept="image/*" onChange={handlePhotoChange}
                required={!preview} id="photo-input" />
              <label htmlFor="photo-input" className="upload-label">
                {preview ? (
                  <div className="preview-wrapper">
                    <img src={preview} alt="Preview" className="preview-image" />
                    <button type="button" className="remove-photo"
                      onClick={(e) => { e.preventDefault(); handleRemovePhoto(); }}>
                      ✕ Remove
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📷</span>
                    <p>Click to upload photo</p>
                    <span className="upload-hint">JPG, PNG, WEBP</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? <><span className="spinner-sm"></span> Registering...</> : 'Register Voter'}
          </button>
        </form>

        {message.text && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}
      </div>
    </div>
  );
}

export default Registration;
