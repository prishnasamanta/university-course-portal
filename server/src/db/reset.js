import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const dbPath = path.join(__dirname, '../../data/university.db');
const schemaPath = path.join(__dirname, 'schema.sql');

const DROP_ORDER = [
  'marks_revision_requests', 'marks', 'assessment_components', 'result_workflow',
  'course_results', 'enrollment_grades', 'enrollments', 'section_schedule_slots',
  'instructor_teaching_preferences', 'sections', 'course_prerequisites', 'courses',
  'students', 'instructors', 'semesters', 'programs', 'grading_policy', 'users'
];

export function resetDatabase() {
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    // File may be locked by a running server — tables will be dropped in clearDatabaseTables
  }
}

export function clearDatabaseTables(dbWrapper) {
  dbWrapper.exec('PRAGMA foreign_keys = OFF');
  for (const table of DROP_ORDER) {
    dbWrapper.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  dbWrapper.exec(schema);
}
