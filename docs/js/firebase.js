// firebase.js

// Import Firebase SDK modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-functions.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAnnH-Gt-8qsCr9N-aOzSB7Y6ca8cg5UGM",
  authDomain: "snow-market-baf05.firebaseapp.com",
  projectId: "snow-market-baf05",
  storageBucket: "snow-market-baf05.firebasestorage.app",
  messagingSenderId: "470488025522",
  appId: "1:470488025522:web:4a0c53585497bb1dc3fcab",
  measurementId: "G-S5BW4VVV8D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Optional: enable verbose Firestore SDK logs when ?debugFirestore=1 or window.DEBUG_FIRESTORE is true
try{
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debugFirestore') === '1' || window.DEBUG_FIRESTORE) {
    try { setLogLevel('debug'); console.info('[firebase] Firestore log level: debug'); } catch(e) { console.warn('[firebase] could not set Firestore log level', e); }
  }
}catch(e){}

// Export modules so other JS files can use them
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
