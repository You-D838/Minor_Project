import React from 'react';
import '../Styles/IntruderLog.css';

function IntruderLog({ intruders = [] }) {
  const stats = {
    total: intruders.length,
    today: intruders.filter(i => {
      const today = new Date().toLocaleDateString();
      return i.timestamp.includes(today.split('/')[1]) || true; // show all as today for now
    }).length,
    thisWeek: intruders.length,
  };

  const handleDownload = (intruder) => {
    const link = document.createElement('a');
    link.href = intruder.image;
    link.download = `intruder-${intruder.id}.jpg`;
    link.click();
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
          <span className="big-number">{intruders.length}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">This Week</span>
          <span className="big-number">{intruders.length}</span>
        </div>
      </div>

      {intruders.length === 0 ? (
        <div className="empty-intruders">
          <span>🛡️</span>
          <h2>No Intruders Detected</h2>
          <p>The system is actively monitoring. Unauthorized access attempts will be captured and appear here automatically.</p>
        </div>
      ) : (
        <div className="intruder-grid">
          {intruders.map(intruder => (
            <div key={intruder.id} className="intruder-card">
              <div className="intruder-image">
                {intruder.image ? (
                  <img src={intruder.image} alt="Captured intruder" />
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
                  <span className="value">{intruder.location}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Confidence</span>
                  <span className="value red">{(intruder.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="intruder-actions">
                <button
                  className="btn-view"
                  onClick={() => window.open(intruder.image, '_blank')}
                >
                  View Full
                </button>
                <button
                  className="btn-download"
                  onClick={() => handleDownload(intruder)}
                >
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