import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { getPostgresPool } from './postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/university.db');
const schemaPath = path.join(__dirname, 'schema.sql');

let dbInstance = null;
let wrapperInstance = null;
let initPromise = null;
let pgSyncChain = Promise.resolve(); // Serializes PG writes to respect FK order

function convertSqlForPostgres(sql) {
  let paramIndex = 1;
  let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  // Handle SQLite-specific syntax
  pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
  pgSql = pgSql.replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO');
  pgSql = pgSql.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
  pgSql = pgSql.replace(/AUTOINCREMENT/gi, '');
  
  if (sql.match(/INSERT OR IGNORE INTO/i) && !pgSql.match(/ON CONFLICT/i)) {
    pgSql += ' ON CONFLICT DO NOTHING';
  }
  if (sql.match(/INSERT OR REPLACE INTO/i) && !pgSql.match(/ON CONFLICT/i)) {
    pgSql += ' ON CONFLICT DO NOTHING';
  }
  return pgSql;
}

function syncToPostgres(sql, params = []) {
  const pool = getPostgresPool();
  if (!pool) return;
  
  // Skip read-only queries, PRAGMA, and internal SQLite queries
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') || 
      trimmed.startsWith('PRAGMA') || 
      trimmed.startsWith('CREATE') ||
      trimmed.includes('LAST_INSERT_ROWID') ||
      trimmed.includes('SQLITE_SEQUENCE')) {
    return;
  }
  
  try {
    const pgSql = convertSqlForPostgres(sql);
    // Chain writes so FK dependencies are respected (e.g. users before students)
    pgSyncChain = pgSyncChain.then(() =>
      pool.query(pgSql, params)
        .then((res) => {
          console.log(`[PG Sync OK] ${res.rowCount} row(s) | ${pgSql.slice(0, 100)}`);
        })
        .catch((err) => {
          console.warn(`[PG Sync FAIL] ${err.message} | ${pgSql.slice(0, 100)}`);
        })
    );
  } catch (e) {
    console.warn(`[PG Sync Error] ${e.message}`);
  }
}

function saveDb() {
  if (!dbInstance) return;
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(dbInstance.export()));
  } catch (err) {
    // Ignore save errors on read-only environments
  }
}

function rowToObject(columns, values) {
  const row = {};
  columns.forEach((col, i) => { row[col] = values[i]; });
  return row;
}

function seedSqlite(db) {
  try {
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const P = hash('pass1234');
    const PROF = hash('prof1234');
    const S123 = hash('student123');
    const ST123 = hash('staff123');
    const HD123 = hash('head123');
    const ADM = hash('admin123');

    db.exec(`
      INSERT OR IGNORE INTO users (email, password_hash, password, name, role, department, employee_id, profile_completed) VALUES
      ('alice@student.uni.edu', '${S123}', 'student123', 'Alice Johnson', 'student', NULL, NULL, 0),
      ('dr.smith@uni.edu', '${PROF}', 'prof1234', 'Prof. John Smith', 'instructor', 'Computer Science', 'EMP001', 1),
      ('staff@uni.edu', '${ST123}', 'staff123', 'Sarah Williams', 'academic_staff', NULL, NULL, 1),
      ('head@uni.edu', '${HD123}', 'head123', 'Dr. Anita Sharma', 'dept_head', 'cs', NULL, 1),
      ('admin@uni.edu', '${ADM}', 'admin123', 'System Admin', 'admin', NULL, NULL, 1),
      
      ('ram.das@btech.uni.edu', '${P}', 'pass1234', 'Ram Das', 'student', NULL, NULL, 0),
      ('priya.verma@btech.uni.edu', '${P}', 'pass1234', 'Priya Verma', 'student', NULL, NULL, 0),
      ('amit.sharma@btech.uni.edu', '${P}', 'pass1234', 'Amit Sharma', 'student', NULL, NULL, 0),
      ('nisha.patel@btech.uni.edu', '${P}', 'pass1234', 'Nisha Patel', 'student', NULL, NULL, 0),
      ('rohan.gupta@btech.uni.edu', '${P}', 'pass1234', 'Rohan Gupta', 'student', NULL, NULL, 0),
      
      ('sneha.roy@msc.uni.edu', '${P}', 'pass1234', 'Sneha Roy', 'student', NULL, NULL, 0),
      ('arjun.nair@msc.uni.edu', '${P}', 'pass1234', 'Arjun Nair', 'student', NULL, NULL, 0),
      ('deepa.menon@msc.uni.edu', '${P}', 'pass1234', 'Deepa Menon', 'student', NULL, NULL, 0),
      ('vikram.singh@msc.uni.edu', '${P}', 'pass1234', 'Vikram Singh', 'student', NULL, NULL, 0),
      ('kavya.iyer@msc.uni.edu', '${P}', 'pass1234', 'Kavya Iyer', 'student', NULL, NULL, 0),
      
      ('ravi.kumar@mtech.uni.edu', '${P}', 'pass1234', 'Ravi Kumar', 'student', NULL, NULL, 0),
      ('ananya.das@mtech.uni.edu', '${P}', 'pass1234', 'Ananya Das', 'student', NULL, NULL, 0),
      ('suresh.rao@mtech.uni.edu', '${P}', 'pass1234', 'Suresh Rao', 'student', NULL, NULL, 0),
      ('leela.shah@mtech.uni.edu', '${P}', 'pass1234', 'Leela Shah', 'student', NULL, NULL, 0),
      ('mohan.bose@mtech.uni.edu', '${P}', 'pass1234', 'Mohan Bose', 'student', NULL, NULL, 0),
      
      ('tanvi.joshi@btech.uni.edu', '${P}', 'pass1234', 'Tanvi Joshi', 'student', NULL, NULL, 0),
      ('harsh.gupta@btech.uni.edu', '${P}', 'pass1234', 'Harsh Gupta', 'student', NULL, NULL, 0),
      ('simran.kaur@btech.uni.edu', '${P}', 'pass1234', 'Simran Kaur', 'student', NULL, NULL, 0),
      ('dev.mehta@btech.uni.edu', '${P}', 'pass1234', 'Dev Mehta', 'student', NULL, NULL, 0),
      ('aisha.khan@btech.uni.edu', '${P}', 'pass1234', 'Aisha Khan', 'student', NULL, NULL, 0),
      
      ('neha.sharma@msc.uni.edu', '${P}', 'pass1234', 'Neha Sharma', 'student', NULL, NULL, 0),
      ('arun.pillai@msc.uni.edu', '${P}', 'pass1234', 'Arun Pillai', 'student', NULL, NULL, 0),
      ('divya.bhat@msc.uni.edu', '${P}', 'pass1234', 'Divya Bhat', 'student', NULL, NULL, 0),
      ('kiran.reddy@msc.uni.edu', '${P}', 'pass1234', 'Kiran Reddy', 'student', NULL, NULL, 0),
      ('sanjay.mehta@msc.uni.edu', '${P}', 'pass1234', 'Sanjay Mehta', 'student', NULL, NULL, 0),
      
      ('anita.roy@uni.edu', '${PROF}', 'prof1234', 'Prof. Anita Roy', 'instructor', 'Computer Science', 'EMP002', 1),
      ('ramesh.iyer@uni.edu', '${PROF}', 'prof1234', 'Prof. Ramesh Iyer', 'instructor', 'Computer Science', 'EMP003', 1),
      ('sunita.bose@uni.edu', '${PROF}', 'prof1234', 'Prof. Sunita Bose', 'instructor', 'Economics', 'EMP004', 1),
      ('girish.nair@uni.edu', '${PROF}', 'prof1234', 'Prof. Girish Nair', 'instructor', 'Statistics', 'EMP005', 1),
      ('kavita.sharma@uni.edu', '${PROF}', 'prof1234', 'Prof. Kavita Sharma', 'instructor', 'Computer Science', 'EMP006', 1);
    `);

    db.exec(`
      INSERT OR IGNORE INTO programs (code, name, department) VALUES 
      ('BTECH-CS', 'B.Tech Computer Science', 'cs'),
      ('MSC-CS', 'M.Sc Computer Science', 'cs'),
      ('MTECH-CS', 'M.Tech Computer Science', 'cs'),
      ('BTECH-ECO', 'B.Tech Economics', 'eco'),
      ('MSC-STAT', 'M.Sc Statistics', 'stat');
    `);

    db.exec(`
      INSERT OR IGNORE INTO semesters (semester_number, name, year, is_active, registration_open, exams_completed) VALUES
      (1, 'Semester 1', 2025, 1, 1, 0),
      (2, 'Semester 2', 2025, 0, 0, 0),
      (3, 'Semester 3', 2025, 0, 0, 0),
      (4, 'Semester 4', 2025, 0, 0, 0),
      (5, 'Semester 5', 2025, 0, 0, 0),
      (6, 'Semester 6', 2025, 0, 0, 0),
      (7, 'Semester 7', 2025, 0, 0, 0),
      (8, 'Semester 8', 2025, 0, 0, 0);
    `);

    db.exec(`
      INSERT OR IGNORE INTO students (user_id, program_id, batch_year, roll_number, profile_completed, previous_degree, previous_grade, current_semester_id) VALUES 
      ((SELECT id FROM users WHERE email='alice@student.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-CS'), 2022, 'CS22001', 1, 'B.Sc', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='ram.das@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-CS'), 2023, 'CS23001', 1, 'Class XII', 'A+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='priya.verma@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-CS'), 2023, 'CS23002', 1, 'Class XII', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='amit.sharma@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-CS'), 2023, 'CS23003', 1, 'Class XII', 'B+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='nisha.patel@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-CS'), 2023, 'CS23004', 1, 'Class XII', 'A+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='rohan.gupta@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-CS'), 2023, 'CS23005', 1, 'Class XII', 'B', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='sneha.roy@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-CS'), 2023, 'MCS23001', 1, 'B.Sc', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='arjun.nair@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-CS'), 2023, 'MCS23002', 1, 'B.Sc', 'A+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='deepa.menon@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-CS'), 2023, 'MCS23003', 1, 'B.Sc', 'B+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='vikram.singh@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-CS'), 2023, 'MCS23004', 1, 'B.Sc', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='kavya.iyer@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-CS'), 2023, 'MCS23005', 1, 'B.Sc', 'A+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='ravi.kumar@mtech.uni.edu'), (SELECT id FROM programs WHERE code='MTECH-CS'), 2023, 'MTC23001', 1, 'B.Tech', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='ananya.das@mtech.uni.edu'), (SELECT id FROM programs WHERE code='MTECH-CS'), 2023, 'MTC23002', 1, 'B.Tech', 'A+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='suresh.rao@mtech.uni.edu'), (SELECT id FROM programs WHERE code='MTECH-CS'), 2023, 'MTC23003', 1, 'B.Tech', 'B+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='leela.shah@mtech.uni.edu'), (SELECT id FROM programs WHERE code='MTECH-CS'), 2023, 'MTC23004', 1, 'B.Tech', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='mohan.bose@mtech.uni.edu'), (SELECT id FROM programs WHERE code='MTECH-CS'), 2023, 'MTC23005', 1, 'B.Tech', 'B', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='tanvi.joshi@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-ECO'), 2023, 'ECO23001', 1, 'Class XII', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='harsh.gupta@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-ECO'), 2023, 'ECO23002', 1, 'Class XII', 'B+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='simran.kaur@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-ECO'), 2023, 'ECO23003', 1, 'Class XII', 'A+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='dev.mehta@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-ECO'), 2023, 'ECO23004', 1, 'Class XII', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='aisha.khan@btech.uni.edu'), (SELECT id FROM programs WHERE code='BTECH-ECO'), 2023, 'ECO23005', 1, 'Class XII', 'B+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='neha.sharma@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-STAT'), 2023, 'STA23001', 1, 'B.Sc', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='arun.pillai@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-STAT'), 2023, 'STA23002', 1, 'B.Sc', 'A+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='divya.bhat@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-STAT'), 2023, 'STA23003', 1, 'B.Sc', 'B+', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='kiran.reddy@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-STAT'), 2023, 'STA23004', 1, 'B.Sc', 'A', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025)),
      ((SELECT id FROM users WHERE email='sanjay.mehta@msc.uni.edu'), (SELECT id FROM programs WHERE code='MSC-STAT'), 2023, 'STA23005', 1, 'B.Sc', 'B', (SELECT id FROM semesters WHERE semester_number=1 AND year=2025));
    `);

    
    db.exec(`
      INSERT OR IGNORE INTO courses (code, title, credits, description, department, degree_level, is_published) VALUES
      ('CS101', 'Data Structures', 6, 'Fundamental data structures and algorithms', 'cs', 'btech', 1),
      ('CS102', 'Algorithms', 6, 'Design and analysis of algorithms', 'cs', 'btech', 1),
      ('CS103', 'Database Management Systems', 6, 'Relational databases and SQL', 'cs', 'btech', 1),
      ('CS201', 'Machine Learning', 6, 'Supervised and unsupervised ML algorithms', 'cs', 'msc', 1),
      ('CS202', 'Natural Language Processing', 6, 'NLP techniques and applications', 'cs', 'msc', 1),
      ('CS203', 'Computer Vision', 6, 'Image processing and deep learning for vision', 'cs', 'msc', 1),
      ('CS301', 'Advanced Algorithms', 6, 'Advanced algorithm design and complexity theory', 'cs', 'mtech', 1),
      ('CS302', 'Distributed Systems', 6, 'Distributed computing and consensus protocols', 'cs', 'mtech', 1),
      ('CS303', 'Cloud Computing', 6, 'Cloud infrastructure and microservices', 'cs', 'mtech', 1),
      ('ECO101', 'Microeconomics', 6, 'Individual economic decision making', 'eco', 'btech', 1),
      ('ECO102', 'Macroeconomics', 6, 'Economy-wide phenomena and policy', 'eco', 'btech', 1),
      ('ECO103', 'Statistics for Economics', 6, 'Statistical methods for economic analysis', 'eco', 'btech', 1),
      ('STAT201', 'Probability Theory', 6, 'Probability spaces and random variables', 'stat', 'msc', 1),
      ('STAT202', 'Statistical Inference', 6, 'Estimation and hypothesis testing', 'stat', 'msc', 1),
      ('STAT203', 'Time Series Analysis', 6, 'Analysis of time-indexed data', 'stat', 'msc', 1);
    `);

    db.exec(`
      INSERT OR IGNORE INTO sections (course_id, semester_id, section_code, capacity, exam_requested, exam_reg_open, instructor_id) VALUES
      ((SELECT id FROM courses WHERE code='CS101'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='dr.smith@uni.edu')),
      ((SELECT id FROM courses WHERE code='CS102'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='dr.smith@uni.edu')),
      ((SELECT id FROM courses WHERE code='CS103'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='dr.smith@uni.edu')),
      ((SELECT id FROM courses WHERE code='CS201'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='anita.roy@uni.edu')),
      ((SELECT id FROM courses WHERE code='CS202'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='anita.roy@uni.edu')),
      ((SELECT id FROM courses WHERE code='CS203'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='anita.roy@uni.edu')),
      ((SELECT id FROM courses WHERE code='CS301'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='ramesh.iyer@uni.edu')),
      ((SELECT id FROM courses WHERE code='CS302'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='ramesh.iyer@uni.edu')),
      ((SELECT id FROM courses WHERE code='CS303'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='ramesh.iyer@uni.edu')),
      ((SELECT id FROM courses WHERE code='ECO101'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='sunita.bose@uni.edu')),
      ((SELECT id FROM courses WHERE code='ECO102'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='sunita.bose@uni.edu')),
      ((SELECT id FROM courses WHERE code='ECO103'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='sunita.bose@uni.edu')),
      ((SELECT id FROM courses WHERE code='STAT201'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='girish.nair@uni.edu')),
      ((SELECT id FROM courses WHERE code='STAT202'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='girish.nair@uni.edu')),
      ((SELECT id FROM courses WHERE code='STAT203'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM users WHERE email='girish.nair@uni.edu'));
    `);

    db.exec(`
      INSERT INTO section_schedule_slots (section_id, day_of_week, start_time, end_time) VALUES
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS101'), 1, '09:00', '11:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS102'), 2, '09:00', '11:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS103'), 3, '09:00', '11:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS201'), 1, '11:00', '13:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS202'), 2, '11:00', '13:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS203'), 3, '11:00', '13:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS301'), 1, '14:00', '16:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS302'), 2, '14:00', '16:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS303'), 3, '14:00', '16:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='ECO101'), 4, '09:00', '11:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='ECO102'), 5, '09:00', '11:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='ECO103'), 4, '11:00', '13:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='STAT201'), 4, '14:00', '16:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='STAT202'), 5, '14:00', '16:00'),
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='STAT203'), 5, '11:00', '13:00');

      INSERT OR IGNORE INTO enrollments (student_id, section_id, chosen_slot_id, status) VALUES
      ((SELECT id FROM students WHERE user_id=(SELECT id FROM users WHERE email='alice@student.uni.edu')), (SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS101'), (SELECT id FROM section_schedule_slots WHERE section_id=(SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS101') LIMIT 1), 'registered'),
      ((SELECT id FROM students WHERE user_id=(SELECT id FROM users WHERE email='ram.das@btech.uni.edu')), (SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS101'), (SELECT id FROM section_schedule_slots WHERE section_id=(SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS101') LIMIT 1), 'registered');

      INSERT OR IGNORE INTO result_workflow (enrollment_id, status) VALUES
      (1, 'checked_pending_verification'),
      (2, 'checked_pending_verification');

      INSERT OR IGNORE INTO assessment_components (section_id, name, max_marks, weight_percent) VALUES
      ((SELECT s.id FROM sections s JOIN courses c ON c.id=s.course_id WHERE c.code='CS101'), 'Final Exam', 100, 100);

      INSERT OR IGNORE INTO marks (enrollment_id, component_id, marks_obtained, entered_by) VALUES
      (1, 1, 78, (SELECT id FROM users WHERE email='dr.smith@uni.edu')),
      (2, 1, 82, (SELECT id FROM users WHERE email='dr.smith@uni.edu'));

      INSERT OR IGNORE INTO marks_revision_requests (mark_id, requested_by, reason, student_reason, old_value, status) VALUES
      (1, (SELECT id FROM users WHERE email='alice@student.uni.edu'), 'Requesting recheck for Question 4 grading calculation', 'Requesting recheck for Question 4 grading calculation', 78, 'pending_staff_review');
    `);

    saveDb();
    console.log('[SQLite] Automatically seeded default users and initial database schema.');
  } catch (err) {
    console.error(err);
    // Ignore auto-seed errors
  }
}

function createWrapper(db) {
  return {
    exec(sql) {
      db.exec(sql);
      saveDb();
      // Mirror write to PostgreSQL
      syncToPostgres(sql);
    },
    prepare(sql) {
      return {
        run(...params) {
          db.run(sql, params);
          let lastInsertRowid = 0;
          try {
            const result = db.exec('SELECT last_insert_rowid() AS id');
            lastInsertRowid = result[0]?.values[0]?.[0] ?? 0;
          } catch (e) {}
          saveDb();
          // Mirror write to PostgreSQL
          syncToPostgres(sql, params);
          return { lastInsertRowid, changes: db.getRowsModified() };
        },
        get(...params) {
          const stmt = db.prepare(sql);
          try {
            stmt.bind(params);
            if (stmt.step()) {
              return rowToObject(stmt.getColumnNames(), stmt.get());
            }
            return undefined;
          } finally {
            stmt.free();
          }
        },
        all(...params) {
          const stmt = db.prepare(sql);
          const rows = [];
          try {
            stmt.bind(params);
            while (stmt.step()) {
              rows.push(rowToObject(stmt.getColumnNames(), stmt.get()));
            }
            return rows;
          } finally {
            stmt.free();
          }
        }
      };
    },
    pragma(_setting) {}
  };
}

export async function initDb() {
  if (wrapperInstance) return wrapperInstance;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const SQL = await initSqlJs();
        if (fs.existsSync(dbPath)) {
          dbInstance = new SQL.Database(fs.readFileSync(dbPath));
        } else {
          dbInstance = new SQL.Database();
          if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            dbInstance.exec(schema);
          }
          saveDb();
        }
        dbInstance.exec('PRAGMA foreign_keys = ON;');

        try {
          const res = dbInstance.exec('SELECT COUNT(*) FROM users');
          const count = res[0]?.values[0]?.[0] ?? 0;
          if (count === 0) {
            seedSqlite(dbInstance);
          }
        } catch (err) {
          seedSqlite(dbInstance);
        }

        // Hydrate SQLite from live PostgreSQL to ensure 100% ID synchronization
        const { hydrateSqliteFromPostgres } = await import('./hydrate.js');
        await hydrateSqliteFromPostgres(dbInstance);

        wrapperInstance = createWrapper(dbInstance);
        return wrapperInstance;
      } catch (err) {
        console.error('[Database Init Error]:', err.message);
        wrapperInstance = {
          prepare: () => ({ run: () => ({}), get: () => undefined, all: () => [] }),
          exec: () => {}
        };
        return wrapperInstance;
      }
    })();
  }

  return initPromise;
}

export async function getDb() {
  if (!wrapperInstance) await initDb();
  return wrapperInstance;
}

export default {
  get prepare() {
    if (!wrapperInstance) {
      initDb().catch(console.error);
      return (sql) => ({
        run: () => ({}),
        get: (...params) => wrapperInstance ? wrapperInstance.prepare(sql).get(...params) : undefined,
        all: (...params) => wrapperInstance ? wrapperInstance.prepare(sql).all(...params) : []
      });
    }
    return wrapperInstance.prepare.bind(wrapperInstance);
  },
  get exec() {
    if (!wrapperInstance) {
      initDb().catch(console.error);
      return (sql) => wrapperInstance ? wrapperInstance.exec(sql) : undefined;
    }
    return wrapperInstance.exec.bind(wrapperInstance);
  },
  setInstance(instance) {
    wrapperInstance = instance;
  }
};
