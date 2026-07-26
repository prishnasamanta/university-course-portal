import { useEffect, useState } from 'react';
import { api } from '../api';

const DEGREE_TILES = [
  { code: 'BTECH-CS', label: 'B.Tech Computer Science', dept: 'cs', level: 'btech', icon: '💻', color: '#4f46e5' },
  { code: 'MSC-CS', label: 'M.Sc Computer Science', dept: 'cs', level: 'msc', icon: '🤖', color: '#0891b2' },
  { code: 'MTECH-CS', label: 'M.Tech Computer Science', dept: 'cs', level: 'mtech', icon: '⚙️', color: '#7c3aed' },
  { code: 'BTECH-ECO', label: 'B.Tech Economics', dept: 'eco', level: 'btech', icon: '📈', color: '#059669' },
  { code: 'MSC-STAT', label: 'M.Sc Statistics', dept: 'stat', level: 'msc', icon: '📊', color: '#d97706' },
];

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_DISPLAY = {
  papers_submitted: { label: '⏳ Pending Verification', color: '#6b7280', bg: '#f3f4f6' },
  checked_pending_verification: { label: '✅ Checked by Instructor', color: '#1e40af', bg: '#dbeafe' },
  waiting_hod_approval: { label: '🏛️ HOD Review', color: '#92400e', bg: '#fef3c7' },
  ready_to_publish: { label: '✔️ Approved by HOD', color: '#065f46', bg: '#d1fae5' },
  published: { label: '🎉 Published', color: '#059669', bg: '#ecfdf5' },
  hod_rejected: { label: '❌ Rejected by HOD', color: '#991b1b', bg: '#fef2f2' },
};

export default function InstructorDashboard() {
  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'results'
  const [sections, setSections] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Enter Marks Modal state
  const [marksModalSection, setMarksModalSection] = useState(null);
  const [marksStudents, setMarksStudents] = useState([]);
  const [studentMarksInputs, setStudentMarksInputs] = useState({});
  const [savingMarks, setSavingMarks] = useState(false);

  // Timetable Modal state
  const [timetableSection, setTimetableSection] = useState(null);
  const [ttDay, setTtDay] = useState(1);
  const [ttStart, setTtStart] = useState('09:00');
  const [ttEnd, setTtEnd] = useState('11:00');
  const [ttRoom, setTtRoom] = useState('');

  // View Results Tab state
  const [resultSections, setResultSections] = useState([]);
  const [selectedResultSec, setSelectedResultSec] = useState(null);
  const [resultStudents, setResultStudents] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getInstructorSections();
      setSections(data);
      const resSecs = await api.getInstructorResultSections();
      setResultSections(resSecs);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Exam request handlers
  const requestExam = async (sectionId) => {
    try {
      await api.requestExam(sectionId);
      flash('success', 'Exam request sent to Academic Staff!');
      load();
    } catch (err) {
      flash('error', err.message || 'Failed');
    }
  };

  const cancelExam = async (sectionId) => {
    try {
      await api.cancelExamRequest(sectionId);
      flash('success', 'Exam request cancelled');
      load();
    } catch (err) {
      flash('error', err.message || 'Failed');
    }
  };

  // Open Enter Marks modal
  const openMarksModal = async (sec) => {
    setMarksModalSection(sec);
    try {
      const students = await api.getSectionResultStudents(sec.id);
      setMarksStudents(students);
      const initialInputs = {};
      students.forEach(st => {
        initialInputs[st.enrollment_id] = st.marks ?? '';
      });
      setStudentMarksInputs(initialInputs);
    } catch (e) {
      flash('error', 'Failed to load students');
    }
  };

  // Save all entered marks
  const saveAllMarks = async (e) => {
    e.preventDefault();
    if (!marksModalSection) return;
    setSavingMarks(true);
    try {
      let savedCount = 0;
      for (const st of marksStudents) {
        const val = studentMarksInputs[st.enrollment_id];
        if (val !== '' && val !== null && val !== undefined) {
          const num = Number(val);
          if (num >= 0 && num <= 100) {
            await api.saveExamResult(st.enrollment_id, num);
            savedCount++;
          }
        }
      }
      flash('success', `Saved marks out of 100 for ${savedCount} student(s)!`);
      setMarksModalSection(null);
      load();
    } catch (err) {
      flash('error', err.message || 'Failed to save marks');
    } finally {
      setSavingMarks(false);
    }
  };

  // Timetable modal
  const openTimetableModal = (sec) => {
    setTimetableSection(sec);
    const existingSlot = sec.schedule_slots?.[0];
    if (existingSlot) {
      setTtDay(existingSlot.day_of_week);
      setTtStart(existingSlot.start_time);
      setTtEnd(existingSlot.end_time);
    } else {
      setTtDay(1);
      setTtStart('09:00');
      setTtEnd('11:00');
    }
    setTtRoom(sec.room || '');
  };

  const saveTimetable = async (e) => {
    e.preventDefault();
    if (!timetableSection) return;
    try {
      await api.updateSectionTimetable(timetableSection.id, {
        day_of_week: ttDay,
        start_time: ttStart,
        end_time: ttEnd,
        room: ttRoom
      });
      flash('success', 'Timetable and room updated successfully!');
      setTimetableSection(null);
      load();
    } catch (err) {
      flash('error', err.message || 'Failed to update timetable');
    }
  };

  // View results for selected section in View Results tab
  const loadViewResults = async (secId) => {
    setSelectedResultSec(secId);
    try {
      const rows = await api.getSectionResultStudents(secId);
      setResultStudents(rows);
    } catch (e) {
      setResultStudents([]);
    }
  };

  if (loading) return <div className="loading-screen">Loading instructor dashboard…</div>;

  // Filter sections by selected degree tile
  const filteredSections = selectedDegree
    ? sections.filter(s => s.degree_level === selectedDegree.level && s.department === selectedDegree.dept)
    : sections;

  return (
    <div>
      <div className="page-header">
        <h1>Instructor Dashboard</h1>
        <p>Manage course sections, exam requests, timetables, and student results</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Top Tabs */}
      <div className="admin-tabs" style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📚 My Courses ({sections.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          📊 View Results
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: MY COURSES */}
      {/* ==================================================== */}
      {activeTab === 'courses' && (
        <div>
          {/* Degree Filter Tiles */}
          <div className="degree-tiles">
            {DEGREE_TILES.map(deg => {
              const count = sections.filter(s => s.degree_level === deg.level && s.department === deg.dept).length;
              return (
                <button
                  key={deg.code}
                  type="button"
                  className={`degree-tile ${selectedDegree?.code === deg.code ? 'selected' : ''}`}
                  style={{ '--tile-color': deg.color }}
                  onClick={() => setSelectedDegree(selectedDegree?.code === deg.code ? null : deg)}
                >
                  <span className="degree-tile-icon">{deg.icon}</span>
                  <span className="degree-tile-label">{deg.label} ({count})</span>
                </button>
              );
            })}
          </div>

          {filteredSections.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>👨‍🏫</div>
              <p>
                {selectedDegree
                  ? `No courses assigned to you under ${selectedDegree.label}.`
                  : 'No sections assigned yet. Academic staff will assign you to sections.'}
              </p>
            </div>
          ) : (
            <div className="card-grid">
              {filteredSections.map(s => {
                const slots = s.schedule_slots || [];
                const allMarksSaved = s.enrolled_count > 0 && s.marks_count >= s.enrolled_count;
                const canEnterMarks = !s.exam_reg_open && !allMarksSaved && (s.exam_requested || s.exams_completed);

                return (
                  <div key={s.id} className="card section-card">
                    <div className="section-card-header">
                      <span className="badge dept">{s.course_code}</span>
                      <span className="badge">{s.credits} cr</span>
                    </div>

                    <h3 style={{ margin:'0.5rem 0' }}>{s.course_title}</h3>
                    <small className="muted">Section {s.section_code} · {s.semester_name} {s.year}</small>

                    <div style={{ fontSize:'0.85rem', margin:'0.5rem 0' }}>
                      <div>👥 Enrolled Students: <strong>{s.enrolled_count}</strong></div>
                      <div>🏫 Room: <strong>{s.room || 'Not set'}</strong></div>
                      <div>
                        🕐 Schedule:{' '}
                        <strong>
                          {slots.length > 0
                            ? slots.map(sl => `${sl.day_name} ${sl.start_time}-${sl.end_time}`).join(', ')
                            : 'Not set'}
                        </strong>
                      </div>
                    </div>

                    {/* Action buttons & lifecycle state */}
                    <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid var(--border)', display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                      {/* State 1: Exam Registration Open */}
                      {s.exam_reg_open ? (
                        <>
                          <span className="badge success">📝 Registration Open</span>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openTimetableModal(s)}>
                            📅 Change Timetable
                          </button>
                        </>
                      ) : s.exam_requested ? (
                        /* State 2: Exam Requested */
                        <>
                          <span className="badge" style={{ background:'#fef3c7', color:'#92400e' }}>⏳ Exam Requested</span>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => cancelExam(s.id)}>
                            Cancel Request
                          </button>
                          {canEnterMarks && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => openMarksModal(s)}>
                              ✏️ Enter Marks
                            </button>
                          )}
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openTimetableModal(s)}>
                            📅 Change Timetable
                          </button>
                        </>
                      ) : (
                        /* State 3: Initial State (No Exam Requested) */
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => requestExam(s.id)}>
                            📝 Request Exam
                          </button>
                          {canEnterMarks && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => openMarksModal(s)}>
                              ✏️ Enter Marks
                            </button>
                          )}
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openTimetableModal(s)}>
                            {slots.length > 0 ? '📅 Change Timetable' : '📅 Add Timetable'}
                          </button>
                        </>
                      )}

                      {/* Hide Enter Marks button once all marks are entered & saved */}
                      {allMarksSaved && (
                        <span className="badge success" style={{ background:'#ecfdf5', color:'#059669' }}>
                          ✅ Marks Submitted ({s.marks_count}/{s.enrolled_count})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: VIEW RESULTS (Read-Only) */}
      {/* ==================================================== */}
      {activeTab === 'results' && (
        <div className="card">
          <h2>Student Results (Read-Only View)</h2>
          <p className="muted" style={{ marginBottom:'1rem' }}>
            Select a course section below to view submitted and published student marks.
          </p>

          <div className="inline-label" style={{ marginBottom:'1.5rem' }}>
            <label style={{ fontWeight:600 }}>Select Course Section:</label>
            <select
              value={selectedResultSec || ''}
              onChange={e => loadViewResults(e.target.value)}
              style={{ padding:'0.5rem 0.75rem', border:'1px solid var(--border)', borderRadius:8, fontSize:'1rem' }}
            >
              <option value="">-- Choose Section --</option>
              {resultSections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.course_code} — {sec.course_title} ({sec.section_code}) - {sec.semester_name} {sec.year}
                </option>
              ))}
            </select>
          </div>

          {selectedResultSec && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Marks (Out of 100)</th>
                  <th>Grade</th>
                  <th>Workflow Status</th>
                </tr>
              </thead>
              <tbody>
                {resultStudents.map(st => {
                  const sLabel = STATUS_DISPLAY[st.workflow_status] || STATUS_DISPLAY.papers_submitted;
                  return (
                    <tr key={st.enrollment_id}>
                      <td><strong>{st.roll_number}</strong></td>
                      <td>{st.student_name}</td>
                      <td>{st.marks != null ? <strong>{st.marks} / 100</strong> : '—'}</td>
                      <td>{st.letter_grade ? <span className="badge">{st.letter_grade}</span> : '—'}</td>
                      <td>
                        <span
                          style={{
                            display:'inline-block', padding:'0.2rem 0.6rem', borderRadius:'999px',
                            fontSize:'0.75rem', fontWeight:700,
                            color: sLabel.color, background: sLabel.bg
                          }}
                        >
                          {sLabel.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {resultStudents.length === 0 && (
                  <tr><td colSpan={5} className="muted">No students enrolled or no marks entered yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ENTER MARKS (Default Full Marks = 100) */}
      {/* ==================================================== */}
      {marksModalSection && (
        <div className="modal-overlay" style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="modal-content card" style={{ maxWidth:650, width:'95%', maxHeight:'85vh', overflowY:'auto', padding:'1.75rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <div>
                <h3 style={{ margin:0 }}>✏️ Enter Student Marks</h3>
                <small className="muted">{marksModalSection.course_code} — {marksModalSection.course_title} (Full Marks: 100)</small>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setMarksModalSection(null)}>✕ Close</button>
            </div>

            <form onSubmit={saveAllMarks}>
              <table className="data-table" style={{ marginBottom:'1.5rem' }}>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Full Marks</th>
                    <th>Marks Obtained (0-100)</th>
                  </tr>
                </thead>
                <tbody>
                  {marksStudents.map(st => (
                    <tr key={st.enrollment_id}>
                      <td><strong>{st.roll_number}</strong></td>
                      <td>{st.student_name}</td>
                      <td><span className="badge">100</span></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={studentMarksInputs[st.enrollment_id] ?? ''}
                          onChange={e => setStudentMarksInputs({ ...studentMarksInputs, [st.enrollment_id]: e.target.value })}
                          placeholder="Marks (0-100)"
                          style={{ width:120, padding:'0.4rem', border:'1px solid var(--border)', borderRadius:6 }}
                        />
                      </td>
                    </tr>
                  ))}
                  {marksStudents.length === 0 && (
                    <tr><td colSpan={4} className="muted">No students enrolled in this section</td></tr>
                  )}
                </tbody>
              </table>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setMarksModalSection(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingMarks || marksStudents.length === 0}>
                  {savingMarks ? 'Saving…' : '💾 Save Marks'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD / CHANGE TIMETABLE */}
      {/* ==================================================== */}
      {timetableSection && (
        <div className="modal-overlay" style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="modal-content card" style={{ maxWidth:480, width:'90%', padding:'1.75rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 style={{ margin:0 }}>📅 Timetable & Room for {timetableSection.course_code}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTimetableSection(null)}>✕</button>
            </div>

            <form onSubmit={saveTimetable}>
              <div className="form-grid" style={{ marginBottom:'1rem' }}>
                <label>Day of Week
                  <select value={ttDay} onChange={e => setTtDay(Number(e.target.value))} style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6, marginTop:'0.25rem' }}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </label>
                <label>Start Time
                  <input type="time" value={ttStart} onChange={e => setTtStart(e.target.value)} required style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6, marginTop:'0.25rem' }} />
                </label>
                <label>End Time
                  <input type="time" value={ttEnd} onChange={e => setTtEnd(e.target.value)} required style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6, marginTop:'0.25rem' }} />
                </label>
                <label>Room Number / Venue
                  <input type="text" value={ttRoom} onChange={e => setTtRoom(e.target.value)} placeholder="e.g. Room 204" style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6, marginTop:'0.25rem' }} />
                </label>
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setTimetableSection(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Timetable</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
