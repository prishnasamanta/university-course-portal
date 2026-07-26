import { useEffect, useState } from 'react';
import { api } from '../api';

const DEPTS = ['cs', 'eco', 'stat'];
const LEVELS = ['btech', 'msc', 'mtech'];
const LEVEL_LABELS = { btech: 'B.Tech', msc: 'M.Sc', mtech: 'M.Tech' };
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const DEGREE_TILES = [
  { code: 'BTECH-CS', label: 'B.Tech Computer Science', dept: 'cs', level: 'btech', icon: '💻', color: '#4f46e5' },
  { code: 'MSC-CS', label: 'M.Sc Computer Science', dept: 'cs', level: 'msc', icon: '🤖', color: '#0891b2' },
  { code: 'MTECH-CS', label: 'M.Tech Computer Science', dept: 'cs', level: 'mtech', icon: '⚙️', color: '#7c3aed' },
  { code: 'BTECH-ECO', label: 'B.Tech Economics', dept: 'eco', level: 'btech', icon: '📈', color: '#059669' },
  { code: 'MSC-STAT', label: 'M.Sc Statistics', dept: 'stat', level: 'msc', icon: '📊', color: '#d97706' },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('semesters');
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [examRequests, setExamRequests] = useState([]);
  const [workflowSections, setWorkflowSections] = useState([]);
  const [message, setMessage] = useState(null);

  // Semester tab state
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [showSemForm, setShowSemForm] = useState(false);
  const [newSem, setNewSem] = useState({ name: 'Spring', year: new Date().getFullYear() + 1 });

  // Course catalog state
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [newCourse, setNewCourse] = useState({
    code: '', title: '', credits: 6, department: 'cs', degree_level: 'btech',
    required_previous_degree: '', min_previous_grade: '', syllabus: '', prerequisite_ids: []
  });

  // Section state
  const [newSection, setNewSection] = useState({
    course_id: '', semester_id: '', section_code: 'A', instructor_id: '', capacity: 60, room: '',
    slots: [{ day_of_week: 1, start_time: '09:00', end_time: '11:00' }]
  });

  // Exam section detail
  const [examDetail, setExamDetail] = useState(null);
  const [examDetailRows, setExamDetailRows] = useState([]);

  // Workflow section detail
  const [wfSection, setWfSection] = useState(null);
  const [wfStudents, setWfStudents] = useState([]);

  const load = () => {
    Promise.all([
      api.getSemesters(), api.getCourses(), api.getInstructors(),
      api.getExamRequests(), api.getWorkflowSections()
    ]).then(([sems, crs, inst, er, wf]) => {
      setSemesters(sems);
      setCourses(crs);
      setInstructors(inst);
      setExamRequests(er);
      setWorkflowSections(wf);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const createSemester = async (e) => {
    e.preventDefault();
    await api.createSemester?.({ ...newSem, is_active: 1, registration_open: 0 }).catch(() =>
      api.getSemesters()
    );
    flash('success', 'Semester created');
    setShowSemForm(false);
    load();
  };

  const toggleReg = async (semId, current) => {
    await api.toggleRegistration(semId, !current);
    flash('success', `Registration ${!current ? 'opened' : 'closed'}`);
    load();
  };

  const createCourse = async (e) => {
    e.preventDefault();
    await api.createCourse({ ...newCourse, credits: Number(newCourse.credits) });
    flash('success', 'Course added to catalog');
    setShowCourseForm(false);
    setNewCourse({ code:'', title:'', credits:6, department:'cs', degree_level:'btech', required_previous_degree:'', min_previous_grade:'', syllabus:'', prerequisite_ids:[] });
    load();
  };

  const createSection = async (e) => {
    e.preventDefault();
    await api.createSection({
      ...newSection,
      course_id: Number(newSection.course_id),
      semester_id: Number(newSection.semester_id),
      instructor_id: Number(newSection.instructor_id),
      capacity: Number(newSection.capacity),
      schedule_slots: newSection.slots
    });
    flash('success', 'Section created — visible to students');
    load();
  };

  const openExamReg = async (sectionId) => {
    await api.openExamReg(sectionId);
    flash('success', 'Exam registration opened for students');
    load();
  };

  const closeExamReg = async (sectionId) => {
    await api.closeExamReg(sectionId);
    flash('success', 'Exam registration closed');
    load();
  };

  const loadExamDetail = async (sectionId) => {
    setExamDetail(sectionId);
    const rows = await api.getSectionExamRegistrations(sectionId);
    setExamDetailRows(rows);
  };

  const loadWfDetail = async (sectionId) => {
    const data = await api.getWorkflowSectionResults(sectionId);
    setWfSection(data.section);
    setWfStudents(data.students);
  };

  const filterCoursesByDegree = (deg) => {
    if (!deg) return courses;
    return courses.filter(c => c.degree_level === deg.level && c.department === deg.dept);
  };

  const filteredSemesters = selectedDegree
    ? semesters // all semesters (degree filter is conceptual — semesters span all degrees)
    : semesters;

  const TABS = [
    { id: 'semesters', label: '📅 Semesters' },
    { id: 'catalog', label: '📚 Course Catalog' },
    { id: 'sections', label: '📋 Create Section' },
    { id: 'exams', label: `📝 Exam Registration${examRequests.length ? ` (${examRequests.length})` : ''}` },
    { id: 'workflow', label: '📊 Results Workflow' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Academic Office</h1>
        <p>Manage degrees, courses, registration, exams and results workflow</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Tab nav */}
      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== SEMESTERS TAB ===== */}
      {tab === 'semesters' && (
        <div>
          <div className="degree-tiles">
            {DEGREE_TILES.map(deg => (
              <button
                key={deg.code}
                type="button"
                className={`degree-tile ${selectedDegree?.code === deg.code ? 'selected' : ''}`}
                style={{ '--tile-color': deg.color }}
                onClick={() => setSelectedDegree(selectedDegree?.code === deg.code ? null : deg)}
              >
                <span className="degree-tile-icon">{deg.icon}</span>
                <span className="degree-tile-label">{deg.label}</span>
              </button>
            ))}
          </div>

          {selectedDegree && (
            <div className="card" style={{ borderLeft: `4px solid ${selectedDegree.color}` }}>
              <div className="card-header">
                <h2>{selectedDegree.icon} {selectedDegree.label} — Semesters</h2>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowSemForm(!showSemForm)}>
                  {showSemForm ? 'Cancel' : '+ New Semester'}
                </button>
              </div>

              {showSemForm && (
                <form onSubmit={createSemester} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-end', marginBottom:'1rem', flexWrap:'wrap' }}>
                  <label style={{ fontWeight:600, fontSize:'0.85rem' }}>
                    Term
                    <select value={newSem.name} onChange={e => setNewSem({...newSem, name: e.target.value})} style={{ display:'block', padding:'0.5rem', marginTop:'0.25rem', border:'1px solid var(--border)', borderRadius:6 }}>
                      <option>Fall</option><option>Spring</option><option>Summer</option>
                    </select>
                  </label>
                  <label style={{ fontWeight:600, fontSize:'0.85rem' }}>
                    Year
                    <input type="number" value={newSem.year} onChange={e => setNewSem({...newSem, year: Number(e.target.value)})} style={{ display:'block', padding:'0.5rem', marginTop:'0.25rem', border:'1px solid var(--border)', borderRadius:6, width:80 }} />
                  </label>
                  <button type="submit" className="btn btn-primary">Create</button>
                </form>
              )}

              <table className="data-table">
                <thead><tr><th>Semester</th><th>Status</th><th>Registration</th><th>Exams</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredSemesters.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.name} {s.year}</strong></td>
                      <td>{s.is_active ? <span className="badge success">Active</span> : <span className="badge">Inactive</span>}</td>
                      <td>{s.registration_open ? <span className="badge success">Open</span> : <span className="badge">Closed</span>}</td>
                      <td>{s.exams_completed ? <span className="badge success">Done</span> : '—'}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className={`btn btn-sm ${s.registration_open ? 'btn-danger' : 'btn-primary'}`}
                          onClick={() => toggleReg(s.id, s.registration_open)}
                        >
                          {s.registration_open ? '🔒 Close Reg' : '✅ Open Reg'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => api.toggleExamsCompleted(s.id, !s.exams_completed).then(load)}
                        >
                          {s.exams_completed ? 'Reopen Exams' : '📝 Mark Exams Done'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSemesters.length === 0 && (
                    <tr><td colSpan={5} className="muted">No semesters yet — create one above</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!selectedDegree && (
            <div className="card">
              <p className="muted">👆 Select a degree above to manage its semesters and registration</p>
            </div>
          )}
        </div>
      )}

      {/* ===== COURSE CATALOG TAB ===== */}
      {tab === 'catalog' && (
        <div className="card">
          <div className="card-header">
            <h2>Course Catalog</h2>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCourseForm(!showCourseForm)}>
              {showCourseForm ? 'Cancel' : '+ Add Course'}
            </button>
          </div>

          {showCourseForm && (
            <form onSubmit={createCourse} className="course-form">
              <div className="form-grid">
                <label>Code<input value={newCourse.code} onChange={e => setNewCourse({...newCourse, code:e.target.value})} required placeholder="CS104" /></label>
                <label>Title<input value={newCourse.title} onChange={e => setNewCourse({...newCourse, title:e.target.value})} required placeholder="Operating Systems" /></label>
                <label>Credits<input type="number" value={newCourse.credits} onChange={e => setNewCourse({...newCourse, credits:e.target.value})} required min={1} /></label>
                <label>Department
                  <select value={newCourse.department} onChange={e => setNewCourse({...newCourse, department:e.target.value})}>
                    {DEPTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                  </select>
                </label>
                <label>Degree Level
                  <select value={newCourse.degree_level} onChange={e => setNewCourse({...newCourse, degree_level:e.target.value})}>
                    {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                  </select>
                </label>
                <label>Min Prev Grade<input value={newCourse.min_previous_grade} onChange={e => setNewCourse({...newCourse, min_previous_grade:e.target.value})} placeholder="Optional e.g. B" /></label>
              </div>
              <label>Syllabus<textarea value={newCourse.syllabus} onChange={e => setNewCourse({...newCourse, syllabus:e.target.value})} rows={3} /></label>
              <button type="submit" className="btn btn-primary">Add Course</button>
            </form>
          )}

          {DEGREE_TILES.map(deg => {
            const degCourses = courses.filter(c => c.degree_level === deg.level && c.department === deg.dept);
            if (degCourses.length === 0) return null;
            return (
              <div key={deg.code} style={{ marginBottom:'1.5rem' }}>
                <h3 style={{ color: deg.color, marginBottom:'0.5rem', fontSize:'1rem' }}>{deg.icon} {deg.label}</h3>
                <table className="data-table">
                  <thead><tr><th>Code</th><th>Title</th><th>Credits</th><th>Min Grade</th></tr></thead>
                  <tbody>
                    {degCourses.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.code}</strong></td>
                        <td>{c.title}</td>
                        <td><span className="badge">{c.credits} cr</span></td>
                        <td>{c.min_previous_grade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== CREATE SECTION TAB ===== */}
      {tab === 'sections' && (
        <div className="card">
          <h2>Create Section (Assign Instructor + Timetable)</h2>
          <p className="muted" style={{ marginBottom:'1rem' }}>Only sections with instructors appear in student registration.</p>
          <form onSubmit={createSection} className="course-form">
            <div className="form-grid">
              <label>Course
                <select value={newSection.course_id} onChange={e => setNewSection({...newSection, course_id:e.target.value})} required>
                  <option value="">Select course</option>
                  {DEGREE_TILES.map(deg => (
                    <optgroup key={deg.code} label={deg.label}>
                      {courses.filter(c => c.degree_level===deg.level && c.department===deg.dept)
                        .map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>Semester
                <select value={newSection.semester_id} onChange={e => setNewSection({...newSection, semester_id:e.target.value})} required>
                  <option value="">Select semester</option>
                  {semesters.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
                </select>
              </label>
              <label>Instructor
                <select value={newSection.instructor_id} onChange={e => setNewSection({...newSection, instructor_id:e.target.value})} required>
                  <option value="">Select instructor</option>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name} ({i.department})</option>)}
                </select>
              </label>
              <label>Section Code<input value={newSection.section_code} onChange={e => setNewSection({...newSection, section_code:e.target.value})} /></label>
              <label>Capacity<input type="number" value={newSection.capacity} onChange={e => setNewSection({...newSection, capacity:e.target.value})} /></label>
              <label>Room<input value={newSection.room} onChange={e => setNewSection({...newSection, room:e.target.value})} placeholder="e.g. Room 101" /></label>
            </div>
            <div style={{ marginBottom:'0.75rem' }}>
              <strong style={{ fontSize:'0.875rem' }}>Schedule Slot</strong>
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem', flexWrap:'wrap' }}>
                <select
                  value={newSection.slots[0]?.day_of_week}
                  onChange={e => setNewSection({...newSection, slots:[{...newSection.slots[0], day_of_week:Number(e.target.value)}]})}
                  style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6 }}
                >
                  {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <input type="time" value={newSection.slots[0]?.start_time} onChange={e => setNewSection({...newSection, slots:[{...newSection.slots[0], start_time:e.target.value}]})} style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6 }} />
                <input type="time" value={newSection.slots[0]?.end_time} onChange={e => setNewSection({...newSection, slots:[{...newSection.slots[0], end_time:e.target.value}]})} style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6 }} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Create Section</button>
          </form>
        </div>
      )}

      {/* ===== EXAM REGISTRATION TAB ===== */}
      {tab === 'exams' && (
        <div>
          {examRequests.length === 0 ? (
            <div className="card">
              <div style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
                <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>📝</div>
                <p>No exam requests yet. Instructors will appear here when they request to conduct an exam.</p>
              </div>
            </div>
          ) : (
            examRequests.map(sec => (
              <div key={sec.section_id} className="card" style={{ marginBottom:'1rem' }}>
                <div className="card-header" style={{ flexWrap:'wrap', gap:'0.5rem' }}>
                  <div>
                    <h3 style={{ margin:0 }}>{sec.course_code} — {sec.course_title} ({sec.section_code})</h3>
                    <small className="muted">👨‍🏫 {sec.instructor_name} · {sec.semester_name} {sec.year} · {LEVEL_LABELS[sec.degree_level] || sec.degree_level}</small>
                  </div>
                  <div className="actions" style={{ flexWrap:'wrap' }}>
                    {!sec.exam_reg_open ? (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => openExamReg(sec.section_id)}>
                        ✅ Open Exam Registration
                      </button>
                    ) : (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => closeExamReg(sec.section_id)}>
                        🔒 Close Exam Registration
                      </button>
                    )}
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => loadExamDetail(examDetail === sec.section_id ? null : sec.section_id)}>
                      👥 View Registrations
                    </button>
                  </div>
                </div>

                <div style={{ display:'flex', gap:'1.5rem', marginTop:'0.5rem', fontSize:'0.875rem', flexWrap:'wrap' }}>
                  <span>Total enrolled: <strong>{sec.enrolled_count}</strong></span>
                  <span>Exam registered: <strong>{sec.exam_registered_count}</strong></span>
                  <span>Status: {sec.exam_reg_open
                    ? <span className="badge success">Exam Reg Open</span>
                    : <span className="badge">Exam Reg Closed</span>}
                  </span>
                </div>

                {examDetail === sec.section_id && (
                  <div style={{ marginTop:'1rem', borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
                    <h4 style={{ margin:'0 0 0.75rem', fontSize:'0.9rem' }}>Exam Registration List</h4>
                    <table className="data-table">
                      <thead>
                        <tr><th>Roll No</th><th>Student Name</th><th>Exam Registered</th><th>Registered At</th></tr>
                      </thead>
                      <tbody>
                        {examDetailRows.map(r => (
                          <tr key={r.enrollment_id}>
                            <td>{r.roll_number}</td>
                            <td>{r.student_name}</td>
                            <td>{r.exam_reg_id
                              ? <span className="badge success">✅ Registered</span>
                              : <span className="badge" style={{ background:'#fef2f2', color:'#991b1b' }}>❌ Not Registered</span>}
                            </td>
                            <td>{r.registered_at ? new Date(r.registered_at).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                        {examDetailRows.length === 0 && (
                          <tr><td colSpan={4} className="muted">No students enrolled in this section</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== RESULTS WORKFLOW TAB ===== */}
      {tab === 'workflow' && (
        <div>
          {workflowSections.length === 0 ? (
            <div className="card">
              <div style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
                <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>📊</div>
                <p>No results to review yet. Results appear here after instructors submit marks.</p>
              </div>
            </div>
          ) : (
            workflowSections.map(sec => (
              <div key={sec.id} className="card" style={{ marginBottom:'1rem' }}>
                <div className="card-header" style={{ flexWrap:'wrap', gap:'0.5rem' }}>
                  <div>
                    <h3 style={{ margin:0 }}>{sec.course_code} — {sec.course_title} ({sec.section_code})</h3>
                    <small className="muted">👨‍🏫 {sec.instructor_name} · {sec.semester_name} {sec.year}</small>
                  </div>
                  <div className="actions" style={{ flexWrap:'wrap' }}>
                    {sec.pending_forward > 0 && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => api.forwardToHod(sec.id).then(() => { flash('success', 'Forwarded to HOD'); load(); })}>
                        📤 Forward to HOD ({sec.pending_forward})
                      </button>
                    )}
                    {sec.pending_publish > 0 && (
                      <button type="button" className="btn btn-success btn-sm" onClick={() => api.publishResults(sec.id).then(() => { flash('success', 'Results published!'); load(); })}>
                        🎉 Distribute Results ({sec.pending_publish})
                      </button>
                    )}
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => loadWfDetail(sec.id)}>
                      📋 View Details
                    </button>
                  </div>
                </div>

                {wfSection?.id === sec.id && (
                  <div style={{ marginTop:'1rem', borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
                    <table className="data-table">
                      <thead><tr><th>Roll No</th><th>Student</th><th>Marks</th><th>Grade</th><th>Status</th></tr></thead>
                      <tbody>
                        {wfStudents.map(s => (
                          <tr key={s.enrollment_id}>
                            <td>{s.roll_number}</td>
                            <td>{s.student_name}</td>
                            <td>{s.marks ?? '—'}</td>
                            <td>{s.letter_grade ?? '—'}</td>
                            <td><span className="status-badge">{s.status_label}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
