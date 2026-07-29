import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'results'
  const [resultsSubTab, setResultsSubTab] = useState('entry'); // 'entry' | 'recheck'

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Paper review recheck state
  const [instructorReviewRequests, setInstructorReviewRequests] = useState([]);
  const [recheckInputs, setRecheckInputs] = useState({});

  // View Students Modal state
  const [viewStudentsModal, setViewStudentsModal] = useState(null);
  const [viewStudentsList, setViewStudentsList] = useState([]);

  // Enter Marks Modal state
  const [marksModalSection, setMarksModalSection] = useState(null);
  const [marksStudents, setMarksStudents] = useState([]);
  const [studentMarksInputs, setStudentMarksInputs] = useState({});
  const [savingMarks, setSavingMarks] = useState(false);

  // Timetable Modal state
  const [timetableSection, setTimetableSection] = useState(null);
  const [ttSlots, setTtSlots] = useState([{ day_of_week: 1, start_time: '09:00', end_time: '11:00' }]);

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
      const revs = await api.getInstructorPaperReviewRequests().catch(() => []);
      setInstructorReviewRequests(revs);
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

  // View Students modal handler (shows Name & Roll No only)
  const openViewStudentsModal = async (sec) => {
    setViewStudentsModal(sec);
    try {
      const rows = await api.getSectionResultStudents(sec.id);
      setViewStudentsList(rows);
    } catch {
      setViewStudentsList([]);
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

  // Multi-day timetable modal handlers
  const openTimetableModal = (sec) => {
    setTimetableSection(sec);
    if (sec.schedule_slots && sec.schedule_slots.length > 0) {
      setTtSlots(sec.schedule_slots.map(s => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time
      })));
    } else {
      setTtSlots([{ day_of_week: 1, start_time: '09:00', end_time: '11:00' }]);
    }
  };

  const addTtSlot = () => {
    setTtSlots(prev => [...prev, { day_of_week: 2, start_time: '14:00', end_time: '16:00' }]);
  };

  const removeTtSlot = (idx) => {
    setTtSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const saveTimetable = async (e) => {
    e.preventDefault();
    if (!timetableSection) return;
    try {
      await api.updateSectionTimetable(timetableSection.id, {
        slots: ttSlots
      });
      flash('success', 'Multi-day timetable updated in database!');
      setTimetableSection(null);
      load();
    } catch (err) {
      flash('error', err.message || 'Failed to update timetable');
    }
  };

  // Submit Paper Review Recheck
  const submitRecheck = async (requestId) => {
    const input = recheckInputs[requestId];
    if (!input || input.new_value === '') {
      flash('error', 'Please enter a revised mark.');
      return;
    }
    try {
      await api.recheckPaperReview(requestId, Number(input.new_value), input.remarks || '');
      flash('success', 'Revised marks submitted to Academic Staff.');
      load();
    } catch (err) {
      flash('error', err.message);
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

  return (
    <div>
      <div className="page-header">
        <h1>Instructor Dashboard</h1>
        <p>Welcome, <strong>{user?.name}</strong> ({user?.department?.toUpperCase() || 'CS'} Department)</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Top Tabs */}
      <div className="admin-tabs" style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📚 My Department Courses ({sections.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          📊 Results Entry &amp; View
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: MY COURSES (Direct Course Cards Grid) */}
      {/* ==================================================== */}
      {activeTab === 'courses' && (
        <div>
          {sections.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>👨‍🏫</div>
              <p>No courses assigned to your department ({user?.department?.toUpperCase() || 'CS'}) yet.</p>
            </div>
          ) : (
            <div className="card-grid">
              {sections.map(s => {
                const slots = s.schedule_slots || [];
                const examStarted = s.exam_started === 1;

                return (
                  <div key={s.id} className="card section-card">
                    <div className="section-card-header">
                      <span className="badge dept">{s.course_code}</span>
                      <span className="badge">{s.credits} cr</span>
                    </div>

                    <h3 style={{ margin:'0.5rem 0' }}>{s.course_title}</h3>
                    <small className="muted">Section {s.section_code} · {s.semester_name} {s.year}</small>

                    <div style={{ fontSize:'0.85rem', margin:'0.55rem 0' }}>
                      <div>👥 Enrolled Students: <strong>{s.enrolled_count}</strong></div>
                      <div>
                        🕐 Schedule:{' '}
                        <strong>
                          {slots.length > 0
                            ? slots.map(sl => `${DAYS[sl.day_of_week] || ''} ${sl.start_time}-${sl.end_time}`).join(', ')
                            : 'Not set'}
                        </strong>
                      </div>
                    </div>

                    {/* Action Buttons based on Exam Started state */}
                    <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid var(--border)', display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                      {!examStarted ? (
                        /* BEFORE EXAM STARTED: Request Exam, Change Timetable, View Students */
                        <>
                          {!s.exam_requested ? (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => requestExam(s.id)}>
                              📝 Request Exam
                            </button>
                          ) : !s.exam_reg_open ? (
                            <>
                              <span className="badge" style={{ background:'#fef3c7', color:'#92400e' }}>⏳ Exam Requested</span>
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => cancelExam(s.id)}>
                                ✕ Cancel Request
                              </button>
                            </>
                          ) : (
                            <span className="badge success">📝 Exam Reg Open</span>
                          )}

                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openTimetableModal(s)}>
                            📅 Change Timetable
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openViewStudentsModal(s)}>
                            👥 View Students
                          </button>
                        </>
                      ) : (
                        /* AFTER EXAM STARTED / DONE: Enter Marks, Change Timetable, View Students */
                        <>
                          <span className="badge success">▶️ Exam Started</span>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => openMarksModal(s)}>
                            ✏️ Enter Marks
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openTimetableModal(s)}>
                            📅 Change Timetable
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openViewStudentsModal(s)}>
                            👥 View Students
                          </button>
                        </>
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
      {/* TAB 2: RESULTS ENTRY & VIEW + PAPER RECHECK REQUESTS */}
      {/* ==================================================== */}
      {activeTab === 'results' && (
        <div>
          {/* Sub Navigation inside Results Tab */}
          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${resultsSubTab === 'entry' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setResultsSubTab('entry')}
            >
              📊 Student Results View
            </button>
            <button
              type="button"
              className={`btn btn-sm ${resultsSubTab === 'recheck' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setResultsSubTab('recheck')}
            >
              📄 Paper Recheck Requests ({instructorReviewRequests.length})
            </button>
          </div>

          {resultsSubTab === 'entry' && (
            <div className="card">
              <h2>Student Results Entry &amp; View</h2>
              <div className="inline-label" style={{ marginBottom:'1.5rem', marginTop:'1rem' }}>
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
                    <tr><th>Roll No</th><th>Student Name</th><th>Marks (Out of 100)</th><th>Grade</th><th>Workflow Status</th></tr>
                  </thead>
                  <tbody>
                    {resultStudents.map(st => {
                      const sLabel = STATUS_DISPLAY[st.workflow_status] || STATUS_DISPLAY.papers_submitted;
                      return (
                        <tr key={st.enrollment_id}>
                          <td><strong>{st.roll_number}</strong></td>
                          <td>{st.student_name}</td>
                          <td>{st.marks != null ? <strong>{st.marks} / 100</strong> : '—'}</td>
                          <td><span className="badge">{st.letter_grade || '—'}</span></td>
                          <td>
                            <span className="badge" style={{ background: sLabel.bg, color: sLabel.color }}>
                              {sLabel.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {resultsSubTab === 'recheck' && (
            <div className="card">
              <h2>📄 Paper Recheck &amp; Revision Requests</h2>
              <p className="muted" style={{ marginBottom:'1rem' }}>
                Re-check student exam papers forwarded to you by academic staff/HOD and enter revised marks.
              </p>

              <table className="data-table">
                <thead>
                  <tr><th>Course</th><th>Roll No</th><th>Student Name</th><th>Reason</th><th>Current Marks</th><th>Revised Marks Input</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {instructorReviewRequests.map(r => {
                    const inputVal = recheckInputs[r.request_id] || { new_value: r.new_value ?? r.old_value ?? '', remarks: '' };
                    return (
                      <tr key={r.request_id}>
                        <td><strong>{r.course_code} — {r.course_title}</strong></td>
                        <td>{r.roll_number}</td>
                        <td>{r.student_name}</td>
                        <td>{r.reason}</td>
                        <td>{r.old_value != null ? `${r.old_value} / 100` : '—'}</td>
                        <td>
                          <input
                            type="number"
                            placeholder="New marks"
                            value={inputVal.new_value}
                            onChange={e => setRecheckInputs({
                              ...recheckInputs,
                              [r.request_id]: { ...inputVal, new_value: e.target.value }
                            })}
                            style={{ width:90, padding:'0.4rem', border:'1px solid var(--border)', borderRadius:6 }}
                          />
                        </td>
                        <td>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => submitRecheck(r.request_id)}>
                            💾 Submit Revised Marks
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {instructorReviewRequests.length === 0 && (
                    <tr><td colSpan={7} className="muted">No pending paper recheck requests assigned to you.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== VIEW STUDENTS MODAL ===== */}
      {viewStudentsModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 }}>
          <div className="card" style={{ maxWidth:650, width:'90%', maxHeight:'80vh', overflowY:'auto' }}>
            <div className="card-header">
              <h3>Registered Students — {viewStudentsModal.course_code} ({viewStudentsModal.course_title})</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewStudentsModal(null)}>Close</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Roll Number</th><th>Student Name</th><th>Email</th><th>Marks (100)</th><th>Grade</th></tr></thead>
              <tbody>
                {viewStudentsList.map(st => (
                  <tr key={st.enrollment_id}>
                    <td><strong>{st.roll_number}</strong></td>
                    <td>{st.student_name}</td>
                    <td>{st.student_email || '—'}</td>
                    <td>{st.marks != null ? <strong>{st.marks} / 100</strong> : '—'}</td>
                    <td><span className="badge">{st.letter_grade || '—'}</span></td>
                  </tr>
                ))}
                {viewStudentsList.length === 0 && (
                  <tr><td colSpan={5} className="muted">No students currently enrolled in this section.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== ENTER MARKS MODAL ===== */}
      {marksModalSection && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 }}>
          <div className="card" style={{ maxWidth:650, width:'90%', maxHeight:'85vh', overflowY:'auto' }}>
            <div className="card-header">
              <h3>Enter Final Exam Marks (Out of 100) — {marksModalSection.course_code}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setMarksModalSection(null)}>Cancel</button>
            </div>
            <form onSubmit={saveAllMarks}>
              <table className="data-table" style={{ marginBottom:'1rem' }}>
                <thead><tr><th>Roll No</th><th>Student Name</th><th>Marks (0 - 100)</th></tr></thead>
                <tbody>
                  {marksStudents.map(st => (
                    <tr key={st.enrollment_id}>
                      <td><strong>{st.roll_number}</strong></td>
                      <td>{st.student_name}</td>
                      <td>
                        <input
                          type="number"
                          min="0" max="100" step="0.5"
                          placeholder="e.g. 85"
                          value={studentMarksInputs[st.enrollment_id] ?? ''}
                          onChange={e => setStudentMarksInputs({ ...studentMarksInputs, [st.enrollment_id]: e.target.value })}
                          style={{ width:100, padding:'0.4rem', border:'1px solid var(--border)', borderRadius:6 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="submit" className="btn btn-primary" disabled={savingMarks}>
                {savingMarks ? 'Saving...' : '💾 Save Marks'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== TIMETABLE MODAL ===== */}
      {timetableSection && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 }}>
          <div className="card" style={{ maxWidth:550, width:'90%' }}>
            <div className="card-header">
              <h3>Update Timetable — {timetableSection.course_code}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTimetableSection(null)}>Cancel</button>
            </div>
            <form onSubmit={saveTimetable}>
              {ttSlots.map((slot, index) => (
                <div key={index} style={{ display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center' }}>
                  <select
                    value={slot.day_of_week}
                    onChange={e => {
                      const updated = [...ttSlots];
                      updated[index].day_of_week = Number(e.target.value);
                      setTtSlots(updated);
                    }}
                    style={{ padding:'0.4rem', borderRadius:6, border:'1px solid var(--border)' }}
                  >
                    {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <input
                    type="time"
                    value={slot.start_time}
                    onChange={e => {
                      const updated = [...ttSlots];
                      updated[index].start_time = e.target.value;
                      setTtSlots(updated);
                    }}
                    style={{ padding:'0.4rem', borderRadius:6, border:'1px solid var(--border)' }}
                  />
                  <input
                    type="time"
                    value={slot.end_time}
                    onChange={e => {
                      const updated = [...ttSlots];
                      updated[index].end_time = e.target.value;
                      setTtSlots(updated);
                    }}
                    style={{ padding:'0.4rem', borderRadius:6, border:'1px solid var(--border)' }}
                  />
                  {ttSlots.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeTtSlot(index)}>✕</button>
                  )}
                </div>
              ))}
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={addTtSlot}>+ Add Day Slot</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Timetable</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
