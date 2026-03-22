import React, { useState } from 'react';
import '../Styles/VoterLog.css';

function VoterLog() {
  // Empty array — backend will fill this via API
  const [voters] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | voted | not-voted

  const stats = {
    total: voters.length,
    voted: voters.filter(v => v.status === 'voted').length,
    notVoted: voters.filter(v => v.status === 'not-voted').length,
  };

  const filtered = voters.filter(voter => {
    const matchesSearch =
      voter.name.toLowerCase().includes(search.toLowerCase()) ||
      voter.voterId.toLowerCase().includes(search.toLowerCase()) ||
      voter.phone.includes(search);

    const matchesFilter =
      filter === 'all' ||
      voter.status === filter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="voterlog-container">
      <div className="page-header">
        <h1 className="page-title">Voter Log</h1>
        <span className="page-sub">All registered voters</span>
      </div>

      {/* Summary Stats */}
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

      {/* Search + Filter Bar */}
      <div className="vl-toolbar">
        <div className="vl-search-wrapper">
          <span className="vl-search-icon">🔍</span>
          <input
            type="text"
            className="vl-search"
            placeholder="Search by name, voter ID, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="vl-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <div className="vl-filters">
          <button
            className={`vl-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`vl-filter-btn ${filter === 'voted' ? 'active' : ''}`}
            onClick={() => setFilter('voted')}
          >
            Voted
          </button>
          <button
            className={`vl-filter-btn ${filter === 'not-voted' ? 'active' : ''}`}
            onClick={() => setFilter('not-voted')}
          >
            Not Voted
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="vl-table-card">
        {voters.length === 0 ? (
          <div className="vl-empty">
            <span>📋</span>
            <h2>No Voters Registered Yet</h2>
            <p>Registered voters will appear here once added through the Registration page.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="vl-empty">
            <span>🔍</span>
            <h2>No Results Found</h2>
            <p>No voters match your search or filter. Try a different query.</p>
          </div>
        ) : (
          <>
            <div className="vl-table-meta">
              Showing {filtered.length} of {voters.length} voters
            </div>
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
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((voter, index) => (
                    <tr key={voter.id}>
                      <td className="vl-index">{index + 1}</td>
                      <td className="vl-name">
                        <div className="vl-avatar">
                          {voter.photo ? (
                            <img src={voter.photo} alt={voter.name} />
                          ) : (
                            <span>{voter.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        {voter.name}
                      </td>
                      <td className="vl-mono">{voter.voterId}</td>
                      <td>{voter.phone}</td>
                      <td>{voter.address}</td>
                      <td className="vl-date">{voter.registeredAt}</td>
                      <td>
                        <span className={`vl-badge ${voter.status}`}>
                          {voter.status === 'voted' ? 'Voted' : 'Not Voted'}
                        </span>
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
