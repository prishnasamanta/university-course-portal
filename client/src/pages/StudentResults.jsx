import { useEffect, useState } from 'react';
import { api } from '../api';

const STATUS_INFO = {
  papers_submitted: { label: 'Marks Entered', color: 'status-check', icon: '📝' },
  checked_pending_verification: { label: 'Forwarded to Staff', color: 'status-wait', icon: '📋' },
  waiting_hod_approval: { label: 'Under HOD Review', color: 'status-wait', icon: '🔍' },
  ready_to_publish: { label: 'HOD Approved', color: 'status-ready', icon: '✅' },
  published: { label: 'Results Published', color: 'status-done', icon: '🎉' },
  hod_rejected: { label: 'Revision Requested', color: 'status-reject', icon: '↩️' },
};

export default function StudentResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNoExamModal, setShowNoExamModal] = useState(false);

  useEffect(() => {
    api.getMyResults()
      .then(res => {
        setResults(res || []);
        const hasRegisteredExams = (res || []).some(r => r.exam_registered_id != null);
        if (!hasRegisteredExams) {
          setShowNoExamModal(true);
        }
      })
      .catch(() => {
        setResults([]);
        setShowNoExamModal(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Loading results...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>My Results</h1>
        <p>Track the status of your exam results through the approval workflow</p>
      </div>

      {showNoExamModal && (
        <div className="modal-overlay" style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="modal-content card" style={{ textAlign: 'center', padding: '2rem', maxWidth: '420px', width: '90%' }}>
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.5rem' }}>📝</span>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>No Exams Registered</h2>
            <p className="muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              You have not registered for any examinations yet. Please register for exams under <strong>Exam Registration</strong> when registration is opened by Academic Staff.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setShowNoExamModal(false)}>
              OK, Got It
            </button>
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>📭</span>
            <h3>No results yet</h3>
            <p className="muted">Your results will appear here after exams are registered and marks are entered by your instructor.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Credits</th>
                <th>Semester</th>
                <th>Marks</th>
                <th>Grade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => {
                const info = STATUS_INFO[r.workflow_status] || { label: 'Pending', color: 'status-pending', icon: '⏳' };
                const published = r.workflow_status === 'published';
                return (
                  <tr key={r.enrollment_id}>
                    <td>
                      <strong>{r.course_code}</strong><br />
                      <small className="muted">{r.course_title}</small>
                    </td>
                    <td>{r.credits} cr</td>
                    <td>{r.semester_name} {r.year}</td>
                    <td>{published ? `${r.total_percent?.toFixed(1)}%` : '—'}</td>
                    <td>
                      {published && r.letter_grade ? (
                        <span className="grade-badge" style={{ fontSize: '1.1rem' }}>{r.letter_grade}</span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`status-badge ${info.color}`}>
                        {info.icon} {info.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
