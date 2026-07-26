import db from '../db/index.js';
import { percentToGrade } from './gpa.js';

export const STATUS_LABELS = {
  papers_submitted: 'Papers submitted',
  checked_pending_verification: 'Checked but to be verified',
  waiting_hod_approval: 'Waiting for HOD approval',
  ready_to_publish: 'Grade card ready yet to be publish',
  published: 'Published',
  hod_rejected: 'Rejected by HOD — pending revision'
};

export function ensureWorkflow(enrollmentId) {
  const existing = db.prepare('SELECT enrollment_id FROM result_workflow WHERE enrollment_id = ?').get(enrollmentId);
  if (!existing) {
    db.prepare(`INSERT INTO result_workflow (enrollment_id, status) VALUES (?, 'papers_submitted')`).run(enrollmentId);
  }
}

export function saveCourseResult(enrollmentId, marks, userId) {
  if (marks < 0 || marks > 100) {
    return { ok: false, reason: 'Marks must be between 0 and 100' };
  }

  const enrollment = db.prepare(`
    SELECT e.*, sem.exams_completed
    FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    JOIN semesters sem ON sem.id = s.semester_id
    WHERE e.id = ?
  `).get(enrollmentId);

  if (!enrollment) return { ok: false, reason: 'Enrollment not found' };
  if (!enrollment.exams_completed) {
    return { ok: false, reason: 'Exams not marked complete yet by Academic Staff' };
  }

  ensureWorkflow(enrollmentId);

  db.prepare(`
    INSERT INTO course_results (enrollment_id, marks, entered_by, entered_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(enrollment_id) DO UPDATE SET
      marks = excluded.marks,
      entered_by = excluded.entered_by,
      entered_at = datetime('now')
  `).run(enrollmentId, marks, userId);

  db.prepare(`
    UPDATE result_workflow
    SET status = 'checked_pending_verification', hod_decision = 'pending',
        updated_at = datetime('now'), updated_by = ?
    WHERE enrollment_id = ?
  `).run(userId, enrollmentId);

  return { ok: true };
}

export function forwardSectionToHod(sectionId, userId) {
  const enrollments = db.prepare(`
    SELECT e.id FROM enrollments e
    JOIN result_workflow rw ON rw.enrollment_id = e.id
    WHERE e.section_id = ? AND e.status IN ('registered', 'completed')
      AND rw.status = 'checked_pending_verification'
  `).all(sectionId);

  const update = db.prepare(`
    UPDATE result_workflow
    SET status = 'waiting_hod_approval', updated_at = datetime('now'), updated_by = ?
    WHERE enrollment_id = ?
  `);

  for (const e of enrollments) update.run(userId, e.id);
  return { ok: true, forwarded: enrollments.length };
}

export function hodReviewEnrollment(enrollmentId, decision, userId) {
  const wf = db.prepare('SELECT * FROM result_workflow WHERE enrollment_id = ?').get(enrollmentId);
  if (!wf || wf.status !== 'waiting_hod_approval') {
    return { ok: false, reason: 'Enrollment not awaiting HOD approval' };
  }

  if (decision === 'approved') {
    db.prepare(`
      UPDATE result_workflow
      SET status = 'ready_to_publish', hod_decision = 'approved',
          updated_at = datetime('now'), updated_by = ?
      WHERE enrollment_id = ?
    `).run(userId, enrollmentId);
  } else {
    db.prepare(`
      UPDATE result_workflow
      SET status = 'hod_rejected', hod_decision = 'rejected',
          updated_at = datetime('now'), updated_by = ?
      WHERE enrollment_id = ?
    `).run(userId, enrollmentId);
  }

  return { ok: true, decision };
}

export function hodApproveAll(sectionId, userId) {
  const enrollments = db.prepare(`
    SELECT e.id FROM enrollments e
    JOIN result_workflow rw ON rw.enrollment_id = e.id
    WHERE e.section_id = ? AND rw.status = 'waiting_hod_approval'
  `).all(sectionId);

  for (const e of enrollments) hodReviewEnrollment(e.id, 'approved', userId);
  return { ok: true, approved: enrollments.length };
}

export function publishSectionResults(sectionId, userId) {
  const enrollments = db.prepare(`
    SELECT e.id, cr.marks
    FROM enrollments e
    JOIN result_workflow rw ON rw.enrollment_id = e.id
    LEFT JOIN course_results cr ON cr.enrollment_id = e.id
    WHERE e.section_id = ? AND rw.status = 'ready_to_publish'
  `).all(sectionId);

  for (const e of enrollments) {
    if (e.marks == null) continue;
    const grade = percentToGrade(e.marks);
    db.prepare(`
      INSERT INTO enrollment_grades (enrollment_id, total_percent, letter_grade, grade_point, computed_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(enrollment_id) DO UPDATE SET
        total_percent = excluded.total_percent,
        letter_grade = excluded.letter_grade,
        grade_point = excluded.grade_point,
        computed_at = datetime('now')
    `).run(e.id, e.marks, grade.letter_grade, grade.grade_point);

    db.prepare(`
      UPDATE result_workflow
      SET status = 'published', updated_at = datetime('now'), updated_by = ?
      WHERE enrollment_id = ?
    `).run(userId, e.id);

    db.prepare("UPDATE enrollments SET status = 'completed' WHERE id = ?").run(e.id);
  }

  return { ok: true, published: enrollments.length };
}

export function getWorkflowStatus(enrollmentId) {
  ensureWorkflow(enrollmentId);
  const wf = db.prepare('SELECT * FROM result_workflow WHERE enrollment_id = ?').get(enrollmentId);
  return {
    status: wf.status,
    label: STATUS_LABELS[wf.status] || wf.status,
    hod_decision: wf.hod_decision
  };
}
