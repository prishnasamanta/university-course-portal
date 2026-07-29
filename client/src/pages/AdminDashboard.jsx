import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('semesters');
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [examRequests, setExamRequests] = useState([]);
  const [workflowSections, setWorkflowSections] = useState([]);
  const [message, setMessage] = useState(null);
  const [users, setUsers] = useState([]);

  // Paper review & removal requests state
  const [paperReviewRequests, setPaperReviewRequests] = useState([]);
  const [removalRequests, setRemovalRequests] = useState([]);

  // Semester tab state
  const [selectedDegree, setSelectedDegree] = useState(null);

  // Course catalog state
  const [catalogLevelFilter, setCatalogLevelFilter] = useState('all');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [newCourse, setNewCourse] = useState({
    code: '', title: '', credits: 6, department: 'cs', degree_level: 'btech',
    required_previous_degree: '', min_previous_grade: '', syllabus: ''
  });
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseStudentsModal, setCourseStudentsModal] = useState(null);
  const [courseStudentsList, setCourseStudentsList] = useState([]);

  // Section state
  const [newSection, setNewSection] = useState({
    course_id: '', semester_id: '', section_code: 'A', instructor_id: '', capacity: 60,
    slots: [{ day_of_week: 1, start_time: '09:00', end_time: '11:00' }]
  });

  // Users tab state (Sorting & Filter)
  const [userRoleFilter, setUserRoleFilter] = useState('student'); // 'student' | 'instructor' | 'all'
  const [sortField, setSortField] = useState('id');
  const [sortDir, setSortDir] = useState('asc');

  // Exam section detail
  const [examDetail, setExamDetail] = useState(null);
  const [examDetailRows, setExamDetailRows] = useState([]);

  // Workflow section detail
  const [wfSection, setWfSection] = useState(null);
  const [wfStudents, setWfStudents] = useState([]);

  // ─── DATA LOADING ───
  const load = () => {
    Promise.all([
      api.getSemesters(), api.getCourses(), api.getInstructors(),
      api.getExamRequests(), api.getWorkflowSections(), api.getUsers(),
      api.getStaffPaperReviewRequests().catch(() => []),
      api.getStudentRemovalRequests().catch(() => [])
    ]).then(([sems, crs, inst, er, wf, usr, pr, rm]) => {
      setSemesters(sems);
      setCourses(crs);
      setInstructors(inst);
      setExamRequests(er);
      setWorkflowSections(wf);
      setUsers(usr);
      setPaperReviewRequests(pr);
      setRemovalRequests(rm);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // ─── FLASH MESSAGE ───
  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // ─── SEMESTER HANDLERS ───
  const createNextSemester = async () => {
    if (!selectedDegree) return;

    // Get semesters ordered by number
    const sortedSems = [...semesters].sort((a, b) => (a.semester_number || a.id) - (b.semester_number || b.id));
    const lastSem = sortedSems[sortedSems.length - 1];

    if (lastSem) {
      if (lastSem.registration_open === 1) {
        flash('error', `Cannot create next semester: Registration for "${lastSem.name}" is still OPEN. Please close registration first.`);
        return;
      }
      if (!lastSem.exams_completed) {
        flash('error', `Cannot create next semester: Final exams for "${lastSem.name}" are NOT completed yet. Please mark exams done first.`);
        return;
      }
    }

    const nextNum = lastSem ? (lastSem.semester_number ? lastSem.semester_number + 1 : sortedSems.length + 1) : 1;
    const nextSemData = {
      name: `Semester ${nextNum}`,
      year: new Date().getFullYear(),
      semester_number: nextNum
    };

    try {
      await api.createSemester(nextSemData);
      flash('success', `Created ${nextSemData.name} for ${selectedDegree.label}!`);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const toggleReg = async (semId, currentlyOpen) => {
    try {
      await api.toggleRegistration(semId, currentlyOpen ? 0 : 1);
      flash('success', currentlyOpen ? 'Registration closed' : 'Registration opened');
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  // ─── COURSE HANDLERS ───
  const createCourse = async (e) => {
    e.preventDefault();
    try {
      await api.createCourse(newCourse);
      flash('success', `Course ${newCourse.code} created!`);
      setShowCourseForm(false);
      setNewCourse({
        code: '', title: '', credits: 6, department: 'cs', degree_level: 'btech',
        required_previous_degree: '', min_previous_grade: '', syllabus: ''
      });
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const saveCourseEdit = async (e) => {
    e.preventDefault();
    try {
      await api.updateCourse(editingCourse.id, editingCourse);
      flash('success', `Updated course ${editingCourse.code} details in database.`);
      setEditingCourse(null);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const deleteCourseItem = async (courseId, code) => {
    if (!window.confirm(`Are you sure you want to delete course ${code}? This will remove it from the database.`)) return;
    try {
      await api.deleteCourse(courseId);
      flash('success', `Course ${code} deleted from database.`);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const showCourseStudents = async (course) => {
    setCourseStudentsModal(course);
    try {
      const list = await api.getCourseRegisteredStudents(course.id);
      setCourseStudentsList(list);
    } catch {
      setCourseStudentsList([]);
    }
  };

  const handleUnenroll = async (enrollmentId) => {
    if (!window.confirm('Unenroll this student from this course?')) return;
    try {
      await api.unenrollStudent(enrollmentId);
      flash('success', 'Student unenrolled.');
      if (courseStudentsModal) {
        showCourseStudents(courseStudentsModal);
      }
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  // ─── SECTION HANDLERS ───
  const createSection = async (e) => {
    e.preventDefault();
    try {
      await api.createSection(newSection);
      flash('success', 'Section created with timetable!');
      setNewSection({
        course_id: '', semester_id: '', section_code: 'A', instructor_id: '', capacity: 60,
        slots: [{ day_of_week: 1, start_time: '09:00', end_time: '11:00' }]
      });
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const addSlot = () => {
    setNewSection(s => ({
      ...s,
      slots: [...s.slots, { day_of_week: 3, start_time: '14:00', end_time: '16:00' }]
    }));
  };

  const removeSlot = (index) => {
    setNewSection(s => ({
      ...s,
      slots: s.slots.filter((_, i) => i !== index)
    }));
  };

  // ─── EXAM HANDLERS ───
  const openExamReg = async (sectionId) => {
    try {
      await api.openExamReg(sectionId);
      flash('success', 'Exam registration opened for students!');
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const closeExamReg = async (sectionId) => {
    try {
      await api.closeExamReg(sectionId);
      flash('success', 'Exam registration closed.');
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const startExam = async (sectionId) => {
    try {
      await api.startExam(sectionId);
      flash('success', 'Exam started!');
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const loadExamDetail = async (sectionId) => {
    if (sectionId === null || sectionId === examDetail) {
      setExamDetail(null);
      setExamDetailRows([]);
      return;
    }
    setExamDetail(sectionId);
    try {
      const rows = await api.getSectionExamRegistrations(sectionId);
      setExamDetailRows(rows);
    } catch {
      setExamDetailRows([]);
    }
  };

  // ─── WORKFLOW HANDLERS ───
  const loadWfDetail = async (sectionId) => {
    if (wfSection?.id === sectionId) {
      setWfSection(null);
      setWfStudents([]);
      return;
    }
    try {
      const data = await api.getWorkflowSectionResults(sectionId);
      setWfSection(data.section);
      setWfStudents(data.students || []);
    } catch {
      setWfSection(null);
      setWfStudents([]);
    }
  };

  // ─── PAPER REVIEW HANDLERS ───
  const handleForwardReview = async (requestId) => {
    try {
      await api.forwardPaperReview(requestId);
      flash('success', 'Review request forwarded to instructor.');
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const handleFinalizeReview = async (requestId, decision) => {
    try {
      await api.finalizePaperReview(requestId, decision);
      flash('success', `Paper review ${decision}d.`);
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  // ─── STUDENT REMOVAL HANDLERS ───
  const handleMarkStudentForRemoval = async (studentId) => {
    const reason = window.prompt('Enter reason for student removal request:');
    if (reason === null) return;
    try {
      await api.requestStudentRemoval(studentId, reason);
      flash('success', 'Student marked for removal. Request sent to HOD for approval.');
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const handleExecuteRemovalDelete = async (removalId) => {
    if (!window.confirm('Execute final student deletion from database? This action cannot be undone.')) return;
    try {
      await api.executeStudentRemovalDelete(removalId);
      flash('success', 'Student successfully deleted from database.');
      load();
    } catch (err) {
      flash('error', err.message);
    }
  };

  // ─── USERS TAB SORTING & FILTERING ───
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(s => s === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredUsers = users.filter(u => {
    if (userRoleFilter === 'student') return u.role === 'student';
    if (userRoleFilter === 'instructor') return u.role === 'instructor';
    return true;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let valA = a[sortField] ?? '';
    let valB = b[sortField] ?? '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Filter open semesters for section creation
  const openSemesters = semesters.filter(s => s.registration_open === 1);

  // Filter instructors by course department for section creation
  const selectedCourseObj = courses.find(c => String(c.id) === String(newSection.course_id));
  const filteredInstructorsForSection = instructors.filter(i => {
    if (!selectedCourseObj) return true;
    const cDept = (selectedCourseObj.department || '').toLowerCase();
    const iDept = (i.department || '').toLowerCase();
    if (!iDept || iDept === cDept) return true;
    if ((cDept === 'cs' || cDept.includes('comp')) && (iDept === 'cs' || iDept.includes('comp'))) return true;
    return false;
  });

  // ─── TABS CONFIG (Role Dependent) ───
  // Note: For Admin (`isAdmin === true`), remove Create Section, Exam Registration, and Results Workflow.
  const TABS = [
    { id: 'semesters', label: '📅 Semesters' },
    { id: 'catalog', label: '📚 Course Catalog' },
    ...(!isAdmin ? [{ id: 'sections', label: '📋 Create Section' }] : []),
    { id: 'users', label: `👥 User Accounts (${users.length})` },
    ...(!isAdmin ? [{ id: 'exams', label: `📝 Exam Registration${examRequests.length ? ` (${examRequests.length})` : ''}` }] : []),
    { id: 'paper-reviews', label: `📄 Paper Reviews${paperReviewRequests.length ? ` (${paperReviewRequests.length})` : ''}` },
    ...(!isAdmin ? [{ id: 'workflow', label: '📊 Results Workflow' }] : []),
    ...(isAdmin ? [{ id: 'removals', label: `⚠️ Removal Approvals (${removalRequests.filter(r => r.status === 'approved_by_hod').length})` }] : [])
  ];

  return (
    <div>
      <div className="page-header">
        <h1>{isAdmin ? 'System Administration' : 'Academic Office'}</h1>
        <p>{isAdmin ? 'Manage user accounts, degrees, course catalog, paper reviews, and removal approvals' : 'Manage degree programs, courses, registration, exams, paper reviews, and user accounts'}</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Tab Nav */}
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
          <div style={{ marginBottom:'0.75rem', fontWeight:600, color:'var(--muted)', fontSize:'0.9rem' }}>
            Select a Degree Program:
          </div>

          <div className="degree-tiles" style={{ marginBottom: '1.25rem' }}>
            {DEGREE_TILES.map(deg => (
              <button
                key={deg.code}
                type="button"
                className={`degree-tile ${selectedDegree?.code === deg.code ? 'selected' : ''}`}
                style={{ '--tile-color': deg.color }}
                onClick={() => setSelectedDegree(deg)}
              >
                <span className="degree-tile-icon">{deg.icon}</span>
                <span className="degree-tile-label">{deg.label}</span>
              </button>
            ))}
          </div>

          {!selectedDegree ? (
            <div className="card" style={{ textAlign:'center', padding:'3rem 2rem', color:'var(--muted)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>🎓</div>
              <h3>Please select a degree program above</h3>
              <p>Click on any degree (B.Tech CS, M.Sc CS, M.Tech CS, B.Tech Eco, M.Sc Stat) to manage its semesters.</p>
            </div>
          ) : (
            <div className="card" style={{ borderLeft: `4px solid ${selectedDegree.color}` }}>
              <div className="card-header">
                <h2>{selectedDegree.icon} {selectedDegree.label} — Semesters</h2>
                <button type="button" className="btn btn-primary btn-sm" onClick={createNextSemester}>
                  + New Semester
                </button>
              </div>

              <table className="data-table">
                <thead><tr><th>Semester</th><th>Status</th><th>Registration</th><th>Exams</th><th>Actions</th></tr></thead>
                <tbody>
                  {semesters.map(s => (
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
                  {semesters.length === 0 && (
                    <tr><td colSpan={5} className="muted">No semesters created yet. Click "+ New Semester" to create Semester 1.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== COURSE CATALOG TAB ===== */}
      {tab === 'catalog' && (
        <div className="card">
          <div className="card-header">
            <h2>📚 Course Catalog</h2>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCourseForm(!showCourseForm)}>
              {showCourseForm ? 'Cancel' : '+ New Course'}
            </button>
          </div>

          {/* Level Filter */}
          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
            <button type="button" className={`btn btn-sm ${catalogLevelFilter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCatalogLevelFilter('all')}>All Degrees</button>
            <button type="button" className={`btn btn-sm ${catalogLevelFilter === 'btech' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCatalogLevelFilter('btech')}>B.Tech</button>
            <button type="button" className={`btn btn-sm ${catalogLevelFilter === 'msc' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCatalogLevelFilter('msc')}>M.Sc</button>
            <button type="button" className={`btn btn-sm ${catalogLevelFilter === 'mtech' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCatalogLevelFilter('mtech')}>M.Tech</button>
          </div>

          {showCourseForm && (
            <form onSubmit={createCourse} style={{ display:'grid', gap:'0.75rem', marginBottom:'1.5rem', background:'var(--surface-hover)', padding:'1rem', borderRadius:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'0.75rem' }}>
                <label>Course Code<input value={newCourse.code} onChange={e => setNewCourse({...newCourse, code: e.target.value})} placeholder="e.g. CS101" required /></label>
                <label>Title<input value={newCourse.title} onChange={e => setNewCourse({...newCourse, title: e.target.value})} placeholder="e.g. Data Structures" required /></label>
                <label>Credits<input type="number" value={newCourse.credits} onChange={e => setNewCourse({...newCourse, credits: Number(e.target.value)})} required /></label>
                <label>Department
                  <select value={newCourse.department} onChange={e => setNewCourse({...newCourse, department: e.target.value})}>
                    {DEPTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                  </select>
                </label>
                <label>Degree Level
                  <select value={newCourse.degree_level} onChange={e => setNewCourse({...newCourse, degree_level: e.target.value})}>
                    {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                  </select>
                </label>
              </div>
              <button type="submit" className="btn btn-primary" style={{ justifySelf:'start' }}>Create Course</button>
            </form>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Credits</th>
                <th>Degree &amp; Dept</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses
                .filter(c => catalogLevelFilter === 'all' || c.degree_level === catalogLevelFilter)
                .map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.code}</strong></td>
                    <td>{c.title}</td>
                    <td>{c.credits}</td>
                    <td><span className="badge">{LEVEL_LABELS[c.degree_level] || c.degree_level} ({c.department?.toUpperCase()})</span></td>
                    <td className="actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingCourse(c)}>✏️ Edit</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => showCourseStudents(c)}>👥 Show Students</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteCourseItem(c.id, c.code)}>🗑️ Delete</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* Edit Course Modal */}
          {editingCourse && (
            <div style={{ marginTop:'1.5rem', borderTop:'2px solid var(--primary)', paddingTop:'1rem' }}>
              <h3>Edit Course: {editingCourse.code}</h3>
              <form onSubmit={saveCourseEdit} style={{ display:'grid', gap:'0.75rem' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'0.75rem' }}>
                  <label>Code<input value={editingCourse.code} onChange={e => setEditingCourse({...editingCourse, code:e.target.value})} /></label>
                  <label>Title<input value={editingCourse.title} onChange={e => setEditingCourse({...editingCourse, title:e.target.value})} /></label>
                  <label>Credits<input type="number" value={editingCourse.credits} onChange={e => setEditingCourse({...editingCourse, credits:Number(e.target.value)})} /></label>
                </div>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                  <button type="button" className="btn btn-outline" onClick={() => setEditingCourse(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Course Registered Students Modal */}
          {courseStudentsModal && (
            <div style={{ marginTop:'1.5rem', borderTop:'2px solid var(--primary)', paddingTop:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h3>Registered Students — {courseStudentsModal.code} ({courseStudentsModal.title})</h3>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setCourseStudentsModal(null)}>Close</button>
              </div>
              <table className="data-table" style={{ marginTop:'0.75rem' }}>
                <thead>
                  <tr><th>Roll No</th><th>Name</th><th>Email</th><th>Section</th><th>Enrolled At</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {courseStudentsList.map(st => (
                    <tr key={st.enrollment_id}>
                      <td><strong>{st.roll_number}</strong></td>
                      <td>{st.student_name}</td>
                      <td>{st.student_email || '—'}</td>
                      <td>Section {st.section_code}</td>
                      <td>{st.enrolled_at ? new Date(st.enrolled_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleUnenroll(st.enrollment_id)}>
                          🗑️ {isAdmin ? 'Delete Student' : 'Unenroll'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {courseStudentsList.length === 0 && (
                    <tr><td colSpan={6} className="muted">No students currently enrolled in this course.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== CREATE SECTION TAB (Academic Staff Only) ===== */}
      {!isAdmin && tab === 'sections' && (
        <div className="card">
          <div className="card-header">
            <h2>📋 Create Course Section &amp; Schedule</h2>
          </div>
          <form onSubmit={createSection} style={{ display:'grid', gap:'1rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'0.75rem' }}>
              <label>Course
                <select value={newSection.course_id} onChange={e => setNewSection({...newSection, course_id:e.target.value, instructor_id:''})} required>
                  <option value="">Select course</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.title} ({c.department?.toUpperCase()})</option>
                  ))}
                </select>
              </label>

              <label>Open Semester
                <select value={newSection.semester_id} onChange={e => setNewSection({...newSection, semester_id:e.target.value})} required>
                  <option value="">Select open semester</option>
                  {openSemesters.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
                </select>
                {openSemesters.length === 0 && <small style={{ color:'var(--danger)', display:'block' }}>No semesters are open for registration!</small>}
              </label>

              <label>Instructor (Filtered by Course Dept)
                <select value={newSection.instructor_id} onChange={e => setNewSection({...newSection, instructor_id:e.target.value})} required>
                  <option value="">Select instructor</option>
                  {filteredInstructorsForSection.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.department || 'CS'})</option>
                  ))}
                </select>
              </label>

              <label>Section Code<input value={newSection.section_code} onChange={e => setNewSection({...newSection, section_code:e.target.value})} /></label>
              <label>Capacity<input type="number" value={newSection.capacity} onChange={e => setNewSection({...newSection, capacity:e.target.value})} /></label>
            </div>

            <div style={{ marginBottom:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                <strong style={{ fontSize:'0.875rem' }}>Schedule Days &amp; Timetable Slots ({newSection.slots.length} Days)</strong>
                <button type="button" className="btn btn-outline btn-sm" onClick={addSlot}>+ Add Day</button>
              </div>
              {newSection.slots.map((slot, index) => (
                <div key={index} style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
                  <select
                    value={slot.day_of_week}
                    onChange={e => {
                      const updated = [...newSection.slots];
                      updated[index].day_of_week = Number(e.target.value);
                      setNewSection({...newSection, slots: updated});
                    }}
                    style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6 }}
                  >
                    {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <input
                    type="time"
                    value={slot.start_time}
                    onChange={e => {
                      const updated = [...newSection.slots];
                      updated[index].start_time = e.target.value;
                      setNewSection({...newSection, slots: updated});
                    }}
                    style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6 }}
                  />
                  <input
                    type="time"
                    value={slot.end_time}
                    onChange={e => {
                      const updated = [...newSection.slots];
                      updated[index].end_time = e.target.value;
                      setNewSection({...newSection, slots: updated});
                    }}
                    style={{ padding:'0.5rem', border:'1px solid var(--border)', borderRadius:6 }}
                  />
                  {newSection.slots.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeSlot(index)}>✕ Remove</button>
                  )}
                </div>
              ))}
            </div>

            <button type="submit" className="btn btn-primary">Create Section with Timetable</button>
          </form>
        </div>
      )}

      {/* ===== USER ACCOUNTS TAB ===== */}
      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <h2>👥 Database User Accounts</h2>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              <button type="button" className={`btn btn-sm ${userRoleFilter === 'student' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUserRoleFilter('student')}>👨‍🎓 Students ({users.filter(u => u.role === 'student').length})</button>
              <button type="button" className={`btn btn-sm ${userRoleFilter === 'instructor' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUserRoleFilter('instructor')}>👨‍🏫 Instructors ({users.filter(u => u.role === 'instructor').length})</button>
              <button type="button" className={`btn btn-sm ${userRoleFilter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUserRoleFilter('all')}>🌐 All Users ({users.length})</button>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} style={{ cursor:'pointer' }}>ID {sortField === 'id' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('roll_number')} style={{ cursor:'pointer' }}>Roll / Emp ID {sortField === 'roll_number' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('name')} style={{ cursor:'pointer' }}>Name {sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('email')} style={{ cursor:'pointer' }}>Email {sortField === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th>Password</th>
                <th onClick={() => handleSort('department')} style={{ cursor:'pointer' }}>Dept / Program {sortField === 'department' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('role')} style={{ cursor:'pointer' }}>Role {sortField === 'role' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map(u => (
                <tr key={u.id}>
                  <td><strong>#{u.id}</strong></td>
                  <td>{u.role === 'student' ? (u.roll_number || 'STU') : (u.employee_id || 'EMP')}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><code>{u.password || 'pass1234'}</code></td>
                  <td>{u.role === 'student' ? (u.program_code || 'BTECH-CS') : (u.department?.toUpperCase() || 'CS')}</td>
                  <td>
                    <span className="badge" style={{
                      background: u.role === 'student' ? '#eef2ff' : u.role === 'instructor' ? '#e0f2fe' : u.role === 'admin' ? '#fee2e2' : '#f3f4f6',
                      color: u.role === 'student' ? '#4f46e5' : u.role === 'instructor' ? '#0284c7' : u.role === 'admin' ? '#dc2626' : '#374151'
                    }}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      {u.role === 'student' && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleMarkStudentForRemoval(u.student_id || u.id)}>
                          ⚠️ Mark for Removal
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {sortedUsers.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} className="muted">No matching user accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== EXAM REGISTRATION TAB (Academic Staff Only) ===== */}
      {!isAdmin && tab === 'exams' && (
        <div>
          {examRequests.length === 0 ? (
            <div className="card">
              <div style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
                <div style={{ fontSize:'3rem', marginBottom:'0.75rem' }}>📝</div>
                <p>No exam requests yet. Instructors will appear here when they request an exam.</p>
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
                    {!sec.exam_reg_open && !sec.exam_started && (
                      <button type="button" className="btn btn-success btn-sm" onClick={() => startExam(sec.section_id)}>
                        ▶️ Start Exam
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
                  <span>Status: {sec.exam_started
                    ? <span className="badge success">Exam Done / Started</span>
                    : sec.exam_reg_open
                    ? <span className="badge warning">Exam Reg Open</span>
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
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== PAPER REVIEWS TAB ===== */}
      {tab === 'paper-reviews' && (
        <div className="card">
          <div className="card-header">
            <h2>📄 Student Paper Review &amp; Revision Requests</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Course</th><th>Student</th><th>Roll No</th><th>Reason</th><th>Current Mark</th><th>Revised Mark</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {paperReviewRequests.map(r => (
                <tr key={r.request_id}>
                  <td><strong>{r.course_code}</strong></td>
                  <td>{r.student_name}</td>
                  <td>{r.roll_number}</td>
                  <td>{r.reason}</td>
                  <td>{r.old_value ?? '—'}</td>
                  <td><strong>{r.new_value ?? '—'}</strong></td>
                  <td><span className="badge">{r.status}</span></td>
                  <td className="actions">
                    {r.status === 'pending_staff_review' && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleForwardReview(r.request_id)}>
                        📤 Forward to Instructor
                      </button>
                    )}
                    {r.status === 'instructor_rechecked' && (
                      <>
                        <button type="button" className="btn btn-success btn-sm" onClick={() => handleFinalizeReview(r.request_id, 'approve')}>
                          ✅ Approve Grade
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleFinalizeReview(r.request_id, 'reject')}>
                          ❌ Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {paperReviewRequests.length === 0 && (
                <tr><td colSpan={8} className="muted">No paper review requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== RESULTS WORKFLOW TAB (Academic Staff Only) ===== */}
      {!isAdmin && tab === 'workflow' && (
        <div>
          {LEVELS.map(level => {
            const levelSections = workflowSections.filter(s => (s.degree_level || 'btech') === level);
            if (levelSections.length === 0) return null;
            return (
              <div key={level} style={{ marginBottom:'2rem' }}>
                <h2 style={{ borderBottom:'2px solid var(--primary)', paddingBottom:'0.5rem', marginBottom:'1rem' }}>
                  {LEVEL_LABELS[level]} Degree Results Workflow
                </h2>
                {levelSections.map(sec => (
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
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== ADMIN REMOVAL APPROVALS TAB ===== */}
      {isAdmin && tab === 'removals' && (
        <div className="card">
          <div className="card-header">
            <h2>⚠️ HOD Approved Student Removal Requests</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Roll No</th><th>Student Name</th><th>Email</th><th>Program</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {removalRequests.map(r => (
                <tr key={r.removal_id}>
                  <td><strong>{r.roll_number}</strong></td>
                  <td>{r.student_name}</td>
                  <td>{r.student_email}</td>
                  <td>{r.program_name}</td>
                  <td>{r.reason}</td>
                  <td>
                    <span className={`badge ${r.status === 'approved_by_hod' ? 'success' : ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.status === 'approved_by_hod' && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleExecuteRemovalDelete(r.removal_id)}>
                        🗑️ Confirm Final Deletion
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {removalRequests.length === 0 && (
                <tr><td colSpan={7} className="muted">No student removal requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
