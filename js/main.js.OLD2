// main.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { collection, doc, addDoc, setDoc, getDoc, serverTimestamp, GeoPoint, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from './firebase-config.js';

/* ===============================
   Constants & small utilities
   =============================== */
const missionPoints = 500;
const LEVEL_SIZE = 11000; // NEW
const FETCH_COOLDOWN_MS = 5 * 60 * 1000; // currently 5min (kept)
const SPECIES_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/missions';
const POINTS_PROXY_URL  = 'https://liked-stirring-stinkbug.ngrok-free.app/api/points';
const IDENTIFY_PROXY_URL= 'https://liked-stirring-stinkbug.ngrok-free.app/api/identify';

// DOM helpers (guard null on mobile-first layouts)
const $ = (id) => document.getElementById(id);

// Progress elements (global + modal)
const LEVEL_EL_ID = 'levelNumber';
const LEVEL_BAR_ID = 'levelProgressBar';               // global header progress
const MODAL_LEVEL_EL_ID = 'resultLevelNumber';
const MODAL_LEVEL_BAR_ID = 'resultLevelProgressBar';   // modal progress

// Tier classification (Common/Rare/Epic/Legendary) — single source of truth
const POINT_TIERS = [
  { max: 500,      name: 'Common',    class: 'common-points' },
  { max: 1000,     name: 'Rare',      class: 'rare-points' },
  { max: 1500,     name: 'Epic',      class: 'epic-points' },
  { max: Infinity, name: 'Legendary', class: 'legendary-points' },
];
function classifyPoints(val) { return POINT_TIERS.find(t => val < t.max); }

// Compute level/progress — reuse everywhere
function computeLevel(totalPoints) {
  const level = Math.max(1, Math.floor(1 + (totalPoints / LEVEL_SIZE)));
  const prev = (level - 1) * LEVEL_SIZE;
  const next = level * LEVEL_SIZE;
  const progressPct = ((totalPoints - prev) / (next - prev)) * 100;
  return { level, prev, next, progressPct };
}

// Safer window.open for mobile (prevents reverse-tabnabbing)
function openSafe(url) { window.open(url, '_blank', 'noopener,noreferrer'); } // NEW

// Busy state for taps to avoid double submit on mobile
function setBusy(el, busy = true) {
  if (!el) return;
  el.disabled = busy;
  el.setAttribute('aria-busy', String(busy));
}

// Small fetch helper with timeout + optional retry — keeps your endpoints the same
async function fetchJSON(url, options = {}, { timeoutMs = 15000, retries = 0 } = {}) { // NEW
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      clearTimeout(t);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
  }
}

// Concurrency mapper for image loading (reduces jank on mobile)
async function mapWithConcurrency(items, limit, fn) { // NEW
  let i = 0;
  const out = Array(items.length);
  const workers = Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ===============================
   App state
   =============================== */
let missionsList = [];
let speciesList = [];
let allFiles = [];

let currentUserProgress = {
  total_points: 0,
  level: 1,
  progress: 0
};

/* ===============================
   Auth & realtime updates
   =============================== */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    $('userName') && ($('userName').textContent = user.displayName || user.email);
    const userRef = doc(db, 'users', user.uid);

    // Ensure user doc exists to avoid updateDoc throwing (first run)
    await setDoc(userRef, { total_points: 0 }, { merge: true }); // NEW

    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const lastFetch = userData.last_species_fetch?.toDate?.();
    const now = new Date();
    const threeHours = 3 * 60 * 60 * 1000;

    updateUIState();

    if (lastFetch && (now - lastFetch < threeHours)) {
      console.log("[Cache] Using saved species and missions from Firestore");

      speciesList = userData.species_list || [];
      missionsList = userData.missions_list || [];

      await displaySpecies(missionsList); // mimic fetchSpecies response
    } else {
      console.log("[Fetch] No recent species fetch — waiting for geolocation to call fetchSpecies()");
      // Geolocation triggers fetchSpecies(lat, lon)
    }

    // Realtime points/level updates — respect modal lock
    onSnapshot(userRef, (docSnap) => {
      console.log("[onSnapshot] Triggered - Checking if the progress bar should update");
      if (!docSnap.exists()) return;

      const data = docSnap.data();
      const total = data.total_points || 0;
      const { level, progressPct } = computeLevel(total);

      // Only block the MODAL bar when locked; keep global header live
      const modalLocked = $(MODAL_LEVEL_BAR_ID)?.dataset.locked === "true";
      if (!modalLocked) {
        $(LEVEL_EL_ID) && ($(LEVEL_EL_ID).textContent = level);
        $(LEVEL_BAR_ID) && ($(LEVEL_BAR_ID).style.width = `${progressPct}%`);
        console.log("[onSnapshot] Global progress bar updated from Firestore.");
      } else {
        console.log("[onSnapshot] Modal is in control; global stays as-is.");
      }
    });

  } else {
    window.location.href = "login.html";
  }
});

/* ===============================
   Logout & navigation
   =============================== */
$('logoutBtn')?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Error during logout:", error);
  }
});

$('plantDexBtn')?.addEventListener('click', () => {
  openSafe("plantdex.html"); // NEW (keeps new tab)
});

/* ===============================
   DOM elements
   =============================== */
const getLocationBtn = $('getLocationBtn');
const locationInfo   = $('locationInfo');
const suggestionsDiv = $('suggestions');
const photoInput     = $('photoInput');
const validateBtn    = $('validateBtn');
const validationResult = $('validationResult');
const submitBtn      = $('submitBtn');
const preview        = $('preview');

/* ===============================
   Modal helpers (fit new UI)
   =============================== */
function showModal(content) {
  const modal = $("resultModal");
  $("modalText").innerHTML = content;
  modal.style.display = "block"; // keeping your display logic to match existing HTML
}
function hideModal() {
  $("resultModal").style.display = "none";
  // remove any level-up messages when closing
  const modalText = $("levelUp");
  if (modalText) {
    modalText.querySelectorAll(".level-up-message")?.forEach(msg => msg.remove());
  }
}

$("modalClose")?.addEventListener("click", hideModal);
window.addEventListener("click", (event) => {
  if (event.target === $("resultModal")) hideModal();
});

// Mission modal
function showModalMission(content) {
  $("missionModalText").innerHTML = content;
  $("missionModal").style.display = "block";
}
function hideModalMission() {
  $("missionModal").style.display = "none";
}
$("missionModalClose")?.addEventListener("click", hideModalMission);
// FIX: close when clicking overlay, not the close button element
window.addEventListener("click", (event) => { // NEW
  if (event.target === $("missionModal")) hideModalMission();
});

/* ===============================
   Firestore ops
   =============================== */
// Add observation (and discovery if needed) to Firestore
async function addObservation(userId, speciesName, lat, lng, plantnetImageCode, total_points, points, plantnet_identify_score) {
  try {
    const observationsRef = collection(db, 'users', userId, 'observations');
    const observationData = {
      speciesName,
      observedAt: serverTimestamp(),
      location: new GeoPoint(lat, lng),
      plantnetImageCode,
      total_points,
      points,
      plantnet_identify_score
    };
    const observationDoc = await addDoc(observationsRef, observationData);
    console.log("Observation added with ID:", observationDoc.id);

    const discoveryRef = doc(db, 'users', userId, 'discoveries', speciesName);
    const discoverySnap = await getDoc(discoveryRef);

    let discoveryBonus = 0;
    if (!discoverySnap.exists()) {
      // First discovery, add bonus
      discoveryBonus = 500;
      const discoveryData = {
        speciesName,
        discoveredAt: serverTimestamp(),
        location: new GeoPoint(lat, lng),
        observationId: observationDoc.id
      };
      await setDoc(discoveryRef, discoveryData);
      console.log("New species discovered:", speciesName);
    }

    // Update total points including discovery bonus
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      total_points: increment(total_points + discoveryBonus)
    });

    console.log(`User's total_points updated. Discovery bonus applied: ${discoveryBonus}`);

    return discoveryBonus;

  } catch (error) {
    console.error("Error adding observation/discovery:", error);
    return 0;
  }
}

/* ===============================
   Wikipedia helper (same API)
   =============================== */
function getBinomialName(fullName) {
  const parts = fullName.trim().split(" ");
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : fullName;
}
async function getWikipediaImage(speciesFullName) {
  const binomial = getBinomialName(speciesFullName);
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(binomial)}&prop=pageimages&format=json&pithumbsize=150&origin=*`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const pages = data.query.pages;
    for (let pageId in pages) {
      if (pages[pageId].thumbnail && pages[pageId].thumbnail.source) {
        return pages[pageId].thumbnail.source;
      }
    }
  } catch (err) {
    console.error("Wikipedia API error:", err);
  }
  return null;
}

/* ===============================
   UI: Species list / missions (mobile-first)
   =============================== */
async function displaySpecies(species_list) {
  suggestionsDiv.innerHTML = '';
  if (!species_list || species_list.length === 0) {
    suggestionsDiv.innerHTML = `<p>No missions found.</p>`;
    return;
  }

  // Header + info button (keep behavior, better structure)
  const header = document.createElement('h3');
  header.append(`Missions (${species_list.length}) `);

  const infoButton = document.createElement('button');
  infoButton.id = "infoButton";
  infoButton.type = "button";
  infoButton.className = "linklike";
  infoButton.setAttribute('aria-label', 'Mission information');
  infoButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <circle cx="12" cy="8" r="1"></circle>
    </svg>
  `;
  infoButton.addEventListener("click", () => {
    showModalMission("<h2>Mission Information</h2><p><small>Mission: [Species Name]</small></p><p>Missions suggest species for you to observe in your area based on GeoPl@ntNet predictions. These species are selected because they have been predicted with high uncertainty in a small radius around your location. Points are calculated using multiple metrics, including GeoPl@ntNet uncertainty, the distance to the nearest Pl@ntNet observation, the total number of Pl@ntNet observations, and the time since the last observation.</p>");
  });

  header.appendChild(infoButton);
  suggestionsDiv.appendChild(header);

  // Build skeleton cards first for smoother render on mobile
  const imageEls = []; // track images for later src set
  for (const species of species_list) {
    const item = document.createElement('div');
    item.classList.add('species-item');

    // Mission title
    const missionTitle = document.createElement('div');
    missionTitle.classList.add('mission-title');
    missionTitle.textContent = `Mission: ${species.name}`;
    item.appendChild(missionTitle);

    const cardContent = document.createElement('div');
    cardContent.classList.add('card-content');

    // Image container
    const imageContainer = document.createElement('div');
    imageContainer.classList.add('species-image-container');
    const img = document.createElement('img');
    img.classList.add('species-image');
    img.alt = species.name;
    img.src = ''; // placeholder until loaded
    imageContainer.appendChild(img);

    // Info container
    const infoContainer = document.createElement('div');
    infoContainer.classList.add('species-info');

    // Compute total points from its parts
    let totalPoints = 0;
    if (species.points) {
      for (const key in species.points) totalPoints += species.points[key];
    }

    // Points badge
    const pointsBtn = document.createElement('button');
    pointsBtn.classList.add('points-btn');
    pointsBtn.textContent = `${totalPoints} points`;
    const tier = classifyPoints(totalPoints);
    if (tier) pointsBtn.classList.add(tier.class);

    // Show breakdown modal
    pointsBtn.addEventListener('click', () => {
      let detail = `<h2>Point details</h2><p><small>Mission: ${species.name}</small></p>`;
      detail += `<p class="mission-level ${tier.class}">${tier.name}</p>`;
      if (species.points) {
        for (const key in species.points) {
          const displayKey = key === 'base' ? 'Species observation' : key;
          detail += `<p>${displayKey}: ${species.points[key]} points</p>`;
        }
      }
      showModalMission(detail);
    });

    infoContainer.appendChild(pointsBtn);

    // Common name
    const commonNameP = document.createElement('p');
    commonNameP.textContent = species.common_name || "No common name";
    infoContainer.appendChild(commonNameP);

    // Badges
    const badgesP = document.createElement('p');
    badgesP.innerHTML =
      (species.is_tree ? `<span class="badge tree-badge">🌳 Tree</span>` : '') +
      (species.is_invasive ? `<span class="badge invasive-badge">⚠️ Invasive</span>` : '') +
      (species.is_flowering ? `<span class="badge flowering-badge">🌸 Flowering</span>` : '') +
      (species.is_fruiting ? `<span class="badge flowering-badge">🍎 Fruiting</span>` : '');
    infoContainer.appendChild(badgesP);

    // More info link
    const moreInfoP = document.createElement('p');
    const speciesLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(species.name)}/data`;
    const moreInfoLink = document.createElement('a');
    moreInfoLink.href = speciesLink;
    moreInfoLink.target = "_blank";
    moreInfoLink.rel = "noopener noreferrer";
    moreInfoLink.textContent = "More info";
    moreInfoP.appendChild(moreInfoLink);
    infoContainer.appendChild(moreInfoP);

    cardContent.appendChild(imageContainer);
    cardContent.appendChild(infoContainer);
    item.appendChild(cardContent);
    suggestionsDiv.appendChild(item);

    imageEls.push({ img, imageContainer, speciesName: species.name });
  }

  // Load thumbnails in parallel (4 at a time)
  await mapWithConcurrency(imageEls, 4, async ({ img, imageContainer, speciesName }) => {
    const wikiImageUrl = await getWikipediaImage(speciesName);
    if (wikiImageUrl) {
      img.src = wikiImageUrl;
    } else {
      imageContainer.style.display = 'none';
    }
  });
}

/* ===============================
   Identify / Validate
   =============================== */
// Identify picture using the proxy server
async function identifyPicture(file) {
  const formData = new FormData();
  formData.append('image', file, file.name);
  // same API, but via helper (timeout + optional retry)
  const response = await fetch(IDENTIFY_PROXY_URL, { method: 'POST', body: formData }); // keep as-is for multi-image consistency
  if (!response.ok) throw new Error("Upload failed");
  return await response.json();
}

async function validateMultiplePictures(files) {
  if (!files || files.length === 0) {
    validationResult.innerHTML = `<p>Please select at least one image.</p>`;
    return;
  }

  // Lock modal progress bar
  $(MODAL_LEVEL_BAR_ID).dataset.locked = "true";
  console.log("[validateMultiplePictures] Progress bar LOCKED from updates.");

  try {
    const currentUserId = auth.currentUser.uid;
    const userRef = doc(db, 'users', currentUserId);

    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User document not found.");

    const userData = userSnap.data();
    const oldTotalPoints = userData.total_points || 0;
    const { level: oldLevel, prev: prevLevelThreshold, next: nextLevelThreshold } = computeLevel(oldTotalPoints);
    const oldProgress = ((oldTotalPoints - prevLevelThreshold) / (nextLevelThreshold - prevLevelThreshold)) * 100;

    $(MODAL_LEVEL_EL_ID).textContent = oldLevel;
    $(MODAL_LEVEL_BAR_ID).style.width = `${oldProgress}%`;

    showModal(`<p>Processing ${files.length} image(s) for identification...</p>`);

    // Send all images together (kept)
    const formData = new FormData();
    files.forEach(file => formData.append('image', file, file.name));

    const response = await fetch(IDENTIFY_PROXY_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error("Upload failed");
    const jsonResponse = await response.json();

    // 🔍 One identification result
    const bestMatch = jsonResponse.bestMatch;
    const plantnetImageId = jsonResponse.query?.images?.[0];
    const identification_score = jsonResponse.results?.[0]?.score || 0;
    const uniqueOrgansCount = new Set(jsonResponse.predictedOrgans?.map(o => o.organ)).size || 1;
    const speciesLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(bestMatch)}/data`;

    const { lat, lon } = await getCoordinates();

    // Determine points
    let total_points, points, isMissionValidated = false;
    if (missionsList && missionsList.length > 0) {
      const missionMatch = missionsList.find(m => m.name.trim().toLowerCase() === bestMatch.trim().toLowerCase());
      if (missionMatch) {
        total_points = missionMatch.total_points + missionPoints;
        points = missionMatch.points;
        isMissionValidated = true;
      } else {
        const result = await getPoints(lat, lon, bestMatch, speciesList, uniqueOrgansCount);
        total_points = result.total_points;
        points = result.points;
      }
    } else {
      const result = await getPoints(lat, lon, bestMatch, speciesList, uniqueOrgansCount);
      total_points = result.total_points;
      points = result.points;
    }

    const discoveryBonus = await addObservation(
      currentUserId,
      bestMatch,
      lat,
      lon,
      plantnetImageId,
      total_points,
      points,
      identification_score
    );

    total_points += discoveryBonus;

    // Build result UI (keep behavior)
    let resultHtml = `
      <h3>
        <button class="species-button" id="resultSpeciesBtn">${bestMatch}</button>
      </h3>
    `;
    if (isMissionValidated) {
      resultHtml += `<p style="color: green;"><strong>Mission validated!</strong></p>`;
    }

    resultHtml += `
      <h3 style="text-align: center;">Points: 
        <span id="totalPoints">0</span>
      </h3>
      <div style="text-align: center;">
        <h4>Your observation:</h4>
        ${files.map(file => {
          const url = URL.createObjectURL(file);
          // revoke later
          return `<img data-blob-url="${url}" src="${url}" alt="Uploaded image"
            style="max-width: 120px; max-height: 120px; object-fit: contain; border-radius: 8px; display: inline-block; margin: 5px;">`;
        }).join('')}
      </div>
    `;

    // Observation-only total (no mission validated)
    let observationPointsTotal = 0;
    if (points) {
      for (const key in points) {
        if (key !== "mission validated") observationPointsTotal += points[key];
      }
    }
    const obsTier = classifyPoints(observationPointsTotal);

    resultHtml += `
      <h3>Observation Points: 
        <span class="points-btn ${obsTier.class}">${observationPointsTotal} points</span>
      </h3>
      <h4>Observation Points:</h4>
      <div id="pointsContainer" aria-live="polite"></div>
    `;

    $("modalText").innerHTML = resultHtml;

    // Open species link safely
    $("resultSpeciesBtn")?.addEventListener('click', () => openSafe(speciesLink)); // NEW

    // Revoke blob URLs once images load
    document.querySelectorAll('img[data-blob-url]')?.forEach(img => { // NEW
      img.addEventListener('load', () => {
        const u = img.getAttribute('data-blob-url');
        if (u) URL.revokeObjectURL(u);
      }, { once: true });
    });

    animateValue("totalPoints", 0, total_points, 2000);

    // Animate each point row
    let delay = 0;
    const keys = Object.keys(points || {}).filter(key => key !== "mission validated");
    keys.forEach(key => {
      setTimeout(() => {
        const p = document.createElement("p");
        p.textContent = `${key === 'base' ? 'Species observation' : key}: ${points[key]} points`;
        p.classList.add("fade-in");
        $("pointsContainer").appendChild(p);
      }, delay);
      delay += 300;
    });

    if (isMissionValidated || discoveryBonus > 0) {
      setTimeout(() => {
        let bonusHtml = "<h4>Bonus Points:</h4>";
        if (isMissionValidated) {
          bonusHtml += `<p class="fade-in">Mission validated: ${missionPoints} points</p>`;
        }
        if (discoveryBonus > 0) {
          bonusHtml += `<p class="fade-in">New species discovery: 500 points</p>`;
        }
        $("pointsContainer").insertAdjacentHTML("beforeend", bonusHtml);
      }, delay);
    }

    // Rely on onSnapshot for the global header; we still update the MODAL meter at the end
    const totalAnimationDuration = Math.max(2000, delay) + 200;
    setTimeout(async () => {
      // Fetch fresh user data just once here (kept behavior)
      const newUserSnap = await getDoc(userRef);
      const newTotalPoints = newUserSnap.data()?.total_points || 0;
      const { level: newLevel, progressPct: newProgress } = computeLevel(newTotalPoints);

      $(MODAL_LEVEL_EL_ID).textContent = newLevel;
      $(MODAL_LEVEL_BAR_ID).style.width = `${newProgress}%`;
      console.log(`[validateMultiplePictures] Updated Level: ${newLevel}, Progress: ${newProgress}`);

      // Old vs new
      const oldLevel = parseInt($(MODAL_LEVEL_EL_ID).textContent, 10);
      if (newLevel > oldLevel) triggerLevelUpAnimation(newLevel);

      $(MODAL_LEVEL_BAR_ID).dataset.locked = "false";
      console.log("[validateMultiplePictures] Progress bar UNLOCKED.");
    }, totalAnimationDuration);

  } catch (err) {
    showModal(`<p style="color: red;">Error validating photo(s): ${err.message}</p>`);
  }
}

// Validate general plant picture (single)
async function validateGeneralPicture() {
  const file = photoInput.files[0];
  if (!file) {
    validationResult.innerHTML = `<p>Please capture or select a photo first.</p>`;
    return;
  }

  $(MODAL_LEVEL_BAR_ID).dataset.locked = "true";
  console.log("[validateGeneralPicture] Progress bar LOCKED from updates.");

  try {
    const currentUserId = auth.currentUser.uid;
    const userRef = doc(db, 'users', currentUserId);

    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User document not found.");

    const userData = userSnap.data();
    const oldTotalPoints = userData.total_points || 0;
    const { level: oldLevel, prev: prevLevelThreshold, next: nextLevelThreshold } = computeLevel(oldTotalPoints);
    const oldProgress = ((oldTotalPoints - prevLevelThreshold) / (nextLevelThreshold - prevLevelThreshold)) * 100;

    $(MODAL_LEVEL_EL_ID).textContent = oldLevel;
    $(MODAL_LEVEL_BAR_ID).style.width = `${oldProgress}%`;
    showModal(`<p>Processing identification...</p>`);

    // Identify the picture
    const jsonResponse = await identifyPicture(file);
    const bestMatch = jsonResponse.bestMatch;
    const plantnetImageId = jsonResponse.query.images[0];
    const identification_score = jsonResponse.results[0].score;
    const speciesLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(bestMatch)}/data`;

    // Get user's location
    const { lat, lon } = await getCoordinates();

    // Determine mission points
    let total_points, points, isMissionValidated = false;
    if (missionsList && missionsList.length > 0) {
      const missionMatch = missionsList.find(m => m.name.trim().toLowerCase() === bestMatch.trim().toLowerCase());
      if (missionMatch) {
        total_points = missionMatch.total_points + missionPoints;
        points = missionMatch.points;
        isMissionValidated = true;
      } else {
        const result = await getPoints(lat, lon, bestMatch, speciesList);
        total_points = result.total_points;
        points = result.points;
      }
    } else {
      const result = await getPoints(lat, lon, bestMatch, speciesList);
      total_points = result.total_points;
      points = result.points;
    }

    const uploadedImageUrl = URL.createObjectURL(file);

    // Add observation to Firestore
    const discoveryBonus = await addObservation(
      currentUserId,
      bestMatch,
      lat,
      lon,
      plantnetImageId,
      total_points,
      points,
      identification_score
    );

    total_points += discoveryBonus;

    // Build identification result UI
    let resultHtml = `
      <h3>
        <button class="species-button" id="resultSpeciesBtnSingle">${bestMatch}</button>
      </h3>
    `;
    if (isMissionValidated) {
      resultHtml += `<p style="color: green;"><strong>Mission validated!</strong></p>`;
    }
    resultHtml += `
    <h3 style="text-align: center;">Points: 
      <span id="totalPoints">0</span>
    </h3>
    <div style="text-align: center;">
      <h4>Your observation:</h4>
      <img id="uploadedObsImg" src="${uploadedImageUrl}" alt="Uploaded plant image" 
        style="max-width: 120px; max-height: 120px; object-fit: contain; 
        border-radius: 8px; display: block; margin: 5px auto;">
    </div>`;

    // Compute observation-only total
    let observationPointsTotal = 0;
    if (points) {
      for (const key in points) {
        if (key !== "mission validated") observationPointsTotal += points[key];
      }
    }
    const obsTier = classifyPoints(observationPointsTotal);

    resultHtml += `
      <h3>Observation Points: 
        <span class="points-btn ${obsTier.class}">${observationPointsTotal} points</span>
      </h3>
      <h4>Observation Points:</h4>
      <div id="pointsContainer" aria-live="polite"></div>
    `;
    $("modalText").innerHTML = resultHtml;

    $("resultSpeciesBtnSingle")?.addEventListener('click', () => openSafe(speciesLink)); // NEW
    $("uploadedObsImg")?.addEventListener('load', () => URL.revokeObjectURL(uploadedImageUrl), { once: true }); // NEW

    // Animate totals
    animateValue("totalPoints", 0, total_points, 2000);

    // Details list
    let delay = 0;
    const keys = Object.keys(points || {}).filter(key => key !== "mission validated");
    keys.forEach(key => {
      setTimeout(() => {
        const p = document.createElement("p");
        p.textContent = `${key === 'base' ? 'Species observation' : key}: ${points[key]} points`;
        p.classList.add("fade-in");
        $("pointsContainer").appendChild(p);
      }, delay);
      delay += 300;
    });

    if (isMissionValidated || discoveryBonus > 0) {
      setTimeout(() => {
        let bonusHtml = "<h4>Bonus Points:</h4>";
        if (isMissionValidated) bonusHtml += `<p class="fade-in">Mission validated: ${missionPoints} points</p>`;
        if (discoveryBonus > 0) bonusHtml += `<p class="fade-in">New species discovery: 500 points</p>`;
        $("pointsContainer").insertAdjacentHTML("beforeend", bonusHtml);
      }, delay);
    }

    // Update modal bar at the end (global will sync via onSnapshot)
    const totalAnimationDuration = Math.max(2000, delay) + 200;
    setTimeout(async () => {
      const newUserSnap = await getDoc(userRef);
      const newTotalPoints = newUserSnap.data()?.total_points || 0;
      const { level: newLevel, progressPct: newProgress } = computeLevel(newTotalPoints);

      $(MODAL_LEVEL_EL_ID).textContent = newLevel;
      $(MODAL_LEVEL_BAR_ID).style.width = `${newProgress}%`;
      console.log(`[validateGeneralPicture] Updated Level: ${newLevel}, Progress: ${newProgress}`);

      const oldLevelCheck = parseInt($(MODAL_LEVEL_EL_ID).textContent, 10);
      if (newLevel > oldLevelCheck) triggerLevelUpAnimation(newLevel);

      $(MODAL_LEVEL_BAR_ID).dataset.locked = "false";
      console.log("[validateGeneralPicture] Progress bar UNLOCKED.");
    }, totalAnimationDuration);

  } catch (err) {
    showModal(`<p style="color: red;">Error validating photo: ${err.message}</p>`);
  }
}

/* ===============================
   Geolocation (same behavior)
   =============================== */
function getCoordinates() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
        },
        (error) => reject(new Error("Error getting location: " + error.message)),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
    } else {
      reject(new Error("Geolocation is not supported by this browser."));
    }
  });
}

getLocationBtn?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    locationInfo.textContent = "Geolocation is not supported by this browser.";
    return;
  }
  navigator.geolocation.getCurrentPosition(success, error, {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 1000
  });
});

function success(position) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  locationInfo.innerHTML = `<p>Your location: <strong>Lat:</strong> ${lat.toFixed(6)}, <strong>Lon:</strong> ${lon.toFixed(6)}</p>`;
  fetchSpecies(lat, lon);
}
function error(err) {
  locationInfo.textContent = "Error retrieving location: " + err.message;
}

/* ===============================
   Fetch missions / points (same endpoints)
   =============================== */
async function fetchSpeciesOLD(lat, lon) {
  suggestionsDiv.innerHTML = `<p>Loading missions...</p>`;
  const data = { point: { lat, lon } };
  try {
    const response = await fetch(SPECIES_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Network response was not ok');
    const jsonResponse = await response.json();
    missionsList = jsonResponse.species;
    await displaySpecies(jsonResponse);
  } catch (err) {
    suggestionsDiv.innerHTML = `<p>Error fetching missions: ${err.message}</p>`;
  }
}

async function fetchSpecies(lat, lon) {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  const lastFetchTimestamp = userSnap.data()?.last_species_fetch?.toMillis?.() || 0;
  const now = Date.now();

  if (now - lastFetchTimestamp < FETCH_COOLDOWN_MS) {
    const secondsLeft = Math.ceil((FETCH_COOLDOWN_MS - (now - lastFetchTimestamp)) / 1000);
    const existingContent = suggestionsDiv.innerHTML;
    suggestionsDiv.innerHTML = `
      <p style="color: orange;">Please wait ${secondsLeft} seconds before fetching missions again.</p>
      ${existingContent}
    `;
    return;
  }

  suggestionsDiv.innerHTML = `<p>Loading missions...</p>`;
  const data = { point: { lat, lon } };

  try {
    const response = await fetch(SPECIES_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Network response was not ok');

    const jsonResponse = await response.json();

    // 🌱 Save result_pred to speciesList
    speciesList = jsonResponse.result_pred.species;

    // 🧭 Save processed result to missionsList
    missionsList = jsonResponse.result.species;

    await saveSpeciesAndMissions(userRef, speciesList, missionsList);
    await displaySpecies(missionsList);

    // ✅ Store the new fetch time in Firestore
    await updateDoc(userRef, { last_species_fetch: serverTimestamp() });

  } catch (err) {
    suggestionsDiv.innerHTML = `<p>Error fetching missions: ${err.message}</p>`;
  }
}

async function getPoints(lat, lon, species, speciesList, uniqueOrgansCount = 1) {
  const data = {
    point: { lat, lon },
    species_name: species,
    species_list: speciesList,
    nb_organs: uniqueOrgansCount
  };

  try {
    const response = await fetch(POINTS_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();

  } catch (err) {
    return { total_points: 0, points: {} };
  }
}

/* ===============================
   UI helpers
   =============================== */
function animateValue(id, start, end, duration) {
  const obj = $(id);
  const range = end - start;
  const steps = Math.max(1, Math.floor(duration / 50));
  const increment = range / steps;
  let current = start;
  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    current += increment;
    if (tick >= steps) {
      current = end;
      clearInterval(timer);
    }
    if (obj) obj.textContent = Math.floor(current);
  }, 50);
}

function triggerLevelUpAnimation(newLevel) {
  const levelBadge = $('currentLevelText');
  const modalText = $("levelUp");
  if (levelBadge) levelBadge.classList.add("level-up-glow", "level-up-pop");

  const celebrationMessage = document.createElement("p");
  celebrationMessage.innerHTML = `🎉 <strong>Level Up!</strong>  🎉`;
  celebrationMessage.classList.add("level-up-message");
  modalText?.prepend(celebrationMessage);

  setTimeout(() => {
    levelBadge?.classList.remove("level-up-glow", "level-up-pop");
  }, 2500);

  fireConfettiInsideModal();
}

// Fire confetti animation (optional)
function fireConfetti() {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 }
  });
}

function fireConfettiInsideModal() {
  const modal = $("resultModal");
  if (!modal) return;

  let confettiCanvas = $("modalConfetti");
  if (!confettiCanvas) {
    confettiCanvas = document.createElement("canvas");
    confettiCanvas.id = "modalConfetti";
    confettiCanvas.style.position = "absolute";
    confettiCanvas.style.top = "0";
    confettiCanvas.style.left = "0";
    confettiCanvas.style.width = "100%";
    confettiCanvas.style.height = "100%";
    confettiCanvas.style.pointerEvents = "none";
    modal.appendChild(confettiCanvas);
  }

  const myConfetti = confetti.create(confettiCanvas, { resize: true, useWorker: true });
  myConfetti({ particleCount: 100, spread: 80, startVelocity: 50, origin: { y: 0.5, x: 0.5 } });

  setTimeout(() => { confettiCanvas.remove(); }, 3000);
}

async function saveSpeciesAndMissions(userRef, speciesList, missionsList) {
  try {
    await updateDoc(userRef, {
      species_list: speciesList,
      missions_list: missionsList,
    });
    console.log("[Firestore] speciesList and missionsList saved.");
  } catch (error) {
    console.error("[Firestore] Error saving species and missions:", error);
  }
}

function updateUIState() {
  if (allFiles.length === 0) {
    submitBtn.style.display = 'none';
    validateBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
        fill="currentColor" viewBox="0 0 16 16">
        <path d="M10.5 2a.5.5 0 0 1 .5.5V3h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2v-.5a.5.5 0 0 1 .5-.5h6Zm-2.5 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>
      </svg>
      I found a plant!
    `;
  } else {
    submitBtn.style.display = 'inline-block';
    validateBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
        fill="currentColor" viewBox="0 0 16 16">
        <path d="M10.5 2a.5.5 0 0 1 .5.5V3h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2v-.5a.5.5 0 0 1 .5-.5h6Zm-2.5 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>
      </svg>
      Add another photo
    `;
  }
}

/* ===============================
   File input listeners (mobile)
   =============================== */
validateBtn?.addEventListener('click', () => {
  if (!speciesList || speciesList.length === 0) {
    // Consistent UI instead of alert
    showModal(`<p>No species data available. Please load missions first.</p>`);
    return;
  }
  photoInput.click();
});

photoInput?.addEventListener('change', () => {
  const files = Array.from(photoInput.files || []);
  validationResult.innerHTML = '';
  if (files.length === 0) {
    validationResult.innerHTML = `<p>Please capture or select at least one photo.</p>`;
    return;
  }

  allFiles = allFiles.concat(files);

  files.forEach(file => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '80px';
    img.style.margin = '5px';
    img.style.borderRadius = '8px';
    img.style.border = '1px solid #ccc';
    img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true }); // NEW
    preview.appendChild(img);
  });

  photoInput.value = ''; // Allow repeated input
  updateUIState();
});

submitBtn?.addEventListener('click', async () => {
  if (allFiles.length === 0) {
    validationResult.innerHTML = `<p>No photos to validate. Please add some first.</p>`;
    return;
  }
  setBusy(submitBtn, true); // NEW
  try {
    updateUIState();
    validationResult.innerHTML = `<p>Validating ${allFiles.length} photos...</p>`;

    const pictures = allFiles;
    allFiles = [];
    preview.innerHTML = '';

    await validateMultiplePictures(pictures);
    validationResult.innerHTML = '';
  } finally {
    setBusy(submitBtn, false);
  }
});
