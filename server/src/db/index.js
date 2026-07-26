import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/university.db');
const schemaPath = path.join(__dirname, 'schema.sql');

let dbInstance = null;

function saveDb() {
  if (!dbInstance) return;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(dbInstance.export()));
}

function rowToObject(columns, values) {
  const row = {};
  columns.forEach((col, i) => { row[col] = values[i]; });
  return row;
}

function seedSqlite(db) {
  try {
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    db.exec(`
      INSERT INTO users (email, password_hash, name, role) VALUES
      ('alice@student.uni.edu', '${hash('student123')}', 'Alice Johnson', 'student'),
      ('dr.smith@uni.edu', '${hash('inst123')}', 'Dr. Alice Smith', 'instructor'),
      ('staff@uni.edu', '${hash('staff123')}', 'Academic Staff', 'academic_staff'),
      ('head@uni.edu', '${hash('head123')}', 'Dept Head CS', 'dept_head'),
      ('admin@uni.edu', '${hash('admin123')}', 'System Admin', 'admin'),
      ('student1@univ.edu', '${hash('stud123')}', 'Alice Johnson', 'student');
      
      INSERT INTO programs (code, name, department) VALUES ('BSC-CS', 'B.Sc Computer Science', 'Computer Science');
      INSERT INTO semesters (name, year, is_active, registration_open, exams_completed) VALUES ('Fall', 2025, 1, 1, 0);
      INSERT INTO students (user_id, program_id, batch_year, roll_number, profile_completed) VALUES (1, 1, 2023, 'CS2023001', 1);
      INSERT INTO instructors (user_id, department, employee_id, profile_completed) VALUES (2, 'Computer Science', 'EMP001', 1);
    `);
    saveDb();
    console.log('[SQLite] Automatically seeded default users and initial database schema.');
  } catch (err) {
    console.warn('[SQLite Auto-Seed Warning]:', err.message);
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
          const result = db.exec('SELECT last_insert_rowid() AS id');
          const lastInsertRowid = result[0]?.values[0]?.[0] ?? 0;
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
  if (dbInstance) return createWrapper(dbInstance);

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '../../node_modules/sql.js/dist', file)
  });

  if (fs.existsSync(dbPath)) {
    dbInstance = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    dbInstance = new SQL.Database();
    const schema = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.exec(schema);
    saveDb();
  }

  try {
    const res = dbInstance.exec('SELECT COUNT(*) FROM users');
    const count = res[0]?.values[0]?.[0] ?? 0;
    if (count === 0) {
      seedSqlite(dbInstance);
    }
  } catch (err) {
    // Ignore count errors
  }

  return createWrapper(dbInstance);
}

let db = null;

export async function getDb() {
  if (!db) db = await initDb();
  return db;
}

export default {
  get prepare() {
    if (!db) throw new Error('Database not initialized. Call initDb() first.');
    return db.prepare.bind(db);
  },
  get exec() {
    if (!db) throw new Error('Database not initialized. Call initDb() first.');
    return db.exec.bind(db);
  },
  setInstance(instance) {
    db = instance;
  }
};
