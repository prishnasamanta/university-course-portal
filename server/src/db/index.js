import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
