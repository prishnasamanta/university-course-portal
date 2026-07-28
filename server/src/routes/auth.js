import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

async function findUserByEmail(email) {
  try {
    const db = await getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) return user;
  } catch (err) {
    console.error('[Database Auth Error]:', err.message);
  }
  return null;
}

async function findUserById(id) {
  try {
    const db = await getDb();
    return db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id);
  } catch (err) {
    return null;
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordValid = (user.password_hash && bcrypt.compareSync(password, user.password_hash)) ||
                          (user.password_hash === password) ||
                          (user.password === password);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to process login request' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const validRoles = ['student', 'instructor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role must be student or instructor' });
    }

    // Check if email already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const db = await getDb();

    // Insert into PostgreSQL/SQLite database to obtain INTEGER ID and store user profile
    const result = db.prepare('INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)')
      .run(name, email, role, password_hash);
    const numericId = result.lastInsertRowid;

    if (role === 'student') {
      const defaultProgram = db.prepare('SELECT id FROM programs LIMIT 1').get()?.id || 1;
      const rollNo = `STU${numericId}${Math.floor(Math.random() * 1000)}`;
      db.prepare(`
        INSERT OR IGNORE INTO students (user_id, email, name, password_hash, program_id, batch_year, roll_number, profile_completed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run(numericId, email, name, password_hash, defaultProgram, new Date().getFullYear(), rollNo);
    } else if (role === 'instructor') {
      const empId = `EMP${numericId}${Math.floor(Math.random() * 1000)}`;
      db.prepare(`
        INSERT OR IGNORE INTO instructors (user_id, email, name, password_hash, department, employee_id, profile_completed)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(numericId, email, name, password_hash, 'Computer Science', empId);
    }

    const newUser = {
      id: numericId,
      name,
      email,
      role
    };

    const token = signToken(newUser);
    res.status(201).json({
      token,
      user: newUser,
      needsProfileSetup: true
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Failed to create account' });
  }
});

// GET /api/auth/me
router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const db = await getDb();
    let profile = null;

    if (user.role === 'student') {
      try {
        profile = db.prepare(`
          SELECT s.*, p.name AS program_name, p.code AS program_code, p.department,
                 sem.name AS current_semester_name, sem.year AS current_semester_year
          FROM students s
          LEFT JOIN programs p ON p.id = s.program_id
          LEFT JOIN semesters sem ON sem.id = s.current_semester_id
          WHERE s.user_id = ?
        `).get(user.id);
        
        if (!profile) {
          const defaultProgram = db.prepare('SELECT id FROM programs LIMIT 1').get()?.id || 1;
          const rollNo = `STU${user.id}${Math.floor(Math.random() * 10000)}`;
          db.prepare(`
            INSERT INTO students (user_id, program_id, batch_year, roll_number, profile_completed)
            VALUES (?, ?, ?, ?, 0)
          `).run(user.id, defaultProgram, new Date().getFullYear(), rollNo);
          profile = db.prepare('SELECT * FROM students WHERE user_id = ?').get(user.id);
        }
      } catch (err) {
        profile = { id: user.id, user_id: user.id, profile_completed: 0 };
      }
    } else if (user.role === 'instructor') {
      try {
        profile = db.prepare('SELECT * FROM instructors WHERE user_id = ?').get(user.id);
        if (!profile) {
          const empId = `EMP${user.id}${Math.floor(Math.random() * 10000)}`;
          db.prepare(`
            INSERT INTO instructors (user_id, department, employee_id, profile_completed)
            VALUES (?, ?, ?, 0)
          `).run(user.id, 'Computer Science', empId);
          profile = db.prepare('SELECT * FROM instructors WHERE user_id = ?').get(user.id);
        }
      } catch (err) {
        profile = { id: user.id, user_id: user.id, department: '', profile_completed: 0 };
      }
    }

    res.json({ user, profile });
  } catch (err) {
    console.error('Auth /me error:', err);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

export default router;
