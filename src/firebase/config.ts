import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Cấu hình Firebase Web App của Tiệm In 194
export const firebaseConfig = {
  apiKey: "AIzaSyBLUZJ6Xm_d8ToqcwZZXSopgmEpcI5konY",
  authDomain: "lab-f7f0a.firebaseapp.com",
  projectId: "lab-f7f0a",
  storageBucket: "lab-f7f0a.firebasestorage.app",
  messagingSenderId: "1092337487585",
  appId: "1:1092337487585:web:12ac272bf97a43396d71a0",
  measurementId: "G-9LW60DVYFC"
};

// Khởi tạo Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Khởi tạo Cloud Firestore Database
export const db = getFirestore(app);

// Khởi tạo Firebase Authentication
export const auth = getAuth(app);
