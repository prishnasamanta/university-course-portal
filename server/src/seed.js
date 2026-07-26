import bcrypt from 'bcryptjs';
import { initDb } from './db/index.js';
import dbHolder from './db/index.js';
import { resetDatabase, clearDatabaseTables } from './db/reset.js';

const hash = (pw) => bcrypt.hashSync(pw, 10);
const DAY = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5 };

function insertSlots(db, sectionId, slots) {
  const ins = db.prepare('INSERT INTO section_schedule_slots (section_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)');
  for (const s of slots) ins.run(sectionId, s.day, s.start, s.end);
}

function userId(db, email) {
  return db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
}

async function seed() {
  resetDatabase();
  const db = await initDb();
  clearDatabaseTables(db);
  dbHolder.setInstance(db);

  const insertUser = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)');
  insertUser.run('dr.smith@uni.edu', hash('inst123'), 'Dr. Alice Smith', 'instructor');
  insertUser.run('dr.jones@uni.edu', hash('inst123'), 'Dr. Bob Jones', 'instructor');
  insertUser.run('alice@student.uni.edu', hash('student123'), 'Alice Johnson', 'student');
  insertUser.run('bob@student.uni.edu', hash('student123'), 'Bob Williams', 'student');
  insertUser.run('admin@uni.edu', hash('admin123'), 'System Admin', 'admin');
  insertUser.run('staff@uni.edu', hash('staff123'), 'Academic Staff', 'academic_staff');
  insertUser.run('head@uni.edu', hash('head123'), 'Dept Head CS', 'dept_head');

  const inst1User = userId(db, 'dr.smith@uni.edu');
  const inst2User = userId(db, 'dr.jones@uni.edu');
  const stud1User = userId(db, 'alice@student.uni.edu');

  const progCs = db.prepare('INSERT INTO programs (code, name, department) VALUES (?, ?, ?)')
    .run('BSC-CS', 'B.Sc Computer Science', 'Computer Science').lastInsertRowid;

  const inst1 = db.prepare('INSERT INTO instructors (user_id, department, employee_id, profile_completed) VALUES (?, ?, ?, 0)')
    .run(inst1User, 'Computer Science', 'EMP001').lastInsertRowid;
  const inst2 = db.prepare('INSERT INTO instructors (user_id, department, employee_id, profile_completed) VALUES (?, ?, ?, 1)')
    .run(inst2User, 'Computer Science', 'EMP002').lastInsertRowid;

  db.prepare('INSERT INTO semesters (name, year, is_active, registration_open, exams_completed) VALUES (?, ?, ?, ?, ?)')
    .run('Fall', 2025, 1, 1, 0);
  const semFall = db.prepare('SELECT id FROM semesters WHERE name = ? AND year = ?').get('Fall', 2025).id;
  db.prepare('INSERT INTO semesters (name, year, is_active, registration_open, exams_completed) VALUES (?, ?, ?, ?, ?)')
    .run('Spring', 2025, 0, 0, 1);

  db.prepare(`
    INSERT INTO students (user_id, program_id, batch_year, roll_number, profile_completed)
    VALUES (?, ?, ?, ?, 0)
  `).run(stud1User, progCs, 2023, 'CS2023001');
  db.prepare('INSERT INTO students (user_id, program_id, batch_year, roll_number, profile_completed) VALUES (?, ?, ?, ?, 0)')
    .run(userId(db, 'bob@student.uni.edu'), progCs, 2023, 'CS2023002');

  const stud1 = db.prepare('SELECT id FROM students WHERE roll_number = ?').get('CS2023001').id;

  const grades = [
    ['A+', 90, 4.0], ['A', 80, 3.7], ['B+', 75, 3.3], ['B', 70, 3.0],
    ['C+', 65, 2.7], ['C', 60, 2.3], ['D', 50, 1.0], ['F', 0, 0]
  ];
  const insertGrade = db.prepare('INSERT INTO grading_policy (letter_grade, min_percent, grade_point) VALUES (?, ?, ?)');
  for (const g of grades) insertGrade.run(...g);

  const insertCourse = db.prepare(`
    INSERT INTO courses (code, title, credits, description, department, degree_level, required_previous_degree, min_previous_grade, syllabus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCourse.run('CS101', 'Intro to Programming', 4, 'Python basics', 'cs', 'btech', null, null, 'Variables, loops, functions, OOP intro');
  insertCourse.run('CS201', 'Data Structures', 4, 'DSA fundamentals', 'cs', 'btech', 'B.Sc', 'C', 'Arrays, linked lists, trees, graphs');
  insertCourse.run('CS301', 'Database Systems', 3, 'SQL and design', 'cs', 'btech', 'B.Tech', 'B', 'ER diagrams, normalization, SQL, transactions');
  insertCourse.run('MA101', 'Calculus I', 3, 'Differential calculus', 'stat', 'btech', null, null, 'Limits, derivatives, integrals');
  insertCourse.run('ECO201', 'Microeconomics', 3, 'Supply and demand', 'eco', 'btech', null, null, 'Market structures, elasticity, welfare');
  insertCourse.run('CS501', 'Advanced ML', 4, 'Graduate ML course', 'cs', 'msc', 'B.Tech', 'B+', 'Supervised/unsupervised learning, deep nets');
  insertCourse.run('CS601', 'Distributed Systems', 4, 'M.Tech systems course', 'cs', 'mtech', 'M.Sc', 'A', 'Consensus, replication, fault tolerance');
  insertCourse.run('ST301', 'Statistical Inference', 3, 'Graduate statistics', 'stat', 'msc', 'B.Sc', 'B', 'Estimation, hypothesis testing');

  const cs101 = db.prepare('SELECT id FROM courses WHERE code = ?').get('CS101').id;
  const cs201 = db.prepare('SELECT id FROM courses WHERE code = ?').get('CS201').id;
  const cs301 = db.prepare('SELECT id FROM courses WHERE code = ?').get('CS301').id;
  const cs501 = db.prepare('SELECT id FROM courses WHERE code = ?').get('CS501').id;
  const cs601 = db.prepare('SELECT id FROM courses WHERE code = ?').get('CS601').id;
  const st301 = db.prepare('SELECT id FROM courses WHERE code = ?').get('ST301').id;

  db.prepare('INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)').run(cs201, cs101);
  db.prepare('INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)').run(cs301, cs201);
  db.prepare('INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)').run(cs501, cs301);
  db.prepare('INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)').run(cs601, cs501);
  db.prepare('INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)').run(st301, cs101);

  const insertSection = db.prepare(`
    INSERT INTO sections (course_id, semester_id, section_code, instructor_id, capacity, room) VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertSection.run(cs101, semFall, 'A', inst1, 30, 'Lab-101');
  const secCs101 = db.prepare('SELECT id FROM sections WHERE course_id = ? AND section_code = ?').get(cs101, 'A').id;
  insertSlots(db, secCs101, [
    { day: DAY.MON, start: '09:00', end: '11:00' },
    { day: DAY.TUE, start: '09:00', end: '11:00' },
    { day: DAY.WED, start: '09:00', end: '11:00' }
  ]);

  insertSection.run(cs201, semFall, 'A', inst1, 25, 'Lab-201');
  const secCs201 = db.prepare('SELECT id FROM sections WHERE course_id = ? AND section_code = ?').get(cs201, 'A').id;
  insertSlots(db, secCs201, [
    { day: DAY.TUE, start: '14:00', end: '16:00' },
    { day: DAY.THU, start: '14:00', end: '16:00' }
  ]);

  insertSection.run(cs301, semFall, 'A', inst2, 20, 'Lab-301');
  const secCs301 = db.prepare('SELECT id FROM sections WHERE course_id = ? AND section_code = ?').get(cs301, 'A').id;
  insertSlots(db, secCs301, [
    { day: DAY.MON, start: '14:00', end: '16:00' },
    { day: DAY.WED, start: '14:00', end: '16:00' }
  ]);

  insertSection.run(db.prepare('SELECT id FROM courses WHERE code = ?').get('MA101').id, semFall, 'A', inst2, 40, 'Room-105');
  const secMa101 = db.prepare('SELECT id FROM sections WHERE course_id = (SELECT id FROM courses WHERE code = ?)').get('MA101').id;
  insertSlots(db, secMa101, [{ day: DAY.FRI, start: '10:00', end: '12:00' }]);

  insertSection.run(db.prepare('SELECT id FROM courses WHERE code = ?').get('ECO201').id, semFall, 'A', inst2, 35, 'Room-210');
  const secEco = db.prepare('SELECT id FROM sections WHERE course_id = (SELECT id FROM courses WHERE code = ?)').get('ECO201').id;
  insertSlots(db, secEco, [
    { day: DAY.MON, start: '11:00', end: '13:00' },
    { day: DAY.TUE, start: '11:00', end: '13:00' }
  ]);

  insertSection.run(cs501, semFall, 'A', inst1, 15, 'Grad-Lab');
  const secCs501 = db.prepare('SELECT id FROM sections WHERE course_id = ?').get(cs501).id;
  insertSlots(db, secCs501, [{ day: DAY.THU, start: '09:00', end: '11:00' }]);

  insertSection.run(cs601, semFall, 'A', inst1, 12, 'Grad-Lab-2');
  insertSection.run(st301, semFall, 'A', inst2, 18, 'Stat-201');

  db.prepare(`
    INSERT INTO instructor_teaching_preferences (instructor_id, course_id, semester_id, day_of_week, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(inst1, cs101, semFall, DAY.MON, '09:00', '11:00');

  console.log('Seed completed successfully!');
  console.log('\nDemo accounts (profile overlay on first student/instructor login):');
  console.log('  Student:    alice@student.uni.edu / student123');
  console.log('  Instructor: dr.smith@uni.edu / inst123');
  console.log('  Staff:      staff@uni.edu / staff123');
  console.log('  Dept Head:  head@uni.edu / head123');
}

seed().catch(console.error);
