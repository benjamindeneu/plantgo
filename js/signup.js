// signup.js

import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { auth, db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (password !== confirmPassword) {
    document.getElementById('signupMessage').textContent = "Passwords do not match.";
    return;
  }

  try {
    // Create a new user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Set the display name to the chosen username
    await updateProfile(user, { displayName: username });
    
    // Create a Firestore document for the new user
    await setDoc(doc(db, 'users', user.uid), {
      name: username,
      email: email
    });
    
    // Redirect to your main page after successful signup
    window.location.href = "index.html";
  } catch (error) {
    document.getElementById('signupMessage').textContent = error.message;
  }
});
