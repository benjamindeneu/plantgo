// main.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { collection, doc, addDoc, setDoc, getDoc, serverTimestamp, GeoPoint, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from './firebase-config.js';

const missionPoints = 500;
let missionsList = [];
let speciesList = [];
let allFiles = [];

let currentUserProgress = {
  total_points: 0,
  level: 1,
  progress: 0
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById('userName').textContent = user.displayName || user.email;
    const userRef = doc(db, 'users', user.uid);

    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const lastFetch = userData.last_species_fetch?.toDate(); // Firestore Timestamp → JS Date
    const now = new Date();
    const threeHours = 3 * 60 * 60 * 1000;

    updateUIState();

    if (lastFetch && (now - lastFetch < threeHours)) {
      console.log("[Cache] Using saved species and missions from Firestore");

      speciesList = userData.species_list || [];
      missionsList = userData.missions_list || [];

      await displaySpecies(missionsList); // mimic fetchSpecies response
    } else {
      console.log("[Fetch] No recent species fetch — calling fetchSpecies()");
      // Wait to fetch species after user location is available
      // You might need to trigger fetchSpecies(lat, lon) after geolocation succeeds
    }
    
    // Listen for real-time updates on the user's points
    onSnapshot(userRef, (docSnap) => {
      console.log("[onSnapshot] Triggered - Checking if the progress bar should update");
    
      if (!docSnap.exists()) return;
    
      const userData = docSnap.data();
      console.log("[onSnapshot] User data received:", userData);
    
      // Calculate new progress
      const newTotalPoints = userData.total_points || 0;
      const newLevel = Math.floor(1 + (newTotalPoints / 11000));
      const nextLevelThreshold = newLevel * 11000;
      const prevLevelThreshold = (newLevel - 1) * 11000;
      const newProgress = ((newTotalPoints - prevLevelThreshold) / (nextLevelThreshold - prevLevelThreshold)) * 100;
    
      console.log("[onSnapshot] Calculated Level:", newLevel, "Progress:", newProgress);
    
      // Check if the progress bar has been manually set already
      if (document.getElementById('resultProgressBar')?.dataset.locked === "true") {
        console.log("[onSnapshot] Progress bar update BLOCKED.");
        return;
      }
    
      // Apply updates
      document.getElementById('levelNumber').textContent = newLevel;
      document.getElementById('levelProgressBar').style.width = `${newProgress}%`;
    
      console.log("[onSnapshot] Progress bar updated from Firestore.");
    });

  } else {
    window.location.href = "login.html";
  }
});


// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Error during logout:", error);
  }
});

//document.getElementById('plantDexBtn').addEventListener('click', () => {
//  window.location.href = "plantdex.html";
//});
document.getElementById('plantDexBtn').addEventListener('click', () => {
  window.open("plantdex.html", "_blank");
});

// Proxy server endpoints
//const SPECIES_PROXY_URL = 'https://giving-winning-mastodon.ngrok-free.app/api/missions';
//const POINTS_PROXY_URL = 'https://giving-winning-mastodon.ngrok-free.app/api/points';
//const IDENTIFY_PROXY_URL = 'https://giving-winning-mastodon.ngrok-free.app/api/identify';

// Proxy server endpoints
const SPECIES_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/missions';
const IDENTIFY_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/identify';

// DOM elements
const getLocationBtn = document.getElementById('getLocationBtn');
const locationInfo = document.getElementById('locationInfo');
const suggestionsDiv = document.getElementById('suggestions');
const photoInput = document.getElementById('photoInput');
const validateBtn = document.getElementById('validateBtn');
const validationResult = document.getElementById('validationResult');
const submitBtn = document.getElementById('submitBtn');
const preview = document.getElementById('preview');

// Modal functions
function showModal(content) {
  document.getElementById("modalText").innerHTML = content;
  document.getElementById("resultModal").style.display = "block";
}
function hideModal() {
  document.getElementById("resultModal").style.display = "none";

  // **REMOVE LEVEL-UP MESSAGE WHEN CLOSING THE MODAL**
  const modalText = document.getElementById("levelUp");
  const existingMessages = modalText.querySelectorAll(".level-up-message");
  existingMessages.forEach(msg => msg.remove());
}
document.getElementById("modalClose").addEventListener("click", hideModal);
window.addEventListener("click", (event) => {
  if (event.target === document.getElementById("resultModal")) {
    hideModal();
  }
});

// Modal functions
function showModalMission(content) {
  document.getElementById("missionModalText").innerHTML = content;
  document.getElementById("missionModal").style.display = "block";
}
function hideModalMission() {
  document.getElementById("missionModal").style.display = "none";
}
document.getElementById("missionModalClose").addEventListener("click", hideModalMission);
window.addEventListener("click", (event) => {
  if (event.target === document.getElementById("missionModalClose")) {
    hideModalMission();
  }
});

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

// Helper: Extract binomial name for Wikipedia lookup
function getBinomialName(fullName) {
  const parts = fullName.trim().split(" ");
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : fullName;
}

// Retrieve Wikipedia thumbnail for a species
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

// Display species missions
async function displaySpecies(species_list) {
  suggestionsDiv.innerHTML = '';
  if (!species_list || species_list.length === 0) {
    suggestionsDiv.innerHTML = `<p>No missions found.</p>`;
    return;
  }

  const header = document.createElement('h3');
  header.innerHTML = `Missions (${species_list.length}) <button id="infoButton" style="background:none;border:none;color:#388e3c;cursor:pointer;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12" y2="8"></line>
    </svg>
  </button>`;
  suggestionsDiv.appendChild(header);
  document.getElementById("infoButton").addEventListener("click", () => {
    showModalMission("<h2>Mission Information</h2><p><small>Mission: [Species Name]</small></p><p>Missions suggest species for you to observe in your area based on GeoPl@ntNet predictions. These species are selected because they have been predicted with high uncertainty in a small radius around your location. Points are calculated using multiple metrics, including GeoPl@ntNet uncertainty, the distance to the nearest Pl@ntNet observation, the total number of Pl@ntNet observations, and the time since the last observation.</p>");
  });

  for (const species of species_list) {
    const item = document.createElement('div');
    item.classList.add('species-item');

    const missionTitle = document.createElement('div');
    missionTitle.classList.add('mission-title');
    missionTitle.textContent = `Mission: ${species.name}`;
    item.appendChild(missionTitle);

    const cardContent = document.createElement('div');
    cardContent.classList.add('card-content');

    const imageContainer = document.createElement('div');
    imageContainer.classList.add('species-image-container');
    const img = document.createElement('img');
    img.classList.add('species-image');
    img.alt = species.name;
    img.src = '';
    imageContainer.appendChild(img);

    const infoContainer = document.createElement('div');
    infoContainer.classList.add('species-info');

    // 🆕 total points now comes as species.points.total
    const totalPoints = species.points?.total ?? 0;

    const pointsBtn = document.createElement('button');
    pointsBtn.classList.add('points-btn');
    pointsBtn.textContent = `${totalPoints} points`;
    if (totalPoints < 500) pointsBtn.classList.add('common-points');
    else if (totalPoints < 1000) pointsBtn.classList.add('rare-points');
    else if (totalPoints < 1500) pointsBtn.classList.add('epic-points');
    else pointsBtn.classList.add('legendary-points');

    pointsBtn.addEventListener('click', () => {
      let detail = `<h2>Point details</h2><p><small>Mission: ${species.name}</small></p>`;
      let missionLevel = "";
      let levelClass = "";
      if (totalPoints < 500) { missionLevel = "Common"; levelClass = "common-points"; }
      else if (totalPoints < 1000) { missionLevel = "Rare"; levelClass = "rare-points"; }
      else if (totalPoints < 1500) { missionLevel = "Epic"; levelClass = "epic-points"; }
      else { missionLevel = "Legendary"; levelClass = "legendary-points"; }
      detail += `<p class="mission-level ${levelClass}">${missionLevel}</p>`;

      // 🆕 Breakdown lives in species.points.detail
      const detailObj = species.points?.detail || {};
      for (const key of Object.keys(detailObj)) {
        const displayKey = key === 'base' ? 'Species observation' : key;
        detail += `<p>${displayKey}: ${detailObj[key]} points</p>`;
      }
      showModalMission(detail);
    });

    infoContainer.appendChild(pointsBtn);

    const commonNameP = document.createElement('p');
    commonNameP.textContent = species.common_name || "No common name";
    infoContainer.appendChild(commonNameP);

    const badgesP = document.createElement('p');
    badgesP.innerHTML =
      (species.is_tree ? `<span class="badge tree-badge">🌳 Tree</span>` : '') +
      (species.is_invasive ? `<span class="badge invasive-badge">⚠️ Invasive</span>` : '') +
      (species.is_flowering ? `<span class="badge flowering-badge">🌸 Flowering</span>` : '') +
      (species.is_fruiting ? `<span class="badge flowering-badge">🍎 Fruiting</span>` : '');
    infoContainer.appendChild(badgesP);

    const moreInfoP = document.createElement('p');
    const speciesLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(species.name)}/data`;
    const moreInfoLink = document.createElement('a');
    moreInfoLink.href = speciesLink;
    moreInfoLink.target = "_blank";
    moreInfoLink.textContent = "More info";
    moreInfoP.appendChild(moreInfoLink);
    infoContainer.appendChild(moreInfoP);

    cardContent.appendChild(imageContainer);
    cardContent.appendChild(infoContainer);
    item.appendChild(cardContent);
    suggestionsDiv.appendChild(item);

    const wikiImageUrl = await getWikipediaImage(species.name);
    if (wikiImageUrl) img.src = wikiImageUrl;
    else imageContainer.style.display = 'none';
  }
}




// Identify picture using the proxy server
async function identifyPicture(file, lat, lon, model = "best") {
  const formData = new FormData();
  formData.append('image', file, file.name);
  formData.append('lat', String(lat));
  formData.append('lon', String(lon));
  formData.append('model', model);

  const response = await fetch(IDENTIFY_PROXY_URL, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  return await response.json(); // { identify: {...}, points: { total, detail }, model }
}


async function validateMultiplePictures(files) {
  if (!files || files.length === 0) {
    validationResult.innerHTML = `<p>Please select at least one image.</p>`;
    return;
  }

  // Lock progress bar
  document.getElementById('resultLevelProgressBar').dataset.locked = "true";
  console.log("[validateMultiplePictures] Progress bar LOCKED from updates.");

  try {
    const currentUserId = auth.currentUser.uid;
    const userRef = doc(db, 'users', currentUserId);

    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User document not found.");

    const userData = userSnap.data();
    const oldTotalPoints = userData.total_points || 0;
    const oldLevel = Math.floor(1 + (oldTotalPoints / 11000));
    const prevLevelThreshold = (oldLevel - 1) * 11000;
    const nextLevelThreshold = oldLevel * 11000;
    const oldProgress = ((oldTotalPoints - prevLevelThreshold) / (nextLevelThreshold - prevLevelThreshold)) * 100;

    document.getElementById('resultLevelNumber').textContent = oldLevel;
    document.getElementById('resultLevelProgressBar').style.width = `${oldProgress}%`;

    showModal(`<p>Processing ${files.length} image(s) for identification...</p>`);

    // Use the first image for backend (current API expects one)
    const mainFile = files[0];

    const { lat, lon } = await getCoordinates();
    const jsonResponse = await identifyPicture(mainFile, lat, lon, "best");

    // New shape
    const bestMatch = jsonResponse.identify?.name || "Unknown";
    const gbifId = jsonResponse.identify?.gbif_id ?? null;
    const identification_score = jsonResponse.identify?.score ?? 0;
    const plantnetImageId = jsonResponse.identify?.raw?.images?.[0] || null; // may be absent depending on PlantNet payload
    const pointsObj = jsonResponse.points || { total: 0, detail: {} };
    const speciesLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(bestMatch)}/data`;

    // Determine if this matches a mission
    let total_points = pointsObj.total || 0;
    const points = pointsObj.detail || {};
    let isMissionValidated = false;

    if (missionsList && missionsList.length > 0) {
      const missionMatch = missionsList.find(m => m.name.trim().toLowerCase() === bestMatch.trim().toLowerCase());
      if (missionMatch) {
        isMissionValidated = true;
        total_points += missionPoints; // client-side mission bonus
      }
    }

    // Save observation
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

    // Wait for Firestore update
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newUserSnap = await getDoc(userRef);
    const newUserData = newUserSnap.data();
    const newTotalPoints = newUserData.total_points || 0;
    const newLevel = Math.floor(1 + (newTotalPoints / 11000));
    const newPrevLevelThreshold = (newLevel - 1) * 11000;
    const newNextLevelThreshold = newLevel * 11000;
    const newProgress = ((newTotalPoints - newPrevLevelThreshold) / (newNextLevelThreshold - newPrevLevelThreshold)) * 100;

    // Build UI
    let resultHtml = `
      <h3>
        <button onclick="window.open('${speciesLink}', '_blank')" class="species-button">
          ${bestMatch}
        </button>
      </h3>
    `;
    if (isMissionValidated) {
      resultHtml += `<p style="color: green;"><strong>Mission validated!</strong></p>`;
    }
    resultHtml += `
      <h3 style="text-align: center;">Points: <span id="totalPoints">0</span></h3>
      <div style="text-align: center;">
        <h4>Your observation:</h4>
        ${files.map(file => `
          <img src="${URL.createObjectURL(file)}" alt="Uploaded image"
               style="max-width: 120px; max-height: 120px; object-fit: contain;
               border-radius: 8px; display: inline-block; margin: 5px;">
        `).join('')}
      </div>
      <h4>Observation Points:</h4>
      <div id="pointsContainer"></div>
    `;
    document.getElementById('modalText').innerHTML = resultHtml;

    // Animate
    animateValue("totalPoints", 0, total_points, 2000);

    let delay = 0;
    for (const key of Object.keys(points)) {
      setTimeout(() => {
        const p = document.createElement("p");
        p.textContent = `${key}: ${points[key]} points`;
        p.classList.add("fade-in");
        document.getElementById("pointsContainer").appendChild(p);
      }, delay);
      delay += 300;
    }

    if (isMissionValidated || discoveryBonus > 0) {
      setTimeout(() => {
        let bonusHtml = "<h4>Bonus Points:</h4>";
        if (isMissionValidated) bonusHtml += `<p class="fade-in">Mission validated: ${missionPoints} points</p>`;
        if (discoveryBonus > 0) bonusHtml += `<p class="fade-in">New species discovery: 500 points</p>`;
        document.getElementById("pointsContainer").insertAdjacentHTML("beforeend", bonusHtml);
      }, delay);
    }

    const totalAnimationDuration = Math.max(2000, delay) + 200;
    setTimeout(() => {
      document.getElementById('resultLevelNumber').textContent = newLevel;
      document.getElementById('resultLevelProgressBar').style.width = `${newProgress}%`;
      if (newLevel > oldLevel) triggerLevelUpAnimation(newLevel);
      document.getElementById('resultLevelProgressBar').dataset.locked = "false";
    }, totalAnimationDuration);

  } catch (err) {
    showModal(`<p style="color: red;">Error validating photo(s): ${err.message}</p>`);
  }
}


// Get GPS coordinates as a promise
function getCoordinates() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
        },
        (error) => reject(new Error("Error getting location: " + error.message))
      );
    } else {
      reject(new Error("Geolocation is not supported by this browser."));
    }
  });
}

// Event listeners
validateBtn.addEventListener('click', () => {
  if (!speciesList || speciesList.length === 0) {
    alert("No species data available. Please load missions first.");
    return;
  }

  photoInput.click();
});

//photoInput.addEventListener('change', async () => {
//  await validateGeneralPicture();
//});

photoInput.addEventListener('change', () => {
  const files = Array.from(photoInput.files);
  validationResult.innerHTML = '';
  if (files.length === 0) {
    validationResult.innerHTML = `<p>Please capture or select at least one photo.</p>`;
    return;
  }

  allFiles = allFiles.concat(files);

  files.forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = '80px';
    img.style.margin = '5px';
    img.style.borderRadius = '8px';
    img.style.border = '1px solid #ccc';
    preview.appendChild(img);
  });

  photoInput.value = ''; // Allow repeated input
  updateUIState();
});

submitBtn.addEventListener('click', async () => {
  if (allFiles.length === 0) {
    validationResult.innerHTML = `<p>No photos to validate. Please add some first.</p>`;
    return;
  }
  updateUIState();
  validationResult.innerHTML = `<p>Validating ${allFiles.length} photos...</p>`;

  const pictures = allFiles;
  allFiles = [];
  preview.innerHTML = '';

  await validateMultiplePictures(pictures);
  validationResult.innerHTML = '';
});

getLocationBtn.addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 1000
    });
  } else {
    locationInfo.textContent = "Geolocation is not supported by this browser.";
  }
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

async function fetchSpecies(lat, lon) {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  const lastFetchTimestamp = userSnap.data()?.last_species_fetch?.toMillis?.() || 0;
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;

  if (now - lastFetchTimestamp < FIVE_MINUTES) {
    const secondsLeft = Math.ceil((FIVE_MINUTES - (now - lastFetchTimestamp)) / 1000);
    const existingContent = suggestionsDiv.innerHTML;
    suggestionsDiv.innerHTML = `
      <p style="color: orange;">Please wait ${secondsLeft} seconds before fetching missions again.</p>
      ${existingContent}
    `;
    return;
  }

  suggestionsDiv.innerHTML = `<p>Loading missions...</p>`;

  try {
    const body = { lat, lon, model: "best", limit: 20 }; // tweak limit if you want
    const resp = await fetch(SPECIES_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Network response was not ok (${resp.status})`);
    const json = await resp.json();

    // Backend now sends: { model, missions: [...], length }
    missionsList = json.missions || [];
    // Optional: keep a simple list of species names if you still need it elsewhere
    speciesList = missionsList.map(m => m.name);

    await saveSpeciesAndMissions(userRef, speciesList, missionsList);
    await displaySpecies(missionsList);

    await updateDoc(userRef, { last_species_fetch: serverTimestamp() });
  } catch (err) {
    suggestionsDiv.innerHTML = `<p>Error fetching missions: ${err.message}</p>`;
  }
}


function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  const range = end - start;
  const increment = range / (duration / 50); // update every 50ms
  let current = start;
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    obj.textContent = Math.floor(current);
  }, 50);
}

function triggerLevelUpAnimation(newLevel) {
  const levelBadge = document.getElementById('currentLevelText');
  const modalText = document.getElementById("levelUp");

  // Add glowing and pop-up effects
  levelBadge.classList.add("level-up-glow", "level-up-pop");

  // Celebration message
  const celebrationMessage = document.createElement("p");
  celebrationMessage.innerHTML = `🎉 <strong>Level Up!</strong>  🎉`;
  celebrationMessage.classList.add("level-up-message");
  
  // Insert the message at the top of the modal text
  modalText.prepend(celebrationMessage);

  // Remove animation classes after animation ends
  setTimeout(() => {
    levelBadge.classList.remove("level-up-glow", "level-up-pop");
  }, 2500); // Duration matches CSS animation time

  // (Optional) Fire confetti for extra celebration
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
  const modal = document.getElementById("resultModal");

  // Create a new canvas element inside the modal
  let confettiCanvas = document.getElementById("modalConfetti");
  if (!confettiCanvas) {
    confettiCanvas = document.createElement("canvas");
    confettiCanvas.id = "modalConfetti";
    confettiCanvas.style.position = "absolute";
    confettiCanvas.style.top = "0";
    confettiCanvas.style.left = "0";
    confettiCanvas.style.width = "100%";
    confettiCanvas.style.height = "100%";
    confettiCanvas.style.pointerEvents = "none"; // So it doesn't interfere with clicks

    modal.appendChild(confettiCanvas);
  }

  const myConfetti = confetti.create(confettiCanvas, {
    resize: true,
    useWorker: true
  });

  // Fire confetti effect
  myConfetti({
    particleCount: 100,
    spread: 80,
    startVelocity: 50,
    origin: { y: 0.5, x: 0.5 }
  });

  // Remove the canvas after animation
  setTimeout(() => {
    confettiCanvas.remove();
  }, 3000);
}

async function saveSpeciesAndMissions(userRef, speciesList, missionsList) {
  try {
    await updateDoc(userRef, {
      species_list: speciesList,
      missions_list: missionsList,
      //last_species_mission_save: serverTimestamp()  // Optional: for tracking
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
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M10.5 2a.5.5 0 0 1 .5.5V3h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2v-.5a.5.5 0 0 1 .5-.5h6Zm-2.5 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>
      </svg>
      I found a plant!
    `;
  } else {
    submitBtn.style.display = 'inline-block';
    validateBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M10.5 2a.5.5 0 0 1 .5.5V3h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2v-.5a.5.5 0 0 1 .5-.5h6Zm-2.5 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>
      </svg>
      Add another photo
    `;
  }
}