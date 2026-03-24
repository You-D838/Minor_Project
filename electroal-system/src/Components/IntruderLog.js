import React, { useEffect, useState } from 'react';
import '../Styles/IntruderLog.css';
import { getValidToken } from '../utils/auth';

const API_BASE = 'http://localhost:5000/api';

function IntruderLog({ intruders: sessionIntruders = [] }) {
  const [intruders, setIntruders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const token = getValidToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    fetch(`${API_BASE}/intruders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setIntruders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setIntruders(sessionIntruders);
        setLoading(false);
      });
  }, [sessionIntruders]);

  const allIntruders = [
    ...intruders,
    ...sessionIntruders.filter(s => !intruders.find(i => i.id === s.id))
  ];

  const stats = {
    total: allIntruders.length,
    today: allIntruders.filter(i => {
      const today = new Date().toLocaleDateString();
      return new Date(i.timestamp).toLocaleDateString() === today;
    }).length,
    thisWeek: allIntruders.length,
  };

  const getImageSrc = (intruder) => {
    if (intruder.image_path) {
      return `http://localhost:5000/static/${intruder.image_path}`;
    }
    if (intruder.image && intruder.image.startsWith('data:')) {
      return intruder.image;
    }
    return null;
  };

  const handleDownload = (intruder) => {
    const src = getImageSrc(intruder);
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = `intruder-${intruder.id}.jpg`;
    link.click();
  };

  const handleView = (intruder) => {
    const src = getImageSrc(intruder);
    if (src) window.open(src, '_blank');
  };

  const handleDelete = async (intruder) => {
    const confirmed = window.confirm(`Remove intruder log #${intruder.id}?`);
    if (!confirmed) {
      return;
    }

    const token = getValidToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    setDeletingId(intruder.id);
    setMessage({ text: '', type: '' });

    try {
      const response = await fetch(`${API_BASE}/intruders/${intruder.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || 'Failed to remove intruder log.');
      }

      setIntruders(prev => prev.filter(item => item.id !== intruder.id));
      setMessage({ text: result.message || 'Intruder log removed successfully.', type: 'success' });
    } catch (error) {
      setMessage({ text: error.message || 'Failed to remove intruder log.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="intruder-container">
      <div className="page-header">
        <h1 className="page-title">Intruder Detection Log</h1>
        <span className="page-sub">Unauthorized access attempts</span>
      </div>

      <div className="intruder-stats">
        <div className="stat-box">
          <span className="stat-label">Total Detected</span>
          <span className="big-number">{stats.total}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Today</span>
          <span className="big-number">{stats.today}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">This Week</span>
          <span className="big-number">{stats.thisWeek}</span>
        </div>
      </div>

      {message.text && (
        <div className={`intruder-message ${message.type}`}>{message.text}</div>
      )}

      {loading ? (
        <div className="empty-intruders">
          <span>Loading</span>
          <h2>Loading...</h2>
          <p>Fetching intruder records from server.</p>
        </div>
      ) : allIntruders.length === 0 ? (
        <div className="empty-intruders">
          <span>Clear</span>
          <h2>No Intruders Detected</h2>
          <p>The system is actively monitoring. Unauthorized access attempts will appear here automatically.</p>
        </div>
      ) : (
        <div className="intruder-grid">
          {allIntruders.map(intruder => (
            <div key={intruder.id} className="intruder-card">
              <div className="intruder-image">
                {getImageSrc(intruder) ? (
                  <img src={getImageSrc(intruder)} alt="Captured intruder" />
                ) : (
                  <div className="no-image">No Image</div>
                )}
                <span className="alert-badge">Alert</span>
              </div>

              <div className="intruder-details">
                <div className="detail-row">
                  <span className="label">ID</span>
                  <span className="value">#{intruder.id.toString().slice(-5)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Time</span>
                  <span className="value">{intruder.timestamp}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Location</span>
                  <span className="value">{intruder.location || 'Polling Station A'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Confidence</span>
                  <span className="value red">
                    {typeof intruder.confidence === 'number'
                      ? intruder.confidence <= 1
                        ? (intruder.confidence * 100).toFixed(1)
                        : intruder.confidence.toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>

              <div className="intruder-actions">
                <button className="btn-view" onClick={() => handleView(intruder)}>
                  View Full
                </button>
                <button className="btn-download" onClick={() => handleDownload(intruder)}>
                  Download
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(intruder)}
                  disabled={deletingId === intruder.id}
                >
                  {deletingId === intruder.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IntruderLog;
