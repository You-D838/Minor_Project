import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import '../Styles/LiveVoting.css';
import { getValidToken } from '../utils/auth';

const API_BASE = 'http://localhost:5000/api';

function LiveVoting({ onIntruderCaptured }) {
  const [verificationResult, setVerificationResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [autoScanActive, setAutoScanActive] = useState(true);
  const [stats, setStats] = useState({ todayVotes: 0, pending: 0, intruders: 0 });
  const webcamRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  useEffect(() => {
    const fetchStats = () => {
      const token = getValidToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }

      fetch(`${API_BASE}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setStats({
          todayVotes: data.voted || 0,
          pending: data.not_voted || 0,
          intruders: data.intruders || 0
        }))
        .catch(() => {});
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const runScan = useCallback(async () => {
    if (isScanning || !webcamRef.current || cameraError) return;

    const token = getValidToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    setIsScanning(true);
    setVerificationResult(null);

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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ image: screenshot })
      });

      const result = await response.json();
      setVerificationResult(result);

      if (result.status === 'intruder') {
        const intruderRecord = {
          id: Date.now(),
          image: screenshot,
          image_path: result.image_path || null,
          timestamp: new Date().toLocaleString(),
          location: 'Polling Station A',
          confidence: result.confidence / 100,
        };
        if (onIntruderCaptured) onIntruderCaptured(intruderRecord);
      }
    } catch (err) {
      setVerificationResult({
        status: 'error',
        name: '',
        message: 'Could not connect to server. Check backend.',
        confidence: 0
      });
    } finally {
      setIsScanning(false);

      if (autoScanActive) {
        scanTimeoutRef.current = setTimeout(runScan, 800);
      }

      setTimeout(() => setVerificationResult(null), 2500);
    }
  }, [isScanning, cameraError, autoScanActive, onIntruderCaptured]);

  useEffect(() => {
    if (autoScanActive && !cameraError) {
      scanTimeoutRef.current = setTimeout(runScan, 800);
    }
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [autoScanActive, cameraError, runScan]);

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  const getStatusClass = () => {
    if (!verificationResult) return '';
    if (verificationResult.status === 'authorized') return 'status-success';
    if (verificationResult.status === 'scanning' || verificationResult.status === 'uncertain' || verificationResult.status === 'error') {
      return 'status-warning';
    }
    return 'status-error';
  };

  const statusIcon = () => {
    if (!verificationResult) return 'Eye';
    if (verificationResult.status === 'authorized') return 'OK';
    if (verificationResult.status === 'duplicate') return 'WARN';
    if (verificationResult.status === 'intruder') return 'BLOCK';
    if (verificationResult.status === 'uncertain') return 'CHECK';
    if (verificationResult.status === 'scanning') return 'SCAN';
    if (verificationResult.status === 'no_face') return 'FACE';
    if (verificationResult.status === 'error') return 'WARN';
    return 'INFO';
  };

  return (
    <div className="voting-container">
      <div className="page-header">
        <h1 className="page-title">Live Voter Verification</h1>
        <span className="page-sub">Automated face recognition system</span>
      </div>

      <div className="voting-layout">
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
                <span>CAM</span>
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
            {autoScanActive ? 'Pause Scanning' : 'Resume Scanning'}
          </button>
        </div>

        <div className="status-section">
          <div className="section-label">Verification Result</div>
          <div className={`status-card ${getStatusClass()}`}>
            {verificationResult ? (
              <>
                <div className="status-icon">{statusIcon()}</div>
                <h2>{verificationResult.status.replace('_', ' ').toUpperCase()}</h2>
                {verificationResult.name && (
                  <p className="voter-name">{verificationResult.name}</p>
                )}
                <p className="status-message">{verificationResult.message}</p>
              </>
            ) : (
              <>
                <div className="status-icon">FACE</div>
                <h2>{isScanning ? 'SCANNING' : 'MONITORING'}</h2>
                <p className="status-message">
                  {isScanning
                    ? 'Analyzing face - please stay still'
                    : 'System is actively monitoring the camera feed'}
                </p>
              </>
            )}
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
