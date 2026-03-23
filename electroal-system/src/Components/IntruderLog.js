import React, { useState, useEffect } from 'react';
import '../Styles/IntruderLog.css';

const API_BASE = 'http://localhost:5000/api';

function IntruderLog({ intruders: sessionIntruders = [] }) {
  const [intruders, setIntruders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch from backend on load — persistent records from DB
  useEffect(() => {
    fetch(`${API_BASE}/intruders`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        setIntruders(data);
        setLoading(false);
      })
      .catch(() => {
        // Backend not connected — fall back to session captures from props
        setIntruders(sessionIntruders);
        setLoading(false);
      });
  }, [sessionIntruders]);

  // Merge any new session captures not yet in DB list
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
    // If image_path from backend — use backend static URL
    if (intruder.image_path) {
      return `http://localhost:5000/static/${intruder.image_path}`;
    }
    // If base64 from session capture — use directly
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

      {loading ? (
        <div className="empty-intruders">
          <span>⏳</span>
          <h2>Loading...</h2>
          <p>Fetching intruder records from server.</p>
        </div>
      ) : allIntruders.length === 0 ? (
        <div className="empty-intruders">
          <span>🛡️</span>
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
                  <div className="no-image">📷 No Image</div>
                )}
                <span className="alert-badge">⚠ ALERT</span>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IntruderLog;
