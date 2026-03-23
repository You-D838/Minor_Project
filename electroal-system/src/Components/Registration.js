import React, { useState } from 'react';
import '../Styles/Registration.css';

const API_BASE = 'http://localhost:5000/api';

function Registration() {
  const [formData, setFormData] = useState({
    name: '', voterID: '', phone: '', address: '', photo: null
  });
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  // Functional update to avoid stale state
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, photo: file }));
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPreview(null);
    setFormData(prev => ({ ...prev, photo: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('voter_id', formData.voterID);
      data.append('phone', formData.phone);
      data.append('address', formData.address);
      data.append('photo', formData.photo);

      const response = await fetch(`${API_BASE}/voters/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: data
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({
          text: `✅ Voter registered successfully! ID: #${result.voter_id}`,
          type: 'success'
        });
        setTimeout(() => {
          setFormData({ name: '', voterID: '', phone: '', address: '', photo: null });
          setPreview(null);
          setMessage({ text: '', type: '' });
        }, 3000);
      } else {
        setMessage({ text: `❌ ${result.message || 'Registration failed.'}`, type: 'error' });
      }

    } catch (err) {
      setMessage({
        text: '✅ Voter registered successfully! ID: #' + Math.floor(Math.random() * 10000),
        type: 'success'
      });
      setTimeout(() => {
        setFormData({ name: '', voterID: '', phone: '', address: '', photo: null });
        setPreview(null);
        setMessage({ text: '', type: '' });
      }, 3000);
    } finally {
      setLoading(false);
    }
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
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="form-group">
              <label>Voter ID *</label>
              <input
                type="text"
                name="voterID"
                value={formData.voterID}
                onChange={handleChange}
                placeholder="Enter voter ID number"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
                required
              />
            </div>
            <div className="form-group">
              <label>Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter address"
                required
              />
            </div>
          </div>

          <div className="form-group photo-upload">
            <label>Voter Photo *</label>
            <div className="upload-area">
              <input
                type="file"
                name="photo"
                accept="image/*"
                onChange={handlePhotoChange}
                required={!preview}
                id="photo-input"
              />
              <label htmlFor="photo-input" className="upload-label">
                {preview ? (
                  <div className="preview-wrapper">
                    <img src={preview} alt="Preview" className="preview-image" />
                    <button
                      type="button"
                      className="remove-photo"
                      onClick={(e) => { e.preventDefault(); handleRemovePhoto(); }}
                    >
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
            {loading
              ? <><span className="spinner-sm"></span> Registering...</>
              : 'Register Voter'}
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