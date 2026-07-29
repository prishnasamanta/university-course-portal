import db from '../db/index.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const GRADE_RANK = {
  'A+': 8, A: 7, 'B+': 6, B: 5, 'C+': 4, C: 3, D: 2, F: 1
};

export function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function slotsOverlap(aStart, aEnd, bStart, bEnd) {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

export function getClearedCourseIds(studentId) {
  const rows = db.prepare(`
    SELECT DISTINCT s.course_id
    FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    JOIN enrollment_grades eg ON eg.enrollment_id = e.id
    WHERE e.student_id = ? AND e.status = 'completed' AND eg.grade_point >= 1.0
  `).all(studentId);
  return new Set(rows.map(r => r.course_id));
}

export function checkPrerequisites(studentId, courseId) {
  return { ok: true };
}

export function checkDegreeAndGrade(studentId, courseId) {
  const student = db.prepare('SELECT previous_degree, previous_grade FROM students WHERE id = ?').get(studentId);
  const course = db.prepare(`
    SELECT required_previous_degree, min_previous_grade, degree_level
    FROM courses WHERE id = ?
  `).get(courseId);

  if (course.required_previous_degree && student.previous_degree) {
    const required = course.required_previous_degree.toLowerCase();
    const actual = student.previous_degree.toLowerCase();
    if (!actual.includes(required) && required !== actual) {
      return {
        ok: false,
        reason: `Requires previous degree: ${course.required_previous_degree}`,
        required_degree: course.required_previous_degree
      };
    }
  }

  if (course.min_previous_grade && student.previous_grade) {
    const reqRank = GRADE_RANK[course.min_previous_grade.toUpperCase()] ?? 0;
    const actRank = GRADE_RANK[student.previous_grade.toUpperCase()] ?? 0;
    if (actRank < reqRank) {
      return {
        ok: false,
        reason: `Minimum previous grade required: ${course.min_previous_grade}`,
        required_grade: course.min_previous_grade
      };
    }
  }

  return { ok: true };
}

export function checkCapacity(sectionId) {
  const section = db.prepare('SELECT capacity FROM sections WHERE id = ?').get(sectionId);
  const enrolled = db.prepare(`
    SELECT COUNT(*) AS count FROM enrollments
    WHERE section_id = ? AND status = 'registered'
  `).get(sectionId);

  if (enrolled.count >= section.capacity) {
    return { ok: false, reason: 'Section is at full capacity' };
  }
  return { ok: true, remaining: section.capacity - enrolled.count };
}

export function getStudentChosenSlots(studentId) {
  return db.prepare(`
    SELECT e.id AS enrollment_id, e.chosen_slot_id, ss.day_of_week, ss.start_time, ss.end_time,
           c.code AS course_code
    FROM enrollments e
    JOIN section_schedule_slots ss ON ss.id = e.chosen_slot_id
    JOIN sections s ON s.id = e.section_id
    JOIN courses c ON c.id = s.course_id
    WHERE e.student_id = ? AND e.status = 'registered'
  `).all(studentId);
}

export function checkSlotClash(studentId, slotId, excludeSectionId = null) {
  const target = db.prepare('SELECT * FROM section_schedule_slots WHERE id = ?').get(slotId);
  if (!target) return { ok: false, reason: 'Schedule slot not found' };

  const existing = getStudentChosenSlots(studentId);

  for (const slot of existing) {
    if (excludeSectionId && slot.enrollment_id) {
      const enr = db.prepare('SELECT section_id FROM enrollments WHERE id = ?').get(slot.enrollment_id);
      if (enr?.section_id === excludeSectionId) continue;
    }
    if (
      slot.day_of_week === target.day_of_week &&
      slotsOverlap(target.start_time, target.end_time, slot.start_time, slot.end_time)
    ) {
      return {
        ok: false,
        reason: `Timetable clash on ${DAY_NAMES[target.day_of_week]}`,
        clashes_with: { code: slot.course_code, day: DAY_NAMES[slot.day_of_week], time: `${slot.start_time}-${slot.end_time}` }
      };
    }
  }
  return { ok: true };
}

export function getAvailableSlotsForStudent(studentId, sectionId) {
  const slots = db.prepare(`
    SELECT ss.* FROM section_schedule_slots ss WHERE ss.section_id = ?
  `).all(sectionId);

  return slots.map(slot => {
    const clash = checkSlotClash(studentId, slot.id);
    return {
      ...slot,
      day_name: DAY_NAMES[slot.day_of_week],
      available: clash.ok,
      clash_reason: clash.ok ? null : clash.reason
    };
  });
}

export function validateRegistration(studentId, sectionId, chosenSlotId) {
  const section = db.prepare(`
    SELECT s.*, c.id AS course_id, c.code, sem.registration_open
    FROM sections s
    JOIN courses c ON c.id = s.course_id
    JOIN semesters sem ON sem.id = s.semester_id
    WHERE s.id = ?
  `).get(sectionId);

  if (!section) return { ok: false, reason: 'Section not found' };
  if (!section.instructor_id) return { ok: false, reason: 'No instructor assigned yet' };
  if (!section.registration_open) return { ok: false, reason: 'Registration is closed for this semester' };

  const already = db.prepare(`
    SELECT id FROM enrollments WHERE student_id = ? AND section_id = ? AND status = 'registered'
  `).get(studentId, sectionId);
  if (already) return { ok: false, reason: 'Already registered for this section' };

  const sameCourse = db.prepare(`
    SELECT e.id FROM enrollments e
    JOIN sections s ON s.id = e.section_id
    WHERE e.student_id = ? AND s.course_id = ? AND s.semester_id = ? AND e.status = 'registered'
  `).get(studentId, section.course_id, section.semester_id);
  if (sameCourse) return { ok: false, reason: 'Already registered for this course' };

  const prereq = checkPrerequisites(studentId, section.course_id);
  if (!prereq.ok) return prereq;

  const degreeGrade = checkDegreeAndGrade(studentId, section.course_id);
  if (!degreeGrade.ok) return degreeGrade;

  const capacity = checkCapacity(sectionId);
  if (!capacity.ok) return capacity;

  if (!chosenSlotId) {
    const available = getAvailableSlotsForStudent(studentId, sectionId);
    const freeSlots = available.filter(s => s.available);
    if (freeSlots.length === 0) {
      return { ok: false, reason: 'All schedule days clash with your current timetable', available_slots: available };
    }
    return { ok: true, needs_slot_selection: true, available_slots: available, section };
  }

  const slot = db.prepare(`
    SELECT * FROM section_schedule_slots WHERE id = ? AND section_id = ?
  `).get(chosenSlotId, sectionId);
  if (!slot) return { ok: false, reason: 'Invalid schedule slot for this section' };

  const clash = checkSlotClash(studentId, chosenSlotId);
  if (!clash.ok) return clash;

  return { ok: true, section, chosen_slot: { ...slot, day_name: DAY_NAMES[slot.day_of_week] } };
}

export function registerStudent(studentId, sectionId, chosenSlotId) {
  let slotIdToUse = chosenSlotId ? Number(chosenSlotId) : null;

  if (!slotIdToUse && sectionId) {
    const available = getAvailableSlotsForStudent(studentId, sectionId);
    const freeSlots = available.filter(s => s.available);
    if (freeSlots.length > 0) {
      slotIdToUse = freeSlots[0].id;
    } else if (available.length > 0) {
      slotIdToUse = available[0].id;
    }
  }

  const validation = validateRegistration(studentId, sectionId, slotIdToUse);
  if (!validation.ok) return validation;

  const result = db.prepare(`
    INSERT INTO enrollments (student_id, section_id, chosen_slot_id, status)
    VALUES (?, ?, ?, 'registered')
  `).run(studentId, sectionId, slotIdToUse || null);

  const enrollmentId = result.lastInsertRowid;

  // Insert into result_workflow table
  try {
    db.prepare(`
      INSERT OR IGNORE INTO result_workflow (enrollment_id, status) VALUES (?, 'papers_submitted')
    `).run(enrollmentId);
  } catch (e) { /* ignore */ }

  // Check if exam registration is currently open for this section; if so, register for exam too!
  try {
    const section = db.prepare('SELECT exam_reg_open FROM sections WHERE id = ?').get(sectionId);
    if (section && section.exam_reg_open) {
      db.prepare('INSERT OR IGNORE INTO exam_registrations (enrollment_id) VALUES (?)').run(enrollmentId);
    }
  } catch (e) { /* ignore */ }

  return { ok: true, enrollment_id: enrollmentId, chosen_slot_id: slotIdToUse };
}

export { DAY_NAMES };
