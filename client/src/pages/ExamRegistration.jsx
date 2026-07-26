import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ExamRegistration() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const load = async () => {
    try {
      const data = await api.getOpenExamSections();
      setSections(data);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const register = async (sectionId) => {
    try {
      await api.registerForExam(sectionId);
      setMessage({ type: 'success', text: 'Successfully registered for exam!' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Exam Registration</h1>
        <p>Register for exams when academic staff opens registration</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : sections.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>📭</span>
            <h3>No exams open for registration</h3>
            <p className="muted">Academic staff will open exam registration when exams are scheduled. You'll see your courses here.</p>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {sections.map(s => (
            <div key={s.section_id} className="card">
              <div className="section-card-header">
                <strong>{s.course_code}</strong>
                <span className={`status-badge ${s.exam_registered ? 'status-done' : 'status-check'}`}>
                  {s.exam_registered ? '✅ Registered' : '🔔 Open'}
                </span>
              </div>
              <h3>{s.course_title}</h3>
              <p className="muted">{s.semester_name} {s.year} • {s.credits} credits</p>
              <p className="muted">Instructor: {s.instructor_name}</p>
              {!s.exam_registered ? (
                <button type="button" className="btn btn-primary" onClick={() => register(s.section_id)}>
                  Register for Exam
                </button>
              ) : (
                <p style={{ color: 'var(--success)', fontWeight: 600 }}>✅ You are registered</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
