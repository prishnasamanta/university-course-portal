import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];

const TIME_SLOTS = [
  { start: '09:00', end: '11:00', label: '9:00 AM – 11:00 AM' },
  { start: '11:00', end: '13:00', label: '11:00 AM – 1:00 PM' },
  { start: '14:00', end: '16:00', label: '2:00 PM – 4:00 PM' },
  { start: '16:00', end: '18:00', label: '4:00 PM – 6:00 PM' },
];

export default function InstructorProfileOverlay({ onComplete }) {
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState('welcome');
  const [courses, setCourses] = useState([]);
  const [activeSemesterId, setActiveSemesterId] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [availability, setAvailability] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.getInstructorAvailableCourses(), api.getSemesters()])
      .then(([crs, sems]) => {
        setCourses(crs);
        const active = sems.find(s => s.is_active || s.registration_open) || sems[0];
        if (active) setActiveSemesterId(active.id);
      });
  }, []);

  const toggleCourse = (courseId) => {
    setSelectedCourses(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const setCourseSlot = (courseId, day, slot) => {
    setAvailability(prev => ({
      ...prev,
      [courseId]: { day_of_week: day, start_time: slot.start, end_time: slot.end }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (selectedCourses.length === 0) {
      setError('Select at least one course to teach');
      return;
    }

    const preferences = selectedCourses.map(courseId => {
      const slot = availability[courseId];
      if (!slot) return null;
      return { course_id: courseId, semester_id: activeSemesterId, ...slot };
    }).filter(Boolean);

    if (preferences.length !== selectedCourses.length) {
      setError('Set day and 2-hour time slot for each selected course');
      return;
    }

    setSaving(true);
    try {
      await api.saveInstructorProfile(preferences);
      await refreshProfile();
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay profile-overlay">
      <div className="modal profile-modal wide">
        {step === 'welcome' ? (
          <>
            <div className="profile-modal-header center">
              <span className="brand-icon large">👨‍🏫</span>
              <h2>Instructor Setup</h2>
              <p className="muted">Select courses from the academic catalog and set your available teaching days and 2-hour time slots.</p>
            </div>
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => setStep('form')}>
              Add Teaching Details
            </button>
          </>
        ) : (
          <>
            <div className="profile-modal-header">
              <span className="brand-icon">👨‍🏫</span>
              <h2>Teaching Preferences</h2>
              <p className="muted">Courses are listed by Academic Staff. Pick a day and 2-hour slot — Mon–Wed (or adjacent days) will be generated for students to choose from.</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="course-pick-grid">
                {courses.map(c => (
                  <div key={c.id} className={`course-pick-card ${selectedCourses.includes(c.id) ? 'selected' : ''}`}>
                    <label className="course-pick-label">
                      <input
                        type="checkbox"
                        checked={selectedCourses.includes(c.id)}
                        onChange={() => toggleCourse(c.id)}
                      />
                      <div>
                        <strong>{c.code}</strong> — {c.title}
                        <small className="muted">{c.department?.toUpperCase()} • {c.degree_level?.toUpperCase()}</small>
                      </div>
                    </label>

                    {selectedCourses.includes(c.id) && (
                      <div className="slot-picker">
                        <select
                          value={availability[c.id]?.day_of_week ?? ''}
                          onChange={e => {
                            const day = Number(e.target.value);
                            const slot = availability[c.id] || TIME_SLOTS[0];
                            setCourseSlot(c.id, day, slot);
                          }}
                        >
                          <option value="">Select day</option>
                          {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                        <select
                          value={availability[c.id] ? `${availability[c.id].start_time}-${availability[c.id].end_time}` : ''}
                          onChange={e => {
                            const slot = TIME_SLOTS.find(s => `${s.start}-${s.end}` === e.target.value);
                            const day = availability[c.id]?.day_of_week || 1;
                            if (slot) setCourseSlot(c.id, day, slot);
                          }}
                        >
                          <option value="">Select 2-hour slot</option>
                          {TIME_SLOTS.map(s => (
                            <option key={s.label} value={`${s.start}-${s.end}`}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setStep('welcome')}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
