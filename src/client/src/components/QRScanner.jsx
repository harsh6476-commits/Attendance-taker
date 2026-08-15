import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../services/api';
import { authenticatePasskey } from '../services/webauthn';
import { ShieldCheck, Camera, MapPin, Key, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function QRScanner({ sessionId, onSuccess, onClose }) {
  const [step, setStep] = useState('auth'); // 'auth' | 'scan' | 'verifying' | 'result'
  const [authTxToken, setAuthTxToken] = useState(null);
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    // Request location snapshot upon mount
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        (err) => {
          setLocError('Location permission denied or unavailable. Attendance will proceed with lower confidence.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  useEffect(() => {
    if (step === 'scan') {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(
        (scannedToken) => {
          scanner.clear();
          handleTokenScanned(scannedToken);
        },
        (err) => {}
      );

      scannerRef.current = scanner;

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(() => {});
        }
      };
    }
  }, [step]);

  const handleWebAuthnTrigger = async () => {
    try {
      setError('');
      setScanMessage('Authenticating Passkey...');
      const authRes = await authenticatePasskey();
      if (authRes && authRes.authTxToken) {
        setAuthTxToken(authRes.authTxToken);
        setStep('scan');
      }
    } catch (err) {
      setError(err.message || 'Passkey authentication failed. You can proceed with standard session.');
      // Fallback allowed
      setStep('scan');
    }
  };

  const handleTokenScanned = async (scannedToken) => {
    setStep('verifying');
    setError('');

    try {
      const requestId = crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random()}`;

      const res = await api.verifyAttendance({
        sessionId,
        token: scannedToken,
        authTxToken,
        location,
        requestId
      });

      setResult(res);
      setStep('result');
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setError(err.message || 'Verification failed');
      setStep('scan');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(5, 7, 12, 0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '2rem', borderRadius: '24px', position: 'relative' }}>
        <button onClick={onClose} className="btn btn-secondary" style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem 0.75rem' }}>
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 className="gradient-text" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Student Attendance</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fast multi-signal verification</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '0.85rem', borderRadius: '10px', color: '#f43f5e', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {/* Step 1: WebAuthn Touch Authentication */}
        {step === 'auth' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Key size={36} color="var(--emerald)" />
            </div>

            <h3 style={{ marginBottom: '0.5rem' }}>Touch Authenticator</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Authenticate with your device Face ID / Fingerprint passkey before scanning the classroom projector.
            </p>

            <button onClick={handleWebAuthnTrigger} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }}>
              <ShieldCheck size={20} /> Authenticate & Open Camera
            </button>

            <button onClick={() => setStep('scan')} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.8rem' }}>
              Skip Passkey (Password Session Only)
            </button>
          </div>
        )}

        {/* Step 2: Camera QR Reader */}
        {step === 'scan' && (
          <div>
            <div id="qr-reader" style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}></div>
            
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <MapPin size={16} color={location ? 'var(--emerald)' : 'var(--amber)'} />
              {location ? `Location captured (${Math.round(location.accuracy)}m accuracy)` : locError || 'Fetching GPS location...'}
            </div>
          </div>
        )}

        {/* Step 3: Verifying */}
        {step === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="pulse-dot" style={{ width: '20px', height: '20px', margin: '0 auto 1rem' }}></div>
            <h3>Verifying Submission...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Checking dynamic signature, epoch, replay status, and geofence...
            </p>
          </div>
        )}

        {/* Step 4: Verification Result Receipt */}
        {step === 'result' && result && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: result.status === 'present' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', border: `2px solid ${result.status === 'present' ? 'var(--emerald)' : 'var(--amber)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <CheckCircle2 size={48} color={result.status === 'present' ? 'var(--emerald)' : 'var(--amber)'} />
            </div>

            <h2 style={{ color: result.status === 'present' ? '#34d399' : '#fbbf24', marginBottom: '0.5rem' }}>
              {result.status === 'present' ? 'ATTENDANCE MARKED PRESENT' : 'SUSPICIOUS SIGNAL FLAGGED'}
            </h2>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '12px', textAlign: 'left', margin: '1rem 0', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Confidence Score:</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>{result.confidenceScore} / 100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>
                <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Signals:</span>
                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                  {result.evidence.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button onClick={onClose} className="btn btn-primary" style={{ width: '100%' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
