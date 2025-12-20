import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, "us-central1"); // Specify region to match function deployment

// Enable Firebase offline persistence for blazing fast loads
if (typeof window !== 'undefined') {
  // Enable Firestore persistence (offline support + caching)
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence only enabled in one tab
      enableIndexedDbPersistence(db, { forceOwnership: false }).catch(() => {
        // Persistence failed, continue without it
      });
    } else if (err.code === 'unimplemented') {
      // Browser doesn't support persistence
    }
  });
  
  // Enable auth persistence
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Auth persistence failed, continue
  });
}

// Initialize Analytics only if measurementId is available and we're in production or test environment
let analyticsInstance: any = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId && (!import.meta.env.DEV || import.meta.env.VITEST)) {
  try {
    analyticsInstance = getAnalytics(app);
  } catch (error) {
    // Analytics initialization failed - continue without it
  }
}

export const analytics = analyticsInstance;

// Connect to emulators in development
if (import.meta.env.DEV) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, "localhost", 5001);
  } catch (error) {
    // Emulator connection failed - continue without it
  }
}

export default app;
