import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const DEGREES = ['B.Sc', 'B.Tech', 'M.Sc', 'M.Tech', 'BA', 'Other'];
const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];

export default function StudentProfileOverlay({ onComplete }) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState('welcome');
  const [semesters, setSemesters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    program_id: '',
    previous_degree: '',
    previous_grade: '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.saveStudentProfile(form);
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
      <div className="modal profile-modal">
        {step === 'welcome' ? (
          <>
            <div className="profile-modal-header center">
              <span className="brand-icon large">🎓</span>
              <h2>Welcome to the University Portal</h2>
              <p className="muted">Before you can register for courses, please add your academic details.</p>
            </div>
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => setStep('form')}>
              Add Your Details
            </button>
          </>
        ) : (
          <>
            <div className="profile-modal-header">
              <span className="brand-icon">🎓</span>
              <h2>Student Profile Details</h2>
              <p className="muted">Select your degree program, previous degree, grade, and current semester.</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="profile-form">
              <label>Full Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
              <label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
              
              <label>
                Enrolled Program / Degree
                <select value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value })} required>
                  <option value="">Select program</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </label>

              <label>
                Previous Degree
                <select value={form.previous_degree} onChange={e => setForm({ ...form, previous_degree: e.target.value })} required>
                  <option value="">Select degree</option>
                  {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              
              <label>
                Grade in Previous Degree
                <select value={form.previous_grade} onChange={e => setForm({ ...form, previous_grade: e.target.value })} required>
                  <option value="">Select grade</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              
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
