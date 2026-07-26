import { Router } from 'express';

import db, { getDb } from '../db/index.js';

import { authRequired, requireRoles, getStudentByUserId } from '../middleware/auth.js';

import { registerStudent, validateRegistration, getAvailableSlotsForStudent, DAY_NAMES } from '../services/registration.js';

import { getGradeCard, getTranscript, computeCGPA } from '../services/gpa.js';

import { syncAllInstructorSections } from '../services/sectionSync.js';



const router = Router();



router.post('/profile/student', authRequired, requireRoles('student'), (req, res) => {
  let student = getStudentByUserId(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student profile not found' });

  const { name, email, program_id, previous_degree, previous_grade, current_semester_id } = req.body;

  if (!name || !previous_degree || !previous_grade || !current_semester_id) {
    return res.status(400).json({ error: 'All profile fields are required' });
  }

  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email || req.user.email, req.user.id);

  const progId = program_id ? Number(program_id) : student.program_id || 1;

  db.prepare(`
    UPDATE students SET program_id = ?, previous_degree = ?, previous_grade = ?, current_semester_id = ?,
      profile_completed = 1
    WHERE id = ?
  `).run(progId, previous_degree, previous_grade, Number(current_semester_id), student.id);

  res.json({ ok: true });
});



router.get('/programs', authRequired, (req, res) => {

  res.json(db.prepare('SELECT * FROM programs ORDER BY name').all());

});



router.get('/courses', authRequired, (req, res) => {

  const courses = db.prepare('SELECT * FROM courses WHERE is_published = 1 ORDER BY code').all();

  const withPrereqs = courses.map(c => ({

    ...c,

    prerequisites: db.prepare(`

      SELECT c2.id, c2.code, c2.title

      FROM course_prerequisites cp

      JOIN courses c2 ON c2.id = cp.prerequisite_course_id

      WHERE cp.course_id = ?

    `).all(c.id)

  }));

  res.json(withPrereqs);

});



router.get('/semesters', authRequired, (req, res) => {

  res.json(db.prepare('SELECT * FROM semesters ORDER BY year DESC, name').all());

});



router.get('/offerings/:semesterId', authRequired, (req, res) => {

  const sections = db.prepare(`

    SELECT s.*, c.code AS course_code, c.title AS course_title, c.credits,

           c.department, c.degree_level, c.required_previous_degree, c.min_previous_grade, c.syllabus,

           u.name AS instructor_name, i.employee_id,

           (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status = 'registered') AS enrolled_count

    FROM sections s

    JOIN courses c ON c.id = s.course_id

    LEFT JOIN instructors i ON i.id = s.instructor_id

    LEFT JOIN users u ON u.id = i.user_id

    WHERE s.semester_id = ? AND s.instructor_id IS NOT NULL AND c.is_published = 1

    ORDER BY c.code, s.section_code

  `).all(req.params.semesterId);



  res.json(sections.map(s => {

    const slots = db.prepare('SELECT * FROM section_schedule_slots WHERE section_id = ? ORDER BY day_of_week').all(s.id);

    return {

      ...s,

      schedule_slots: slots.map(sl => ({ ...sl, day_name: DAY_NAMES[sl.day_of_week] })),

      slots_available: s.capacity - s.enrolled_count

    };

  }));

});



router.get('/courses/:courseId/semester/:semesterId', authRequired, (req, res) => {

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);

  if (!course) return res.status(404).json({ error: 'Course not found' });



  const prerequisites = db.prepare(`

    SELECT c.id, c.code, c.title FROM course_prerequisites cp

    JOIN courses c ON c.id = cp.prerequisite_course_id WHERE cp.course_id = ?

  `).all(course.id);



  const sections = db.prepare(`

    SELECT s.*, u.name AS instructor_name,

           (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status = 'registered') AS enrolled_count

    FROM sections s

    LEFT JOIN instructors i ON i.id = s.instructor_id

    LEFT JOIN users u ON u.id = i.user_id

    WHERE s.course_id = ? AND s.semester_id = ? AND s.instructor_id IS NOT NULL

  `).all(course.id, req.params.semesterId);



  const student = req.user.role === 'student' ? getStudentByUserId(req.user.id) : null;



  res.json({

    ...course,

    prerequisites,

    sections: sections.map(sec => {

      const slots = db.prepare('SELECT * FROM section_schedule_slots WHERE section_id = ? ORDER BY day_of_week').all(sec.id);

      const slotInfo = student

        ? getAvailableSlotsForStudent(student.id, sec.id)

        : slots.map(sl => ({ ...sl, day_name: DAY_NAMES[sl.day_of_week], available: true }));

      return { ...sec, schedule_slots: slotInfo, slots_available: sec.capacity - sec.enrolled_count };

    })

  });

});



router.get('/students/:studentId', authRequired, requireRoles('admin', 'academic_staff', 'dept_head', 'student'), (req, res) => {

  const student = db.prepare(`

    SELECT s.*, u.name, u.email, p.name AS program_name, p.code AS program_code,

           sem.name AS current_semester_name, sem.year AS current_semester_year

    FROM students s

    JOIN users u ON u.id = s.user_id

    JOIN programs p ON p.id = s.program_id

    LEFT JOIN semesters sem ON sem.id = s.current_semester_id

    WHERE s.id = ?

  `).get(req.params.studentId);



  if (!student) return res.status(404).json({ error: 'Student not found' });



  if (req.user.role === 'student') {

    const own = getStudentByUserId(req.user.id);

    if (!own || own.id !== student.id) return res.status(403).json({ error: 'Access denied' });

  }



  const history = db.prepare(`

    SELECT sem.name AS semester, sem.year, c.code, c.title, c.credits,

           eg.letter_grade, eg.grade_point, e.status

    FROM enrollments e

    JOIN sections sec ON sec.id = e.section_id

    JOIN semesters sem ON sem.id = sec.semester_id

    JOIN courses c ON c.id = sec.course_id

    LEFT JOIN enrollment_grades eg ON eg.enrollment_id = e.id

    WHERE e.student_id = ?

    ORDER BY sem.year DESC, sem.name

  `).all(student.id);



  res.json({ ...student, academic_history: history, cgpa: computeCGPA(student.id) });

});



router.post('/register/validate', authRequired, requireRoles('student'), (req, res) => {

  const student = getStudentByUserId(req.user.id);

  if (!student) return res.status(404).json({ error: 'Student profile not found' });

  if (!student.profile_completed) return res.status(400).json({ error: 'Complete your profile first' });

  const { section_id, chosen_slot_id } = req.body;

  res.json(validateRegistration(student.id, section_id, chosen_slot_id));

});



router.post('/register', authRequired, requireRoles('student'), (req, res) => {

  const student = getStudentByUserId(req.user.id);

  if (!student) return res.status(404).json({ error: 'Student profile not found' });

  if (!student.profile_completed) return res.status(400).json({ error: 'Complete your profile first' });

  const result = registerStudent(student.id, req.body.section_id, req.body.chosen_slot_id);

  if (!result.ok) return res.status(400).json(result);

  res.status(201).json(result);

});



router.get('/my-enrollments', authRequired, requireRoles('student'), (req, res) => {

  const student = getStudentByUserId(req.user.id);

  const enrollments = db.prepare(`

    SELECT e.*, c.code, c.title, c.credits, s.section_code, s.room,

           ss.day_of_week, ss.start_time, ss.end_time,

           sem.name AS semester_name, sem.year, u.name AS instructor_name

    FROM enrollments e

    JOIN sections s ON s.id = e.section_id

    JOIN courses c ON c.id = s.course_id

    JOIN semesters sem ON sem.id = s.semester_id

    LEFT JOIN section_schedule_slots ss ON ss.id = e.chosen_slot_id

    LEFT JOIN instructors i ON i.id = s.instructor_id

    LEFT JOIN users u ON u.id = i.user_id

    WHERE e.student_id = ? AND e.status = 'registered'

    ORDER BY sem.year DESC, c.code

  `).all(student.id);



  res.json(enrollments.map(e => ({ ...e, day_name: e.day_of_week != null ? DAY_NAMES[e.day_of_week] : '—' })));

});



router.post('/drop/:enrollmentId', authRequired, requireRoles('student'), (req, res) => {

  const student = getStudentByUserId(req.user.id);

  const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ? AND student_id = ?').get(

    req.params.enrollmentId, student.id

  );

  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

  db.prepare("UPDATE enrollments SET status = 'dropped' WHERE id = ?").run(enrollment.id);

  res.json({ ok: true });

});



router.get('/grade-card/:semesterId', authRequired, requireRoles('student'), (req, res) => {

  const student = getStudentByUserId(req.user.id);

  res.json(getGradeCard(student.id, Number(req.params.semesterId)));

});



router.get('/transcript', authRequired, requireRoles('student'), (req, res) => {

  const student = getStudentByUserId(req.user.id);

  res.json({ courses: getTranscript(student.id), cgpa: computeCGPA(student.id) });

});



router.post('/semesters', authRequired, requireRoles('admin', 'academic_staff'), (req, res) => {

  const { name, year, is_active, registration_open } = req.body;

  const result = db.prepare(`

    INSERT INTO semesters (name, year, is_active, registration_open) VALUES (?, ?, ?, ?)

  `).run(name, year, is_active ? 1 : 0, registration_open ? 1 : 0);

  res.status(201).json({ id: result.lastInsertRowid });

});



router.patch('/semesters/:id/registration', authRequired, requireRoles('admin', 'academic_staff'), (req, res) => {

  const { registration_open } = req.body;

  db.prepare('UPDATE semesters SET registration_open = ? WHERE id = ?').run(registration_open ? 1 : 0, req.params.id);

  res.json({ ok: true });

});



router.patch('/semesters/:id/exams', authRequired, requireRoles('admin', 'academic_staff'), (req, res) => {

  const { exams_completed } = req.body;

  db.prepare('UPDATE semesters SET exams_completed = ? WHERE id = ?').run(exams_completed ? 1 : 0, req.params.id);

  res.json({ ok: true });

});



router.post('/sections', authRequired, requireRoles('admin', 'academic_staff', 'dept_head'), (req, res) => {

  const { course_id, semester_id, section_code, instructor_id, capacity, room, schedule_slots } = req.body;

  const result = db.prepare(`

    INSERT INTO sections (course_id, semester_id, section_code, instructor_id, capacity, room)

    VALUES (?, ?, ?, ?, ?, ?)

  `).run(course_id, semester_id, section_code, instructor_id, capacity, room || null);



  const sectionId = result.lastInsertRowid;

  if (schedule_slots?.length) {

    const insert = db.prepare(`

      INSERT INTO section_schedule_slots (section_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)

    `);

    for (const slot of schedule_slots) insert.run(sectionId, slot.day_of_week, slot.start_time, slot.end_time);

  }

  res.status(201).json({ id: sectionId });

});



router.post('/courses', authRequired, requireRoles('admin', 'academic_staff', 'dept_head'), (req, res) => {

  const {

    code, title, credits, description, department, degree_level,

    required_previous_degree, min_previous_grade, syllabus, prerequisite_ids

  } = req.body;



  const result = db.prepare(`

    INSERT INTO courses (code, title, credits, description, department, degree_level,

      required_previous_degree, min_previous_grade, syllabus, is_published)

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)

  `).run(

    code, title, credits, description || null, department || 'cs', degree_level || 'btech',

    required_previous_degree || null, min_previous_grade || null, syllabus || null

  );



  if (prerequisite_ids?.length) {

    const insert = db.prepare('INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)');

    for (const pid of prerequisite_ids) insert.run(result.lastInsertRowid, pid);

  }

  res.status(201).json({ id: result.lastInsertRowid });

});



router.get('/instructors', authRequired, requireRoles('admin', 'academic_staff', 'dept_head'), (req, res) => {

  res.json(db.prepare(`

    SELECT i.*, u.name, u.email FROM instructors i JOIN users u ON u.id = i.user_id ORDER BY u.name

  `).all());

});



router.post('/sync-sections-from-preferences', authRequired, requireRoles('admin', 'academic_staff'), (req, res) => {
  const { semester_id } = req.body || {};
  res.json(syncAllInstructorSections(semester_id || null));
});

router.get('/instructor-preferences', authRequired, requireRoles('admin', 'academic_staff'), (req, res) => {

  res.json(db.prepare(`

    SELECT tp.*, c.code AS course_code, c.title AS course_title, u.name AS instructor_name

    FROM instructor_teaching_preferences tp

    JOIN courses c ON c.id = tp.course_id

    JOIN instructors i ON i.id = tp.instructor_id

    JOIN users u ON u.id = i.user_id

    ORDER BY u.name, c.code

  `).all());

});



// GET /api/exam-registrations — student sees which sections have exam open
router.get('/exam-registrations', authRequired, requireRoles('student'), async (req, res) => {
  const student = getStudentByUserId(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  
  const dbInst = await getDb();
  const rows = dbInst.prepare(`
    SELECT e.id AS enrollment_id, c.code, c.title, c.credits, s.id AS section_id,
           s.section_code, s.exam_reg_open, s.exam_requested,
           sem.name AS semester_name, sem.year,
           u.name AS instructor_name,
           (SELECT COUNT(*) FROM exam_registrations er WHERE er.enrollment_id = e.id) AS already_registered
    FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN instructors i ON i.id = s.instructor_id
    LEFT JOIN users u ON u.id = i.user_id
    WHERE e.student_id = ? AND e.status = 'registered' AND s.exam_reg_open = 1
    ORDER BY c.code
  `).all(student.id);
  
  res.json(rows);
});

// POST /api/exam-register/:enrollmentId — student registers for exam
router.post('/exam-register/:enrollmentId', authRequired, requireRoles('student'), async (req, res) => {
  const student = getStudentByUserId(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  
  const dbInst = await getDb();
  const enrollment = dbInst.prepare('SELECT e.*, s.exam_reg_open FROM enrollments e JOIN sections s ON s.id = e.section_id WHERE e.id = ? AND e.student_id = ?').get(req.params.enrollmentId, student.id);
  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
  if (!enrollment.exam_reg_open) return res.status(400).json({ error: 'Exam registration is not open for this course' });
  
  try {
    dbInst.prepare('INSERT INTO exam_registrations (enrollment_id) VALUES (?)').run(enrollment.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: 'Already registered for this exam' });
  }
});

// GET /api/my-exam-registrations — student sees their exam registration status
router.get('/my-exam-registrations', authRequired, requireRoles('student'), async (req, res) => {
  const student = getStudentByUserId(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  
  const dbInst = await getDb();
  const rows = dbInst.prepare(`
    SELECT e.id AS enrollment_id, c.code, c.title, c.credits,
           s.section_code, s.exam_reg_open, s.exam_requested,
           sem.name AS semester_name, sem.year,
           u.name AS instructor_name,
           er.id AS exam_reg_id, er.registered_at,
           rw.status AS result_status
    FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN instructors i ON i.id = s.instructor_id
    LEFT JOIN users u ON u.id = i.user_id
    LEFT JOIN exam_registrations er ON er.enrollment_id = e.id
    LEFT JOIN result_workflow rw ON rw.enrollment_id = e.id
    WHERE e.student_id = ? AND e.status = 'registered'
    ORDER BY c.code
  `).all(student.id);
  
  res.json(rows);
});

export default router;

