import { getPostgresPool } from './postgres.js';

function convertSqlForPostgres(sql) {
  let paramIndex = 1;
  let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
  if (sql.match(/INSERT OR IGNORE INTO/i) && !pgSql.match(/ON CONFLICT/i)) {
    pgSql += ' ON CONFLICT DO NOTHING';
  }
  return pgSql;
}

async function testSync() {
  const pool = getPostgresPool();
  
  const sql = `
        INSERT OR IGNORE INTO students (user_id, program_id, batch_year, roll_number, profile_completed)
        VALUES (?, ?, ?, ?, 0)
      `;
  const params = [1, 1, 2025, 'STU1'];
  const pgSql = convertSqlForPostgres(sql);
  
  console.log('Executing:', pgSql, params);
  try {
    const res = await pool.query(pgSql, params);
    console.log('Success:', res.rowCount);
  } catch (err) {
    console.error('Error:', err);
  }
  
  pool.end();
}

testSync();
