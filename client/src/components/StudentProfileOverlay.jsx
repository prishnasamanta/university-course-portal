import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const DEGREES = ['B.Sc', 'B.Tech', 'M.Sc', 'M.Tech', 'BA', 'Class XII', 'Other'];
const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
const DEPTS = [
  { code: 'cs', label: 'Computer Science' },
  { code: 'eco', label: 'Economics' },
  { code: 'stat', label: 'Statistics' }
];

export default function StudentProfileOverlay({ onComplete }) {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState('welcome');
  const [semesters, setSemesters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedDept, setSelectedDept] = useState('cs');

  const generatedRoll = profile?.roll_number || `STU-${user?.id || 1001}`;

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: 'cs',
    program_id: '',
    previous_degree: 'B.Sc',
    previous_grade: 'A',
    current_semester_id: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.getSemesters(), api.getPrograms()])
      .then(([sems, progs]) => {
        setSemesters(sems);
        setPrograms(progs);
        const active = sems.find(s => s.is_active) || sems[0];
        setForm(f => ({
          ...f,
          current_semester_id: active ? String(active.id) : '',
          program_id: progs[0] ? String(progs[0].id) : ''
        }));
      });
  }, []);

  const filteredPrograms = programs.filter(p => {
    if (selectedDept === 'cs') return p.department === 'cs' || p.code.includes('CS');
    if (selectedDept === 'eco') return p.department === 'eco' || p.code.includes('ECO');
    if (selectedDept === 'stat') return p.department === 'stat' || p.code.includes('STAT');
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.saveStudentProfile({ ...form, department: selectedDept });
      await refreshProfile();
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay profile-overlay">
      <div className="modal profile-modal" style={{ position: 'relative', maxWidth: 550 }}>
        <button
          type="button"
          onClick={onComplete}
          style={{
            position: 'absolute',
            top: '12px',
            right: '16px',
            background: 'none',
            border: 'none',
            fontSize: '1.4rem',
            cursor: 'pointer',
            color: 'var(--muted)',
            lineHeight: 1
          }}
          title="Close"
        >
          ✕
        </button>

        {/* Auto-generated Roll Number Banner */}
        <div style={{ background: 'var(--surface-hover)', padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '1rem', borderLeft: '4px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🆔 <strong>Roll Number:</strong></span>
          <span className="badge success" style={{ fontSize: '0.95rem' }}>{generatedRoll}</span>
        </div>

        {step === 'welcome' ? (
          <>
            <div className="profile-modal-header center">
              <span className="brand-icon large">🎓</span>
              <h2>Welcome to the Student Portal</h2>
              <p className="muted">Your Roll Number is <strong>{generatedRoll}</strong>. Please confirm your academic details to continue.</p>
            </div>
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => setStep('form')}>
              Complete Profile Setup
            </button>
          </>
        ) : (
          <>
            <div className="profile-modal-header">
              <h2>Student Profile Details</h2>
              <p className="muted">Enter your department, degree program, previous academic details, and current semester.</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="profile-form">
              <label>Full Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
              <label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
              
              <label>
                Department
                <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} required>
                  {DEPTS.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                </select>
              </label>

              <label>
                Enrolled Degree Program
                <select value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value })} required>
                  <option value="">Select program</option>
                  {(filteredPrograms.length > 0 ? filteredPrograms : programs).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label>
                  Previous Degree
                  <select value={form.previous_degree} onChange={e => setForm({ ...form, previous_degree: e.target.value })} required>
                    {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                
                <label>
                  Previous Grade
                  <select value={form.previous_grade} onChange={e => setForm({ ...form, previous_grade: e.target.value })} required>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
              </div>

              <label>
                Current Semester
                <select value={form.current_semester_id} onChange={e => setForm({ ...form, current_semester_id: e.target.value })} required>
                  {semesters.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.year}</option>
                  ))}
                </select>
              </label>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setStep('welcome')}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
