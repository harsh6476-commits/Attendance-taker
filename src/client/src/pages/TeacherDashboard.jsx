import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import DynamicQRProjector from '../components/DynamicQRProjector';
import LiveAttendanceBoard from '../components/LiveAttendanceBoard';
import { Plus, Play, Users, BookOpen, Download, Settings, Tv } from 'lucide-react';

export default function TeacherDashboard() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(null); // class object
  const [activeSession, setActiveSession] = useState(null);
  const [projectorMode, setProjectorMode] = useState(false);

  // Form states
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('A');
  const [semester, setSemester] = useState('3');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [mode, setMode] = useState('fast');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    try {
      const data = await api.getTeacherClasses();
      setClasses(data.classes || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createClass({ className, subject, section, semester });
      setShowCreateModal(false);
      setClassName('');
      setSubject('');
      fetchClasses();
    } catch (err) {
      setError(err.message || 'Failed to create classroom');
    }
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!showStartModal) return;
    setError('');

    try {
      const res = await api.startSession({
        classId: showStartModal._id,
        durationMinutes: Number(durationMinutes),
        mode
      });
      setActiveSession(res.session);
      setShowStartModal(null);
    } catch (err) {
      setError(err.message || 'Failed to start attendance session');
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      await api.endSession(activeSession._id || activeSession.id);
      setActiveSession(null);
      setProjectorMode(false);
    } catch (e) {}
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Teacher Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage classrooms, launch attendance sessions, and export reports</p>
        </div>

        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={18} /> Create Classroom
        </button>
      </div>

      {/* Active Session Highlight Banner */}
      {activeSession && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.08)', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="badge badge-present" style={{ marginBottom: '0.5rem' }}>
                <span className="pulse-dot"></span> SESSION ACTIVE
              </span>
              <h2 style={{ fontSize: '1.4rem' }}>Attendance Session in Progress</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Students can now scan the dynamic QR projector stream using their WebAuthn authenticators.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setProjectorMode(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                <Tv size={18} /> Launch Fullscreen Projector
              </button>
              <button onClick={handleEndSession} className="btn btn-danger">
                End Session
              </button>
            </div>
          </div>

          {/* Embedded Live Status Board */}
          <LiveAttendanceBoard sessionId={activeSession._id || activeSession.id} onEndSession={handleEndSession} />
        </div>
      )}

      {/* Classroom Cards Grid */}
      <h2 style={{ fontSize: '1.35rem', marginBottom: '1.25rem' }}>Your Classrooms ({classes.length})</h2>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading classrooms...</div>
      ) : classes.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderRadius: '20px' }}>
          <BookOpen size={48} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
          <h3>No Classrooms Created Yet</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Create your first classroom to begin enrolling students and taking attendance.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={18} /> Create First Classroom
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {classes.map(c => (
            <div key={c._id} className="glass-panel glass-panel-hover" style={{ padding: '1.75rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>{c.className}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {c.subject} • Sec {c.section} (Sem {c.semester})
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.06)', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    {c.classCode}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Users size={16} color="var(--emerald)" />
                    <span style={{ fontWeight: 600, color: '#ffffff' }}>{c.studentCount}</span> Enrolled
                  </div>
                  {c.geofence && c.geofence.latitude && (
                    <div style={{ color: '#34d399' }}>✓ Geofenced</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                <button onClick={() => setShowStartModal(c)} className="btn btn-primary" style={{ flex: 1, padding: '0.55rem' }}>
                  <Play size={16} /> Start Attendance
                </button>
                <Link to={`/class/${c._id}`} className="btn btn-secondary" style={{ padding: '0.55rem 0.85rem' }}>
                  <Settings size={16} /> Manage
                </Link>
                <a
                  href={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : ''}/api/reports/class/${c._id}/excel`}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 0.85rem' }}
                  title="Export Cumulative Excel"
                >
                  <Download size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Projector Modal */}
      {projectorMode && activeSession && (
        <DynamicQRProjector sessionId={activeSession._id || activeSession.id} onClose={() => setProjectorMode(false)} />
      )}

      {/* Create Classroom Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '2rem', borderRadius: '24px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Create New Classroom</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Enter course and section details to generate a class code.</p>

            {error && <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleCreateClass}>
              <div className="input-group">
                <label className="input-label">Class / Course Title</label>
                <input type="text" required value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. Data Structures & Algorithms" className="input-field" />
              </div>

              <div className="input-group">
                <label className="input-label">Subject Code / Abbreviation</label>
                <input type="text" required value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. DSA" className="input-field" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Section</label>
                  <input type="text" required value={section} onChange={e => setSection(e.target.value)} placeholder="A" className="input-field" />
                </div>
                <div className="input-group">
                  <label className="input-label">Semester</label>
                  <input type="text" required value={semester} onChange={e => setSemester(e.target.value)} placeholder="3" className="input-field" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Attendance Session Modal */}
      {showStartModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '2rem', borderRadius: '24px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Start Attendance Session</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Class: <strong>{showStartModal.className} ({showStartModal.classCode})</strong>
            </p>

            {error && <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleStartSession}>
              <div className="input-group">
                <label className="input-label">Attendance Window Duration (Minutes)</label>
                <select value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="input-field">
                  <option value={3}>3 Minutes</option>
                  <option value={5}>5 Minutes (Recommended)</option>
                  <option value={10}>10 Minutes</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Verification Assurance Mode</label>
                <select value={mode} onChange={e => setMode(e.target.value)} className="input-field">
                  <option value="fast">Fast Transaction Mode (WebAuthn + Dynamic QR)</option>
                  <option value="high_assurance">High Assurance Mode (+ Active Face Liveness Check)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowStartModal(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Play size={16} /> Launch Session Stream
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
