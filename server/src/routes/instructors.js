import { Router } from 'express';

import db, { getDb } from '../db/index.js';

import { authRequired, requireRoles, getInstructorByUserId } from '../middleware/auth.js';

import { computeEnrollmentGrade } from '../services/gpa.js';

import { saveCourseResult, STATUS_LABELS } from '../services/resultWorkflow.js';

import { DAY_NAMES } from '../services/registration.js';

import { syncSectionsFromPreferences } from '../services/sectionSync.js';



const router = Router();



router.post('/profile', authRequired, requireRoles('instructor'), (req, res) => {

  const instructor = getInstructorByUserId(req.user.id);

  const { preferences } = req.body;



  if (!preferences?.length) {

    return res.status(400).json({ error: 'Select at least one course with availability' });

  }



  db.prepare('DELETE FROM instructor_teaching_preferences WHERE instructor_id = ?').run(req.user.id);



  const insert = db.prepare(`

    INSERT INTO instructor_teaching_preferences (instructor_id, course_id, semester_id, day_of_week, start_time, end_time)

    VALUES (?, ?, ?, ?, ?, ?)

  `);



  for (const pref of preferences) {

    insert.run(

      req.user.id, pref.course_id, pref.semester_id || null,

      pref.day_of_week, pref.start_time, pref.end_time

    );

  }



  db.prepare('UPDATE users SET profile_completed = 1 WHERE id = ?').run(req.user.id);

  const sync = syncSectionsFromPreferences(req.user.id, preferences[0]?.semester_id || null);

  res.json({ ok: true, sections: sync });

});



router.get('/available-courses', authRequired, requireRoles('instructor'), (req, res) => {

  res.json(db.prepare(`

    SELECT id, code, title, department, degree_level, credits, syllabus

    FROM courses WHERE is_published = 1 ORDER BY code

  `).all());

});



router.get('/my-preferences', authRequired, requireRoles('instructor'), (req, res) => {

  const instructor = getInstructorByUserId(req.user.id);

  const prefs = db.prepare(`

    SELECT tp.*, c.code, c.title FROM instructor_teaching_preferences tp

    JOIN courses c ON c.id = tp.course_id WHERE tp.instructor_id = ?

  `).all(req.user.id);

  res.json(prefs.map(p => ({ ...p, day_name: DAY_NAMES[p.day_of_week] })));

});



router.get('/my-sections', authRequired, requireRoles('instructor'), (req, res) => {
  const instructor = getInstructorByUserId(req.user.id);

  const sections = db.prepare(`
    SELECT s.*, c.code AS course_code, c.title AS course_title, c.credits, c.department, c.degree_level,
           sem.name AS semester_name, sem.year, sem.exams_completed,
           (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status IN ('registered','completed')) AS enrolled_count,
           (SELECT COUNT(*) FROM enrollments e JOIN course_results cr ON cr.enrollment_id = e.id WHERE e.section_id = s.id AND e.status IN ('registered','completed')) AS marks_count
    FROM sections s
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    WHERE s.instructor_id = ?
    ORDER BY sem.year DESC, c.code
  `).all(req.user.id);

  res.json(sections.map(sec => {
    const slots = db.prepare('SELECT * FROM section_schedule_slots WHERE section_id = ? ORDER BY day_of_week').all(sec.id);
    return {
      ...sec,
      schedule_slots: slots.map(sl => ({ ...sl, day_name: DAY_NAMES[sl.day_of_week] }))
    };
  }));
});



router.get('/results/sections', authRequired, requireRoles('instructor'), (req, res) => {

  const instructor = getInstructorByUserId(req.user.id);

  res.json(db.prepare(`

    SELECT s.id, s.course_id, c.code AS course_code, c.title AS course_title, c.department AS course_department,
           s.section_code, s.exam_requested, s.exam_reg_open, s.exam_started,
           sem.name AS semester_name, sem.year, sem.exams_completed,
           (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status IN ('registered', 'completed')) AS enrolled_count
    FROM sections s
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    WHERE s.instructor_id = ?
    ORDER BY sem.year DESC, c.code
  `).all(req.user.id));

});



router.get('/results/sections/:sectionId/students', authRequired, requireRoles('instructor', 'admin', 'dept_head', 'academic_staff'), (req, res) => {

  const rows = db.prepare(`

    SELECT e.id AS enrollment_id, st.roll_number, u.name AS student_name,

           cr.marks, rw.status AS workflow_status, eg.letter_grade, eg.total_percent

    FROM enrollments e

    JOIN students st ON st.id = e.student_id

    JOIN users u ON u.id = st.user_id

    LEFT JOIN course_results cr ON cr.enrollment_id = e.id

    LEFT JOIN result_workflow rw ON rw.enrollment_id = e.id

    LEFT JOIN enrollment_grades eg ON eg.enrollment_id = e.id

    WHERE e.section_id = ? AND e.status IN ('registered', 'completed')

    ORDER BY st.roll_number

  `).all(req.params.sectionId);



  res.json(rows.map(r => ({

    ...r,

    status_label: STATUS_LABELS[r.workflow_status] || STATUS_LABELS.papers_submitted,

    show_grade: r.workflow_status === 'published'

  })));

});



router.post('/results', authRequired, requireRoles('instructor'), (req, res) => {

  const { enrollment_id, marks } = req.body;

  const enrollment = db.prepare(`

    SELECT e.*, s.instructor_id FROM enrollments e

    JOIN sections s ON s.id = e.section_id WHERE e.id = ?

  `).get(enrollment_id);



  const instructor = getInstructorByUserId(req.user.id);

  if (!enrollment || enrollment.instructor_id !== req.user.id) {

    return res.status(403).json({ error: 'Not your section' });

  }



  const result = saveCourseResult(enrollment_id, Number(marks), req.user.id);

  if (!result.ok) return res.status(400).json(result);

  res.json(result);

});



router.get('/sections/:sectionId/components', authRequired, requireRoles('instructor', 'admin', 'dept_head'), (req, res) => {

  res.json(db.prepare('SELECT * FROM assessment_components WHERE section_id = ? ORDER BY id').all(req.params.sectionId));

});



router.post('/sections/:sectionId/components', authRequired, requireRoles('instructor', 'admin'), (req, res) => {

  const { name, max_marks, weight_percent } = req.body;

  const result = db.prepare(`

    INSERT INTO assessment_components (section_id, name, max_marks, weight_percent) VALUES (?, ?, ?, ?)

  `).run(req.params.sectionId, name, max_marks, weight_percent);

  res.status(201).json({ id: result.lastInsertRowid });

});



router.get('/sections/:sectionId/marks', authRequired, requireRoles('instructor', 'admin', 'dept_head'), (req, res) => {

  const rows = db.prepare(`

    SELECT e.id AS enrollment_id, st.roll_number, u.name AS student_name,

           ac.id AS component_id, ac.name AS component_name, ac.max_marks,

           m.id AS mark_id, m.marks_obtained, m.finalized

    FROM enrollments e

    JOIN students st ON st.id = e.student_id

    JOIN users u ON u.id = st.user_id

    JOIN assessment_components ac ON ac.section_id = e.section_id

    LEFT JOIN marks m ON m.enrollment_id = e.id AND m.component_id = ac.id

    WHERE e.section_id = ? AND e.status = 'registered'

    ORDER BY st.roll_number, ac.id

  `).all(req.params.sectionId);



  const grouped = {};

  for (const row of rows) {

    if (!grouped[row.enrollment_id]) {

      grouped[row.enrollment_id] = { enrollment_id: row.enrollment_id, roll_number: row.roll_number, student_name: row.student_name, marks: [] };

    }

    grouped[row.enrollment_id].marks.push({

      mark_id: row.mark_id, component_id: row.component_id, component_name: row.component_name,

      max_marks: row.max_marks, marks_obtained: row.marks_obtained, finalized: row.finalized

    });

  }

  res.json(Object.values(grouped));

});



router.post('/marks', authRequired, requireRoles('instructor'), (req, res) => {

  const { enrollment_id, component_id, marks_obtained } = req.body;

  const existing = db.prepare('SELECT m.* FROM marks m WHERE m.enrollment_id = ? AND m.component_id = ?').get(enrollment_id, component_id);



  if (existing?.finalized) {

    return res.status(400).json({ error: 'Marks are finalized. Submit a revision request to edit.', mark_id: existing.id });

  }



  if (existing) {

    db.prepare(`UPDATE marks SET marks_obtained = ?, entered_by = ?, updated_at = datetime('now') WHERE id = ?`)

      .run(marks_obtained, req.user.id, existing.id);

    res.json({ id: existing.id, updated: true });

  } else {

    const result = db.prepare(`INSERT INTO marks (enrollment_id, component_id, marks_obtained, entered_by) VALUES (?, ?, ?, ?)`)

      .run(enrollment_id, component_id, marks_obtained, req.user.id);

    res.status(201).json({ id: result.lastInsertRowid });

  }

});



router.post('/marks/:markId/finalize', authRequired, requireRoles('instructor'), (req, res) => {

  const mark = db.prepare('SELECT * FROM marks WHERE id = ?').get(req.params.markId);

  if (!mark) return res.status(404).json({ error: 'Mark not found' });

  if (mark.marks_obtained === null) return res.status(400).json({ error: 'Cannot finalize empty marks' });



  db.prepare(`UPDATE marks SET finalized = 1, finalized_at = datetime('now') WHERE id = ?`).run(mark.id);

  computeEnrollmentGrade(mark.enrollment_id);

  res.json({ ok: true });

});



router.post('/marks/:markId/revision-request', authRequired, requireRoles('instructor'), (req, res) => {

  const { new_value, reason } = req.body;

  const mark = db.prepare('SELECT * FROM marks WHERE id = ?').get(req.params.markId);

  if (!mark) return res.status(404).json({ error: 'Mark not found' });

  if (!mark.finalized) return res.status(400).json({ error: 'Mark is not finalized yet' });



  const result = db.prepare(`

    INSERT INTO marks_revision_requests (mark_id, requested_by, reason, old_value, new_value) VALUES (?, ?, ?, ?, ?)

  `).run(mark.id, req.user.id, reason, mark.marks_obtained, new_value);



  res.status(201).json({ id: result.lastInsertRowid, status: 'pending' });

});



router.get('/revision-requests', authRequired, requireRoles('dept_head', 'admin', 'academic_staff'), (req, res) => {

  res.json(db.prepare(`

    SELECT r.*, u.name AS requested_by_name, m.enrollment_id, ac.name AS component_name,

           st.roll_number, su.name AS student_name

    FROM marks_revision_requests r

    JOIN marks m ON m.id = r.mark_id

    JOIN users u ON u.id = r.requested_by

    JOIN assessment_components ac ON ac.id = m.component_id

    JOIN enrollments e ON e.id = m.enrollment_id

    JOIN students st ON st.id = e.student_id

    JOIN users su ON su.id = st.user_id

    WHERE r.status = 'pending'

    ORDER BY r.created_at

  `).all());

});



router.post('/revision-requests/:id/review', authRequired, requireRoles('dept_head', 'admin'), (req, res) => {

  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });



  const request = db.prepare('SELECT * FROM marks_revision_requests WHERE id = ?').get(req.params.id);

  if (!request || request.status !== 'pending') return res.status(404).json({ error: 'Pending revision request not found' });



  db.prepare(`UPDATE marks_revision_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)

    .run(status, req.user.id, request.id);



  if (status === 'approved') {

    db.prepare(`UPDATE marks SET marks_obtained = ?, finalized = 0, updated_at = datetime('now') WHERE id = ?`)

      .run(request.new_value, request.mark_id);

    computeEnrollmentGrade(db.prepare('SELECT enrollment_id FROM marks WHERE id = ?').get(request.mark_id).enrollment_id);

  }

  res.json({ ok: true, status });

});



// POST /api/instructor/sections/:sectionId/request-exam
router.post('/sections/:sectionId/request-exam', authRequired, requireRoles('instructor'), async (req, res) => {
  const instructor = getInstructorByUserId(req.user.id);
  const dbInst = await getDb();
  const section = dbInst.prepare('SELECT * FROM sections WHERE id = ? AND instructor_id = ?').get(req.params.sectionId, req.user.id);
  if (!section) return res.status(404).json({ error: 'Section not found or not yours' });
  
  dbInst.prepare('UPDATE sections SET exam_requested = 1 WHERE id = ?').run(section.id);
  res.json({ ok: true });
});

// POST /api/instructor/sections/:sectionId/cancel-exam-request
router.post('/sections/:sectionId/cancel-exam-request', authRequired, requireRoles('instructor'), async (req, res) => {
  const dbInst = await getDb();
  const section = dbInst.prepare('SELECT * FROM sections WHERE id = ? AND instructor_id = ?').get(req.params.sectionId, req.user.id);
  if (!section) return res.status(404).json({ error: 'Section not found or not yours' });
  if (section.exam_reg_open) {
    return res.status(400).json({ error: 'Cannot cancel exam request once exam registration is opened by academic staff.' });
  }
  
  dbInst.prepare('UPDATE sections SET exam_requested = 0 WHERE id = ?').run(section.id);
  res.json({ ok: true });
});

// POST /api/instructor/sections/:sectionId/timetable
router.post('/sections/:sectionId/timetable', authRequired, requireRoles('instructor'), async (req, res) => {
  const instructor = getInstructorByUserId(req.user.id);
  const dbInst = await getDb();
  const section = dbInst.prepare('SELECT * FROM sections WHERE id = ? AND instructor_id = ?').get(req.params.sectionId, req.user.id);
  if (!section) return res.status(404).json({ error: 'Section not found or not yours' });

  const { day_of_week, start_time, end_time, room, slots } = req.body;
  if (room !== undefined) {
    dbInst.prepare('UPDATE sections SET room = ? WHERE id = ?').run(room, section.id);
  }

  if (Array.isArray(slots) && slots.length > 0) {
    dbInst.prepare('DELETE FROM section_schedule_slots WHERE section_id = ?').run(section.id);
    const ins = dbInst.prepare('INSERT INTO section_schedule_slots (section_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)');
    for (const s of slots) {
      if (s.day_of_week != null && s.start_time && s.end_time) {
        ins.run(section.id, Number(s.day_of_week), s.start_time, s.end_time);
      }
    }
  } else if (day_of_week != null && start_time && end_time) {
    dbInst.prepare('DELETE FROM section_schedule_slots WHERE section_id = ?').run(section.id);
    dbInst.prepare('INSERT INTO section_schedule_slots (section_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)').run(section.id, Number(day_of_week), start_time, end_time);
  }
  res.json({ ok: true });
});

export default router;

