import React from 'react';
import '../Styles/Dashboard.css';

function Dashboard() {
  const stats = {
    totalVoters: 0,
    voted: 0,
    notVoted: 0,
    intruders: 0,
  };

  const recentVoters = [];

  const turnoutPercent = stats.totalVoters > 0
    ? Math.round((stats.voted / stats.totalVoters) * 100)
    : 0;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h1 className="page-title">Election Dashboard</h1>
        <span className="page-sub">Real-time overview</span>
      </div>

      {/* 4 stat cards in one row */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Registered</span>
          <span className="stat-number">{stats.totalVoters}</span>
          <span className="stat-icon-sm">👥</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Voted</span>
          <span className="stat-number">{stats.voted}</span>
          <span className="stat-icon-sm">✅</span>
        </div>
        <div className="stat-card orange">
          <span className="stat-label">Not Voted</span>
          <span className="stat-number">{stats.notVoted}</span>
          <span className="stat-icon-sm">⏳</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Intruder Attempts</span>
          <span className="stat-number">{stats.intruders}</span>
          <span className="stat-icon-sm">⚠️</span>
        </div>
      </div>

      {/* Turnout */}
      <div className="turnout-card">
        <div className="turnout-header">
          <h2>Voter Turnout</h2>
          <span className="turnout-percent">{turnoutPercent}%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${turnoutPercent}%` }}></div>
        </div>
        <p className="turnout-sub">{stats.voted} of {stats.totalVoters} registered voters have voted</p>
      </div>

      {/* Activity Table */}
      <div className="recent-activity">
        <h2>Recent Activity</h2>
        {recentVoters.length === 0 ? (
          <div className="empty-state">
            <span>📋</span>
            <p>No activity yet. Data will appear here once voting begins.</p>
          </div>
        ) : (
          <div className="activity-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentVoters.map(voter => (
                  <tr key={voter.id}>
                    <td>{voter.id}</td>
                    <td>{voter.name}</td>
                    <td>{voter.time}</td>
                    <td>
                      <span className={`badge ${voter.status.toLowerCase()}`}>
                        {voter.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
