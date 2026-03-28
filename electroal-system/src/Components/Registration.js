import React, { useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import '../Styles/Registration.css';
import { getValidToken } from '../utils/auth';

const API_BASE = 'http://localhost:5000/api';

function Registration() {
  const [formData, setFormData] = useState({
    name: '', citizenshipNo: '', phone: '', address: ''
  });
  const webcamRef = useRef(null);
  const [captures, setCaptures] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const videoConstraints = useMemo(() => ({
    width: 640,
    height: 480,
    facingMode: 'user'
  }), []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const captureFrame = () => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) {
      setMessage({ text: 'Could not capture from webcam. Please allow camera access.', type: 'error' });
      return;
    }

    setCaptures(prev => {
      if (prev.length >= 10) {
        return prev;
      }
      return [...prev, img];
    });
  };

  const clearCaptures = () => {
    setCaptures([]);
  };

  const resetForm = () => {
    setFormData({ name: '', citizenshipNo: '', phone: '', address: '' });
    setCaptures([]);
    setMessage({ text: '', type: '' });
  };

  const redirectToLogin = () => {
    localStorage.removeItem('token');
    setTimeout(() => {
      window.location.href = '/login';
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getValidToken();
      if (!token) {
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        redirectToLogin();
        return;
      }

      if (captures.length < 10) {
        setMessage({ text: 'Please capture 10 webcam photos before registering.', type: 'error' });
        return;
      }

      const response = await fetch(`${API_BASE}/voters/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          citizenship_no: formData.citizenshipNo,
          phone: formData.phone,
          address: formData.address,
          images: captures
        })
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({
          text: `Registered successfully. ID: #${result.voter_id}`,
          type: 'success'
        });
        setTimeout(resetForm, 3000);
      } else if (response.status === 401) {
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        redirectToLogin();
      } else {
        setMessage({
          text: result.message || 'Registration failed.',
          type: 'error'
        });
      }
    } catch (err) {
      setMessage({
        text: 'Could not connect to server.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-container">
      <div className="registration-card">
        <div className="reg-header">
          <h1>Voter Registration</h1>
          <p>Register each voter once using their citizenship number (capture 10 webcam photos)</p>
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
              <label>Citizenship No. *</label>
              <input
                type="text"
                name="citizenshipNo"
                value={formData.citizenshipNo}
                onChange={handleChange}
                placeholder="Enter citizenship number"
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

          <div className="form-group webcam-block">
            <label>Webcam Capture (10 frames) *</label>
            <div className="webcam-panel">
              <div className="webcam-view">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  mirrored
                />
              </div>

              <div className="webcam-actions">
                <div className="webcam-progress">
                  Captured: <strong>{captures.length}</strong> / 10
                </div>
                <div className="webcam-buttons">
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={captureFrame}
                    disabled={captures.length >= 10 || loading}
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    className="remove-photo"
                    onClick={clearCaptures}
                    disabled={captures.length === 0 || loading}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {captures.length > 0 && (
              <div className="capture-grid">
                {captures.map((src, idx) => (
                  <img key={String(idx)} src={src} alt={`Capture ${idx + 1}`} className="capture-thumb" />
                ))}
              </div>
            )}
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
