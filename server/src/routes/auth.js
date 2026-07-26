import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.user.id);
  let profile = null;

  if (user.role === 'student') {
    profile = db.prepare(`
      SELECT s.*, p.name AS program_name, p.code AS program_code, p.department,
             sem.name AS current_semester_name, sem.year AS current_semester_year
      FROM students s
      JOIN programs p ON p.id = s.program_id
      LEFT JOIN semesters sem ON sem.id = s.current_semester_id
      WHERE s.user_id = ?
    `).get(user.id);
  } else if (user.role === 'instructor') {
    profile = db.prepare('SELECT * FROM instructors WHERE user_id = ?').get(user.id);
  }

  res.json({ user, profile });
});

export default router;
