import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/university.db');
const schemaPath = path.join(__dirname, 'schema.sql');

let dbInstance = null;
let wrapperInstance = null;
let initPromise = null;

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
    `);

    db.exec(`
      INSERT INTO programs (code, name, department) VALUES 
      ('BTECH-CS', 'B.Tech Computer Science', 'cs'),
      ('MSC-CS', 'M.Sc Computer Science', 'cs'),
      ('MTECH-CS', 'M.Tech Computer Science', 'cs'),
      ('BTECH-ECO', 'B.Tech Economics', 'eco'),
      ('MSC-STAT', 'M.Sc Statistics', 'stat');
    `);

    db.exec(`
      INSERT INTO semesters (semester_number, name, year, is_active, registration_open, exams_completed) VALUES
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
      INSERT OR IGNORE INTO academic_staff (user_id, staff_code, office_room) VALUES
      ((SELECT id FROM users WHERE email='staff@uni.edu'), 'STF001', 'Room 102');

      INSERT OR IGNORE INTO dept_heads (user_id, department, head_code) VALUES
      ((SELECT id FROM users WHERE email='head@uni.edu'), 'cs', 'HOD001');

      INSERT OR IGNORE INTO admins (user_id, admin_code) VALUES
      ((SELECT id FROM users WHERE email='admin@uni.edu'), 'ADM001');
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
      INSERT OR IGNORE INTO instructors (user_id, department, employee_id, profile_completed) VALUES
      ((SELECT id FROM users WHERE email='dr.smith@uni.edu'), 'Computer Science', 'EMP001', 1),
      ((SELECT id FROM users WHERE email='anita.roy@uni.edu'), 'Computer Science', 'EMP002', 1),
      ((SELECT id FROM users WHERE email='ramesh.iyer@uni.edu'), 'Computer Science', 'EMP003', 1),
      ((SELECT id FROM users WHERE email='sunita.bose@uni.edu'), 'Economics', 'EMP004', 1),
      ((SELECT id FROM users WHERE email='girish.nair@uni.edu'), 'Statistics', 'EMP005', 1),
      ((SELECT id FROM users WHERE email='kavita.sharma@uni.edu'), 'Computer Science', 'EMP006', 1);
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
      ((SELECT id FROM courses WHERE code='CS101'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='dr.smith@uni.edu'))),
      ((SELECT id FROM courses WHERE code='CS102'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='dr.smith@uni.edu'))),
      ((SELECT id FROM courses WHERE code='CS103'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='dr.smith@uni.edu'))),
      ((SELECT id FROM courses WHERE code='CS201'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='anita.roy@uni.edu'))),
      ((SELECT id FROM courses WHERE code='CS202'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='anita.roy@uni.edu'))),
      ((SELECT id FROM courses WHERE code='CS203'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='anita.roy@uni.edu'))),
      ((SELECT id FROM courses WHERE code='CS301'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='ramesh.iyer@uni.edu'))),
      ((SELECT id FROM courses WHERE code='CS302'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='ramesh.iyer@uni.edu'))),
      ((SELECT id FROM courses WHERE code='CS303'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='ramesh.iyer@uni.edu'))),
      ((SELECT id FROM courses WHERE code='ECO101'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='sunita.bose@uni.edu'))),
      ((SELECT id FROM courses WHERE code='ECO102'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='sunita.bose@uni.edu'))),
      ((SELECT id FROM courses WHERE code='ECO103'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='sunita.bose@uni.edu'))),
      ((SELECT id FROM courses WHERE code='STAT201'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='girish.nair@uni.edu'))),
      ((SELECT id FROM courses WHERE code='STAT202'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='girish.nair@uni.edu'))),
      ((SELECT id FROM courses WHERE code='STAT203'), (SELECT id FROM semesters WHERE semester_number=1 AND year=2025), 'A', 60, 0, 0, (SELECT id FROM instructors WHERE user_id=(SELECT id FROM users WHERE email='girish.nair@uni.edu')));
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
