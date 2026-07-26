import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { getFirestoreDb } from '../db/firebase.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

async function findUserByEmail(email) {
  // 1. Try Firestore
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

  // 2. Fallback to SQLite
  try {
    const db = await getDb();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  } catch (err) {
    console.error('[SQLite Auth Error]:', err.message);
    return null;
  }
}

async function findUserById(id) {
  // For numeric IDs (seeded SQLite accounts), check SQLite first
  if (typeof id === 'number' || /^\d+$/.test(String(id))) {
    try {
      const db = await getDb();
      const row = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id);
      if (row) return row;
    } catch (err) { /* fallthrough */ }
  }

  // For string IDs (Firestore-registered accounts), check Firestore
  try {
    const firestore = getFirestoreDb();
    if (firestore) {
      const doc = await firestore.collection('users').doc(String(id)).get();
      if (doc.exists) {
        return { id: doc.data().id || doc.id, ...doc.data() };
      }
    }
  } catch (err) { /* Ignore */ }

  // Final fallback: SQLite for any remaining case
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
    const newId = `user_${Date.now()}`;

    const newUser = {
      id: newId,
      name,
      email,
      role,
      password_hash,
      created_at: new Date().toISOString()
    };

    // Save to Firestore if available
    let savedToFirestore = false;
    try {
      const firestore = getFirestoreDb();
      if (firestore) {
        await firestore.collection('users').doc(newId).set(newUser);

        // Create role-specific profile doc
        if (role === 'student') {
          await firestore.collection('students').doc(newId).set({
            user_id: newId,
            profile_completed: 0,
            previous_degree: '',
            previous_grade: '',
            current_semester_id: null,
            created_at: new Date().toISOString()
          });
        } else if (role === 'instructor') {
          await firestore.collection('instructors').doc(newId).set({
            user_id: newId,
            profile_completed: 0,
            department: '',
            created_at: new Date().toISOString()
          });
        }
        savedToFirestore = true;
      }
    } catch (err) {
      console.warn('[Register Firestore Warning]:', err.message);
    }

    // Fallback: also save to SQLite
    if (!savedToFirestore) {
      try {
        const db = await getDb();
        db.prepare('INSERT INTO users (id, name, email, role, password_hash) VALUES (?, ?, ?, ?, ?)')
          .run(newId, name, email, role, password_hash);
      } catch (err) {
        console.error('[Register SQLite Error]:', err.message);
        return res.status(500).json({ error: 'Failed to create account' });
      }
    }

    const token = signToken({ ...newUser, id: newId });
    res.status(201).json({
      token,
      user: { id: newId, email, name, role },
      needsProfileSetup: true
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create account' });
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
        // Try Firestore first
        const firestore = getFirestoreDb();
        if (firestore) {
          const doc = await firestore.collection('students').where('user_id', '==', String(user.id)).limit(1).get();
          if (!doc.empty) {
            profile = { ...doc.docs[0].data(), id: doc.docs[0].id };
          }
        }
        // Fallback to SQLite
        if (!profile) {
          profile = db.prepare(`
            SELECT s.*, p.name AS program_name, p.code AS program_code, p.department,
                   sem.name AS current_semester_name, sem.year AS current_semester_year
            FROM students s
            JOIN programs p ON p.id = s.program_id
            LEFT JOIN semesters sem ON sem.id = s.current_semester_id
            WHERE s.user_id = ?
          `).get(user.id);
        }
      } catch (err) {
        profile = { id: user.id, user_id: user.id, profile_completed: 0 };
      }
    } else if (user.role === 'instructor') {
      try {
        const firestore = getFirestoreDb();
        if (firestore) {
          const doc = await firestore.collection('instructors').where('user_id', '==', String(user.id)).limit(1).get();
          if (!doc.empty) {
            profile = { ...doc.docs[0].data(), id: doc.docs[0].id };
          }
        }
        if (!profile) {
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
