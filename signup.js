// signup.js
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";

import { auth, db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

import { initI18n, t } from "./src/language/i18n.js";

// Init translations
const savedLang = localStorage.getItem("lang");
if (savedLang) {
  document.documentElement.lang = savedLang;
}
await initI18n();

const langSelect = document.getElementById("langSelect");
const form = document.getElementById("signupForm");
const messageEl = document.getElementById("signupMessage");

if (langSelect) {
  // Set current value based on active language
  langSelect.value = document.documentElement.lang || "en";

  langSelect.addEventListener("change", async (e) => {
    const newLang = e.target.value;

    // Save language
    localStorage.setItem("lang", newLang);

    // Update <html lang="">
    document.documentElement.lang = newLang;

    // Re-init i18n to reload translations
    await initI18n();
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageEl.textContent = "";

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    messageEl.textContent = t("signup.error.passwordMismatch");
    return;
  }

  try {
    // Create user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Set display name
    await updateProfile(user, { displayName: username });

    // Create Firestore document
    await setDoc(doc(db, "users", user.uid), {
      name: username,
      email: email,
      total_points: 0
    });

    // Redirect to main app page
    window.location.href = "./index.html";

  } catch (error) {
    messageEl.textContent = error?.message || "Signup failed.";
  }
});
