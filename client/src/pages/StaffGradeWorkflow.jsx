import { useEffect, useState } from 'react';
import { api } from '../api';

export default function StaffGradeWorkflow() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [data, setData] = useState(null);
  const [message, setMessage] = useState(null);
  const [semesters, setSemesters] = useState([]);

  const load = () => api.getWorkflowSections().then(setSections);

  useEffect(() => {
    load();
    api.getSemesters().then(setSemesters);
  }, []);

  const openSection = async (id) => {
    setSelectedSection(id);
    setData(await api.getWorkflowSectionResults(id));
  };

  const forwardHod = async () => {
    const r = await api.forwardToHod(selectedSection);
    setMessage({ type: 'success', text: `Forwarded ${r.forwarded} student(s) to HOD` });
    openSection(selectedSection);
    load();
  };

  const publish = async () => {
    const r = await api.publishResults(selectedSection);
    setMessage({ type: 'success', text: `Published ${r.published} grade card(s)` });
    openSection(selectedSection);
    load();
  };

  const markExamsDone = async (semId) => {
    await api.toggleExamsCompleted(semId, true);
    setMessage({ type: 'success', text: 'Semester marked as exams completed' });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Grade Card Workflow</h1>
        <p>Forward verified marks to HOD, then publish approved grade cards</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        <h2>Mark Exams Complete</h2>
        <div className="inline-form">
          {semesters.map(s => (
            <button key={s.id} type="button" className="btn btn-outline btn-sm" onClick={() => markExamsDone(s.id)}>
              {s.name} {s.year} {s.exams_completed ? '✓ Done' : '→ Mark Done'}
            </button>
          ))}
        </div>
      </div>

      <div className="card-grid">
        {sections.map(s => (
          <div key={s.id} className="card section-card" onClick={() => openSection(s.id)}>
            <strong>{s.course_code}</strong>
            <h3>{s.course_title}</h3>
            <p className="muted">{s.instructor_name} • Sec {s.section_code}</p>
            <p>To forward: {s.pending_forward} | To publish: {s.pending_publish}</p>
          </div>
        ))}
      </div>

      {data && (
        <div className="card">
          <div className="card-header">
            <h2>{data.section?.course_code} — Results</h2>
            <div className="actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={forwardHod}>Forward to HOD</button>
              <button type="button" className="btn btn-success btn-sm" onClick={publish}>Publish Grade Cards</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Student</th><th>Marks</th><th>Status</th><th>Grade</th></tr>
            </thead>
            <tbody>
              {data.students.map(s => (
                <tr key={s.enrollment_id}>
                  <td>{s.student_name} ({s.roll_number})</td>
                  <td>{s.marks ?? '—'}</td>
                  <td><span className="status-badge">{s.status_label}</span></td>
                  <td>{s.letter_grade || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
