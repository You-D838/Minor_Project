import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import '../Styles/LiveVoting.css';

const API_BASE = 'http://localhost:5000/api';

function LiveVoting({ onIntruderCaptured }) {
  const [verificationResult, setVerificationResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [autoScanActive, setAutoScanActive] = useState(true);
  const [stats, setStats] = useState({ todayVotes: 0, pending: 0, intruders: 0 });
  const webcamRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  // Fetch live stats
  useEffect(() => {
    const fetchStats = () => {
      fetch(`${API_BASE}/stats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => setStats({
          todayVotes: data.voted || 0,
          pending: data.not_voted || 0,
          intruders: data.intruders || 0
        }))
        .catch(() => {}); // silently fail if backend not connected
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const runScan = useCallback(async () => {
    if (isScanning || !webcamRef.current || cameraError) return;

    setIsScanning(true);
    setVerificationResult(null);

    // Capture screenshot
    const screenshot = webcamRef.current.getScreenshot();
    if (!screenshot) {
      setIsScanning(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ image: screenshot })
      });

      const result = await response.json();
      // result = { status, name, confidence, message }

      setVerificationResult(result);

      // If intruder — pass to App.js for intruder log
      if (result.status === 'intruder') {
        const intruderRecord = {
          id: Date.now(),
          image: screenshot,
          image_path: result.image_path || null,
          timestamp: new Date().toLocaleString(),
          location: 'Polling Station A',
          confidence: result.confidence / 100, // convert % back to 0-1 for display
        };
        if (onIntruderCaptured) onIntruderCaptured(intruderRecord);
      }

    } catch (err) {
      // Backend not connected — show error state
      setVerificationResult({
        status: 'error',
        name: '',
        message: 'Could not connect to server. Check backend.',
        confidence: 0
      });
    } finally {
      setIsScanning(false);

      // Schedule next scan only AFTER this one finishes (fixes overlap issue)
      if (autoScanActive) {
        scanTimeoutRef.current = setTimeout(runScan, 5000);
      }

      // Clear result after 5 seconds
      setTimeout(() => setVerificationResult(null), 5000);
    }
  }, [isScanning, cameraError, autoScanActive, onIntruderCaptured]);

  // Start auto scanning
  useEffect(() => {
    if (autoScanActive && !cameraError) {
      scanTimeoutRef.current = setTimeout(runScan, 2000);
    }
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [autoScanActive, cameraError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  const getStatusClass = () => {
    if (!verificationResult) return '';
    if (verificationResult.status === 'authorized') return 'status-success';
    if (verificationResult.status === 'error') return 'status-warning';
    return 'status-error';
  };

  return (
    <div className="voting-container">
      <div className="page-header">
        <h1 className="page-title">Live Voter Verification</h1>
        <span className="page-sub">Automated face recognition system</span>
      </div>

      <div className="voting-layout">
        {/* Camera */}
        <div className="camera-section">
          <div className="camera-top-bar">
            <span className="section-label">Camera Feed</span>
            <div className={`auto-indicator ${autoScanActive ? 'active' : 'paused'}`}>
              <span className="indicator-dot"></span>
              {autoScanActive ? 'AUTO SCANNING' : 'PAUSED'}
            </div>
          </div>

          <div className="webcam-wrapper">
            {cameraError ? (
              <div className="camera-error">
                <span>📷</span>
                <h3>Camera Unavailable</h3>
                <p>Allow camera access in your browser settings.</p>
              </div>
            ) : (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="webcam"
                onUserMediaError={() => setCameraError(true)}
              />
            )}

            {isScanning && !cameraError && (
              <div className="scanning-overlay">
                <div className="scanner-line"></div>
                <p>Analyzing face...</p>
              </div>
            )}

            {!isScanning && !cameraError && autoScanActive && (
              <div className="scan-pulse">
                <div className="corner tl"></div>
                <div className="corner tr"></div>
                <div className="corner bl"></div>
                <div className="corner br"></div>
              </div>
            )}
          </div>

          <button
            className={`toggle-scan-btn ${autoScanActive ? 'pause' : 'resume'}`}
            onClick={() => {
              if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
              setAutoScanActive(!autoScanActive);
            }}
            disabled={cameraError}
          >
            {autoScanActive ? '⏸ Pause Scanning' : '▶ Resume Scanning'}
          </button>
        </div>

        {/* Status + Stats */}
        <div className="status-section">
          <div className="section-label">Verification Result</div>
          <div className={`status-card ${getStatusClass()}`}>
            {verificationResult ? (
              <>
                <div className="status-icon">
                  {verificationResult.status === 'authorized' && '✅'}
                  {verificationResult.status === 'duplicate'  && '⚠️'}
                  {verificationResult.status === 'intruder'   && '🚫'}
                  {verificationResult.status === 'no_face'    && '👁️'}
                  {verificationResult.status === 'error'      && '⚠️'}
                </div>
                <h2>{verificationResult.status.replace('_', ' ').toUpperCase()}</h2>
                {verificationResult.name && (
                  <p className="voter-name">{verificationResult.name}</p>
                )}
                <p className="status-message">{verificationResult.message}</p>
                {verificationResult.confidence > 0 && (
                  <p className="confidence-display">
                    Confidence: <strong>{verificationResult.confidence.toFixed(1)}%</strong>
                    {verificationResult.confidence < 90
                      ? ' — Below threshold'
                      : ' — Above threshold'}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="status-icon">👁️</div>
                <h2>{isScanning ? 'SCANNING' : 'MONITORING'}</h2>
                <p className="status-message">
                  {isScanning
                    ? 'Analyzing face — please stay still'
                    : 'System is actively monitoring the camera feed'}
                </p>
              </>
            )}
          </div>

          {/* Confidence Threshold Info */}
          <div className="threshold-info">
            <span className="threshold-label">Detection Threshold</span>
            <div className="threshold-bar-bg">
              <div className="threshold-marker">
                <span>90%</span>
              </div>
              <div className="threshold-marker::after"></div>
            </div>
            <div className="threshold-legend">
              <span className="legend-intruder">▌ Below 90% = Intruder</span>
              <span className="legend-authorized">▌ Above 90% = Authorized</span>
            </div>
          </div>

          <div className="voting-stats">
            <div className="stat-item">
              <span className="stat-label">Today's Votes</span>
              <span className="stat-value">{stats.todayVotes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Pending</span>
              <span className="stat-value">{stats.pending}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Intruders</span>
              <span className="stat-value red">{stats.intruders}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveVoting;
