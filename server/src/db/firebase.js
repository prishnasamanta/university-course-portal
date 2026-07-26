import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let firestoreInstance = null;
let isFirebaseConnected = false;
let connectedProjectId = null;

export function initFirebase() {
  if (firestoreInstance) {
    return { db: firestoreInstance, connected: isFirebaseConnected, projectId: connectedProjectId };
  }

  try {
    const keyPathRoot = path.join(__dirname, '../../serviceAccountKey.json');
    const keyPathDb = path.join(__dirname, 'serviceAccountKey.json');
    const envKeyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
      ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : null;

    let credentialObj = null;

    if (envKeyPath && fs.existsSync(envKeyPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(envKeyPath, 'utf8'));
      credentialObj = cert(serviceAccount);
      connectedProjectId = serviceAccount.project_id;
    } else if (fs.existsSync(keyPathRoot)) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPathRoot, 'utf8'));
      credentialObj = cert(serviceAccount);
      connectedProjectId = serviceAccount.project_id;
    } else if (fs.existsSync(keyPathDb)) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPathDb, 'utf8'));
      credentialObj = cert(serviceAccount);
      connectedProjectId = serviceAccount.project_id;
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credentialObj = cert(serviceAccount);
      connectedProjectId = serviceAccount.project_id;
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      credentialObj = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      });
      connectedProjectId = process.env.FIREBASE_PROJECT_ID;
    }

    if (credentialObj) {
      if (!getApps().length) {
        initializeApp({ credential: credentialObj });
      }
      firestoreInstance = getFirestore();
      isFirebaseConnected = true;
      console.log(`\x1b[32m[Firebase]\x1b[0m Successfully connected to Firebase Firestore (Project: ${connectedProjectId})`);
    } else {
      console.log(`\x1b[33m[Firebase]\x1b[0m Service account key not found. Place 'serviceAccountKey.json' in server directory or configure .env variables.`);
    }
  } catch (error) {
    console.error(`\x1b[31m[Firebase Error]\x1b[0m Failed to initialize Firebase Admin SDK:`, error.message);
  }

  return { db: firestoreInstance, connected: isFirebaseConnected, projectId: connectedProjectId };
}

export function getFirestoreDb() {
  if (!firestoreInstance) {
    initFirebase();
  }
  return firestoreInstance;
}

export function getFirebaseStatus() {
  return {
    connected: isFirebaseConnected,
    projectId: connectedProjectId || process.env.FIREBASE_PROJECT_ID || null
  };
}

export default {
  initFirebase,
  getFirestoreDb,
  getFirebaseStatus
};
