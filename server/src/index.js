import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import dbHolder from './db/index.js';
import { initFirebase, getFirebaseStatus } from './db/firebase.js';
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

// Initialize DB and Firebase asynchronously
initDb().then(db => {
  dbHolder.setInstance(db);
  initFirebase();
}).catch(console.error);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'University Course Portal API',
    firebase: getFirebaseStatus()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', studentRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/workflow', workflowRoutes);

// Serve static frontend UI if dist directory exists
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' });
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

const isDirectRun = process.argv[1] && process.argv[1].endsWith('index.js');
if (isDirectRun || process.env.PORT || process.env.NODE_ENV === 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
