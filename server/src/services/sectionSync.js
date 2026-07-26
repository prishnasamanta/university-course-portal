import db from '../db/index.js';

function getActiveSemesterId() {
  const sem = db.prepare(`
    SELECT id FROM semesters
    WHERE is_active = 1 OR registration_open = 1
    ORDER BY is_active DESC, registration_open DESC
    LIMIT 1
  `).get();
  return sem?.id ?? null;
}

function scheduleDaysFromPreference(dayOfWeek) {
  if (dayOfWeek === 1) return [1, 2, 3];
  if (dayOfWeek === 2) return [2, 3, 4];
  if (dayOfWeek === 3) return [3, 4, 5];
  return [dayOfWeek, Math.min(dayOfWeek + 1, 5), Math.min(dayOfWeek + 2, 5)];
}

export function syncSectionsFromPreferences(instructorId, semesterId = null) {
  const semId = semesterId || getActiveSemesterId();
  if (!semId) return { ok: false, reason: 'No active semester found' };

  const prefs = db.prepare(`
    SELECT * FROM instructor_teaching_preferences WHERE instructor_id = ?
  `).all(instructorId);

  let created = 0;
  let updated = 0;

  for (const pref of prefs) {
    const targetSem = pref.semester_id || semId;
    let section = db.prepare(`
      SELECT id FROM sections
      WHERE course_id = ? AND semester_id = ? AND instructor_id = ?
    `).get(pref.course_id, targetSem, instructorId);

    if (!section) {
      const result = db.prepare(`
        INSERT INTO sections (course_id, semester_id, section_code, instructor_id, capacity, room)
        VALUES (?, ?, 'A', ?, 30, NULL)
      `).run(pref.course_id, targetSem, instructorId);
      section = { id: result.lastInsertRowid };
      created++;
    } else {
      updated++;
    }

    db.prepare('DELETE FROM section_schedule_slots WHERE section_id = ?').run(section.id);

    const insertSlot = db.prepare(`
      INSERT INTO section_schedule_slots (section_id, day_of_week, start_time, end_time)
      VALUES (?, ?, ?, ?)
    `);

    for (const day of scheduleDaysFromPreference(pref.day_of_week)) {
      insertSlot.run(section.id, day, pref.start_time, pref.end_time);
    }
  }

  return { ok: true, created, updated, semester_id: semId };
}

export function syncAllInstructorSections(semesterId = null) {
  const instructors = db.prepare(`
    SELECT DISTINCT instructor_id FROM instructor_teaching_preferences
  `).all();

  let totalCreated = 0;
  for (const { instructor_id } of instructors) {
    const r = syncSectionsFromPreferences(instructor_id, semesterId);
    if (r.ok) totalCreated += r.created;
  }
  return { ok: true, sections_created: totalCreated };
}
