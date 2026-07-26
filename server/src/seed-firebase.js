import bcrypt from 'bcryptjs';
import { initFirebase } from './db/firebase.js';

async function seedFirebase() {
  console.log('\x1b[36m=====================================================\x1b[0m');
  console.log('\x1b[36m   🔥 University Course Portal - Firebase Seed Tool  \x1b[0m');
  console.log('\x1b[36m=====================================================\x1b[0m\n');

  const { db, connected, projectId } = initFirebase();

  if (!connected || !db) {
    console.error('\x1b[31m❌ Error:\x1b[0m Firebase is not connected.');
    console.error('Please provide a valid \x1b[33mserviceAccountKey.json\x1b[0m file in the server directory, or set environment variables in \x1b[33m.env\x1b[0m.');
    console.error('Check DEPLOYMENT.md for setup instructions.\n');
    process.exit(1);
  }

  console.log(`\x1b[32m✔ Connected to Firebase Project:\x1b[0m ${projectId}`);
  console.log('Seeding initial university data into Firestore collections...\n');

  const hash = (pass) => bcrypt.hashSync(pass, 10);

  // 1. Users Collection
  const users = [
    // Primary Demo Accounts
    { id: 1, email: 'admin@uni.edu', password_hash: hash('admin123'), name: 'System Admin', role: 'admin' },
    { id: 2, email: 'staff@uni.edu', password_hash: hash('staff123'), name: 'Academic Staff', role: 'academic_staff' },
    { id: 3, email: 'head@uni.edu', password_hash: hash('head123'), name: 'Dr. Alan Turing (HOD CS)', role: 'dept_head' },
    { id: 4, email: 'dr.smith@uni.edu', password_hash: hash('inst123'), name: 'Prof. John Smith', role: 'instructor' },
    { id: 5, email: 'dr.jones@uni.edu', password_hash: hash('inst123'), name: 'Prof. Sarah Davis', role: 'instructor' },
    { id: 6, email: 'alice@student.uni.edu', password_hash: hash('student123'), name: 'Alice Johnson', role: 'student' },
    { id: 7, email: 'bob@student.uni.edu', password_hash: hash('student123'), name: 'Bob Williams', role: 'student' },
    
    // Additional Aliases
    { id: 8, email: 'admin@univ.edu', password_hash: hash('admin123'), name: 'System Admin', role: 'admin' },
    { id: 9, email: 'staff@univ.edu', password_hash: hash('staff123'), name: 'Academic Office', role: 'academic_staff' },
    { id: 10, email: 'hod.cs@univ.edu', password_hash: hash('hod123'), name: 'Dr. Alan Turing (HOD CS)', role: 'dept_head' },
    { id: 11, email: 'prof.smith@univ.edu', password_hash: hash('prof123'), name: 'Prof. John Smith', role: 'instructor' },
    { id: 12, email: 'student1@univ.edu', password_hash: hash('stud123'), name: 'Alice Johnson', role: 'student' },
  ];

  console.log('⏳ Seeding users...');
  for (const user of users) {
    await db.collection('users').doc(String(user.id)).set({
      ...user,
      created_at: new Date().toISOString()
    }, { merge: true });
  }

  // 2. Programs Collection
  const programs = [
    { id: 1, code: 'BTECH_CS', name: 'B.Tech Computer Science', department: 'cs' },
    { id: 2, code: 'MTECH_CS', name: 'M.Tech Computer Science', department: 'cs' },
    { id: 3, code: 'MSC_DS', name: 'M.Sc Data Science', department: 'cs' },
  ];

  console.log('⏳ Seeding programs...');
  for (const prog of programs) {
    await db.collection('programs').doc(String(prog.id)).set(prog, { merge: true });
  }

  // 3. Semesters Collection
  const semesters = [
    { id: 1, name: 'Autumn', year: 2025, is_active: 1, registration_open: 1, exams_completed: 1 },
    { id: 2, name: 'Spring', year: 2026, is_active: 0, registration_open: 0, exams_completed: 0 },
  ];

  console.log('⏳ Seeding semesters...');
  for (const sem of semesters) {
    await db.collection('semesters').doc(String(sem.id)).set(sem, { merge: true });
  }

  // 4. Students & Instructors Profiles
  const students = [
    { id: 1, user_id: 6, program_id: 1, batch_year: 2023, roll_number: 'CS2023001', profile_completed: 1, previous_degree: 'High School', previous_grade: 'A', current_semester_id: 1 },
    { id: 2, user_id: 7, program_id: 1, batch_year: 2023, roll_number: 'CS2023002', profile_completed: 1, previous_degree: 'High School', previous_grade: 'B+', current_semester_id: 1 },
    { id: 3, user_id: 12, program_id: 1, batch_year: 2023, roll_number: 'CS2023003', profile_completed: 1, previous_degree: 'High School', previous_grade: 'A', current_semester_id: 1 },
  ];

  console.log('⏳ Seeding student profiles...');
  for (const stud of students) {
    await db.collection('students').doc(String(stud.id)).set(stud, { merge: true });
  }

  const instructors = [
    { id: 1, user_id: 4, department: 'cs', employee_id: 'EMP101', profile_completed: 1 },
    { id: 2, user_id: 5, department: 'cs', employee_id: 'EMP102', profile_completed: 1 },
    { id: 3, user_id: 3, department: 'cs', employee_id: 'EMP100', profile_completed: 1 },
  ];

  console.log('⏳ Seeding instructor profiles...');
  for (const inst of instructors) {
    await db.collection('instructors').doc(String(inst.id)).set(inst, { merge: true });
  }

  // 5. Courses & Prerequisites
  const courses = [
    { id: 1, code: 'CS101', title: 'Programming Fundamentals', credits: 4, description: 'Introduction to C/Python programming', department: 'cs', degree_level: 'btech', is_published: 1 },
    { id: 2, code: 'CS201', title: 'Data Structures & Algorithms', credits: 4, description: 'Arrays, Trees, Graphs, Sorting algorithms', department: 'cs', degree_level: 'btech', is_published: 1 },
    { id: 3, code: 'CS301', title: 'Database Management Systems', credits: 3, description: 'SQL, Relational algebra, Transactions', department: 'cs', degree_level: 'btech', is_published: 1 },
    { id: 4, code: 'CS501', title: 'Advanced Machine Learning', credits: 4, description: 'Deep Learning, Neural Networks', department: 'cs', degree_level: 'mtech', required_previous_degree: 'B.Tech CS', min_previous_grade: 'B+', is_published: 1 },
  ];

  console.log('⏳ Seeding courses...');
  for (const course of courses) {
    await db.collection('courses').doc(String(course.id)).set(course, { merge: true });
  }

  // Prerequisites
  await db.collection('course_prerequisites').doc('2_1').set({ course_id: 2, prerequisite_course_id: 1 });
  await db.collection('course_prerequisites').doc('3_2').set({ course_id: 3, prerequisite_course_id: 2 });

  // 6. Grading Policy
  const gradingPolicy = [
    { id: 1, letter_grade: 'S', min_percent: 90, grade_point: 10 },
    { id: 2, letter_grade: 'A', min_percent: 80, grade_point: 9 },
    { id: 3, letter_grade: 'B', min_percent: 70, grade_point: 8 },
    { id: 4, letter_grade: 'C', min_percent: 60, grade_point: 7 },
    { id: 5, letter_grade: 'D', min_percent: 50, grade_point: 6 },
    { id: 6, letter_grade: 'E', min_percent: 40, grade_point: 5 },
    { id: 7, letter_grade: 'F', min_percent: 0, grade_point: 0 },
  ];

  console.log('⏳ Seeding grading policy...');
  for (const gp of gradingPolicy) {
    await db.collection('grading_policy').doc(String(gp.id)).set(gp, { merge: true });
  }

  console.log('\n\x1b[32m🎉 Success! All data successfully seeded to Firebase Firestore.\x1b[0m\n');
  process.exit(0);
}

seedFirebase().catch(err => {
  console.error('\x1b[31m❌ Error seeding Firebase:\x1b[0m', err);
  process.exit(1);
});
