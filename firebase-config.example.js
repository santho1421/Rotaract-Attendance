// ============================================================
// FIREBASE CONFIGURATION TEMPLATE
// ============================================================
// Replace the values below with your own Firebase Project settings.
// Copy this file, rename it to "firebase-config.js", and fill in the details.
// ============================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase (compat SDK — global `firebase` from CDN)
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const auth = firebase.auth();

// Configure Firebase Authentication to use Session Persistence
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
  .then(() => {
    console.log('🔥 Firebase Auth persistence set to SESSION');
  })
  .catch((err) => {
    console.error('❌ Failed to set Firebase Auth persistence:', err);
  });
