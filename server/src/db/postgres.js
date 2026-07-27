import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

let pool = null;
let pgWrapper = null;

export function getPostgresPool() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURI;
  if (!connectionString) return null;

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
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
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
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
        program_id INTEGER REFERENCES programs(id),
        batch_year INTEGER NOT NULL,
        roll_number VARCHAR(100) UNIQUE NOT NULL,
        profile_completed INTEGER DEFAULT 0,
        previous_degree VARCHAR(100),
        previous_grade VARCHAR(50),
        current_semester_id INTEGER REFERENCES semesters(id)
      );

      CREATE TABLE IF NOT EXISTS instructors (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        department VARCHAR(100) NOT NULL,
        employee_id VARCHAR(100) UNIQUE NOT NULL,
        profile_completed INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS academic_staff (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        staff_code VARCHAR(100) UNIQUE NOT NULL,
        office_room VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS dept_heads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        department VARCHAR(100) NOT NULL,
        head_code VARCHAR(100) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        admin_code VARCHAR(100) UNIQUE NOT NULL
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
        instructor_id INTEGER REFERENCES instructors(id),
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

    // Check if seeded
    const countRes = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      console.log('[PostgreSQL] Seeding default database users and courses...');
      const hash = (pw) => bcrypt.hashSync(pw, 10);
      const P = hash('pass1234');
      const PROF = hash('prof1234');
      const S123 = hash('student123');
      const ST123 = hash('staff123');
      const HD123 = hash('head123');
      const ADM = hash('admin123');

      await client.query(`
        INSERT INTO users (email, password_hash, name, role) VALUES
        ('alice@student.uni.edu', '${S123}', 'Alice Johnson', 'student'),
        ('dr.smith@uni.edu', '${PROF}', 'Prof. John Smith', 'instructor'),
        ('staff@uni.edu', '${ST123}', 'Sarah Williams', 'academic_staff'),
        ('head@uni.edu', '${HD123}', 'Dr. Anita Sharma', 'dept_head'),
        ('admin@uni.edu', '${ADM}', 'System Admin', 'admin'),
        ('ram.das@btech.uni.edu', '${P}', 'Ram Das', 'student'),
        ('priya.verma@btech.uni.edu', '${P}', 'Priya Verma', 'student'),
        ('amit.sharma@btech.uni.edu', '${P}', 'Amit Sharma', 'student'),
        ('nisha.patel@btech.uni.edu', '${P}', 'Nisha Patel', 'student'),
        ('rohan.gupta@btech.uni.edu', '${P}', 'Rohan Gupta', 'student'),
        ('sneha.roy@msc.uni.edu', '${P}', 'Sneha Roy', 'student'),
        ('arjun.nair@msc.uni.edu', '${P}', 'Arjun Nair', 'student'),
        ('deepa.menon@msc.uni.edu', '${P}', 'Deepa Menon', 'student'),
        ('vikram.singh@msc.uni.edu', '${P}', 'Vikram Singh', 'student'),
        ('kavya.iyer@msc.uni.edu', '${P}', 'Kavya Iyer', 'student'),
        ('ravi.kumar@mtech.uni.edu', '${P}', 'Ravi Kumar', 'student'),
        ('ananya.das@mtech.uni.edu', '${P}', 'Ananya Das', 'student'),
        ('suresh.rao@mtech.uni.edu', '${P}', 'Suresh Rao', 'student'),
        ('leela.shah@mtech.uni.edu', '${P}', 'Leela Shah', 'student'),
        ('mohan.bose@mtech.uni.edu', '${P}', 'Mohan Bose', 'student'),
        ('tanvi.joshi@btech.uni.edu', '${P}', 'Tanvi Joshi', 'student'),
        ('harsh.gupta@btech.uni.edu', '${P}', 'Harsh Gupta', 'student'),
        ('simran.kaur@btech.uni.edu', '${P}', 'Simran Kaur', 'student'),
        ('dev.mehta@btech.uni.edu', '${P}', 'Dev Mehta', 'student'),
        ('aisha.khan@btech.uni.edu', '${P}', 'Aisha Khan', 'student'),
        ('neha.sharma@msc.uni.edu', '${P}', 'Neha Sharma', 'student'),
        ('arun.pillai@msc.uni.edu', '${P}', 'Arun Pillai', 'student'),
        ('divya.bhat@msc.uni.edu', '${P}', 'Divya Bhat', 'student'),
        ('kiran.reddy@msc.uni.edu', '${P}', 'Kiran Reddy', 'student'),
        ('sanjay.mehta@msc.uni.edu', '${P}', 'Sanjay Mehta', 'student'),
        ('anita.roy@uni.edu', '${PROF}', 'Prof. Anita Roy', 'instructor'),
        ('ramesh.iyer@uni.edu', '${PROF}', 'Prof. Ramesh Iyer', 'instructor'),
        ('sunita.bose@uni.edu', '${PROF}', 'Prof. Sunita Bose', 'instructor'),
        ('girish.nair@uni.edu', '${PROF}', 'Prof. Girish Nair', 'instructor'),
        ('kavita.sharma@uni.edu', '${PROF}', 'Prof. Kavita Sharma', 'instructor');

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

    client.release();
    return true;
  } catch (err) {
    console.error('[PostgreSQL Init Error]:', err.message);
    return false;
  }
}
