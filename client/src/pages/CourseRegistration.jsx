import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const DEGREE_LABELS = { btech: 'B.Tech', msc: 'M.Sc', mtech: 'M.Tech' };

export default function CourseRegistration() {
  const { profile } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [offerings, setOfferings] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseDetail, setCourseDetail] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.getSemesters(), api.getMyEnrollments()])
      .then(([sems, enr]) => {
        setSemesters(sems);
        setEnrollments(enr);
        const current = profile?.current_semester_id
          ? String(profile.current_semester_id)
          : String(sems.find(s => s.registration_open)?.id || sems[0]?.id || '');
        setSelectedSemester(current);
      });
  }, [profile?.current_semester_id]);

  useEffect(() => {
    if (!selectedSemester) return;
    api.getOfferings(selectedSemester).then(setOfferings);
  }, [selectedSemester]);

  const uniqueCourses = offerings.reduce((acc, o) => {
    if (!acc.find(c => c.course_id === o.course_id)) {
      acc.push({
        course_id: o.course_id,
        course_code: o.course_code,
        course_title: o.course_title,
        credits: o.credits,
        department: o.department,
        degree_level: o.degree_level,
        instructor_name: o.instructor_name,
        section_count: offerings.filter(x => x.course_id === o.course_id).length
      });
    }
    return acc;
  }, []);

  const openCourse = async (courseId) => {
    setSelectedCourse(courseId);
    setSelectedSection(null);
    setSelectedSlot(null);
    const detail = await api.getCourseDetail(courseId, selectedSemester);
    setCourseDetail(detail);
  };

  const closeModal = () => {
    setSelectedCourse(null);
    setCourseDetail(null);
    setSelectedSection(null);
    setSelectedSlot(null);
  };

  const handleRegister = async () => {
    if (!selectedSection || !selectedSlot) {
      setMessage({ type: 'error', text: 'Select a section and preferred day/time slot' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const validation = await api.validateRegistration(selectedSection.id, selectedSlot.id);
      if (!validation.ok) {
        setMessage({ type: 'error', text: validation.reason + (validation.missing ? `: ${validation.missing.map(m => m.code).join(', ')}` : '') });
        return;
      }
      await api.registerCourse(selectedSection.id, selectedSlot.id);
      setMessage({ type: 'success', text: `Registered for ${courseDetail.code} on ${selectedSlot.day_name}!` });
      setEnrollments(await api.getMyEnrollments());
      closeModal();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const isEnrolledInCourse = (courseId) =>
    enrollments.some(e => offerings.find(o => o.id === e.section_id)?.course_id === courseId);

  const studentDegreeLevel = (() => {
    const code = (profile?.program_code || '').toLowerCase();
    const name = (profile?.program_name || '').toLowerCase();
    if (code.includes('btech') || name.includes('b.tech')) return 'btech';
    if (code.includes('mtech') || name.includes('m.tech')) return 'mtech';
    if (code.includes('msc') || name.includes('m.sc')) return 'msc';
    return 'btech'; // default fallback
  })();

  const [degreeFilter, setDegreeFilter] = useState('mine'); // 'mine' | 'all'

  const displayedCourses = uniqueCourses.filter(c => {
    if (degreeFilter === 'mine') {
      return c.degree_level === studentDegreeLevel;
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h1>Course Registration</h1>
        <p>Browse available courses, view schedules & prerequisites, pick your preferred day</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
        <label className="inline-label">
          Semester
          <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.year} {profile?.current_semester_id === s.id ? '(Your current)' : ''}
                {s.registration_open ? ' — Open' : ' — Closed'}
              </option>
            ))}
          </select>
        </label>

        {/* Degree Filter Tabs */}
        <div className="admin-tabs" style={{ margin:0, borderBottom:'none' }}>
          <button
            type="button"
            className={`admin-tab ${degreeFilter === 'mine' ? 'active' : ''}`}
            onClick={() => setDegreeFilter('mine')}
          >
            🎓 {DEGREE_LABELS[studentDegreeLevel] || 'Your Degree'} Courses
          </button>
          <button
            type="button"
            className={`admin-tab ${degreeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setDegreeFilter('all')}
          >
            🌐 All Programs
          </button>
        </div>
      </div>

      <div className="card-grid">
        {displayedCourses.map(c => (
          <div key={c.course_id} className="card course-card" onClick={() => openCourse(c.course_id)}>
            <div className="course-card-top">
              <span className="badge dept">{c.department?.toUpperCase()}</span>
              <span className="badge" style={{ background: c.degree_level === studentDegreeLevel ? '#eef2ff' : '#f3f4f6', color: c.degree_level === studentDegreeLevel ? 'var(--primary)' : 'var(--muted)' }}>
                {DEGREE_LABELS[c.degree_level] || c.degree_level}
              </span>
            </div>
            <h3>{c.course_code}</h3>
            <p>{c.course_title}</p>
            <p className="muted">{c.credits} credits • {c.instructor_name}</p>
            {isEnrolledInCourse(c.course_id) && <span className="badge success">Enrolled</span>}
            <button type="button" className="btn btn-outline btn-sm">View Details →</button>
          </div>
        ))}
        {displayedCourses.length === 0 && (
          <div className="card" style={{ gridColumn:'1/-1', textAlign:'center', padding:'2rem', color:'var(--muted)' }}>
            <p>No {DEGREE_LABELS[studentDegreeLevel]} courses found for this semester.</p>
            <button type="button" className="btn btn-outline btn-sm" style={{ marginTop:'0.5rem' }} onClick={() => setDegreeFilter('all')}>
              Show All University Courses
            </button>
          </div>
        )}
      </div>

      {selectedCourse && courseDetail && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal course-detail-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeModal}>×</button>
            <h2>{courseDetail.code} — {courseDetail.title}</h2>
            <div className="detail-meta">
              <span className="badge">{courseDetail.department?.toUpperCase()}</span>
              <span className="badge">{DEGREE_LABELS[courseDetail.degree_level]}</span>
              <span>{courseDetail.credits} credits</span>
            </div>

            <section className="detail-section">
              <h3>Syllabus</h3>
              <p>{courseDetail.syllabus || courseDetail.description || '—'}</p>
            </section>

            <section className="detail-section">
              <h3>Requirements</h3>
              <ul className="req-list">
                <li><strong>Prerequisites:</strong> {courseDetail.prerequisites?.length ? courseDetail.prerequisites.map(p => p.code).join(', ') : 'None (0 prerequisites)'}</li>
                <li><strong>Previous Degree:</strong> {courseDetail.required_previous_degree || 'Any'}</li>
                <li><strong>Min Previous Grade:</strong> {courseDetail.min_previous_grade || 'Any'}</li>
              </ul>
            </section>

            {courseDetail.sections?.map(sec => (
              <section key={sec.id} className="detail-section section-block">
                <h3>Section {sec.section_code} — {sec.instructor_name}</h3>
                <p className="muted">Seats: {sec.enrolled_count}/{sec.capacity}</p>
                <div className="schedule-grid">
                  {sec.schedule_slots?.map(slot => (
                    <button
                      key={slot.id}
                      type="button"
                      className={`slot-btn ${!slot.available ? 'clash' : ''} ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                      disabled={!slot.available || isEnrolledInCourse(courseDetail.id)}
                      onClick={() => { setSelectedSection(sec); setSelectedSlot(slot); }}
                      title={slot.clash_reason || ''}
                    >
                      <strong>{slot.day_name}</strong>
                      <span>{slot.start_time} – {slot.end_time}</span>
                      {!slot.available && <small>Clash!</small>}
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {selectedSlot && (
              <div className="alert alert-info">
                Selected: <strong>{selectedSlot.day_name}</strong> {selectedSlot.start_time}–{selectedSlot.end_time}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || !selectedSlot || isEnrolledInCourse(courseDetail.id)}
                onClick={handleRegister}
              >
                {loading ? 'Registering...' : 'Register for Selected Day'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
