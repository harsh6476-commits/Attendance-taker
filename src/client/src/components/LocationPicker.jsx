import React, { useState } from 'react';
import { api } from '../services/api';
import { MapPin, Navigation, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LocationPicker({ classId, currentGeofence, onSaved }) {
  const [samples, setSamples] = useState([]);
  const [radiusMeters, setRadiusMeters] = useState(30);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const captureSample = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported by this browser.');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newSample = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now()
        };
        setSamples(prev => [...prev, newSample]);
        setLoading(false);
      },
      (err) => {
        setError(`Location acquisition error: ${err.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const saveGeofence = async () => {
    if (samples.length === 0) {
      setError('Capture at least 1 location sample (5 recommended).');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.registerGeofence(classId, {
        locationSamples: samples,
        radiusMeters: Number(radiusMeters)
      });
      setMessage('Classroom geofence center registered successfully!');
      if (onSaved) onSaved(res.geofence);
    } catch (err) {
      setError(err.message || 'Failed to save geofence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <MapPin size={22} color="var(--emerald)" />
        <div>
          <h3 style={{ fontSize: '1.1rem' }}>Classroom Environment Geofence</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Take 5 location samples around the room to average GPS center and spread
          </p>
        </div>
      </div>

      {currentGeofence && currentGeofence.latitude && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.85rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', color: '#34d399' }}>
          ✓ Active Geofence: Lat {currentGeofence.latitude.toFixed(6)}, Lng {currentGeofence.longitude.toFixed(6)} (Radius: {currentGeofence.radiusMeters}m, Spread: {Math.round(currentGeofence.sampleSpreadMeters || 0)}m)
        </div>
      )}

      {error && <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</div>}
      {message && <div style={{ color: '#34d399', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{message}</div>}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={captureSample} disabled={loading || samples.length >= 5} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          <Navigation size={16} /> {loading ? 'Acquiring GPS...' : `Capture Sample (${samples.length}/5)`}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Radius (m):</label>
          <input
            type="number"
            value={radiusMeters}
            onChange={e => setRadiusMeters(e.target.value)}
            className="input-field"
            style={{ width: '80px', padding: '0.4rem 0.6rem' }}
            min="10"
            max="200"
          />
        </div>
      </div>

      {samples.length > 0 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem', borderRadius: '10px', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Captured Samples:</div>
          <ul style={{ paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-main)' }}>
            {samples.map((s, idx) => (
              <li key={idx}>
                Sample {idx + 1}: Lat {s.latitude.toFixed(6)}, Lng {s.longitude.toFixed(6)} (Accuracy ±{Math.round(s.accuracy)}m)
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={saveGeofence} disabled={samples.length === 0 || loading} className="btn btn-primary" style={{ width: '100%' }}>
        <CheckCircle2 size={18} /> Compute Center & Save Geofence
      </button>
    </div>
  );
}
