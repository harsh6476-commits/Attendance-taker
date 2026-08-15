import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { registerPasskey } from '../services/webauthn';
import QRScanner from '../components/QRScanner';
import { Key, Camera, Plus, BookOpen, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';

export default function StudentDashboard() {
  const { user, refreshUser } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [activeScanSession, setActiveScanSession] = useState(null); // sessionId string

  // Form states
  const [classCode, setClassCode] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [error, setError] = useState('');
  const [passkeyMsg, setPasskeyMsg] = useState('');

  useEffect(() => {
    fetchStudentClasses();
  }, []);

  async function fetchStudentClasses() {
    try {
      const data = await api.getStudentClasses();
      setClasses(data.classes || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  const handleRegisterPasskey = async () => {
    setPasskeyMsg('');
    setError('');
    try {
      await registerPasskey(`${user.name}'s Device`);
      setPasskeyMsg('Passkey registered successfully! You can now use 1-touch authentication.');
      refreshUser();
    } catch (err) {
      setError(err.message || 'Passkey registration failed');
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.joinClass({ classCode, rollNo });
      setShowJoinModal(false);
      setClassCode('');
      setRollNo('');
      fetchStudentClasses();
    } catch (err) {
      setError(err.message || 'Failed to join classroom');
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
      {/* Welcome Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Student Attendance Portal</h1>
          <p style={{ color: 'var(--text-muted)' }}>Welcome, {user?.name} (College ID: {user?.collegeId})</p>
        </div>

        <button onClick={() => setShowJoinModal(true)} className="btn btn-primary">
          <Plus size={18} /> Join Classroom
        </button>
      </div>

      {/* WebAuthn Passkey Registration Prompt Card */}
      {!user?.hasPasskey && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', borderColor: 'rgba(6, 182, 212, 0.4)', background: 'rgba(6, 182, 212, 0.06)', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={26} color="var(--cyan)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Register Phone Passkey for Fast Attendance</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Bind your device Face ID / Fingerprint / PIN authenticator to achieve 3-second 1-click attendance verification.
                </p>
              </div>
            </div>

            <button onClick={handleRegisterPasskey} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <ShieldCheck size={18} /> Register Passkey Now
            </button>
          </div>

          {passkeyMsg && <div style={{ color: '#34d399', fontSize: '0.85rem', marginTop: '0.75rem' }}>{passkeyMsg}</div>}
          {error && <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</div>}
        </div>
      )}

      {/* Enrolled Classes List */}
      <h2 style={{ fontSize: '1.35rem', marginBottom: '1.25rem' }}>Enrolled Classrooms ({classes.length})</h2>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading enrolled classes...</div>
      ) : classes.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderRadius: '20px' }}>
          <BookOpen size={48} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
          <h3>No Classrooms Joined</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Ask your professor for the class code and click "Join Classroom" to enroll.
          </p>
          <button onClick={() => setShowJoinModal(true)} className="btn btn-primary">
            <Plus size={18} /> Join First Classroom
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {classes.map(c => (
            <div key={c._id} className="glass-panel glass-panel-hover" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem' }}>{c.className}</h3>
                  <span className="badge badge-present" style={{ fontSize: '0.7rem' }}>Roll: {c.rollNo}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {c.subject} • Sec {c.section} (Sem {c.semester})
                </p>
              </div>

              <button onClick={() => setActiveScanSession(c._id)} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
                <Camera size={18} /> Mark Attendance Now
              </button>
            </div>
          ))}
        </div>
      )}

      {/* QR Camera Scanner Overlay */}
      {activeScanSession && (
        <QRScanner
          sessionId={activeScanSession}
          onClose={() => setActiveScanSession(null)}
          onSuccess={(res) => {
            console.log('Attendance successful:', res);
          }}
        />
      )}

      {/* Join Class Modal */}
      {showJoinModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '2rem', borderRadius: '24px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Join Classroom</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Enter the unique class code provided by your teacher.</p>

            {error && <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleJoinClass}>
              <div className="input-group">
                <label className="input-label">Class Code</label>
                <input type="text" required value={classCode} onChange={e => setClassCode(e.target.value)} placeholder="e.g. DSA-A-9F2B" className="input-field" style={{ textTransform: 'uppercase' }} />
              </div>

              <div className="input-group">
                <label className="input-label">Your Roll Number in this Class</label>
                <input type="text" required value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="e.g. 101 / 2026-CSE-42" className="input-field" />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowJoinModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Join Class</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
