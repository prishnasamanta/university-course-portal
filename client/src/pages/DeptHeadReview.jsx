import { useEffect, useState } from 'react';
import { api } from '../api';

const LEVEL_LABELS = { btech: 'B.Tech', msc: 'M.Sc', mtech: 'M.Tech' };
const LEVELS = ['btech', 'msc', 'mtech'];

export default function DeptHeadReview() {
  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'removals'
  const [courses, setCourses] = useState([]);
  const [openSectionId, setOpenSectionId] = useState(null);
  const [sectionData, setSectionData] = useState(null);
  const [removalRequests, setRemovalRequests] = useState([]);
  const [message, setMessage] = useState(null);

  const load = () => {
    Promise.all([
      api.getDeptHeadCourses(),
      api.getStudentRemovalRequests().catch(() => [])
    ]).then(([crs, rm]) => {
      setCourses(crs);
      setRemovalRequests(rm);
    });
  };

  useEffect(() => { load(); }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const toggleSectionReview = async (sectionId) => {
    if (openSectionId === sectionId) {
      setOpenSectionId(null);
      setSectionData(null);
      return;
    }
    setOpenSectionId(sectionId);
    try {
      const data = await api.getWorkflowSectionResults(sectionId);
      setSectionData(data);
    } catch {
      setSectionData(null);
    }
  };

  const approveStudent = async (enrollmentId, sectionId) => {
    try {
      await api.hodApproveStudent(enrollmentId);
      flash('success', 'Student grade approved.');
      toggleSectionReview(sectionId);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const rejectStudent = async (enrollmentId, sectionId) => {
    try {
      await api.hodRejectStudent(enrollmentId);
      flash('success', 'Student grade rejected.');
      toggleSectionReview(sectionId);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const approveAll = async (sectionId) => {
    try {
      const r = await api.hodApproveAll(sectionId);
      flash('success', `Approved ${r.approved} student(s)`);
      toggleSectionReview(sectionId);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const handleHodRemovalReview = async (id, decision) => {
    try {
      await api.hodReviewStudentRemoval(id, decision);
      flash('success', `Student removal request ${decision}d by HOD.`);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Department Head Dashboard</h1>
        <p>Review course grade cards categorized by degree program &amp; approve student removal requests</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Tabs */}
      <div className="admin-tabs" style={{ marginBottom:'1.5rem' }}>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          🏛️ Course Grade Review ({courses.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'removals' ? 'active' : ''}`}
          onClick={() => setActiveTab('removals')}
        >
          ⚠️ Student Removal Approvals ({removalRequests.filter(r => r.status === 'pending_hod_approval').length})
        </button>
      </div>

      {/* ===== COURSES CATEGORIZED BY DEGREE ===== */}
      {activeTab === 'courses' && (
        <div>
          {LEVELS.map(level => {
            const levelCourses = courses.filter(c => (c.degree_level || 'btech') === level);
            if (levelCourses.length === 0) return null;

            return (
              <div key={level} className="card" style={{ marginBottom:'1.5rem' }}>
                <h2 style={{ borderBottom:'2px solid var(--primary)', paddingBottom:'0.5rem', marginBottom:'1rem' }}>
                  {LEVEL_LABELS[level]} Degree Courses
                </h2>
                <table className="data-table">
                  <thead>
                    <tr><th>Course</th><th>Semester</th><th>Instructor</th><th>Students</th><th>Pending HOD Review</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {levelCourses.map(c => {
                      const isOpen = openSectionId === c.section_id;
                      return (
                        <tr key={`${c.id}-${c.section_id}`} style={{ borderBottom: isOpen ? 'none' : undefined }}>
                          <td><strong>{c.code}</strong> {c.title}</td>
                          <td>{c.semester_name} {c.year}</td>
                          <td>{c.instructor_name}</td>
                          <td>{c.student_count}</td>
                          <td>{c.pending_hod > 0 ? <span className="badge warning">{c.pending_hod}</span> : '—'}</td>
                          <td>
                            <button
                              type="button"
                              className={`btn btn-sm ${isOpen ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => toggleSectionReview(c.section_id)}
                            >
                              {isOpen ? 'Close Review' : '🔍 Review Grades'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Inline Accordion Grade Review Section directly under the degree courses */}
                {openSectionId && levelCourses.some(c => c.section_id === openSectionId) && sectionData && (
                  <div style={{ marginTop:'1rem', background:'var(--surface-hover)', padding:'1rem', borderRadius:8, border:'1px solid var(--primary)' }}>
                    <div className="card-header" style={{ marginBottom:'0.75rem' }}>
                      <h3 style={{ margin:0 }}>Grade Card Review: {sectionData.section?.course_code} — {sectionData.section?.course_title}</h3>
                      <button type="button" className="btn btn-success btn-sm" onClick={() => approveAll(openSectionId)}>
                        ✅ Approve Everyone
                      </button>
                    </div>

                    <table className="data-table">
                      <thead>
                        <tr><th>Roll Number</th><th>Student Name</th><th>Marks (100)</th><th>Status</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {sectionData.students.map(s => (
                          <tr key={s.enrollment_id}>
                            <td><strong>{s.roll_number}</strong></td>
                            <td>{s.student_name}</td>
                            <td>{s.marks != null ? <strong>{s.marks} / 100</strong> : '—'}</td>
                            <td><span className="status-badge">{s.status_label}</span></td>
                            <td className="actions">
                              {s.workflow_status === 'waiting_hod_approval' && (
                                <>
                                  <button type="button" className="btn btn-primary btn-sm" onClick={() => approveStudent(s.enrollment_id, openSectionId)}>✓ Approve</button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => rejectStudent(s.enrollment_id, openSectionId)}>✕ Reject</button>
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
          })}
        </div>
      )}

      {/* ===== STUDENT REMOVAL APPROVALS TAB ===== */}
      {activeTab === 'removals' && (
        <div className="card">
          <h2>⚠️ Student Removal Requests (From Admin)</h2>
          <p className="muted" style={{ marginBottom:'1rem' }}>
            Review students marked for removal by administrators. Once approved by HOD, admin can execute final deletion.
          </p>

          <table className="data-table">
            <thead>
              <tr><th>Roll Number</th><th>Student Name</th><th>Email</th><th>Program</th><th>Reason</th><th>Requested By</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {removalRequests.map(r => (
                <tr key={r.removal_id}>
                  <td><strong>{r.roll_number}</strong></td>
                  <td>{r.student_name}</td>
                  <td>{r.student_email}</td>
                  <td>{r.program_name}</td>
                  <td>{r.reason}</td>
                  <td>{r.requested_by_admin_name}</td>
                  <td>
                    <span className={`badge ${r.status === 'approved_by_hod' ? 'success' : r.status === 'rejected_by_hod' ? 'danger' : ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="actions">
                    {r.status === 'pending_hod_approval' && (
                      <>
                        <button type="button" className="btn btn-success btn-sm" onClick={() => handleHodRemovalReview(r.removal_id, 'approve')}>
                          ✅ Approve Removal
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleHodRemovalReview(r.removal_id, 'reject')}>
                          ✕ Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {removalRequests.length === 0 && (
                <tr><td colSpan={8} className="muted">No student removal requests pending HOD approval.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
