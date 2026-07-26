import db from '../db/index.js';
import { ensureWorkflow, STATUS_LABELS } from './resultWorkflow.js';

export function getGradingPolicy() {
  return db.prepare('SELECT * FROM grading_policy ORDER BY min_percent DESC').all();
}

export function percentToGrade(percent) {
  const policy = getGradingPolicy();
  for (const row of policy) {
    if (percent >= row.min_percent) {
      return { letter_grade: row.letter_grade, grade_point: row.grade_point };
    }
  }
  return { letter_grade: 'F', grade_point: 0 };
}

export function computeEnrollmentGrade(enrollmentId) {
  const components = db.prepare(`
    SELECT ac.max_marks, ac.weight_percent, m.marks_obtained
    FROM assessment_components ac
    JOIN marks m ON m.component_id = ac.id
    JOIN enrollments e ON e.id = m.enrollment_id
    JOIN sections s ON s.id = e.section_id
    WHERE m.enrollment_id = ? AND s.id = ac.section_id
  `).all(enrollmentId);

  if (components.length === 0) return null;

  const allEntered = components.every(c => c.marks_obtained !== null);
  if (!allEntered) return null;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of components) {
    const pct = (c.marks_obtained / c.max_marks) * 100;
    weightedSum += pct * (c.weight_percent / 100);
    totalWeight += c.weight_percent;
  }

  const totalPercent = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
  const grade = percentToGrade(totalPercent);

  db.prepare(`
    INSERT INTO enrollment_grades (enrollment_id, total_percent, letter_grade, grade_point, computed_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(enrollment_id) DO UPDATE SET
      total_percent = excluded.total_percent,
      letter_grade = excluded.letter_grade,
      grade_point = excluded.grade_point,
      computed_at = datetime('now')
  `).run(enrollmentId, totalPercent, grade.letter_grade, grade.grade_point);

  return { total_percent: totalPercent, ...grade };
}

export function computeSemesterGPA(studentId, semesterId) {
  const rows = db.prepare(`
    SELECT c.credits, eg.grade_point
    FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    JOIN enrollment_grades eg ON eg.enrollment_id = e.id
    WHERE e.student_id = ? AND s.semester_id = ? AND e.status = 'completed'
      AND eg.grade_point IS NOT NULL
  `).all(studentId, semesterId);

  if (rows.length === 0) return null;

  let points = 0;
  let credits = 0;
  for (const r of rows) {
    points += r.grade_point * r.credits;
    credits += r.credits;
  }
  return credits > 0 ? Math.round((points / credits) * 100) / 100 : null;
}

export function computeCGPA(studentId) {
  const rows = db.prepare(`
    SELECT c.credits, eg.grade_point
    FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    JOIN enrollment_grades eg ON eg.enrollment_id = e.id
    WHERE e.student_id = ? AND e.status = 'completed' AND eg.grade_point IS NOT NULL
  `).all(studentId);

  if (rows.length === 0) return null;

  let points = 0;
  let credits = 0;
  for (const r of rows) {
    points += r.grade_point * r.credits;
    credits += r.credits;
  }
  return credits > 0 ? Math.round((points / credits) * 100) / 100 : null;
}

export function getTranscript(studentId) {
  return db.prepare(`
    SELECT sem.name AS semester_name, sem.year, c.code, c.title, c.credits,
           eg.letter_grade, eg.grade_point, eg.total_percent
    FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    JOIN semesters sem ON sem.id = s.semester_id
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN enrollment_grades eg ON eg.enrollment_id = e.id
    WHERE e.student_id = ? AND e.status IN ('completed', 'registered')
    ORDER BY sem.year, sem.name, c.code
  `).all(studentId);
}

export function getGradeCard(studentId, semesterId) {
  const courses = db.prepare(`
    SELECT e.id AS enrollment_id, c.code, c.title, c.credits, eg.letter_grade, eg.grade_point, eg.total_percent,
           s.section_code, cr.marks AS exam_marks, rw.status AS workflow_status
    FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN enrollment_grades eg ON eg.enrollment_id = e.id
    LEFT JOIN course_results cr ON cr.enrollment_id = e.id
    LEFT JOIN result_workflow rw ON rw.enrollment_id = e.id
    WHERE e.student_id = ? AND s.semester_id = ? AND e.status != 'dropped'
    ORDER BY c.code
  `).all(studentId, semesterId);

  const semester = db.prepare('SELECT * FROM semesters WHERE id = ?').get(semesterId);
  const sgpa = computeSemesterGPA(studentId, semesterId);
  const cgpa = computeCGPA(studentId);

  const mapped = courses.map(c => {
    if (!c.workflow_status) {
      ensureWorkflow(c.enrollment_id);
      c.workflow_status = 'papers_submitted';
    }
    const published = c.workflow_status === 'published';
    return {
      ...c,
      status_label: STATUS_LABELS[c.workflow_status] || STATUS_LABELS.papers_submitted,
      total_percent: published ? c.total_percent : null,
      letter_grade: published ? c.letter_grade : null,
      grade_point: published ? c.grade_point : null,
      show_grades: published
    };
  });

  return { semester, courses: mapped, sgpa, cgpa };
}
