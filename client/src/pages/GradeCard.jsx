import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const STATUS_CLASS = {
  papers_submitted: 'status-pending',
  checked_pending_verification: 'status-check',
  waiting_hod_approval: 'status-wait',
  ready_to_publish: 'status-ready',
  published: 'status-done',
  hod_rejected: 'status-reject'
};

export default function GradeCard() {
  const { profile } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [gradeCard, setGradeCard] = useState(null);

  useEffect(() => {
    api.getSemesters().then(sems => {
      setSemesters(sems);
      const current = profile?.current_semester_id
        ? String(profile.current_semester_id)
        : String(sems[0]?.id || '');
      setSelectedSemester(current);
    });
  }, [profile?.current_semester_id]);

  useEffect(() => {
    if (!selectedSemester) return;
    api.getGradeCard(selectedSemester).then(setGradeCard);
  }, [selectedSemester]);

  return (
    <div>
      <div className="page-header">
        <h1>Grade Card</h1>
        <p>Track result status through the publication pipeline</p>
      </div>

      <div className="card">
        <label className="inline-label">
          Semester
          <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.year} {profile?.current_semester_id === s.id ? '(Your current)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {gradeCard && (
        <>
          <div className="stats-grid">
            <div className="stat-card highlight">
              <span className="stat-label">SGPA</span>
              <strong>{gradeCard.sgpa ?? '—'}</strong>
            </div>
            <div className="stat-card highlight">
              <span className="stat-label">CGPA</span>
              <strong>{gradeCard.cgpa ?? '—'}</strong>
            </div>
          </div>

          <div className="card grade-card-print">
            <div className="grade-card-header">
              <h2>Grade Card — {gradeCard.semester?.name} {gradeCard.semester?.year}</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Marks %</th>
                  <th>Grade</th>
                  <th>GP</th>
                </tr>
              </thead>
              <tbody>
                {gradeCard.courses.map(c => (
                  <tr key={c.enrollment_id}>
                    <td>{c.code}</td>
                    <td>{c.title}</td>
                    <td>{c.credits}</td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASS[c.workflow_status] || 'status-pending'}`}>
                        {c.status_label}
                      </span>
                    </td>
                    <td>{c.show_grades && c.total_percent != null ? c.total_percent.toFixed(1) : '—'}</td>
                    <td>{c.show_grades ? <span className="grade-badge">{c.letter_grade}</span> : '—'}</td>
                    <td>{c.show_grades ? c.grade_point : '—'}</td>
                  </tr>
                ))}
                {gradeCard.courses.length === 0 && (
                  <tr><td colSpan={7} className="muted">No courses for this semester</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card status-legend">
            <h3>Status Legend</h3>
            <ol>
              <li><strong>Papers submitted</strong> — Exams done, marks not entered yet</li>
              <li><strong>Checked but to be verified</strong> — Instructor entered marks, with Academic Staff</li>
              <li><strong>Waiting for HOD approval</strong> — Forwarded to Department Head</li>
              <li><strong>Grade card ready yet to be publish</strong> — HOD approved, awaiting final publish</li>
              <li><strong>Published</strong> — Grades visible on grade card</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
