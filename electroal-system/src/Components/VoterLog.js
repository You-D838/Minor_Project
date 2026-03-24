import React, { useEffect, useState } from 'react';
import '../Styles/VoterLog.css';
import { getValidToken } from '../utils/auth';

const API_BASE = 'http://localhost:5000/api';

function VoterLog() {
  const [voters, setVoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const fetchVoters = async () => {
      const token = getValidToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/voters`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }

        setVoters(Array.isArray(data) ? data : []);
      } catch {
        setMessage({ text: 'Could not load voter records.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchVoters();
  }, []);

  const stats = {
    total: voters.length,
    voted: voters.filter(v => v.status === 'voted').length,
    notVoted: voters.filter(v => v.status === 'not-voted').length,
  };

  const filtered = voters.filter(voter => {
    const matchesSearch =
      voter.name.toLowerCase().includes(search.toLowerCase()) ||
      voter.voter_id.toLowerCase().includes(search.toLowerCase()) ||
      (voter.phone && voter.phone.includes(search));
    const matchesFilter = filter === 'all' || voter.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (voter) => {
    const confirmed = window.confirm(`Remove voter ${voter.name} (${voter.voter_id})?`);
    if (!confirmed) {
      return;
    }

    const token = getValidToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    setDeletingId(voter.id);
    setMessage({ text: '', type: '' });

    try {
      const response = await fetch(`${API_BASE}/voters/${voter.id}`, {
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
        throw new Error(result.message || 'Failed to remove voter.');
      }

      setVoters(prev => prev.filter(item => item.id !== voter.id));
      setMessage({ text: result.message || 'Voter removed successfully.', type: 'success' });
    } catch (error) {
      setMessage({ text: error.message || 'Failed to remove voter.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="voterlog-container">
      <div className="page-header">
        <h1 className="page-title">Voter Log</h1>
        <span className="page-sub">All registered voters</span>
      </div>

      <div className="vl-stats">
        <div className="vl-stat-box">
          <span className="vl-stat-label">Total Registered</span>
          <span className="vl-stat-number">{stats.total}</span>
        </div>
        <div className="vl-stat-box green">
          <span className="vl-stat-label">Voted</span>
          <span className="vl-stat-number">{stats.voted}</span>
        </div>
        <div className="vl-stat-box orange">
          <span className="vl-stat-label">Not Voted</span>
          <span className="vl-stat-number">{stats.notVoted}</span>
        </div>
      </div>

      <div className="vl-toolbar">
        <div className="vl-search-wrapper">
          <input
            type="text"
            className="vl-search"
            placeholder="Search by name, voter ID, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="vl-clear" onClick={() => setSearch('')}>Clear</button>
          )}
        </div>
        <div className="vl-filters">
          <button type="button" className={`vl-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={`vl-filter-btn ${filter === 'voted' ? 'active' : ''}`} onClick={() => setFilter('voted')}>Voted</button>
          <button type="button" className={`vl-filter-btn ${filter === 'not-voted' ? 'active' : ''}`} onClick={() => setFilter('not-voted')}>Not Voted</button>
        </div>
      </div>

      {message.text && (
        <div className={`vl-message ${message.type}`}>{message.text}</div>
      )}

      <div className="vl-table-card">
        {loading ? (
          <div className="vl-empty">
            <span>Loading</span>
            <h2>Loading...</h2>
            <p>Fetching voter records from server.</p>
          </div>
        ) : voters.length === 0 ? (
          <div className="vl-empty">
            <span>Empty</span>
            <h2>No Voters Registered Yet</h2>
            <p>Registered voters will appear here once added through the Registration page.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="vl-empty">
            <span>Search</span>
            <h2>No Results Found</h2>
            <p>No voters match your search or filter.</p>
          </div>
        ) : (
          <>
            <div className="vl-table-meta">Showing {filtered.length} of {voters.length} voters</div>
            <div className="vl-table-wrapper">
              <table className="vl-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Voter ID</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((voter, index) => (
                    <tr key={voter.id}>
                      <td className="vl-index">{index + 1}</td>
                      <td className="vl-name">
                        <div className="vl-avatar">
                          {voter.photo_url ? (
                            <img src={`http://localhost:5000/voter_photos/${voter.photo_url}`} alt={voter.name} />
                          ) : (
                            <span>{voter.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        {voter.name}
                      </td>
                      <td className="vl-mono">{voter.voter_id}</td>
                      <td>{voter.phone}</td>
                      <td>{voter.address}</td>
                      <td className="vl-date">{voter.registered_at}</td>
                      <td>
                        <span className={`vl-badge ${voter.status}`}>
                          {voter.status === 'voted' ? 'Voted' : 'Not Voted'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="vl-delete-btn"
                          onClick={() => handleDelete(voter)}
                          disabled={deletingId === voter.id}
                        >
                          {deletingId === voter.id ? 'Removing...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default VoterLog;
