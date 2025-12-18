import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
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

// Initialize Analytics only if measurementId is available and we're in production or test environment
let analyticsInstance: any = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId && (!import.meta.env.DEV || import.meta.env.VITEST)) {
  try {
    analyticsInstance = getAnalytics(app);
    console.log('📊 Firebase Analytics initialized successfully with measurementId:', firebaseConfig.measurementId);

    // Test if analytics is working
    if (analyticsInstance) {
      console.log('📊 Analytics instance created, testing connection...');
    }
  } catch (error) {
    console.error('❌ Firebase Analytics initialization failed:', error);
    const errorDetails = error instanceof Error ? {
      message: error.message,
      code: (error as any).code,
      measurementId: firebaseConfig.measurementId
    } : {
      message: 'Unknown error',
      code: 'UNKNOWN',
      measurementId: firebaseConfig.measurementId
    };
    console.error('Error details:', errorDetails);
  }
} else {
  console.log('📊 Analytics not initialized:', {
    hasWindow: typeof window !== 'undefined',
    hasMeasurementId: !!firebaseConfig.measurementId,
    isDev: import.meta.env.DEV,
    isTest: import.meta.env.VITEST
  });
}

export const analytics = analyticsInstance;

// Connect to emulators in development
if (import.meta.env.DEV) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log('🔥 Connected to Firebase emulators');
  } catch (error) {
    console.warn('Failed to connect to emulators:', error);
  }
}

export default app;
