import { useEffect, useState } from 'react';
import { api } from '../api';

const DEPTS = ['cs', 'eco', 'stat'];
const LEVELS = ['btech', 'msc', 'mtech'];

export default function AdminDashboard() {
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [prefs, setPrefs] = useState([]);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newCourse, setNewCourse] = useState({
    code: '', title: '', credits: 3, department: 'cs', degree_level: 'btech',
    required_previous_degree: '', min_previous_grade: '', syllabus: '', prerequisite_ids: []
  });
  const [newSection, setNewSection] = useState({
    course_id: '', semester_id: '', section_code: 'A', instructor_id: '', capacity: 30, room: '',
    slots: [{ day_of_week: 1, start_time: '09:00', end_time: '11:00' }]
  });

  const load = () => {
    Promise.all([
      api.getSemesters(), api.getCourses(), api.getInstructors(), api.getInstructorPreferences()
    ]).then(([sems, crs, inst, pr]) => {
      setSemesters(sems);
      setCourses(crs);
      setInstructors(inst);
      setPrefs(pr);
    });
  };

  useEffect(() => { load(); }, []);

  const toggleRegistration = async (semesterId, current) => {
    await api.toggleRegistration(semesterId, !current);
    setMessage({ type: 'success', text: `Registration ${!current ? 'opened' : 'closed'}` });
    load();
  };

  const createCourse = async (e) => {
    e.preventDefault();
    await api.createCourse(newCourse);
    setMessage({ type: 'success', text: 'Course added to catalog' });
    setShowForm(false);
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
    setMessage({ type: 'success', text: 'Section created — now visible to students' });
    load();
  };

  const togglePrereq = (id) => {
    setNewCourse(c => ({
      ...c,
      prerequisite_ids: c.prerequisite_ids.includes(id)
        ? c.prerequisite_ids.filter(x => x !== id)
        : [...c.prerequisite_ids, id]
    }));
  };

  return (
    <div>
      <div className="page-header">
        <h1>Academic Office</h1>
        <p>Manage courses, sections, registration, and instructor assignments</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        <div className="card-header">
          <h2>Semesters</h2>
        </div>
        <table className="data-table">
          <thead><tr><th>Semester</th><th>Active</th><th>Registration</th><th>Exams</th><th>Action</th></tr></thead>
          <tbody>
            {semesters.map(s => (
              <tr key={s.id}>
                <td>{s.name} {s.year}</td>
                <td>{s.is_active ? 'Yes' : 'No'}</td>
                <td>{s.registration_open ? 'Open' : 'Closed'}</td>
                <td>{s.exams_completed ? 'Done' : 'Pending'}</td>
                <td>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => toggleRegistration(s.id, s.registration_open)}>
                    {s.registration_open ? 'Close Reg' : 'Open Reg'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Course Catalog</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Course'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={createCourse} className="course-form">
            <div className="form-grid">
              <label>Code<input value={newCourse.code} onChange={e => setNewCourse({ ...newCourse, code: e.target.value })} required /></label>
              <label>Title<input value={newCourse.title} onChange={e => setNewCourse({ ...newCourse, title: e.target.value })} required /></label>
              <label>Credits<input type="number" value={newCourse.credits} onChange={e => setNewCourse({ ...newCourse, credits: e.target.value })} required /></label>
              <label>Department
                <select value={newCourse.department} onChange={e => setNewCourse({ ...newCourse, department: e.target.value })}>
                  {DEPTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                </select>
              </label>
              <label>Degree Level
                <select value={newCourse.degree_level} onChange={e => setNewCourse({ ...newCourse, degree_level: e.target.value })}>
                  {LEVELS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
              </label>
              <label>Req. Previous Degree<input value={newCourse.required_previous_degree} onChange={e => setNewCourse({ ...newCourse, required_previous_degree: e.target.value })} placeholder="Optional" /></label>
              <label>Min Previous Grade<input value={newCourse.min_previous_grade} onChange={e => setNewCourse({ ...newCourse, min_previous_grade: e.target.value })} placeholder="Optional e.g. B" /></label>
            </div>
            <label>Syllabus<textarea value={newCourse.syllabus} onChange={e => setNewCourse({ ...newCourse, syllabus: e.target.value })} rows={3} /></label>
            <div className="prereq-picker">
              <strong>Prerequisites:</strong>
              {courses.map(c => (
                <label key={c.id} className="checkbox-label">
                  <input type="checkbox" checked={newCourse.prerequisite_ids.includes(c.id)} onChange={() => togglePrereq(c.id)} />
                  {c.code}
                </label>
              ))}
            </div>
            <button type="submit" className="btn btn-primary">Add Course</button>
          </form>
        )}

        <table className="data-table">
          <thead><tr><th>Code</th><th>Title</th><th>Dept</th><th>Level</th><th>Credits</th><th>Prerequisites</th><th>Min Grade</th></tr></thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.title}</td>
                <td>{c.department?.toUpperCase()}</td>
                <td>{c.degree_level?.toUpperCase()}</td>
                <td>{c.credits}</td>
                <td>{c.prerequisites?.map(p => p.code).join(', ') || 'None'}</td>
                <td>{c.min_previous_grade || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Create Section (assign instructor + timetable)</h2>
        <p className="muted">Only sections with instructors appear in student registration.</p>
        <form onSubmit={createSection} className="course-form">
          <div className="form-grid">
            <label>Course
              <select value={newSection.course_id} onChange={e => setNewSection({ ...newSection, course_id: e.target.value })} required>
                <option value="">Select</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </label>
            <label>Semester
              <select value={newSection.semester_id} onChange={e => setNewSection({ ...newSection, semester_id: e.target.value })} required>
                <option value="">Select</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
              </select>
            </label>
            <label>Instructor
              <select value={newSection.instructor_id} onChange={e => setNewSection({ ...newSection, instructor_id: e.target.value })} required>
                <option value="">Select</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <label>Section<input value={newSection.section_code} onChange={e => setNewSection({ ...newSection, section_code: e.target.value })} /></label>
            <label>Capacity<input type="number" value={newSection.capacity} onChange={e => setNewSection({ ...newSection, capacity: e.target.value })} /></label>
            <label>Room<input value={newSection.room} onChange={e => setNewSection({ ...newSection, room: e.target.value })} /></label>
          </div>
          <button type="submit" className="btn btn-primary">Create Section</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Instructor Teaching Preferences</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={async () => {
            const r = await api.syncSectionsFromPreferences();
            setMessage({ type: 'success', text: `Synced ${r.sections_created} new section(s) from instructor preferences` });
            load();
          }}>
            Sync Sections from Preferences
          </button>
        </div>
        <table className="data-table">
          <thead><tr><th>Instructor</th><th>Course</th><th>Day</th><th>Time</th></tr></thead>
          <tbody>
            {prefs.map(p => (
              <tr key={p.id}>
                <td>{p.instructor_name}</td>
                <td>{p.course_code}</td>
                <td>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][p.day_of_week]}</td>
                <td>{p.start_time}–{p.end_time}</td>
              </tr>
            ))}
            {prefs.length === 0 && <tr><td colSpan={4} className="muted">No preferences submitted yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
