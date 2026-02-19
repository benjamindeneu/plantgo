// login.js

import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { initI18n, t } from "./src/language/i18n.js";

// Restore saved language first
const savedLang = localStorage.getItem("lang");
if (savedLang) {
  document.documentElement.lang = savedLang;
}

// Init translations
await initI18n();

// Init translations first
await initI18n();

const form = document.getElementById("loginForm");
const messageEl = document.getElementById("loginMessage");
// Setup language selector
const langSelect = document.getElementById("langSelect");

if (langSelect) {
  langSelect.value = document.documentElement.lang || "en";

  langSelect.addEventListener("change", async (e) => {
    const newLang = e.target.value;

    localStorage.setItem("lang", newLang);
    document.documentElement.lang = newLang;

    await initI18n(); // refresh UI texts
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageEl.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

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

    window.location.href = "index.html";
  } catch (error) {
    messageEl.textContent = translateAuthError(error);
  }
});

function translateAuthError(error) {
  switch (error.code) {
    case "auth/user-not-found":
      return t("login.error.userNotFound");
    case "auth/wrong-password":
      return t("login.error.wrongPassword");
    case "auth/invalid-credential":
      return t("login.error.invalid");
    default:
      return t("login.error.generic");
  }
}
