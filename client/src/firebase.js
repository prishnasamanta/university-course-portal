import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_demo_key_placeholder",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "university-portal.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "university-portal",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "university-portal.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

let app = null;
let db = null;
let auth = null;
let isConfigured = false;

try {
  if (import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    isConfigured = true;
    console.log('[Firebase Client] Initialized successfully with project:', firebaseConfig.projectId);
  } else {
    console.log('[Firebase Client] Running in standard REST mode. Configure VITE_FIREBASE_PROJECT_ID in client/.env to enable direct web SDK.');
  }
} catch (err) {
  console.warn('[Firebase Client Initialization Notice]:', err.message);
}

export { app, db, auth, isConfigured, firebaseConfig };
