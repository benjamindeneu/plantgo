// signup.js
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { auth, db } from "./firebase-config.js";
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

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
      email: email,
      total_points: 0
    });
    
    try {
      // Attempt to send the email verification
      await sendEmailVerification(user);
      
      // Inform the user and remove the signup form
      document.getElementById('signupMessage').textContent = "A verification email has been sent. Please check your inbox.";
      document.getElementById('signupForm').remove();
      
    } catch (emailError) {
      // If email sending fails, remove the created user
      await user.delete();
      
      // Optionally, remove the Firestore document as well
      await deleteDoc(doc(db, 'users', user.uid));
      
      document.getElementById('signupMessage').textContent = "Failed to send verification email";
    }
    
  } catch (error) {
    document.getElementById('signupMessage').textContent = error.message;
  }
});
