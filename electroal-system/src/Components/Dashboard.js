import React, { useState, useEffect } from 'react';
import '../Styles/Dashboard.css';
import { getValidToken } from '../utils/auth';

const API_BASE = 'http://localhost:5000/api';

function normalizeRecentVoters(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.recentVoters)) {
    return data.recentVoters;
  }

  if (Array.isArray(data?.recent)) {
    return data.recent;
  }

  return [];
}

function Dashboard({ intruderCount = 0 }) {
  const [stats, setStats] = useState({
    totalVoters: 0, voted: 0, notVoted: 0, intruders: 0
  });
  const [recentVoters, setRecentVoters] = useState([]);

  useEffect(() => {
    const token = getValidToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const headers = { 'Authorization': `Bearer ${token}` };

    // Fetch stats
    fetch(`${API_BASE}/stats`, { headers })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Failed to load dashboard stats');
        }
        return data;
      })
      .then(data => setStats({
        totalVoters: data.total_voters || 0,
        voted: data.voted || 0,
        notVoted: data.not_voted || 0,
        intruders: data.intruders || intruderCount
      }))
      .catch(() => setStats(s => ({ ...s, intruders: intruderCount })));

    // Fetch recent activity
    fetch(`${API_BASE}/voters/recent`, { headers })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Failed to load recent voters');
        }
        return data;
      })
      .then(data => setRecentVoters(normalizeRecentVoters(data)))
      .catch(() => setRecentVoters([]));
  }, [intruderCount]);

  const turnoutPercent = stats.totalVoters > 0
    ? Math.round((stats.voted / stats.totalVoters) * 100)
    : 0;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h1 className="page-title">Election Dashboard</h1>
        <span className="page-sub">Real-time overview</span>
      </div>

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
                      <span className={`badge ${(voter.status || 'unknown').toLowerCase()}`}>
                        {voter.status || 'Unknown'}
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
