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
