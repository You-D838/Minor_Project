import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import '../Styles/LiveVoting.css';

function LiveVoting({ onIntruderCaptured }) {
  const [verificationResult, setVerificationResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [lastCapture, setLastCapture] = useState(null);
  const [autoScanActive, setAutoScanActive] = useState(true);
  const webcamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const stats = { todayVotes: 0, pending: 0, intruders: 0 };

  const runScan = useCallback(() => {
    if (isScanning) return;
    setIsScanning(true);
    setVerificationResult(null);
    setLastCapture(null);

    const screenshot = webcamRef.current ? webcamRef.current.getScreenshot() : null;

    // Simulate backend face recognition response
    // confidence < 0.90 = intruder, >= 0.90 = authorized or duplicate
    setTimeout(() => {
      const confidence = parseFloat((Math.random()).toFixed(2));

      let result;

      if (confidence >= 0.90) {
        // High confidence — recognized voter
        const authorizedScenarios = [
          { status: 'authorized', name: 'Ram Sharma',  message: 'Identity Verified — Proceed to Vote' },
          { status: 'duplicate',  name: 'Sita Kumari', message: 'Already Voted — Duplicate Detected' },
        ];
        result = {
          ...authorizedScenarios[Math.floor(Math.random() * authorizedScenarios.length)],
          confidence,
        };
      } else {
        // Low confidence — intruder
        result = {
          status: 'intruder',
          name: 'Unknown Person',
          message: `Access Denied — Confidence too low (${(confidence * 100).toFixed(1)}%)`,
          confidence,
        };
      }

      setVerificationResult(result);
      setIsScanning(false);

      // If intruder, capture and log
      if (result.status === 'intruder' && screenshot) {
        const intruderRecord = {
          id: Date.now(),
          image: screenshot,
          timestamp: new Date().toLocaleString(),
          location: 'Polling Station A',
          confidence: result.confidence,
        };
        setLastCapture(intruderRecord);
        onIntruderCaptured(intruderRecord);
      }

      // Clear result after 5 seconds
      setTimeout(() => setVerificationResult(null), 5000);
    }, 2000);
  }, [isScanning, onIntruderCaptured]);

  // Auto-scan every 8 seconds when active
  useEffect(() => {
    if (autoScanActive && !cameraError) {
      // Initial scan after 2 seconds of camera loading
      const initialDelay = setTimeout(() => {
        runScan();
      }, 2000);

      scanIntervalRef.current = setInterval(() => {
        runScan();
      }, 8000);

      return () => {
        clearTimeout(initialDelay);
        clearInterval(scanIntervalRef.current);
      };
    }
  }, [autoScanActive, cameraError, runScan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  const getStatusClass = () => {
    if (!verificationResult) return '';
    return verificationResult.status === 'authorized' ? 'status-success' : 'status-error';
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

            {/* Scan countdown indicator */}
            {!isScanning && !cameraError && autoScanActive && (
              <div className="scan-pulse">
                <div className="corner tl"></div>
                <div className="corner tr"></div>
                <div className="corner bl"></div>
                <div className="corner br"></div>
              </div>
            )}
          </div>

          {/* Pause / Resume toggle */}
          <button
            className={`toggle-scan-btn ${autoScanActive ? 'pause' : 'resume'}`}
            onClick={() => setAutoScanActive(!autoScanActive)}
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
                </div>
                <h2>{verificationResult.status.toUpperCase()}</h2>
                <p className="voter-name">{verificationResult.name}</p>
                <p className="status-message">{verificationResult.message}</p>
                <p className="confidence-display">
                  Confidence: <strong>{(verificationResult.confidence * 100).toFixed(1)}%</strong>
                  {verificationResult.confidence < 0.90
                    ? ' — Below threshold'
                    : ' — Above threshold'}
                </p>

                {verificationResult.status === 'intruder' && lastCapture && (
                  <div className="captured-preview">
                    <p className="captured-label">📸 Image Captured & Logged</p>
                    <img src={lastCapture.image} alt="Captured intruder" className="captured-img" />
                  </div>
                )}
              </>
            ) : (
              <>
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
              <div className="threshold-bar-fill"></div>
              <div className="threshold-marker">
                <span>90%</span>
              </div>
            </div>
            <div className="threshold-legend">
              <span className="legend-intruder">Below 90% = Intruder</span>
              <span className="legend-authorized">Above 90% = Authorized</span>
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