import { Router } from 'express';
import db from '../db/index.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import {
  forwardSectionToHod, publishSectionResults, hodReviewEnrollment, hodApproveAll, STATUS_LABELS
} from '../services/resultWorkflow.js';
import { DAY_NAMES } from '../services/registration.js';
import { computeEnrollmentGrade } from '../services/gpa.js';

const router = Router();

router.get('/sections/pending', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const sections = db.prepare(`
    SELECT DISTINCT s.id, c.code AS course_code, c.title AS course_title, s.section_code,
           sem.name AS semester_name, sem.year, u_instr.name AS instructor_name,
           (SELECT COUNT(*) FROM enrollments e
            JOIN result_workflow rw ON rw.enrollment_id = e.id
            WHERE e.section_id = s.id AND rw.status = 'checked_pending_verification') AS pending_forward,
           (SELECT COUNT(*) FROM enrollments e
            JOIN result_workflow rw ON rw.enrollment_id = e.id
            WHERE e.section_id = s.id AND rw.status = 'ready_to_publish') AS pending_publish
    FROM sections s
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN users u_instr ON u_instr.id = s.instructor_id
    WHERE s.instructor_id IS NOT NULL
    ORDER BY sem.year DESC, c.code
  `).all();
  res.json(sections);
});

router.get('/sections/:sectionId/results', authRequired, requireRoles('academic_staff', 'admin', 'dept_head'), (req, res) => {
  const section = db.prepare(`
    SELECT s.*, c.code AS course_code, c.title AS course_title, sem.name AS semester_name, sem.year
    FROM sections s JOIN courses c ON c.id = s.course_id JOIN semesters sem ON sem.id = s.semester_id
    WHERE s.id = ?
  `).get(req.params.sectionId);

  const students = db.prepare(`
    SELECT e.id AS enrollment_id, st.roll_number, u.name AS student_name,
           cr.marks, rw.status AS workflow_status, rw.hod_decision,
           eg.letter_grade, eg.total_percent, eg.grade_point
    FROM enrollments e
    JOIN students st ON st.id = e.student_id
    JOIN users u ON u.id = st.user_id
    LEFT JOIN course_results cr ON cr.enrollment_id = e.id
    LEFT JOIN result_workflow rw ON rw.enrollment_id = e.id
    LEFT JOIN enrollment_grades eg ON eg.enrollment_id = e.id
    WHERE e.section_id = ? AND e.status IN ('registered', 'completed')
    ORDER BY st.roll_number
  `).all(req.params.sectionId);

  res.json({
    section,
    students: students.map(s => ({
      ...s,
      status_label: STATUS_LABELS[s.workflow_status] || STATUS_LABELS.papers_submitted
    }))
  });
});

router.post('/sections/:sectionId/forward-hod', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const result = forwardSectionToHod(req.params.sectionId, req.user.id);
  res.json(result);
});

router.post('/sections/:sectionId/publish', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const result = publishSectionResults(req.params.sectionId, req.user.id);
  res.json(result);
});

router.get('/dept-head/courses', authRequired, requireRoles('dept_head', 'admin'), (req, res) => {
  const courses = db.prepare(`
    SELECT DISTINCT c.id, c.code, c.title, c.department, c.degree_level, c.credits,
           sem.id AS semester_id, sem.name AS semester_name, sem.year,
           s.id AS section_id, s.section_code, u_instr.name AS instructor_name,
           (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status IN ('registered','completed')) AS student_count,
           (SELECT COUNT(*) FROM enrollments e
            JOIN result_workflow rw ON rw.enrollment_id = e.id
            WHERE e.section_id = s.id AND rw.status = 'waiting_hod_approval') AS pending_hod
    FROM courses c
    JOIN sections s ON s.course_id = c.id
    JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN users u_instr ON u_instr.id = s.instructor_id
    WHERE s.instructor_id IS NOT NULL
    ORDER BY sem.year DESC, c.code
  `).all();
  res.json(courses);
});

router.post('/enrollments/:enrollmentId/hod-approve', authRequired, requireRoles('dept_head', 'admin'), (req, res) => {
  const result = hodReviewEnrollment(Number(req.params.enrollmentId), 'approved', req.user.id);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post('/enrollments/:enrollmentId/hod-reject', authRequired, requireRoles('dept_head', 'admin'), (req, res) => {
  const result = hodReviewEnrollment(Number(req.params.enrollmentId), 'rejected', req.user.id);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post('/sections/:sectionId/hod-approve-all', authRequired, requireRoles('dept_head', 'admin'), (req, res) => {
  res.json(hodApproveAll(req.params.sectionId, req.user.id));
});

// GET /api/workflow/exam-requests — staff sees all sections where instructor requested exam
router.get('/exam-requests', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT s.id AS section_id, s.section_code, s.exam_requested, s.exam_reg_open,
           c.code AS course_code, c.title AS course_title, c.degree_level,
           sem.name AS semester_name, sem.year,
           u_instr.name AS instructor_name,
           (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status = 'registered') AS enrolled_count,
           (SELECT COUNT(*) FROM exam_registrations er JOIN enrollments e ON e.id = er.enrollment_id WHERE e.section_id = s.id) AS exam_registered_count
    FROM sections s
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN users u_instr ON u_instr.id = s.instructor_id
    WHERE s.exam_requested = 1 OR s.exam_reg_open = 1
    ORDER BY sem.year DESC, c.code
  `).all();
  res.json(rows);
});

// POST /api/workflow/sections/:sectionId/open-exam-reg — staff opens exam registration
router.post('/sections/:sectionId/open-exam-reg', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  db.prepare('UPDATE sections SET exam_reg_open = 1 WHERE id = ?').run(req.params.sectionId);
  res.json({ ok: true });
});

// POST /api/workflow/sections/:sectionId/close-exam-reg — staff closes exam registration
router.post('/sections/:sectionId/close-exam-reg', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  db.prepare('UPDATE sections SET exam_reg_open = 0 WHERE id = ?').run(req.params.sectionId);
  res.json({ ok: true });
});

// GET /api/workflow/sections/:sectionId/exam-registrations — staff sees who registered/didn't
router.get('/sections/:sectionId/exam-registrations', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const enrolled = db.prepare(`
    SELECT e.id AS enrollment_id, st.roll_number, u.name AS student_name,
           er.id AS exam_reg_id, er.registered_at
    FROM enrollments e
    JOIN students st ON st.id = e.student_id
    JOIN users u ON u.id = st.user_id
    LEFT JOIN exam_registrations er ON er.enrollment_id = e.id
    WHERE e.section_id = ? AND e.status = 'registered'
    ORDER BY st.roll_number
  `).all(req.params.sectionId);
  res.json(enrolled);
});

// GET /api/workflow/users — Admin/Staff lists all database users
router.get('/users', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.created_at,
           st.roll_number, st.id AS student_id, p.code AS program_code,
           u.employee_id, u.department
    FROM users u
    LEFT JOIN students st ON st.user_id = u.id
    LEFT JOIN programs p ON p.id = st.program_id
    ORDER BY u.role, u.name
  `).all();
  res.json(users);
});

// DELETE /api/workflow/users/:userId — Admin purges a user from DB via CASCADE
router.delete('/users/:userId', authRequired, requireRoles('admin', 'academic_staff'), (req, res) => {
  const targetId = req.params.userId;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin' && String(req.user.id) !== String(user.id)) {
    return res.status(403).json({ error: 'Cannot delete admin account' });
  }

  // Delete user from DB — CASCADE foreign keys cleanly purge student/instructor, enrollments, marks
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ ok: true, deleted_id: targetId });
});

// PUT /api/workflow/courses/:courseId — Staff edits course details (code, title, credits, syllabus, etc.)
router.put('/courses/:courseId', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const { code, title, credits, department, degree_level, min_previous_grade, syllabus } = req.body;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  db.prepare(`
    UPDATE courses
    SET code = ?, title = ?, credits = ?, department = ?, degree_level = ?,
        min_previous_grade = ?, syllabus = ?
    WHERE id = ?
  `).run(
    code || course.code,
    title || course.title,
    credits != null ? Number(credits) : course.credits,
    department || course.department,
    degree_level || course.degree_level,
    min_previous_grade !== undefined ? min_previous_grade : course.min_previous_grade,
    syllabus !== undefined ? syllabus : course.syllabus,
    course.id
  );

  res.json({ ok: true });
});

// POST /api/workflow/sections/:sectionId/timetable — Staff edits section room and multi-day schedule slots
router.post('/sections/:sectionId/timetable', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const { room, slots } = req.body;
  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(req.params.sectionId);
  if (!section) return res.status(404).json({ error: 'Section not found' });

  if (room !== undefined) {
    db.prepare('UPDATE sections SET room = ? WHERE id = ?').run(room, section.id);
  }

  if (Array.isArray(slots)) {
    db.prepare('DELETE FROM section_schedule_slots WHERE section_id = ?').run(section.id);
    const ins = db.prepare('INSERT INTO section_schedule_slots (section_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)');
    for (const slot of slots) {
      if (slot.day_of_week != null && slot.start_time && slot.end_time) {
        ins.run(section.id, Number(slot.day_of_week), slot.start_time, slot.end_time);
      }
    }
  }

  res.json({ ok: true });
});

// DELETE /api/workflow/courses/:courseId — Staff/Admin deletes a course from database
router.delete('/courses/:courseId', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  db.prepare('DELETE FROM courses WHERE id = ?').run(course.id);
  res.json({ ok: true, deleted_id: course.id });
});

// ==========================================
// --- PAPER REVIEW WORKFLOW ENDPOINTS ---
// ==========================================

// 1. Student requests paper review
router.post('/paper-review/request', authRequired, requireRoles('student'), (req, res) => {
  const { enrollment_id, mark_id, reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason is required' });

  let markId = mark_id;
  let oldValue = null;

  if (!markId && enrollment_id) {
    let mark = db.prepare('SELECT * FROM marks WHERE enrollment_id = ? LIMIT 1').get(enrollment_id);
    if (!mark) {
      const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(enrollment_id);
      if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

      let comp = db.prepare('SELECT * FROM assessment_components WHERE section_id = ? LIMIT 1').get(enrollment.section_id);
      if (!comp) {
        const cRes = db.prepare('INSERT INTO assessment_components (section_id, name, max_marks, weight_percent) VALUES (?, ?, ?, ?)').run(enrollment.section_id, 'Final Exam', 100, 100);
        comp = { id: cRes.lastInsertRowid };
      }
      const cr = db.prepare('SELECT marks FROM course_results WHERE enrollment_id = ?').get(enrollment_id);
      oldValue = cr ? cr.marks : null;

      const mRes = db.prepare('INSERT INTO marks (enrollment_id, component_id, marks_obtained, entered_by) VALUES (?, ?, ?, ?)').run(enrollment_id, comp.id, oldValue, req.user.id);
      markId = mRes.lastInsertRowid;
    } else {
      markId = mark.id;
      oldValue = mark.marks_obtained;
    }
  } else if (markId) {
    const mark = db.prepare('SELECT * FROM marks WHERE id = ?').get(markId);
    if (mark) oldValue = mark.marks_obtained;
  }

  if (!markId) return res.status(400).json({ error: 'Enrollment or mark required' });

  try {
    const result = db.prepare(`
      INSERT INTO marks_revision_requests (mark_id, requested_by, reason, old_value, status, created_at)
      VALUES (?, ?, ?, ?, 'pending_staff_review', datetime('now'))
    `).run(markId, req.user.id, reason, oldValue);

    res.status(201).json({ ok: true, request_id: result.lastInsertRowid, status: 'pending_staff_review' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to submit review request' });
  }
});

// 2. Student views their paper review requests
router.get('/paper-review/my-requests', authRequired, requireRoles('student'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS request_id, r.reason, r.old_value, r.new_value, r.status, r.instructor_remarks,
           r.created_at, r.reviewed_at,
           c.code AS course_code, c.title AS course_title,
           u_instr.name AS instructor_name
    FROM marks_revision_requests r
    JOIN marks m ON m.id = r.mark_id
    JOIN enrollments e ON e.id = m.enrollment_id
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN users u_instr ON u_instr.id = s.instructor_id
    WHERE r.requested_by = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id);

  res.json(rows);
});

// 3. Academic Staff views pending/all paper review requests
router.get('/paper-review/staff-requests', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS request_id, r.reason, r.old_value, r.new_value, r.status, r.instructor_remarks,
           r.created_at, r.reviewed_at,
           u_stu.name AS student_name, st.roll_number,
           c.code AS course_code, c.title AS course_title,
           u_instr.id AS instructor_id, u_instr.name AS instructor_name,
           u_fw.name AS forwarded_by_name
    FROM marks_revision_requests r
    JOIN marks m ON m.id = r.mark_id
    JOIN enrollments e ON e.id = m.enrollment_id
    JOIN students st ON st.id = e.student_id
    JOIN users u_stu ON u_stu.id = st.user_id
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN users u_instr ON u_instr.id = s.instructor_id
    LEFT JOIN users u_fw ON u_fw.id = r.forwarded_by
    ORDER BY r.created_at DESC
  `).all();

  res.json(rows);
});

// 4. Academic Staff forwards review request to instructor
router.post('/paper-review/:requestId/forward', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const request = db.prepare('SELECT * FROM marks_revision_requests WHERE id = ?').get(req.params.requestId);
  if (!request) return res.status(404).json({ error: 'Review request not found' });

  db.prepare(`
    UPDATE marks_revision_requests
    SET status = 'forwarded_to_instructor', forwarded_by = ?
    WHERE id = ?
  `).run(req.user.id, request.id);

  res.json({ ok: true, status: 'forwarded_to_instructor' });
});

// 5. Instructor views review requests forwarded to them
router.get('/paper-review/instructor-requests', authRequired, requireRoles('instructor'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS request_id, r.reason, r.old_value, r.new_value, r.status, r.instructor_remarks,
           r.created_at,
           u_stu.name AS student_name, st.roll_number,
           c.code AS course_code, c.title AS course_title
    FROM marks_revision_requests r
    JOIN marks m ON m.id = r.mark_id
    JOIN enrollments e ON e.id = m.enrollment_id
    JOIN students st ON st.id = e.student_id
    JOIN users u_stu ON u_stu.id = st.user_id
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    WHERE s.instructor_id = ? AND r.status IN ('forwarded_to_instructor', 'instructor_rechecked')
    ORDER BY r.created_at DESC
  `).all(req.user.id);

  res.json(rows);
});

// 6. Instructor re-checks paper and updates marks
router.post('/paper-review/:requestId/recheck', authRequired, requireRoles('instructor'), (req, res) => {
  const { new_value, instructor_remarks } = req.body;
  if (new_value === undefined || new_value === null) {
    return res.status(400).json({ error: 'new_value is required' });
  }

  const request = db.prepare('SELECT * FROM marks_revision_requests WHERE id = ?').get(req.params.requestId);
  if (!request) return res.status(404).json({ error: 'Review request not found' });

  db.prepare(`
    UPDATE marks_revision_requests
    SET new_value = ?, instructor_remarks = ?, status = 'instructor_rechecked'
    WHERE id = ?
  `).run(Number(new_value), instructor_remarks || null, request.id);

  res.json({ ok: true, status: 'instructor_rechecked' });
});

// 7. Academic Staff finalizes review request (approve/reject)
router.post('/paper-review/:requestId/finalize', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const { decision } = req.body;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approve or reject' });
  }

  const request = db.prepare('SELECT * FROM marks_revision_requests WHERE id = ?').get(req.params.requestId);
  if (!request) return res.status(404).json({ error: 'Review request not found' });

  const finalStatus = decision === 'approve' ? 'approved' : 'rejected';

  db.prepare(`
    UPDATE marks_revision_requests
    SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(finalStatus, req.user.id, request.id);

  if (decision === 'approve' && request.new_value !== null && request.new_value !== undefined) {
    db.prepare('UPDATE marks SET marks_obtained = ?, finalized = 1 WHERE id = ?').run(request.new_value, request.mark_id);

    const mark = db.prepare('SELECT enrollment_id FROM marks WHERE id = ?').get(request.mark_id);
    if (mark) {
      db.prepare(`
        INSERT INTO course_results (enrollment_id, marks, entered_by, entered_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(enrollment_id) DO UPDATE SET marks = excluded.marks, entered_at = datetime('now')
      `).run(mark.enrollment_id, request.new_value, req.user.id);

      computeEnrollmentGrade(mark.enrollment_id);
    }
  }

  res.json({ ok: true, status: finalStatus });
});

export default router;
