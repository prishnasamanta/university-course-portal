import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function InstructorResults() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [message, setMessage] = useState(null);
  const [viewStudent, setViewStudent] = useState(null);

  useEffect(() => {
    api.getInstructorResultSections().then(setSections);
  }, []);

  const loadStudents = async (sectionId) => {
    setSelectedSection(sectionId);
    const data = await api.getSectionResultStudents(sectionId);
    setStudents(data);
    const map = {};
    data.forEach(s => { if (s.marks != null) map[s.enrollment_id] = s.marks; });
    setMarks(map);
  };

  const saveMark = async (enrollmentId) => {
    const val = marks[enrollmentId];
    if (val === '' || val == null) return;
    const num = Number(val);
    if (num < 0 || num > 100) {
      setMessage({ type: 'error', text: 'Marks must be between 0 and 100' });
      return;
    }
    try {
      await api.saveExamResult(enrollmentId, num);
      setMessage({ type: 'success', text: 'Marks saved & forwarded to Academic Staff' });
      loadStudents(selectedSection);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const sectionInfo = sections.find(s => s.id === selectedSection);

  return (
    <div>
      <div className="page-header">
        <h1>Results Entry</h1>
        <p>Enter exam marks (0–100) for your courses — auto-forwards to Academic Staff</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        <label className="inline-label">
          Select Course
          <select value={selectedSection || ''} onChange={e => loadStudents(Number(e.target.value))}>
            <option value="">Choose a course...</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                {s.course_code} — {s.course_title} ({s.section_code}) {s.semester_name} {s.year}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSection && (
        <div className="card">
          <h2>{sectionInfo?.course_code} — Student Marks</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Marks (0–100)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.enrollment_id}>
                  <td>{s.roll_number}</td>
                  <td>{s.student_name}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="marks-input"
                      value={marks[s.enrollment_id] ?? ''}
                      onChange={e => setMarks({ ...marks, [s.enrollment_id]: e.target.value })}
                      disabled={s.workflow_status === 'published' || s.workflow_status === 'waiting_hod_approval'}
                    />
                  </td>
                  <td><span className="status-badge">{s.status_label}</span></td>
                  <td className="actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => saveMark(s.enrollment_id)}>Save</button>
                    {s.show_grade && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewStudent(s)}>View GC</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewStudent && (
        <div className="modal-overlay" onClick={() => setViewStudent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Grade Card — {viewStudent.student_name}</h3>
            <p>Marks: {viewStudent.total_percent?.toFixed(1)}%</p>
            <p>Grade: <span className="grade-badge">{viewStudent.letter_grade}</span></p>
            <button type="button" className="btn btn-outline" onClick={() => setViewStudent(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
