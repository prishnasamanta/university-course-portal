import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ExamRegistration() {
  const [openExams, setOpenExams] = useState([]);
  const [myExams, setMyExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [openData, myData] = await Promise.all([
        api.getExamRegistrations().catch(() => []),
        api.getMyExamRegistrations().catch(() => [])
      ]);
      setOpenExams(openData);
      setMyExams(myData);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const register = async (enrollmentId, courseCode) => {
    try {
      await api.registerForExam(enrollmentId);
      setMessage({ type: 'success', text: `Successfully registered for ${courseCode} final exam!` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Exam Registration</h1>
        <p>View open exams and register when academic staff opens exam registration</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {loading ? (
        <p className="muted" style={{ padding: '2rem' }}>Loading exam registration status…</p>
      ) : openExams.length === 0 && myExams.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '2.5rem' }}>
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.75rem' }}>📭</span>
            <h3>No exams currently open for registration</h3>
            <p className="muted">Academic staff will open exam registration when final exams are scheduled. Check back soon!</p>
          </div>
        </div>
      ) : (
        <div>
          {/* Currently Open for Registration */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📝</span>
              <span>Available Final Exam Registrations</span>
            </h2>

            {openExams.length === 0 ? (
              <p className="muted">No new courses currently awaiting exam registration.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Course Code</th><th>Course Title</th><th>Credits</th><th>Instructor</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {openExams.map(ex => (
                    <tr key={ex.enrollment_id}>
                      <td><strong>{ex.code}</strong></td>
                      <td>{ex.title}</td>
                      <td>{ex.credits} cr</td>
                      <td>{ex.instructor_name || 'Assigned Instructor'}</td>
                      <td>
                        {ex.already_registered ? (
                          <span className="badge success">✅ Registered</span>
                        ) : (
                          <span className="badge warning">🔔 Registration Open</span>
                        )}
                      </td>
                      <td>
                        {!ex.already_registered ? (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => register(ex.enrollment_id, ex.code)}>
                            ✍️ Register for Exam
                          </button>
                        ) : (
                          <span className="badge success">✅ Confirmed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* My Registered Exams Summary */}
          <div className="card">
            <h2 style={{ marginBottom: '1rem' }}>🎓 My Registered Final Exams</h2>
            <table className="data-table">
              <thead>
                <tr><th>Course Code</th><th>Course Title</th><th>Semester</th><th>Exam Reg Status</th><th>Registered Date</th></tr>
              </thead>
              <tbody>
                {myExams.map(ex => (
                  <tr key={ex.enrollment_id}>
                    <td><strong>{ex.code}</strong></td>
                    <td>{ex.title}</td>
                    <td>{ex.semester_name} {ex.year}</td>
                    <td>
                      {ex.exam_reg_id ? (
                        <span className="badge success">✅ Registered</span>
                      ) : ex.exam_reg_open ? (
                        <span className="badge warning">🔔 Open for Reg</span>
                      ) : (
                        <span className="badge">🔒 Not Open Yet</span>
                      )}
                    </td>
                    <td>{ex.registered_at ? new Date(ex.registered_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {myExams.length === 0 && (
                  <tr><td colSpan={5} className="muted">You have no course enrollments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
