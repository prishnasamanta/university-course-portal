import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

let pool = null;
let pgWrapper = null;

export function getPostgresPool() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURI;
  if (!connectionString) return null;

  // Failsafe for copy-paste errors with spaces instead of underscores in the database name
  const sanitizedString = connectionString.replace(/university db i4fc/gi, 'university_db_i4fc');

  if (!pool) {
    const isLocalhost = sanitizedString.includes('localhost') || sanitizedString.includes('127.0.0.1');
    const isRenderInternal = sanitizedString.includes('@dpg-') && !sanitizedString.includes('.render.com');
    const requiresSsl = !isLocalhost && !isRenderInternal;

    pool = new Pool({
      connectionString: sanitizedString,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

export async function initPostgres() {
  const p = getPostgresPool();
  if (!p) return null;

  try {
    const client = await p.connect();
    console.log('[PostgreSQL] Successfully connected to PostgreSQL Database.');

    // Initialize Schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        password VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        employee_id VARCHAR(100),
        profile_completed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS programs (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS semesters (
        id SERIAL PRIMARY KEY,
        semester_number INTEGER NOT NULL,
        name VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        is_active INTEGER DEFAULT 0,
        registration_open INTEGER DEFAULT 0,
        exams_completed INTEGER DEFAULT 0,
        UNIQUE(semester_number, year)
      );

      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255),
        name VARCHAR(255),
        password_hash VARCHAR(255),
        password VARCHAR(255),
        program_id INTEGER REFERENCES programs(id),
        batch_year INTEGER NOT NULL,
        roll_number VARCHAR(100) UNIQUE NOT NULL,
        profile_completed INTEGER DEFAULT 0,
        previous_degree VARCHAR(100),
        previous_grade VARCHAR(50),
        current_semester_id INTEGER REFERENCES semesters(id)
      );



      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        credits NUMERIC DEFAULT 6,
        description TEXT,
        department VARCHAR(100) DEFAULT 'cs',
        degree_level VARCHAR(50) DEFAULT 'btech',
        required_previous_degree VARCHAR(100),
        min_previous_grade VARCHAR(50),
        syllabus TEXT,
        is_published INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS sections (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id),
        semester_id INTEGER REFERENCES semesters(id),
        section_code VARCHAR(50) NOT NULL,
        instructor_id INTEGER REFERENCES users(id),
        capacity INTEGER DEFAULT 60,
        room VARCHAR(100),
        exam_requested INTEGER DEFAULT 0,
        exam_reg_open INTEGER DEFAULT 0,
        UNIQUE (course_id, semester_id, section_code)
      );

      CREATE TABLE IF NOT EXISTS section_schedule_slots (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        start_time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        section_id INTEGER REFERENCES sections(id),
        chosen_slot_id INTEGER REFERENCES section_schedule_slots(id),
        status VARCHAR(50) DEFAULT 'registered',
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, section_id)
      );

      CREATE TABLE IF NOT EXISTS exam_registrations (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER UNIQUE REFERENCES enrollments(id) ON DELETE CASCADE,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS course_results (
        enrollment_id INTEGER PRIMARY KEY REFERENCES enrollments(id) ON DELETE CASCADE,
        marks NUMERIC,
        entered_by INTEGER REFERENCES users(id),
        entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS result_workflow (
        enrollment_id INTEGER PRIMARY KEY REFERENCES enrollments(id) ON DELETE CASCADE,
        status VARCHAR(100) DEFAULT 'papers_submitted',
        hod_decision VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS enrollment_grades (
        enrollment_id INTEGER PRIMARY KEY REFERENCES enrollments(id) ON DELETE CASCADE,
        total_percent NUMERIC,
        letter_grade VARCHAR(10),
        grade_point NUMERIC,
        computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS grading_policy (
        id SERIAL PRIMARY KEY,
        letter_grade VARCHAR(10) UNIQUE NOT NULL,
        min_percent NUMERIC NOT NULL,
        grade_point NUMERIC NOT NULL
      );

      CREATE TABLE IF NOT EXISTS course_prerequisites (
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        prerequisite_course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        PRIMARY KEY (course_id, prerequisite_course_id)
      );

      CREATE TABLE IF NOT EXISTS instructor_teaching_preferences (
        id SERIAL PRIMARY KEY,
        instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        semester_id INTEGER REFERENCES semesters(id),
        day_of_week INTEGER NOT NULL,
        start_time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assessment_components (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        max_marks NUMERIC NOT NULL,
        weight_percent NUMERIC NOT NULL
      );

      CREATE TABLE IF NOT EXISTS marks (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE CASCADE,
        component_id INTEGER REFERENCES assessment_components(id) ON DELETE CASCADE,
        marks_obtained NUMERIC,
        entered_by INTEGER REFERENCES users(id),
        finalized INTEGER DEFAULT 0,
        finalized_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (enrollment_id, component_id)
      );

      CREATE TABLE IF NOT EXISTS marks_revision_requests (
        id SERIAL PRIMARY KEY,
        mark_id INTEGER REFERENCES marks(id) ON DELETE CASCADE,
        requested_by INTEGER REFERENCES users(id),
        reason TEXT NOT NULL,
        old_value NUMERIC,
        new_value NUMERIC NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO grading_policy (letter_grade, min_percent, grade_point) VALUES
        ('O', 90, 10), ('A+', 80, 9), ('A', 70, 8),
        ('B+', 60, 7), ('B', 50, 6), ('C', 40, 5), ('F', 0, 0)
      ON CONFLICT DO NOTHING;

      -- Create SQL Views in PostgreSQL
      CREATE OR REPLACE VIEW v_student_timetables AS
      SELECT e.student_id, e.id AS enrollment_id, e.section_id,
             c.code AS course_code, c.title AS course_title,
             s.section_code, s.room,
             ss.id AS slot_id, ss.day_of_week, ss.start_time, ss.end_time
      FROM enrollments e
      JOIN section_schedule_slots ss ON ss.id = e.chosen_slot_id
      JOIN sections s ON s.id = e.section_id
      JOIN courses c ON c.id = s.course_id
      WHERE e.status = 'registered';

      CREATE OR REPLACE VIEW v_timetable_clashes AS
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

      CREATE OR REPLACE VIEW v_section_capacity_status AS
      SELECT s.id AS section_id, s.course_id, s.semester_id, s.capacity,
             COUNT(e.id) AS enrolled_count,
             (s.capacity - COUNT(e.id)) AS seats_remaining,
             CASE WHEN COUNT(e.id) >= s.capacity THEN 1 ELSE 0 END AS is_full
      FROM sections s
      LEFT JOIN enrollments e ON e.section_id = s.id AND e.status = 'registered'
      GROUP BY s.id;

      CREATE OR REPLACE VIEW v_student_grades AS
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

      CREATE OR REPLACE VIEW v_student_sgpa AS
      SELECT student_id, semester_id,
             SUM(credits) AS total_credits,
             SUM(credit_points) AS total_credit_points,
             ROUND(SUM(credit_points) / SUM(credits), 2) AS sgpa
      FROM v_student_grades
      WHERE workflow_status = 'published' AND grade_point IS NOT NULL
      GROUP BY student_id, semester_id;

      CREATE OR REPLACE VIEW v_student_cgpa AS
      SELECT student_id,
             SUM(credits) AS total_cumulative_credits,
             SUM(credit_points) AS total_cumulative_points,
             ROUND(SUM(credit_points) / SUM(credits), 2) AS cgpa
      FROM v_student_grades
      WHERE workflow_status = 'published' AND grade_point IS NOT NULL
      GROUP BY student_id;
    `);

    // Add new columns to existing users table if they don't exist
    for (const col of ['password', 'department', 'employee_id']) {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} VARCHAR(255)`).catch(() => {});
    }
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed INTEGER DEFAULT 0`).catch(() => {});

    // Drop removed tables (safe - no FK references)
    for (const table of ['admins', 'dept_heads', 'academic_staff', 'instructors']) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`).catch(() => {});
    }

    // Fix sections.instructor_id FK to reference users instead of instructors
    await client.query(`
      ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_instructor_id_fkey
    `).catch(() => {});
    await client.query(`
      ALTER TABLE sections ADD CONSTRAINT sections_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES users(id)
    `).catch(() => {});

    // Fix instructor_teaching_preferences FK
    await client.query(`
      ALTER TABLE instructor_teaching_preferences DROP CONSTRAINT IF EXISTS instructor_teaching_preferences_instructor_id_fkey
    `).catch(() => {});
    await client.query(`
      ALTER TABLE instructor_teaching_preferences ADD CONSTRAINT instructor_teaching_preferences_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
    `).catch(() => {});

    // Check if seeded
    const countRes = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      console.log('[PostgreSQL] Seeding default database users and courses...');
      const hash = (pw) => bcrypt.hashSync(pw, 10);

      await client.query(`
        INSERT INTO users (email, password_hash, password, name, role, department, employee_id, profile_completed) VALUES
        ('alice@student.uni.edu', '${hash('student123')}', 'student123', 'Alice Johnson', 'student', NULL, NULL, 0),
        ('dr.smith@uni.edu', '${hash('prof1234')}', 'prof1234', 'Prof. John Smith', 'instructor', 'Computer Science', 'EMP001', 1),
        ('staff@uni.edu', '${hash('staff123')}', 'staff123', 'Sarah Williams', 'academic_staff', NULL, NULL, 1),
        ('head@uni.edu', '${hash('head123')}', 'head123', 'Dr. Anita Sharma', 'dept_head', 'cs', NULL, 1),
        ('admin@uni.edu', '${hash('admin123')}', 'admin123', 'System Admin', 'admin', NULL, NULL, 1),
        ('ram.das@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Ram Das', 'student', NULL, NULL, 0),
        ('priya.verma@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Priya Verma', 'student', NULL, NULL, 0),
        ('amit.sharma@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Amit Sharma', 'student', NULL, NULL, 0),
        ('nisha.patel@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Nisha Patel', 'student', NULL, NULL, 0),
        ('rohan.gupta@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Rohan Gupta', 'student', NULL, NULL, 0),
        ('sneha.roy@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Sneha Roy', 'student', NULL, NULL, 0),
        ('arjun.nair@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Arjun Nair', 'student', NULL, NULL, 0),
        ('deepa.menon@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Deepa Menon', 'student', NULL, NULL, 0),
        ('vikram.singh@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Vikram Singh', 'student', NULL, NULL, 0),
        ('kavya.iyer@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Kavya Iyer', 'student', NULL, NULL, 0),
        ('ravi.kumar@mtech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Ravi Kumar', 'student', NULL, NULL, 0),
        ('ananya.das@mtech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Ananya Das', 'student', NULL, NULL, 0),
        ('suresh.rao@mtech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Suresh Rao', 'student', NULL, NULL, 0),
        ('leela.shah@mtech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Leela Shah', 'student', NULL, NULL, 0),
        ('mohan.bose@mtech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Mohan Bose', 'student', NULL, NULL, 0),
        ('tanvi.joshi@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Tanvi Joshi', 'student', NULL, NULL, 0),
        ('harsh.gupta@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Harsh Gupta', 'student', NULL, NULL, 0),
        ('simran.kaur@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Simran Kaur', 'student', NULL, NULL, 0),
        ('dev.mehta@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Dev Mehta', 'student', NULL, NULL, 0),
        ('aisha.khan@btech.uni.edu', '${hash('pass1234')}', 'pass1234', 'Aisha Khan', 'student', NULL, NULL, 0),
        ('neha.sharma@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Neha Sharma', 'student', NULL, NULL, 0),
        ('arun.pillai@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Arun Pillai', 'student', NULL, NULL, 0),
        ('divya.bhat@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Divya Bhat', 'student', NULL, NULL, 0),
        ('kiran.reddy@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Kiran Reddy', 'student', NULL, NULL, 0),
        ('sanjay.mehta@msc.uni.edu', '${hash('pass1234')}', 'pass1234', 'Sanjay Mehta', 'student', NULL, NULL, 0),
        ('anita.roy@uni.edu', '${hash('prof1234')}', 'prof1234', 'Prof. Anita Roy', 'instructor', 'Computer Science', 'EMP002', 1),
        ('ramesh.iyer@uni.edu', '${hash('prof1234')}', 'prof1234', 'Prof. Ramesh Iyer', 'instructor', 'Computer Science', 'EMP003', 1),
        ('sunita.bose@uni.edu', '${hash('prof1234')}', 'prof1234', 'Prof. Sunita Bose', 'instructor', 'Economics', 'EMP004', 1),
        ('girish.nair@uni.edu', '${hash('prof1234')}', 'prof1234', 'Prof. Girish Nair', 'instructor', 'Statistics', 'EMP005', 1),
        ('kavita.sharma@uni.edu', '${hash('prof1234')}', 'prof1234', 'Prof. Kavita Sharma', 'instructor', 'Computer Science', 'EMP006', 1);

        INSERT INTO programs (code, name, department) VALUES 
        ('BTECH-CS', 'B.Tech Computer Science', 'cs'),
        ('MSC-CS', 'M.Sc Computer Science', 'cs'),
        ('MTECH-CS', 'M.Tech Computer Science', 'cs'),
        ('BTECH-ECO', 'B.Tech Economics', 'eco'),
        ('MSC-STAT', 'M.Sc Statistics', 'stat');

        INSERT INTO semesters (name, year, is_active, registration_open, exams_completed) VALUES ('Fall', 2025, 1, 1, 0);

        INSERT INTO courses (code, title, credits, description, department, degree_level, is_published) VALUES
        ('CS101', 'Data Structures', 6, 'Fundamental data structures and algorithms', 'cs', 'btech', 1),
        ('CS102', 'Algorithms', 6, 'Design and analysis of algorithms', 'cs', 'btech', 1),
        ('CS103', 'Database Management Systems', 6, 'Relational databases and SQL', 'cs', 'btech', 1),
        ('CS201', 'Machine Learning', 6, 'Supervised and unsupervised ML algorithms', 'cs', 'msc', 1),
        ('CS202', 'Natural Language Processing', 6, 'NLP techniques and applications', 'cs', 'msc', 1),
        ('CS203', 'Computer Vision', 6, 'Image processing and deep learning for vision', 'cs', 'msc', 1),
        ('CS301', 'Advanced Algorithms', 6, 'Advanced algorithm design', 'cs', 'mtech', 1),
        ('CS302', 'Distributed Systems', 6, 'Distributed computing', 'cs', 'mtech', 1),
        ('CS303', 'Cloud Computing', 6, 'Cloud infrastructure', 'cs', 'mtech', 1),
        ('ECO101', 'Microeconomics', 6, 'Individual economic decision making', 'eco', 'btech', 1),
        ('ECO102', 'Macroeconomics', 6, 'Economy-wide phenomena', 'eco', 'btech', 1),
        ('ECO103', 'Statistics for Economics', 6, 'Statistical methods for economic analysis', 'eco', 'btech', 1),
        ('STAT201', 'Probability Theory', 6, 'Probability spaces', 'stat', 'msc', 1),
        ('STAT202', 'Statistical Inference', 6, 'Estimation and hypothesis testing', 'stat', 'msc', 1),
        ('STAT203', 'Time Series Analysis', 6, 'Analysis of time-indexed data', 'stat', 'msc', 1);
      `);
    }

    // Reset PostgreSQL SERIAL Sequences to MAX(id)
    await client.query(`
      SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
      SELECT setval(pg_get_serial_sequence('students', 'id'), COALESCE((SELECT MAX(id) FROM students), 1));
      SELECT setval(pg_get_serial_sequence('courses', 'id'), COALESCE((SELECT MAX(id) FROM courses), 1));
      SELECT setval(pg_get_serial_sequence('sections', 'id'), COALESCE((SELECT MAX(id) FROM sections), 1));
      SELECT setval(pg_get_serial_sequence('semesters', 'id'), COALESCE((SELECT MAX(id) FROM semesters), 1));
      SELECT setval(pg_get_serial_sequence('programs', 'id'), COALESCE((SELECT MAX(id) FROM programs), 1));
    `).catch(() => {});

    client.release();
    return true;
  } catch (err) {
    console.error('[PostgreSQL Init Error]:', err.message);
    return false;
  }
}
