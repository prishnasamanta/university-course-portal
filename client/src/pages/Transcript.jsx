import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Transcript() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getTranscript().then(setData);
  }, []);

  if (!data) return <p className="muted">Loading transcript...</p>;

  const bySemester = {};
  for (const c of data.courses) {
    const key = `${c.semester_name} ${c.year}`;
    if (!bySemester[key]) bySemester[key] = [];
    bySemester[key].push(c);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Academic Transcript</h1>
        <p>Complete academic history • CGPA: <strong>{data.cgpa ?? '—'}</strong></p>
      </div>

      <div className="card transcript-print">
        <div className="transcript-header">
          <h2>Official Transcript</h2>
          <p>Cumulative GPA: {data.cgpa ?? 'N/A'}</p>
        </div>

        {Object.entries(bySemester).map(([sem, courses]) => (
          <div key={sem} className="transcript-semester">
            <h3>{sem}</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course</th>
                  <th>Credits</th>
                  <th>Grade</th>
                  <th>Grade Point</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(c => (
                  <tr key={`${sem}-${c.code}`}>
                    <td>{c.code}</td>
                    <td>{c.title}</td>
                    <td>{c.credits}</td>
                    <td>{c.letter_grade || '—'}</td>
                    <td>{c.grade_point ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
