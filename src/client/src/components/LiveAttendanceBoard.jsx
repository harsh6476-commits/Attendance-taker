import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Download, Edit3, ShieldAlert, CheckCircle, Clock, Search } from 'lucide-react';

export default function LiveAttendanceBoard({ sessionId, onEndSession }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [overrideModal, setOverrideModal] = useState(null); // { recordId, currentStatus, studentName }
  const [newStatus, setNewStatus] = useState('present');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');

  useEffect(() => {
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  async function fetchLiveStatus() {
    try {
      const res = await api.getLiveStatus(sessionId);
      setData(res);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  const handleExportExcel = () => {
    window.location.href = `/api/reports/session/${sessionId}/excel`;
  };

  const handleApplyOverride = async () => {
    if (!overrideReason) {
      setOverrideError('An explicit audit reason is required for teacher override.');
      return;
    }

    try {
      await api.overrideAttendance(overrideModal.recordId, {
        newStatus,
        reason: overrideReason
      });
      setOverrideModal(null);
      setOverrideReason('');
      fetchLiveStatus();
    } catch (err) {
      setOverrideError(err.message || 'Failed to override status');
    }
  };

  if (loading || !data) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading live monitor board...</div>;
  }

  const filteredStudents = data.students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNo.toLowerCase().includes(search.toLowerCase()) ||
    s.collegeId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>Live Session Attendance Board</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Auto-refreshing live status stream with confidence evidence score
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleExportExcel} className="btn btn-secondary">
            <Download size={18} /> Export Excel (.xlsx)
          </button>
          {data.session.status === 'active' && (
            <button onClick={onEndSession} className="btn btn-danger">
              End Attendance Session
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enrolled</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{data.counts.totalEnrolled}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <div style={{ fontSize: '0.8rem', color: '#34d399' }}>Present</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>{data.counts.present}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <div style={{ fontSize: '0.8rem', color: '#fbbf24' }}>Suspicious</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24' }}>{data.counts.suspicious}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
          <div style={{ fontSize: '0.8rem', color: '#f43f5e' }}>Absent</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f43f5e' }}>{data.counts.absent}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '350px' }}>
        <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
          type="text"
          placeholder="Search student or roll no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field"
          style={{ paddingLeft: '2.5rem', width: '100%' }}
        />
      </div>

      {/* Student Table */}
      <div className="glass-panel table-container">
        <table>
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Student Name</th>
              <th>College ID</th>
              <th>Time</th>
              <th>Status</th>
              <th>Confidence</th>
              <th>Evidence Signals</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map(student => (
              <tr key={student.studentId}>
                <td style={{ fontWeight: 600 }}>{student.rollNo}</td>
                <td>{student.name}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{student.collegeId}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {student.timestamp ? new Date(student.timestamp).toLocaleTimeString() : '-'}
                </td>
                <td>
                  <span className={`badge badge-${student.status}`}>
                    {student.status}
                  </span>
                </td>
                <td style={{ fontWeight: 700 }}>
                  {student.confidenceScore ? `${student.confidenceScore}%` : '-'}
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                  {student.evidence ? student.evidence.reasons.join(', ') : 'No submission'}
                </td>
                <td>
                  {student.recordId ? (
                    <button
                      onClick={() => setOverrideModal({ recordId: student.recordId, currentStatus: student.status, studentName: student.name })}
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      <Edit3 size={12} /> Override
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Not recorded</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Teacher Override Dialog Modal */}
      {overrideModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '450px', width: '100%', padding: '1.75rem', borderRadius: '20px' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Teacher Override - {overrideModal.studentName}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Current Status: <strong>{overrideModal.currentStatus.toUpperCase()}</strong>. Changes are permanently audited.
            </p>

            {overrideError && <div style={{ color: 'var(--rose)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{overrideError}</div>}

            <div className="input-group">
              <label className="input-label">New Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input-field">
                <option value="present">PRESENT</option>
                <option value="suspicious">SUSPICIOUS</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Audit Reason (Required)</label>
              <textarea
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="e.g. Student demonstrated physical presence in row 3"
                className="input-field"
                rows="3"
              ></textarea>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setOverrideModal(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleApplyOverride} className="btn btn-primary">Save Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
