import { useEffect, useState } from 'react';
import { api } from '../api';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function InstructorDashboard() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getInstructorSections();
      setSections(data);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const requestExam = async (sectionId) => {
    try {
      await api.requestExam(sectionId);
      flash('success', 'Exam request sent to Academic Staff!');
      load();
    } catch (err) {
      flash('error', err.message || 'Failed');
    }
  };

  const cancelExam = async (sectionId) => {
    try {
      await api.cancelExamRequest(sectionId);
      flash('success', 'Exam request cancelled');
      load();
    } catch (err) {
      flash('error', err.message || 'Failed');
    }
  };

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Teaching Sections</h1>
        <p>Manage your sections, request exams, and enter student marks</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {sections.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
          <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>👨‍🏫</div>
          <p>No sections assigned yet. Academic staff will assign you to sections.</p>
        </div>
      ) : (
        <div className="card-grid">
          {sections.map(s => (
            <div key={s.id} className="card section-card">
              <div className="section-card-header">
                <span className="badge dept">{s.course_code}</span>
                <span className="badge">{s.credits} cr</span>
              </div>
              <h3 style={{ margin:'0.5rem 0' }}>{s.course_title}</h3>
              <small className="muted">Section {s.section_code} · {s.semester_name} {s.year}</small>
              <p style={{ fontSize:'0.85rem', margin:'0.5rem 0' }}>
                👥 <strong>{s.enrolled_count}</strong> students enrolled
              </p>

              {/* Exam status */}
              <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid var(--border)', display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                {s.exam_requested
                  ? (
                    <>
                      <span className="badge" style={{ background:'#fef3c7', color:'#92400e' }}>⏳ Exam Requested</span>
                      {s.exam_reg_open
                        ? <span className="badge success">📝 Exam Reg Open</span>
                        : <button type="button" className="btn btn-outline btn-sm" onClick={() => cancelExam(s.id)}>Cancel Request</button>
                      }
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => requestExam(s.id)}
                    >
                      📝 Request Exam
                    </button>
                  )
                }
              </div>

              {/* Links */}
              <div style={{ marginTop:'0.75rem', display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                <a href={`/marks/${s.id}`} className="btn btn-outline btn-sm" style={{ textDecoration:'none' }}>
                  ✏️ Enter Marks
                </a>
                <a href="/results" className="btn btn-outline btn-sm" style={{ textDecoration:'none' }}>
                  📊 Results
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
