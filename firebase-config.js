const firebaseConfig = {
  apiKey: "AIzaSyASm0wTWyru9pl0I1r1YA87crJd8-Kb3pw",
  authDomain: "rotaractattendance.firebaseapp.com",
  projectId: "rotaractattendance",
  storageBucket: "rotaractattendance.firebasestorage.app",
  messagingSenderId: "464843141818",
  appId: "1:464843141818:web:36903ea0f13fdc28b3c883",
  measurementId: "G-LDBT1QTGET"
};
var db, auth;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  db.enableIndexedDbPersistence().catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed: Multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence not available in this browser.');
    }
  });
  console.log('🔥 Firebase initialized successfully on deployed site');
} catch (err) {
  console.error('Firebase initialization failed. Make sure your GitHub secrets are configured.', err);
}
