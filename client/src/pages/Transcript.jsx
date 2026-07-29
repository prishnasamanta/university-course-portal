import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Transcript() {
  const [data, setData] = useState(null);
  const [myResults, setMyResults] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [message, setMessage] = useState(null);

  const load = () => {
    Promise.all([
      api.getTranscript(),
      api.getMyResults().catch(() => []),
      api.getMyPaperReviewRequests().catch(() => [])
    ]).then(([tData, res, rev]) => {
      setData(tData);
      setMyResults(res);
      setMyReviews(rev);
    });
  };

  useEffect(() => { load(); }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleRequestReview = async (enrollmentId, courseCode) => {
    const existing = myReviews.find(r => r.course_code === courseCode);
    if (existing) {
      flash('error', 'You have already requested a review for this course. Review is currently ongoing or completed.');
      return;
    }

    const reason = window.prompt(`Enter reason for paper review request for ${courseCode}:`);
    if (!reason) return;

    try {
      await api.requestPaperReview(enrollmentId, reason);
      flash('success', `Paper review request for ${courseCode} submitted to Academic Office/HOD!`);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  if (!data) return <p className="muted" style={{ padding: '2rem' }}>Loading academic transcript...</p>;

  const bySemester = {};
  for (const c of (data.courses || [])) {
    const key = `${c.semester_name || 'Semester'} ${c.year || 2025}`;
    if (!bySemester[key]) bySemester[key] = [];
    bySemester[key].push(c);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Academic Transcript</h1>
        <p>Complete official academic history • CGPA: <strong>{data.cgpa ? data.cgpa.toFixed(2) : '—'}</strong></p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card transcript-print">
        <div className="transcript-header" style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--primary)', pb: '0.75rem' }}>
          <h2>Official Student Transcript</h2>
          <p>Cumulative GPA: <strong>{data.cgpa ? data.cgpa.toFixed(2) : 'N/A'}</strong></p>
        </div>

        {Object.entries(bySemester).map(([sem, courses]) => (
          <div key={sem} className="transcript-semester" style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>{sem}</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Title</th>
                  <th>Credits</th>
                  <th>Marks (100)</th>
                  <th>Grade</th>
                  <th>Grade Point</th>
                  <th>Action / Paper Review</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(c => {
                  const resRow = myResults.find(r => r.course_code === c.code);
                  const revRow = myReviews.find(r => r.course_code === c.code);
                  const enrollmentId = resRow?.enrollment_id;

                  return (
                    <tr key={`${sem}-${c.code}`}>
                      <td><strong>{c.code}</strong></td>
                      <td>{c.title}</td>
                      <td>{c.credits} cr</td>
                      <td>{c.total_percent != null ? <strong>{c.total_percent.toFixed(1)} / 100</strong> : '—'}</td>
                      <td>
                        {c.letter_grade ? (
                          <span className="badge success" style={{ fontSize: '0.95rem' }}>{c.letter_grade}</span>
                        ) : '—'}
                      </td>
                      <td>{c.grade_point ?? '—'}</td>
                      <td className="actions">
                        {revRow ? (
                          <span className="badge warning" style={{ background: '#fef3c7', color: '#92400e' }}>
                            ⏳ Review Ongoing ({revRow.status})
                          </span>
                        ) : enrollmentId ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleRequestReview(enrollmentId, c.code)}
                          >
                            📄 Request Review
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
