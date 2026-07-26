import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import dbHolder from './db/index.js';
import { initFirebase, getFirebaseStatus } from './db/firebase.js';
import { initPostgres, getPostgresPool } from './db/postgres.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import instructorRoutes from './routes/instructors.js';
import workflowRoutes from './routes/workflow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

let isPostgresActive = false;

// Initialize DBs asynchronously
(async () => {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURI) {
    isPostgresActive = await initPostgres();
  }
  const db = await initDb();
  dbHolder.setInstance(db);
  initFirebase();
})().catch(console.error);

// Health check endpoints
const healthHandler = (_req, res) => {
  res.json({
    status: 'ok',
    service: 'University Course Portal API',
    database: isPostgresActive ? 'PostgreSQL' : 'SQLite',
    firebase: getFirebaseStatus()
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api', studentRoutes);

// Static frontend serving
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: `API route ${req.path} not found` });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      message: 'University Course Portal API Server is running live on Render!',
      health: '/api/health',
      firebase: getFirebaseStatus()
    });
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
