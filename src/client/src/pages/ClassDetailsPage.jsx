import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import LocationPicker from '../components/LocationPicker';
import { Users, UserPlus, ArrowLeft, Download, ShieldCheck } from 'lucide-react';

export default function ClassDetailsPage() {
  const { classId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollMethod, setEnrollMethod] = useState('sequential');

  // Enrollment forms
  const [startRoll, setStartRoll] = useState(101);
  const [endRoll, setEndRoll] = useState(160);
  const [rollPrefix, setRollPrefix] = useState('');
  const [manualText, setManualText] = useState('');
  const [enrollMsg, setEnrollMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClassDetails();
  }, [classId]);

  async function fetchClassDetails() {
    try {
      const res = await api.getClassDetails(classId);
      setData(res);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  const handleEnrollStudents = async (e) => {
    e.preventDefault();
    setError('');
    setEnrollMsg('');

    try {
      let body = { method: enrollMethod };

      if (enrollMethod === 'sequential') {
        body.startRoll = startRoll;
        body.endRoll = endRoll;
        body.rollPrefix = rollPrefix;
      } else {
        // Parse CSV / multiline manual text (Roll No | Name | College ID | Email)
        const lines = manualText.split('\n');
        const studentList = lines.map(line => {
          const parts = line.split(',').map(s => s.trim());
          return {
            rollNo: parts[0],
            name: parts[1] || `Student ${parts[0]}`,
            collegeId: parts[2] || `ID-${parts[0]}`,
            email: parts[3] || `student.${parts[0]}@college.edu`
          };
        }).filter(s => s.rollNo);
        body.studentList = studentList;
      }

      const res = await api.enrollStudents(classId, body);
      setEnrollMsg(res.message);
      setShowEnrollModal(false);
      fetchClassDetails();
    } catch (err) {
      setError(err.message || 'Failed to enroll students');
    }
  };

  if (loading || !data) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading classroom details...</div>;
  }

  const { class: classObj, enrolledStudents } = data;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
      <Link to="/teacher" className="btn btn-secondary" style={{ marginBottom: '1.5rem', padding: '0.4rem 0.85rem' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      {/* Class Header */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--emerald)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Classroom Management
            </span>
            <h1 style={{ fontSize: '2rem', margin: '0.2rem 0' }}>{classObj.className}</h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Subject: {classObj.subject} | Section: {classObj.section} | Semester: {classObj.semester}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CLASS CODE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}>{classObj.classCode}</div>
            </div>
            <button onClick={() => setShowEnrollModal(true)} className="btn btn-primary">
              <UserPlus size={18} /> Enroll Students
            </button>
          </div>
        </div>
      </div>

      {/* Geofence Registration Section */}
      <LocationPicker
        classId={classObj._id}
        currentGeofence={classObj.geofence}
        onSaved={newGeofence => {
          setData(prev => ({
            ...prev,
            class: { ...prev.class, geofence: newGeofence }
          }));
        }}
      />

      {/* Enrolled Students Table */}
      <div style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem' }}>Enrolled Students ({enrolledStudents.length})</h2>
          <a
            href={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : ''}/api/reports/class/${classObj._id}/excel`}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <Download size={16} /> Cumulative Excel (.xlsx)
          </a>
        </div>

        {enrolledStudents.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No students enrolled in this classroom yet. Click "Enroll Students" to add roll numbers.
          </div>
        ) : (
          <div className="glass-panel table-container">
            <table>
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>College ID</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudents.map(student => (
                  <tr key={student.studentId}>
                    <td style={{ fontWeight: 600 }}>{student.rollNo}</td>
                    <td>{student.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{student.collegeId}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{student.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enroll Students Modal */}
      {showEnrollModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '2rem', borderRadius: '24px' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Enroll Students</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Choose enrollment strategy for this classroom.</p>

            {error && <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleEnrollStudents}>
              <div className="input-group">
                <label className="input-label">Enrollment Method</label>
                <select value={enrollMethod} onChange={e => setEnrollMethod(e.target.value)} className="input-field">
                  <option value="sequential">Sequential Roll Numbers (e.g. 101 to 160)</option>
                  <option value="manual">Manual Entry / CSV Paste</option>
                </select>
              </div>

              {enrollMethod === 'sequential' ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label className="input-label">Start Roll No</label>
                      <input type="number" required value={startRoll} onChange={e => setStartRoll(e.target.value)} className="input-field" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">End Roll No</label>
                      <input type="number" required value={endRoll} onChange={e => setEndRoll(e.target.value)} className="input-field" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Roll Prefix (Optional)</label>
                    <input type="text" value={rollPrefix} onChange={e => setRollPrefix(e.target.value)} placeholder="e.g. CSE-" className="input-field" />
                  </div>
                </div>
              ) : (
                <div className="input-group">
                  <label className="input-label">Paste Comma-Separated (RollNo, Name, CollegeID, Email)</label>
                  <textarea
                    rows="5"
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    placeholder="101, Rahul Sharma, ID-101, rahul@college.edu&#10;102, Arjun Verma, ID-102, arjun@college.edu"
                    className="input-field"
                    style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                  ></textarea>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowEnrollModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Enroll Students</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
