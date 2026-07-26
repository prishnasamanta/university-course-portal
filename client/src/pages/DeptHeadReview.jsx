import { useEffect, useState } from 'react';
import { api } from '../api';

export default function DeptHeadReview() {
  const [courses, setCourses] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [data, setData] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.getDeptHeadCourses().then(setCourses);
  }, []);

  const openSection = async (sectionId) => {
    setSelectedSection(sectionId);
    setData(await api.getWorkflowSectionResults(sectionId));
  };

  const approve = async (enrollmentId) => {
    await api.hodApproveStudent(enrollmentId);
    setMessage({ type: 'success', text: 'Student approved' });
    openSection(selectedSection);
  };

  const reject = async (enrollmentId) => {
    await api.hodRejectStudent(enrollmentId);
    setMessage({ type: 'success', text: 'Student rejected' });
    openSection(selectedSection);
  };

  const approveAll = async () => {
    const r = await api.hodApproveAll(selectedSection);
    setMessage({ type: 'success', text: `Approved ${r.approved} student(s)` });
    openSection(selectedSection);
  };

  const pendingCourses = courses.filter(c => c.pending_hod > 0);

  return (
    <div>
      <div className="page-header">
        <h1>Department Head Review</h1>
        <p>Review grade cards forwarded by Academic Staff — approve individually or all at once</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        <h2>All Courses</h2>
        <table className="data-table">
          <thead>
            <tr><th>Course</th><th>Semester</th><th>Instructor</th><th>Students</th><th>Pending HOD</th><th></th></tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={`${c.id}-${c.section_id}`}>
                <td><strong>{c.code}</strong> {c.title}</td>
                <td>{c.semester_name} {c.year}</td>
                <td>{c.instructor_name}</td>
                <td>{c.student_count}</td>
                <td>{c.pending_hod > 0 ? <span className="badge warn">{c.pending_hod}</span> : '—'}</td>
                <td>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openSection(c.section_id)}>
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="card">
          <div className="card-header">
            <h2>{data.section?.course_code} — Grade Card Review</h2>
            <label className="approve-all-label">
              <input type="checkbox" onChange={e => e.target.checked && approveAll()} />
              Approve everyone
            </label>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Student</th><th>Marks</th><th>Status</th><th>Proposed Grade</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.students.map(s => (
                <tr key={s.enrollment_id}>
                  <td>{s.student_name} ({s.roll_number})</td>
                  <td>{s.marks ?? '—'}</td>
                  <td><span className="status-badge">{s.status_label}</span></td>
                  <td>{s.marks != null ? `${s.marks}%` : '—'}</td>
                  <td className="actions">
                    {s.workflow_status === 'waiting_hod_approval' && (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => approve(s.enrollment_id)}>✓ Accept</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => reject(s.enrollment_id)}>✗ Reject</button>
                      </>
                    )}
                    {s.workflow_status === 'ready_to_publish' && <span className="badge success">Approved</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
