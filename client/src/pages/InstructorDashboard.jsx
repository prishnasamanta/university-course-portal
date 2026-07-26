import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function InstructorDashboard() {
  const [sections, setSections] = useState([]);

  useEffect(() => {
    api.getInstructorSections().then(setSections);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>My Sections</h1>
        <p>Manage assessment components and enter marks</p>
      </div>

      <div className="card-grid">
        {sections.map(s => (
          <div key={s.id} className="card section-card">
            <div className="section-card-header">
              <strong>{s.course_code}</strong>
              <span className="badge">{s.section_code}</span>
            </div>
            <h3>{s.course_title}</h3>
            <p className="muted">{s.semester_name} {s.year} • {s.enrolled_count} students</p>
            <Link to={`/marks/${s.id}`} className="btn btn-primary btn-sm">Enter Marks</Link>
          </div>
        ))}
        {sections.length === 0 && <p className="muted">No sections assigned.</p>}
      </div>
    </div>
  );
}
