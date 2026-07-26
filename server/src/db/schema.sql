PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor', 'academic_staff', 'dept_head', 'admin')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS semesters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  registration_open INTEGER NOT NULL DEFAULT 0,
  exams_completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (name, year)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  program_id INTEGER NOT NULL REFERENCES programs(id),
  batch_year INTEGER NOT NULL,
  roll_number TEXT NOT NULL UNIQUE,
  profile_completed INTEGER NOT NULL DEFAULT 0,
  previous_degree TEXT,
  previous_grade TEXT,
  current_semester_id INTEGER REFERENCES semesters(id)
);

CREATE TABLE IF NOT EXISTS instructors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  employee_id TEXT NOT NULL UNIQUE,
  profile_completed INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS course_prerequisites (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, prerequisite_course_id),
  CHECK (course_id != prerequisite_course_id)
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  semester_id INTEGER NOT NULL REFERENCES semesters(id),
  section_code TEXT NOT NULL,
  instructor_id INTEGER REFERENCES instructors(id),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  room TEXT,
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
  instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
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
  new_value REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
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

CREATE INDEX IF NOT EXISTS idx_sections_semester ON sections(semester_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_section ON enrollments(section_id);
CREATE INDEX IF NOT EXISTS idx_section_slots ON section_schedule_slots(section_id);
