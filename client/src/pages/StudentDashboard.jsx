import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyEnrollments()
      .then(setEnrollments)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Student Dashboard</h1>
        <p>Welcome, {profile?.roll_number || 'Student'}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Program</span>
          <strong>{profile?.program_name || '—'}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Batch</span>
          <strong>{profile?.batch_year || '—'}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Current Enrollments</span>
          <strong>{enrollments.length}</strong>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Current Registrations</h2>
          <Link to="/register" className="btn btn-primary btn-sm">Register Courses</Link>
        </div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : enrollments.length === 0 ? (
          <p className="muted">No active registrations. <Link to="/register">Browse offerings</Link></p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Section</th>
                <th>Schedule</th>
                <th>Instructor</th>
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id}>
                  <td><strong>{e.code}</strong> — {e.title}</td>
                  <td>{e.section_code}</td>
                  <td>{e.day_name} {e.start_time}–{e.end_time}</td>
                  <td>{e.instructor_name}</td>
                  <td>{e.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
