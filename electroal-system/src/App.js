import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import Dashboard from './Components/Dashboard';
import Registration from './Components/Registration';
import LiveVoting from './Components/LiveVoting';
import IntruderLog from './Components/IntruderLog';
import VoterLog from './Components/VoterLog';
import Login from './Components/Login';
import './App.css';

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Persist login across refresh using localStorage token
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem('token')
  );

  // Session intruder captures (for current session before backend saves)
  const [capturedIntruders, setCapturedIntruders] = useState([]);

  const addIntruder = (intruder) => {
    setCapturedIntruders(prev => [intruder, ...prev]);
  };

  const toggleDark = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  };

  return (
    <Router>
      <div className="App">

        {isLoggedIn && (
          <nav className="navbar">
            <div className="navbar-inner">
              <div className="nav-brand">
                <Link to="/dashboard" style={{ textDecoration: 'none' }}>
                  <h2>Electoral <span className="brand-accent">Security</span></h2>
                </Link>
              </div>

              <ul className={`nav-links ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
                <li><NavLink to="/dashboard" end>Dashboard</NavLink></li>
                <li><NavLink to="/registration">Registration</NavLink></li>
                <li><NavLink to="/voting">Live Voting</NavLink></li>
                <li><NavLink to="/voters">Voter Log</NavLink></li>
                <li>
                  <NavLink to="/intruders">
                    Intruder Log
                    {capturedIntruders.length > 0 && (
                      <span className="nav-badge">{capturedIntruders.length}</span>
                    )}
                  </NavLink>
                </li>
              </ul>

              <div className="nav-actions">
                <button onClick={toggleDark} className="dark-toggle" title="Toggle dark mode">
                  {darkMode ? '☀️' : '🌙'}
                </button>
                <button onClick={handleLogout} className="logout-btn">Logout</button>
              </div>

              <button
                className="nav-toggle"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            </div>
          </nav>
        )}

        <div className={isLoggedIn ? 'content' : ''}>
          <Routes>
            <Route path="/"             element={isLoggedIn ? <Navigate to="/dashboard" /> : <Login onLogin={() => setIsLoggedIn(true)} />} />
            <Route path="/login"        element={isLoggedIn ? <Navigate to="/dashboard" /> : <Login onLogin={() => setIsLoggedIn(true)} />} />
            <Route path="/dashboard"    element={isLoggedIn ? <Dashboard intruderCount={capturedIntruders.length} /> : <Navigate to="/login" />} />
            <Route path="/registration" element={isLoggedIn ? <Registration /> : <Navigate to="/login" />} />
            <Route path="/voting"       element={isLoggedIn ? <LiveVoting onIntruderCaptured={addIntruder} /> : <Navigate to="/login" />} />
            <Route path="/voters"       element={isLoggedIn ? <VoterLog /> : <Navigate to="/login" />} />
            <Route path="/intruders"    element={isLoggedIn ? <IntruderLog intruders={capturedIntruders} /> : <Navigate to="/login" />} />
          </Routes>
        </div>

      </div>
    </Router>
  );
}

export default App;
