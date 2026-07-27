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
  if (!pool) {
    console.log('No pool');
    return;
  }
  
  const sql = 'INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)';
  const params = ['Test Sync', `testsync${Date.now()}@test.com`, 'student', '123'];
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
