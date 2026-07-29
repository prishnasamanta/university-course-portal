import { getPostgresPool } from './postgres.js';

export async function hydrateSqliteFromPostgres(sqliteDb) {
  const pool = getPostgresPool();
  if (!pool) return;
  try {
    console.log('[Hydration] Syncing SQLite in-memory state from live PostgreSQL...');
    const tables = ['users', 'programs', 'semesters', 'students', 'courses', 'sections', 'section_schedule_slots', 'enrollments', 'exam_registrations', 'assessment_components', 'marks', 'marks_revision_requests', 'instructor_teaching_preferences', 'student_removal_requests'];
    
    sqliteDb.exec('PRAGMA foreign_keys = OFF;');
    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table}`);
        if (rows.length > 0) {
          sqliteDb.exec(`DELETE FROM ${table};`); // clear default seed if any
          
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => '?').join(',');
          
          const stmt = sqliteDb.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);
          for (const row of rows) {
            const values = columns.map(col => {
              if (row[col] instanceof Date) return row[col].toISOString().replace('T', ' ').replace('Z', '');
              return row[col];
            });
            stmt.run(values);
          }
          stmt.free();
        }
      } catch (err) {
        console.warn(`[Hydration] Failed to sync table ${table}:`, err.message);
      }
    }
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
    
    // Sync sqlite_sequence so new inserts get the correct exact ID
    for (const table of tables) {
      try {
        const res = sqliteDb.exec(`SELECT MAX(id) as max_id FROM ${table}`);
        const maxId = res[0]?.values[0]?.[0] ?? 0;
        if (maxId > 0) {
          sqliteDb.exec(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('${table}', ${maxId})`);
        }
      } catch (err) {}
    }
    console.log('[Hydration] SQLite successfully synchronized with PostgreSQL state!');
  } catch (err) {
    console.error('[Hydration] Error:', err.message);
  }
}
