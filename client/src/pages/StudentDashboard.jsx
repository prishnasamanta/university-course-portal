import { useEffect, useState } from 'react';
import { api } from '../api';

const STATUS_DISPLAY = {
  papers_submitted: { label: '⏳ Pending', color: '#6b7280', bg: '#f3f4f6' },
  checked_pending_verification: { label: '✅ Checked', color: '#1e40af', bg: '#dbeafe' },
  waiting_hod_approval: { label: '🏛️ HOD Review', color: '#92400e', bg: '#fef3c7' },
  ready_to_publish: { label: '✔️ Approved', color: '#065f46', bg: '#d1fae5' },
  published: { label: '🎉 Published', color: '#059669', bg: '#ecfdf5' },
  hod_rejected: { label: '❌ Revision', color: '#991b1b', bg: '#fef2f2' },
};

export default function StudentDashboard() {
  const [enrollments, setEnrollments] = useState([]);
  const [examRegs, setExamRegs] = useState([]);
  const [openExams, setOpenExams] = useState([]);
  const [tab, setTab] = useState('courses');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [enr, myExams, openEx] = await Promise.all([
        api.getMyEnrollments(),
        api.getMyExamRegistrations(),
        api.getExamRegistrations(),
      ]);
      setEnrollments(enr);
      setExamRegs(myExams);
      setOpenExams(openEx);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const registerExam = async (enrollmentId) => {
    try {
      await api.registerForExam(enrollmentId);
      flash('success', 'Exam registration confirmed!');
      load();
    } catch (err) {
      flash('error', err.message || 'Already registered');
    }
  };

  if (loading) return <div className="loading-screen">Loading your dashboard…</div>;

  const totalCredits = enrollments.reduce((s, e) => s + (e.credits || 0), 0);

  const [showNoExamsModal, setShowNoExamsModal] = useState(false);

  const handleResultTabClick = () => {
    const hasRegs = examRegs.some(e => e.exam_reg_id);
    if (!hasRegs) {
      setShowNoExamsModal(true);
    }
    setTab('results');
  };

  return (
    <div>
      {showNoExamsModal && (
        <div className="modal-overlay" style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="modal-content card" style={{ maxWidth:400, width:'90%', textAlign:'center', padding:'2rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>⚠️</div>
            <h3 style={{ margin:'0 0 0.5rem' }}>No Exams Registered</h3>
            <p style={{ color:'var(--muted)', fontSize:'0.9rem', marginBottom:'1.5rem' }}>
              You have not registered for any course exams yet. Please register under the "Exam Registration" tab first.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setShowNoExamsModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>Student Dashboard</h1>
        <p>Your courses, exam registrations and result status</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Summary stats */}
      <div className="stats-grid" style={{ marginBottom:'1.5rem' }}>
        <div className="stat-card highlight">
          <span className="stat-label">Enrolled Courses</span>
          <strong>{enrollments.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Credits</span>
          <strong>{totalCredits}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Exam Registrations</span>
          <strong>{examRegs.filter(e => e.exam_reg_id).length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Open Exam Slots</span>
          <strong>{openExams.length}</strong>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="login-tabs" style={{ marginBottom:'1.5rem' }}>
        <button type="button" className={`login-tab ${tab==='courses' ? 'active' : ''}`} onClick={() => setTab('courses')}>
          📚 My Courses
        </button>
        <button type="button" className={`login-tab ${tab==='exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>
          📝 Exam Registration {openExams.length > 0 && <span style={{ background:'#ef4444', color:'white', borderRadius:'999px', padding:'0 5px', fontSize:'0.7rem', marginLeft:'4px' }}>{openExams.length}</span>}
        </button>
        <button type="button" className={`login-tab ${tab==='results' ? 'active' : ''}`} onClick={handleResultTabClick}>
          📊 Result Status
        </button>
      </div>

      {/* My Courses */}
      {tab === 'courses' && (
        <div>
          {enrollments.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>📚</div>
              <p>You haven't registered for any courses yet.</p>
              <a href="/register" className="btn btn-primary" style={{ marginTop:'0.5rem', textDecoration:'none' }}>Browse Courses</a>
            </div>
          ) : (
            <div className="card-grid">
              {enrollments.map(e => (
                <div key={e.id} className="card section-card">
                  <div className="course-card-top">
                    <span className="badge dept">{e.code}</span>
                    <span className="badge">{e.credits} cr</span>
                  </div>
                  <h3 style={{ margin:'0.5rem 0' }}>{e.title}</h3>
                  <small className="muted">Section {e.section_code} · {e.instructor_name || 'TBA'}</small><br />
                  <small className="muted">{e.semester_name} {e.year}</small>
                  {e.day_name && (
                    <p style={{ fontSize:'0.8rem', marginTop:'0.5rem' }}>
                      🕐 {e.day_name} {e.start_time}–{e.end_time}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exam Registration */}
      {tab === 'exams' && (
        <div>
          {openExams.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>📝</div>
              <p>No exam registrations are open right now.</p>
              <p style={{ fontSize:'0.85rem' }}>Academic staff will open exam registration when your instructor requests it.</p>
            </div>
          ) : (
            <div>
              <div className="card" style={{ marginBottom:'1rem', background:'#eff6ff', border:'1px solid #bfdbfe' }}>
                <p style={{ margin:0, fontSize:'0.9rem', color:'#1e40af' }}>
                  ℹ️ Register for each exam you want to appear in. Unregistered students cannot receive marks.
                </p>
              </div>
              {openExams.map(e => (
                <div key={e.enrollment_id} className="card" style={{ marginBottom:'1rem' }}>
                  <div className="card-header" style={{ flexWrap:'wrap' }}>
                    <div>
                      <h3 style={{ margin:0 }}>{e.code} — {e.title}</h3>
                      <small className="muted">Section {e.section_code} · {e.instructor_name} · {e.semester_name} {e.year}</small>
                    </div>
                    {e.already_registered
                      ? <span className="badge success" style={{ fontSize:'0.85rem', padding:'0.4rem 0.85rem' }}>✅ Exam Registered</span>
                      : <button type="button" className="btn btn-primary" onClick={() => registerExam(e.enrollment_id)}>
                          Register for Exam
                        </button>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result Status */}
      {tab === 'results' && (
        <div>
          {examRegs.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>📊</div>
              <p>No result information yet. Results appear here after you enroll in courses and exams are conducted.</p>
            </div>
          ) : (
            <table className="data-table" style={{ background:'var(--surface)', borderRadius:12, overflow:'hidden' }}>
              <thead>
                <tr><th>Course</th><th>Instructor</th><th>Exam Registered</th><th>Result Status</th></tr>
              </thead>
              <tbody>
                {examRegs.map(r => {
                  const st = STATUS_DISPLAY[r.result_status] || STATUS_DISPLAY.papers_submitted;
                  return (
                    <tr key={r.enrollment_id}>
                      <td>
                        <strong>{r.code}</strong>
                        <div style={{ fontSize:'0.8rem', color:'var(--muted)' }}>{r.title} · {r.credits} cr</div>
                      </td>
                      <td>{r.instructor_name || '—'}</td>
                      <td>
                        {r.exam_reg_id
                          ? <span className="badge success">✅ Registered</span>
                          : <span className="badge">Not registered</span>}
                      </td>
                      <td>
                        <span
                          style={{
                            display:'inline-block', padding:'0.25rem 0.7rem', borderRadius:'999px',
                            fontSize:'0.78rem', fontWeight:700,
                            color: st.color, background: st.bg
                          }}
                        >
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
