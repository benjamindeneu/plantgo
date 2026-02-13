// src/i18n/i18n.js
const SUPPORTED = ["en", "fr", "de", "it", "es", "pt"];
const DEFAULT_LANG = "en";

let dict = {};
let currentLang = DEFAULT_LANG;

function normalizeLang(lang) {
  if (!lang) return DEFAULT_LANG;
  // Accept "en-US" -> "en"
  const base = lang.toLowerCase().split("-")[0];
  return SUPPORTED.includes(base) ? base : DEFAULT_LANG;
}

async function loadDict(lang) {
  const res = await fetch(`./src/language/${lang}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load i18n/${lang}.json`);
  return res.json();
}

export function t(key, vars = {}) {
  const template = dict[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export async function setLanguage(lang) {
  currentLang = normalizeLang(lang);
  localStorage.setItem("lang", currentLang);

  dict = await loadDict(currentLang);

  // Update <html lang="">
  document.documentElement.lang = currentLang;

  // Translate text nodes
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  // Translate placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  // Translate titles/tooltips
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });

  // Optional: translate <title> if you want it dynamic
  const titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) titleEl.textContent = t(titleEl.getAttribute("data-i18n"));

  // 🔔 notify JS views/controllers
  document.dispatchEvent(
    new CustomEvent("i18n:changed", { detail: { lang: currentLang } })
  );
}

export function translateDom(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
  const titleEl = root.querySelector("title[data-i18n]");
  if (titleEl) titleEl.textContent = t(titleEl.getAttribute("data-i18n"));
}

export async function initI18n() {
  const saved = localStorage.getItem("lang");
  const browser = navigator.language || navigator.languages?.[0];
  await setLanguage(saved || browser || DEFAULT_LANG);
}
