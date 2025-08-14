// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA8-g3sUmtRL4qwWCc1_qUwBB6jWh68VH4",
  authDomain: "getseerai.firebaseapp.com",
  projectId: "getseerai",
  storageBucket: "getseerai.firebasestorage.app",
  messagingSenderId: "992558788759",
  appId: "1:992558788759:web:3c8927306728856aadf9d2",
  measurementId: "G-9HZJLFZEM6"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const firestore = getFirestore(app);
// const analytics = getAnalytics(app);

export { app, auth, firestore };
