// login.js

import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check if the user's email is verified
    //if (!user.emailVerified) {
    //  // If not verified, sign the user out and display a message
    //  await signOut(auth);
    //  document.getElementById('loginMessage').textContent = "Please verify your email address before logging in.";
    //  return;
    //}
    
    // On successful and verified login, redirect to your main page
    window.location.href = "index.html";
    
  } catch (error) {
    document.getElementById('loginMessage').textContent = error.message;
  }
});
