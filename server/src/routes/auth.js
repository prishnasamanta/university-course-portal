import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { getFirestoreDb } from '../db/firebase.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

async function findUserByEmail(email) {
  // 1. Try Firestore if available
  try {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('users').where('email', '==', email).limit(1).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.data().id || doc.id, ...doc.data() };
      }
    }
  } catch (err) {
    console.warn('[Firestore Auth Warning]:', err.message);
  }

  // 2. Fallback to SQLite (ensuring database initialization has completed!)
  try {
    const db = await getDb();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  } catch (err) {
    console.error('[SQLite Auth Error]:', err.message);
    return null;
  }
}

async function findUserById(id) {
  try {
    const firestore = getFirestoreDb();
    if (firestore) {
      const doc = await firestore.collection('users').doc(String(id)).get();
      if (doc.exists) {
        return { id: doc.data().id || doc.id, ...doc.data() };
      }
    }
  } catch (err) {
    // Ignore
  }

  try {
    const db = await getDb();
    return db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id);
  } catch (err) {
    return null;
  }
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await findUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
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
          JOIN programs p ON p.id = s.program_id
          LEFT JOIN semesters sem ON sem.id = s.current_semester_id
          WHERE s.user_id = ?
        `).get(user.id);
      } catch (err) {
        profile = { id: user.id, user_id: user.id, profile_completed: 1 };
      }
    } else if (user.role === 'instructor') {
      try {
        profile = db.prepare('SELECT * FROM instructors WHERE user_id = ?').get(user.id);
      } catch (err) {
        profile = { id: user.id, user_id: user.id, department: 'cs', profile_completed: 1 };
      }
    }

    res.json({ user, profile });
  } catch (err) {
    console.error('Auth /me error:', err);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

export default router;
