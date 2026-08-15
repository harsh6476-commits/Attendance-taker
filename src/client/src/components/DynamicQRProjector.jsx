import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { api } from '../services/api';
import { RefreshCw, Users, ShieldAlert, Clock, Maximize2 } from 'lucide-react';

export default function DynamicQRProjector({ sessionId, onClose }) {
  const [tokenData, setTokenData] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(100);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchToken();
    fetchStats();

    // Rotate token every 3 seconds
    const tokenInterval = setInterval(fetchToken, 3000);
    // Refresh live check-in counts every 2 seconds
    const statsInterval = setInterval(fetchStats, 2000);

    // Progress bar animation
    const progressInterval = setInterval(() => {
      const now = Date.now();
      const remaining = 3000 - (now % 3000);
      setProgress((remaining / 3000) * 100);
    }, 50);

    return () => {
      clearInterval(tokenInterval);
      clearInterval(statsInterval);
      clearInterval(progressInterval);
    };
  }, [sessionId]);

  async function fetchToken() {
    try {
      const data = await api.getProjectorToken(sessionId);
      setTokenData(data);
      if (canvasRef.current && data.token) {
        QRCode.toCanvas(canvasRef.current, data.token, {
          width: 380,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to generate dynamic token stream');
    }
  }

  async function fetchStats() {
    try {
      const data = await api.getLiveStatus(sessionId);
      setLiveStats(data);
    } catch (e) {}
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#05070c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '1rem' }}>
        <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.6rem 1rem' }}>
          Close Projector View
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div className="badge badge-present" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          <span className="pulse-dot"></span> LIVE CLASSROOM PROJECTOR STREAM
        </div>
        <h1 className="gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>Scan Attendance QR</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          Token dynamically rotates every 3 seconds for replay protection
        </p>
      </div>

      {/* QR Canvas Container */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff', borderRadius: '24px', boxShadow: '0 0 50px rgba(16, 185, 129, 0.25)' }}>
        <canvas ref={canvasRef} style={{ borderRadius: '12px' }} />
        
        {/* Token Epoch Progress Ring Bar */}
        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '1.25rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #10b981, #06b6d4)', transition: 'width 0.05s linear' }}></div>
        </div>
      </div>

      {/* Live Counter Dashboard */}
      {liveStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginTop: '2.5rem', width: '100%', maxWidth: '800px' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Enrolled</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>{liveStats.counts.totalEnrolled}</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            <div style={{ fontSize: '0.85rem', color: '#34d399' }}>Present</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399' }}>{liveStats.counts.present}</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
            <div style={{ fontSize: '0.85rem', color: '#fbbf24' }}>Suspicious</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fbbf24' }}>{liveStats.counts.suspicious}</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
            <div style={{ fontSize: '0.85rem', color: '#f43f5e' }}>Absent</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f43f5e' }}>{liveStats.counts.absent}</div>
          </div>
        </div>
      )}
    </div>
  );
}
