import express from 'express';
import cors from 'cors';
import { initDb } from './db/index.js';
import dbHolder from './db/index.js';
import { initFirebase, getFirebaseStatus } from './db/firebase.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import instructorRoutes from './routes/instructors.js';
import workflowRoutes from './routes/workflow.js';

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

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'University Course Portal API Server is running live on Render!',
    health: '/api/health',
    firebase: getFirebaseStatus()
  });
});

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
