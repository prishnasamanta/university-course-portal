import jwt from 'jsonwebtoken';
import db from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'university-portal-dev-secret';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function getStudentByUserId(userId) {
  let student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(userId);
  if (!student && userId) {
    try {
      const defaultProgram = db.prepare('SELECT id FROM programs LIMIT 1').get()?.id || 1;
      const rollNo = `STU${Date.now().toString().slice(-6)}`;
      db.prepare(`
        INSERT INTO students (user_id, program_id, batch_year, roll_number, profile_completed)
        VALUES (?, ?, ?, ?, 0)
      `).run(userId, defaultProgram, new Date().getFullYear(), rollNo);
      student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(userId);
    } catch (e) { /* ignore */ }
  }
  return student;
}

export function getInstructorByUserId(userId) {
  let instructor = db.prepare('SELECT * FROM instructors WHERE user_id = ?').get(userId);
  if (!instructor && userId) {
    try {
      const empId = `EMP${Date.now().toString().slice(-6)}`;
      db.prepare(`
        INSERT INTO instructors (user_id, department, employee_id, profile_completed)
        VALUES (?, ?, ?, 0)
      `).run(userId, 'Computer Science', empId);
      instructor = db.prepare('SELECT * FROM instructors WHERE user_id = ?').get(userId);
    } catch (e) { /* ignore */ }
  }
  return instructor;
}
