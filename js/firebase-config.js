// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

// Replace these values with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEXFV3KjuunlvLJZsHIxvQlOjIYFZVId4",
  authDomain: "plantgo-8f557.firebaseapp.com",
  projectId: "plantgo-8f557",
  storageBucket: "plantgo-8f557.firebasestorage.app",
  messagingSenderId: "1046559028126",
  appId: "1:1046559028126:web:97fec457d846caa8609c8f",
  measurementId: "G-2TKNK2LGJ5"
};

// Initialize Firebase and export Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export { app };
