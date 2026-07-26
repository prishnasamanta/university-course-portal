import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export default function MarksEntry() {
  const { sectionId } = useParams();
  const [components, setComponents] = useState([]);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [newComponent, setNewComponent] = useState({ name: '', max_marks: 100, weight_percent: 100 });
  const [message, setMessage] = useState(null);
  const [revisionModal, setRevisionModal] = useState(null);

  const load = () => {
    Promise.all([
      api.getSectionComponents(sectionId),
      api.getSectionMarks(sectionId)
    ]).then(([comps, studs]) => {
      setComponents(comps);
      setStudents(studs);
      const map = {};
      for (const s of studs) {
        for (const m of s.marks) {
          map[`${s.enrollment_id}-${m.component_id}`] = m;
        }
      }
      setMarks(map);
    });
  };

  useEffect(() => { load(); }, [sectionId]);

  const handleSave = async (enrollmentId, componentId, value) => {
    try {
      await api.saveMark({ enrollment_id: enrollmentId, component_id: componentId, marks_obtained: Number(value) });
      setMessage({ type: 'success', text: 'Marks saved' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleFinalize = async (markId) => {
    if (!confirm('Finalize these marks? Further edits will require a revision request.')) return;
    await api.finalizeMark(markId);
    setMessage({ type: 'success', text: 'Marks finalized' });
    load();
  };

  const handleAddComponent = async (e) => {
    e.preventDefault();
    await api.addComponent(sectionId, newComponent);
    setNewComponent({ name: '', max_marks: 100, weight_percent: 100 });
    load();
  };

  const submitRevision = async () => {
    await api.requestRevision(revisionModal.markId, {
      new_value: Number(revisionModal.newValue),
      reason: revisionModal.reason
    });
    setRevisionModal(null);
    setMessage({ type: 'success', text: 'Revision request submitted' });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Marks Entry</h1>
        <p>Section #{sectionId}</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        <h2>Assessment Components</h2>
        <form onSubmit={handleAddComponent} className="inline-form">
          <input placeholder="Name" value={newComponent.name} onChange={e => setNewComponent({ ...newComponent, name: e.target.value })} required />
          <input type="number" placeholder="Max marks" value={newComponent.max_marks} onChange={e => setNewComponent({ ...newComponent, max_marks: e.target.value })} required />
          <input type="number" placeholder="Weight %" value={newComponent.weight_percent} onChange={e => setNewComponent({ ...newComponent, weight_percent: e.target.value })} required />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
        <div className="component-tags">
          {components.map(c => (
            <span key={c.id} className="tag">{c.name} ({c.max_marks} pts, {c.weight_percent}%)</span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Student Marks</h2>
        {students.map(student => (
          <div key={student.enrollment_id} className="student-marks-block">
            <h3>{student.student_name} ({student.roll_number})</h3>
            <div className="marks-grid">
              {student.marks.map(m => {
                const key = `${student.enrollment_id}-${m.component_id}`;
                return (
                  <div key={key} className="mark-field">
                    <label>{m.component_name} / {m.max_marks}</label>
                    <input
                      type="number"
                      defaultValue={m.marks_obtained ?? ''}
                      disabled={m.finalized}
                      onBlur={e => {
                        if (!m.finalized && e.target.value) {
                          handleSave(student.enrollment_id, m.component_id, e.target.value);
                        }
                      }}
                    />
                    {m.mark_id && !m.finalized && m.marks_obtained != null && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => handleFinalize(m.mark_id)}>
                        Finalize
                      </button>
                    )}
                    {m.finalized && (
                      <div className="finalized-actions">
                        <span className="badge success">Finalized</span>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setRevisionModal({ markId: m.mark_id, newValue: m.marks_obtained, reason: '' })}
                        >
                          Request Revision
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {revisionModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Revision Request</h3>
            <label>New Value<input type="number" value={revisionModal.newValue} onChange={e => setRevisionModal({ ...revisionModal, newValue: e.target.value })} /></label>
            <label>Reason<textarea value={revisionModal.reason} onChange={e => setRevisionModal({ ...revisionModal, reason: e.target.value })} required /></label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setRevisionModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={submitRevision}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
