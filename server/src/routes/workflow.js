import { Router } from 'express';
import db from '../db/index.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import {
  forwardSectionToHod, publishSectionResults, hodReviewEnrollment, hodApproveAll, STATUS_LABELS
} from '../services/resultWorkflow.js';
import { DAY_NAMES } from '../services/registration.js';

const router = Router();

router.get('/sections/pending', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const sections = db.prepare(`
    SELECT DISTINCT s.id, c.code AS course_code, c.title AS course_title, s.section_code,
           sem.name AS semester_name, sem.year, u.name AS instructor_name,
           (SELECT COUNT(*) FROM enrollments e
            JOIN result_workflow rw ON rw.enrollment_id = e.id
            WHERE e.section_id = s.id AND rw.status = 'checked_pending_verification') AS pending_forward,
           (SELECT COUNT(*) FROM enrollments e
            JOIN result_workflow rw ON rw.enrollment_id = e.id
            WHERE e.section_id = s.id AND rw.status = 'ready_to_publish') AS pending_publish
    FROM sections s
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN instructors i ON i.id = s.instructor_id
    LEFT JOIN users u ON u.id = i.user_id
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
           s.id AS section_id, s.section_code, u.name AS instructor_name,
           (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status IN ('registered','completed')) AS student_count,
           (SELECT COUNT(*) FROM enrollments e
            JOIN result_workflow rw ON rw.enrollment_id = e.id
            WHERE e.section_id = s.id AND rw.status = 'waiting_hod_approval') AS pending_hod
    FROM courses c
    JOIN sections s ON s.course_id = c.id
    JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN instructors i ON i.id = s.instructor_id
    LEFT JOIN users u ON u.id = i.user_id
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
           u.name AS instructor_name,
           (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status = 'registered') AS enrolled_count,
           (SELECT COUNT(*) FROM exam_registrations er JOIN enrollments e ON e.id = er.enrollment_id WHERE e.section_id = s.id) AS exam_registered_count
    FROM sections s
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN instructors i ON i.id = s.instructor_id
    LEFT JOIN users u ON u.id = i.user_id
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
           ins.employee_id, ins.department
    FROM users u
    LEFT JOIN students st ON st.user_id = u.id
    LEFT JOIN programs p ON p.id = st.program_id
    LEFT JOIN instructors ins ON ins.user_id = u.id
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

// POST /api/workflow/sections/:sectionId/timetable — Staff edits section room, teacher, and schedule slots
router.post('/sections/:sectionId/timetable', authRequired, requireRoles('academic_staff', 'admin'), (req, res) => {
  const { room, slots, instructor_id } = req.body;
  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(req.params.sectionId);
  if (!section) return res.status(404).json({ error: 'Section not found' });

  if (room !== undefined) {
    db.prepare('UPDATE sections SET room = ? WHERE id = ?').run(room, section.id);
  }

  if (instructor_id !== undefined) {
    db.prepare('UPDATE sections SET instructor_id = ? WHERE id = ?').run(instructor_id ? Number(instructor_id) : null, section.id);
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

export default router;
