// login.js

import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // On successful login, redirect to your main page (e.g., index.html)
    window.location.href = "index.html";
  } catch (error) {
    document.getElementById('loginMessage').textContent = error.message;
  }
});
