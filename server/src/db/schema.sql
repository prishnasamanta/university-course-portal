PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor', 'academic_staff', 'dept_head', 'admin')),
  created_at TEXT DEFAULT (datetime('now')),
  password TEXT,
  department TEXT,
  employee_id TEXT,
  profile_completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS semesters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  registration_open INTEGER NOT NULL DEFAULT 0,
  exams_completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (semester_number, year)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  password_hash TEXT,
  password TEXT,
  program_id INTEGER NOT NULL REFERENCES programs(id),
  batch_year INTEGER NOT NULL,
  roll_number TEXT NOT NULL UNIQUE,
  profile_completed INTEGER NOT NULL DEFAULT 0,
  previous_degree TEXT,
  previous_grade TEXT,
  current_semester_id INTEGER REFERENCES semesters(id)
);


CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  credits REAL NOT NULL,
  description TEXT,
  department TEXT NOT NULL DEFAULT 'cs',
  degree_level TEXT NOT NULL DEFAULT 'btech' CHECK (degree_level IN ('btech', 'msc', 'mtech')),
  required_previous_degree TEXT,
  min_previous_grade TEXT,
  syllabus TEXT,
  is_published INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  semester_id INTEGER NOT NULL REFERENCES semesters(id),
  section_code TEXT NOT NULL,
  instructor_id INTEGER REFERENCES users(id),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  room TEXT,
  exam_requested INTEGER NOT NULL DEFAULT 0,
  exam_reg_open INTEGER NOT NULL DEFAULT 0,
  exam_started INTEGER NOT NULL DEFAULT 0,
  UNIQUE (course_id, semester_id, section_code)
);

CREATE TABLE IF NOT EXISTS section_schedule_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  section_id INTEGER NOT NULL REFERENCES sections(id),
  chosen_slot_id INTEGER REFERENCES section_schedule_slots(id),
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'dropped', 'completed')),
  enrolled_at TEXT DEFAULT (datetime('now')),
  UNIQUE (student_id, section_id)
);

CREATE TABLE IF NOT EXISTS instructor_teaching_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  semester_id INTEGER REFERENCES semesters(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_marks REAL NOT NULL,
  weight_percent REAL NOT NULL CHECK (weight_percent > 0 AND weight_percent <= 100)
);

CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES assessment_components(id) ON DELETE CASCADE,
  marks_obtained REAL,
  entered_by INTEGER REFERENCES users(id),
  finalized INTEGER NOT NULL DEFAULT 0,
  finalized_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (enrollment_id, component_id)
);

CREATE TABLE IF NOT EXISTS marks_revision_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mark_id INTEGER NOT NULL REFERENCES marks(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  old_value REAL,
  new_value REAL,
  status TEXT NOT NULL DEFAULT 'pending_staff_review' CHECK (status IN ('pending', 'pending_staff_review', 'forwarded_to_instructor', 'instructor_rechecked', 'approved', 'rejected')),
  forwarded_by INTEGER REFERENCES users(id),
  instructor_remarks TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grading_policy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  letter_grade TEXT NOT NULL UNIQUE,
  min_percent REAL NOT NULL,
  grade_point REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollment_grades (
  enrollment_id INTEGER PRIMARY KEY REFERENCES enrollments(id) ON DELETE CASCADE,
  total_percent REAL,
  letter_grade TEXT,
  grade_point REAL,
  computed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_results (
  enrollment_id INTEGER PRIMARY KEY REFERENCES enrollments(id) ON DELETE CASCADE,
  marks REAL CHECK (marks >= 0 AND marks <= 100),
  entered_by INTEGER REFERENCES users(id),
  entered_at TEXT
);

CREATE TABLE IF NOT EXISTS result_workflow (
  enrollment_id INTEGER PRIMARY KEY REFERENCES enrollments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'papers_submitted' CHECK (status IN (
    'papers_submitted',
    'checked_pending_verification',
    'waiting_hod_approval',
    'ready_to_publish',
    'published',
    'hod_rejected'
  )),
  hod_decision TEXT CHECK (hod_decision IN ('pending', 'approved', 'rejected')),
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exam_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  registered_at TEXT DEFAULT (datetime('now')),
  UNIQUE(enrollment_id)
);

CREATE TABLE IF NOT EXISTS student_removal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_by_admin INTEGER NOT NULL REFERENCES users(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending_hod_approval' CHECK (status IN ('pending_hod_approval', 'approved_by_hod', 'rejected_by_hod', 'completed')),
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sections_semester ON sections(semester_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_section ON enrollments(section_id);
CREATE INDEX IF NOT EXISTS idx_section_slots ON section_schedule_slots(section_id);

INSERT OR IGNORE INTO grading_policy (letter_grade, min_percent, grade_point) VALUES
  ('O', 90, 10),
  ('A+', 80, 9),
  ('A', 70, 8),
  ('B+', 60, 7),
  ('B', 50, 6),
  ('C', 40, 5),
  ('F', 0, 0);

-- ====================================================
-- SQL VIEWS FOR PURE DATABASE QUERY EXECUTION
-- ====================================================

-- 1. SQL View: Student Timetables
CREATE VIEW IF NOT EXISTS v_student_timetables AS
SELECT e.student_id, e.id AS enrollment_id, e.section_id,
       c.code AS course_code, c.title AS course_title,
       s.section_code, s.room,
       ss.id AS slot_id, ss.day_of_week, ss.start_time, ss.end_time
FROM enrollments e
JOIN section_schedule_slots ss ON ss.id = e.chosen_slot_id
JOIN sections s ON s.id = e.section_id
JOIN courses c ON c.id = s.course_id
WHERE e.status = 'registered';

-- 2. SQL View: Timetable Clashes
CREATE VIEW IF NOT EXISTS v_timetable_clashes AS
SELECT t1.student_id,
       t1.course_code AS course1_code, t1.start_time AS course1_start, t1.end_time AS course1_end,
       t2.course_code AS course2_code, t2.start_time AS course2_start, t2.end_time AS course2_end,
       t1.day_of_week
FROM v_student_timetables t1
JOIN v_student_timetables t2 ON t1.student_id = t2.student_id
                            AND t1.enrollment_id != t2.enrollment_id
                            AND t1.day_of_week = t2.day_of_week
                            AND t1.start_time < t2.end_time
                            AND t2.start_time < t1.end_time;

-- 3. SQL View: Section Capacity Status
CREATE VIEW IF NOT EXISTS v_section_capacity_status AS
SELECT s.id AS section_id, s.course_id, s.semester_id, s.capacity,
       COUNT(e.id) AS enrolled_count,
       (s.capacity - COUNT(e.id)) AS seats_remaining,
       CASE WHEN COUNT(e.id) >= s.capacity THEN 1 ELSE 0 END AS is_full
FROM sections s
LEFT JOIN enrollments e ON e.section_id = s.id AND e.status = 'registered'
GROUP BY s.id;

-- 4. SQL View: Automatic Grade & Grade Point Computation
CREATE VIEW IF NOT EXISTS v_student_grades AS
SELECT e.id AS enrollment_id, e.student_id, s.semester_id, c.id AS course_id, c.code AS course_code, c.credits,
       cr.marks,
       gp.letter_grade,
       gp.grade_point,
       (gp.grade_point * c.credits) AS credit_points,
       rw.status AS workflow_status
FROM enrollments e
JOIN sections s ON s.id = e.section_id
JOIN courses c ON c.id = s.course_id
LEFT JOIN course_results cr ON cr.enrollment_id = e.id
LEFT JOIN result_workflow rw ON rw.enrollment_id = e.id
LEFT JOIN grading_policy gp ON cr.marks >= gp.min_percent
                          AND gp.min_percent = (
                            SELECT MAX(min_percent)
                            FROM grading_policy
                            WHERE cr.marks >= min_percent
                          );

-- 5. SQL View: Semester GPA (SGPA) Computation
CREATE VIEW IF NOT EXISTS v_student_sgpa AS
SELECT student_id, semester_id,
       SUM(credits) AS total_credits,
       SUM(credit_points) AS total_credit_points,
       ROUND(SUM(credit_points) / SUM(credits), 2) AS sgpa
FROM v_student_grades
WHERE workflow_status = 'published' AND grade_point IS NOT NULL
GROUP BY student_id, semester_id;

-- 6. SQL View: Cumulative GPA (CGPA) Computation
CREATE VIEW IF NOT EXISTS v_student_cgpa AS
SELECT student_id,
       SUM(credits) AS total_cumulative_credits,
       SUM(credit_points) AS total_cumulative_points,
       ROUND(SUM(credit_points) / SUM(credits), 2) AS cgpa
FROM v_student_grades
WHERE workflow_status = 'published' AND grade_point IS NOT NULL
GROUP BY student_id;

-- 7. SQL View: Mark Edit Audit Trail Log
CREATE VIEW IF NOT EXISTS v_mark_audit_trail AS
SELECT m.id AS revision_id, m.mark_id, m.old_value, m.new_value, m.reason, m.status,
       u.name AS requested_by_name, r.name AS reviewed_by_name, m.created_at
FROM marks_revision_requests m
JOIN users u ON u.id = m.requested_by
LEFT JOIN users r ON r.id = m.reviewed_by;

-- ====================================================
-- SQL TRIGGERS FOR DATABASE AUDIT TRAIL & CONSTRAINTS
-- ====================================================

-- Trigger: Audit Trail logging on course_results update
CREATE TRIGGER IF NOT EXISTS trg_audit_course_results_update
AFTER UPDATE OF marks ON course_results
FOR EACH ROW
WHEN OLD.marks IS NOT NULL AND OLD.marks != NEW.marks
BEGIN
  INSERT INTO marks_revision_requests (mark_id, requested_by, reason, old_value, new_value, status, created_at)
  VALUES (NEW.enrollment_id, NEW.entered_by, 'Instructor modified marks', OLD.marks, NEW.marks, 'approved', datetime('now'));
END;

-- Trigger: Automatic Student Profile creation on users INSERT (SQL/TablePlus/Website)
CREATE TRIGGER IF NOT EXISTS trg_auto_create_student_profile
AFTER INSERT ON users
FOR EACH ROW
WHEN NEW.role = 'student'
BEGIN
  INSERT OR IGNORE INTO students (user_id, program_id, batch_year, roll_number, profile_completed)
  VALUES (NEW.id, (SELECT id FROM programs LIMIT 1), 2025, 'STU' || NEW.id, 0);
END;




