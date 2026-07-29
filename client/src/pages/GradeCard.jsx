import { useEffect, useState } from 'react';
import { api } from '../api';

const GRADE_COLORS = {
  O: '#059669', 'A+': '#0891b2', A: '#4f46e5', 'B+': '#7c3aed',
  B: '#d97706', C: '#dc2626', F: '#6b7280'
};

const STATUS_DISPLAY = {
  papers_submitted: { label: '⏳ Pending', color: '#6b7280', bg: '#f3f4f6' },
  checked_pending_verification: { label: '✅ Checked', color: '#1e40af', bg: '#dbeafe' },
  waiting_hod_approval: { label: '🏛️ HOD Review', color: '#92400e', bg: '#fef3c7' },
  ready_to_publish: { label: '✔️ Approved', color: '#065f46', bg: '#d1fae5' },
  published: { label: '🎉 Published', color: '#059669', bg: '#ecfdf5' },
  hod_rejected: { label: '❌ Revision Needed', color: '#991b1b', bg: '#fef2f2' },
};

const REQUIRED_CREDITS = 24;

export default function GradeCard() {
  const [semesters, setSemesters] = useState([]);
  const [selectedSem, setSelectedSem] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getMySemesters().then(sems => {
      if (sems.length > 0) {
        setSemesters(sems);
        setSelectedSem(String(sems[0].id));
      } else {
        api.getSemesters().then(allSems => {
          setSemesters(allSems);
          if (allSems[0]) setSelectedSem(String(allSems[0].id));
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedSem) return;
    setLoading(true);
    setData(null);
    api.getGradeCard(selectedSem)
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedSem]);

  const publishedCourses = data?.courses?.filter(c => c.show_grades) || [];
  const totalCredits = publishedCourses.reduce((s, c) => s + (c.credits || 0), 0);
  const meetsRequirement = totalCredits >= REQUIRED_CREDITS;

  return (
    <div>
      <div className="page-header">
        <h1>Grade Card</h1>
        <p>Your semester grades — requires {REQUIRED_CREDITS} credits of published results</p>
      </div>

      <div className="inline-label" style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 600 }}>Semester:</label>
        <select
          value={selectedSem}
          onChange={e => setSelectedSem(e.target.value)}
          style={{ padding:'0.5rem 0.75rem', border:'1px solid var(--border)', borderRadius:8, fontSize:'1rem' }}
        >
          {semesters.map(s => (
            <option key={s.id} value={s.id}>{s.name} {s.year}</option>
          ))}
        </select>
      </div>

      {loading && <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>Loading…</div>}

      {data && (
        <>
          {/* Credit progress bar */}
          <div className="card" style={{ marginBottom:'1rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
              <span style={{ fontWeight:600 }}>Published Credits Progress</span>
              <span style={{ fontWeight:700, color: meetsRequirement ? '#059669' : '#d97706' }}>
                {totalCredits} / {REQUIRED_CREDITS} credits
              </span>
            </div>
            <div style={{ background:'#e5e7eb', borderRadius:999, height:10, overflow:'hidden' }}>
              <div style={{
                width: `${Math.min(100, (totalCredits / REQUIRED_CREDITS) * 100)}%`,
                height:'100%',
                background: meetsRequirement ? '#059669' : '#f59e0b',
                borderRadius:999,
                transition: 'width 0.5s ease'
              }} />
            </div>
            {!meetsRequirement && (
              <p style={{ margin:'0.5rem 0 0', fontSize:'0.85rem', color:'#d97706' }}>
                ⚠️ You need at least {REQUIRED_CREDITS} credits of <strong>published</strong> results to view your complete grade card.
                Currently {REQUIRED_CREDITS - totalCredits} credits short.
              </p>
            )}
            {meetsRequirement && (
              <p style={{ margin:'0.5rem 0 0', fontSize:'0.85rem', color:'#059669' }}>
                ✅ Grade card is complete! You have {totalCredits} credits of published results.
              </p>
            )}
          </div>

          {/* SGPA / CGPA cards */}
          {meetsRequirement && (
            <div className="stats-grid" style={{ marginBottom:'1.5rem' }}>
              <div className="stat-card highlight">
                <span className="stat-label">SGPA (This Semester)</span>
                <strong style={{ fontSize:'2rem', color:'var(--primary)' }}>
                  {data.sgpa ? data.sgpa.toFixed(2) : '—'}
                </strong>
                <small style={{ color:'var(--muted)', fontSize:'0.75rem' }}>out of 10.00</small>
              </div>
              <div className="stat-card">
                <span className="stat-label">CGPA (Cumulative)</span>
                <strong style={{ fontSize:'2rem' }}>
                  {data.cgpa ? data.cgpa.toFixed(2) : '—'}
                </strong>
                <small style={{ color:'var(--muted)', fontSize:'0.75rem' }}>out of 10.00</small>
              </div>
              <div className="stat-card">
                <span className="stat-label">Credits Earned</span>
                <strong style={{ fontSize:'2rem' }}>{totalCredits}</strong>
                <small style={{ color:'var(--muted)', fontSize:'0.75rem' }}>this semester</small>
              </div>
            </div>
          )}

          {/* Grade table */}
          <div className="card">
            <div className="grade-card-header">
              <h2 style={{ margin:'0 0 0.25rem' }}>{data.semester?.name} {data.semester?.year} — Grade Card</h2>
              {meetsRequirement && data.sgpa && (
                <div style={{ fontSize:'0.9rem', color:'var(--muted)' }}>
                  SGPA: <strong style={{ color:'var(--primary)' }}>{data.sgpa.toFixed(2)}</strong>
                  &nbsp;·&nbsp;CGPA: <strong>{data.cgpa?.toFixed(2) || '—'}</strong>
                </div>
              )}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Title</th>
                  <th>Credits</th>
                  <th>Marks</th>
                  <th>Grade</th>
                  <th>Grade Point</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.courses || []).map(c => {
                  const st = STATUS_DISPLAY[c.workflow_status] || STATUS_DISPLAY.papers_submitted;
                  const gradeColor = GRADE_COLORS[c.letter_grade] || '#6b7280';
                  return (
                    <tr key={c.enrollment_id}>
                      <td><strong>{c.code}</strong></td>
                      <td>{c.title}</td>
                      <td><span className="badge">{c.credits} cr</span></td>
                      <td>
                        {c.show_grades ? (
                          <span style={{ fontWeight:600 }}>{c.exam_marks ?? c.total_percent?.toFixed(1) ?? '—'}%</span>
                        ) : '—'}
                      </td>
                      <td>
                        {c.show_grades && c.letter_grade ? (
                          <span className="grade-badge" style={{ color: gradeColor, fontSize:'1.1rem' }}>
                            {c.letter_grade}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {c.show_grades && c.grade_point != null ? (
                          <strong>{c.grade_point}</strong>
                        ) : '—'}
                      </td>
                      <td>
                        <span style={{
                          display:'inline-block', padding:'0.2rem 0.6rem', borderRadius:'999px',
                          fontSize:'0.72rem', fontWeight:700,
                          color: st.color, background: st.bg
                        }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!data.courses?.length && (
                  <tr><td colSpan={7} className="muted">No courses found for this semester</td></tr>
                )}
              </tbody>
            </table>

            {/* SGPA formula explanation */}
            {meetsRequirement && data.sgpa && (
              <div style={{ marginTop:'1rem', padding:'1rem', background:'#fafafa', borderRadius:8, fontSize:'0.85rem', color:'var(--muted)' }}>
                <strong>SGPA Calculation:</strong> SGPA = Σ(Grade Point × Credits) / Σ Credits
                &nbsp;·&nbsp;
                <strong>Grade Scale:</strong> O(90+)=10, A+(80+)=9, A(70+)=8, B+(60+)=7, B(50+)=6, C(40+)=5, F=0
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
