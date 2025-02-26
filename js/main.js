// main.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { collection, doc, addDoc, setDoc, getDoc, serverTimestamp, GeoPoint } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from './firebase-config.js';

// --- Authentication check ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in.
    document.getElementById('welcomeMessage').textContent = `Welcome, ${user.displayName || user.email}!`;
    // Continue initializing the app.
    initializeAppFeatures();
  } else {
    // No user is signed in; redirect to login page.
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

// Proxy server endpoints
const SPECIES_PROXY_URL = 'https://giving-winning-mastodon.ngrok-free.app/api/proxy';
const IDENTIFY_PROXY_URL = 'https://giving-winning-mastodon.ngrok-free.app/api/identify';

// DOM elements
const getLocationBtn = document.getElementById('getLocationBtn');
const locationInfo = document.getElementById('locationInfo');
const suggestionsDiv = document.getElementById('suggestions');
const photoInput = document.getElementById('photoInput');
const validateBtn = document.getElementById('validateBtn');
const validationResult = document.getElementById('validationResult');

// Modal functions
function showModal(content) {
  document.getElementById("modalText").innerHTML = content;
  document.getElementById("resultModal").style.display = "block";
}
function hideModal() {
  document.getElementById("resultModal").style.display = "none";
}
document.getElementById("modalClose").addEventListener("click", hideModal);
window.addEventListener("click", (event) => {
  if (event.target === document.getElementById("resultModal")) {
    hideModal();
  }
});

// Add observation (and discovery if needed) to Firestore
async function addObservation(userId, speciesName, lat, lng, plantnetImageCode) {
  try {
    const observationData = {
      speciesName,
      observedAt: serverTimestamp(),
      location: new GeoPoint(lat, lng),
      plantnetImageCode
    };

    const observationsRef = collection(db, 'users', userId, 'observations');
    const observationDoc = await addDoc(observationsRef, observationData);
    console.log("Observation added with ID:", observationDoc.id);

    const discoveryRef = doc(db, 'users', userId, 'discoveries', speciesName);
    const discoverySnap = await getDoc(discoveryRef);
    if (!discoverySnap.exists()) {
      const discoveryData = {
        speciesName,
        discoveredAt: serverTimestamp(),
        location: new GeoPoint(lat, lng)
      };
      await setDoc(discoveryRef, discoveryData);
      console.log("Discovery added for species:", speciesName);
    } else {
      console.log("Species already discovered.");
    }
  } catch (error) {
    console.error("Error adding observation/discovery:", error);
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
async function displaySpecies(response) {
  suggestionsDiv.innerHTML = '';
  if (!response.species || response.species.length === 0) {
    suggestionsDiv.innerHTML = `<p>No missions found.</p>`;
    return;
  }

  // Header with info button
  const header = document.createElement('h3');
  header.innerHTML = `Missions (${response.species.length}) <button id="infoButton" style="background:none;border:none;color:#388e3c;cursor:pointer;">ℹ️</button>`;
  suggestionsDiv.appendChild(header);
  document.getElementById("infoButton").addEventListener("click", () => {
    showModal("<h2>Mission Information</h2><p><small>Mission: [Species Name]</small></p><p>Missions are suggestions based on multiple metrics.</p>");
  });

  // Loop through each species and build the mission card
  for (const species of response.species) {
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
    img.src = ''; // Placeholder until loaded
    imageContainer.appendChild(img);

    // Info container
    const infoContainer = document.createElement('div');
    infoContainer.classList.add('species-info');

    // Compute total points
    let totalPoints = 0;
    if (species.points) {
      for (const key in species.points) {
        totalPoints += species.points[key];
      }
    }

    // Build status badges
    let statusFlare = "";
    if (species.is_tree) statusFlare += `<span class="badge tree-badge">🌳 Tree</span>`;
    if (species.is_invasive) statusFlare += `<span class="badge invasive-badge">⚠️ Invasive</span>`;
    if (species.is_flowering) statusFlare += `<span class="badge flowering-badge">🌸 Flowering</span>`;
    if (species.is_fruiting) statusFlare += `<span class="badge flowering-badge">🍎 Fruiting</span>`;

    // More info link
    const speciesLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(species.name)}/data`;
    infoContainer.innerHTML = `
      <button class="points-btn">${totalPoints} points</button>
      <p>${species.common_name || "No common name"}</p>
      <p>${statusFlare}</p>
      <p><a href="${speciesLink}" target="_blank">More info</a></p>
      <button class="validate-species-btn">Validate this mission</button>
      <input type="file" accept="image/*" capture="environment">
      <div class="validation-feedback"></div>
    `;

    cardContent.appendChild(imageContainer);
    cardContent.appendChild(infoContainer);
    item.appendChild(cardContent);
    suggestionsDiv.appendChild(item);

    // Points button event listener to show breakdown
    const pointsBtn = infoContainer.querySelector('.points-btn');
    pointsBtn.addEventListener('click', () => {
      let detail = `<h2>Point details</h2><p><small>Mission: ${species.name}</small></p>`;
      if (species.points) {
        for (const key in species.points) {
          let displayKey = key === 'base' ? 'Species observation' : key;
          detail += `<p>${displayKey}: ${species.points[key]} points</p>`;
        }
      }
      showModal(detail);
    });

    // Set up per-mission validation
    const validateSpeciesBtn = item.querySelector('.validate-species-btn');
    const fileInput = item.querySelector('input[type="file"]');
    const feedbackDiv = item.querySelector('.validation-feedback');
    validateSpeciesBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      feedbackDiv.innerHTML = `<p>Uploading picture for ${species.name}...</p>`;
      await validateSpeciesPicture(species, file);
    });

    // Load and display Wikipedia image
    const wikiImageUrl = await getWikipediaImage(species.name);
    if (wikiImageUrl) {
      img.src = wikiImageUrl;
    } else {
      imageContainer.style.display = 'none';
    }
  }
}

// Identify picture using the proxy server
async function identifyPicture(file) {
  const formData = new FormData();
  formData.append('image', file, file.name);
  const response = await fetch(IDENTIFY_PROXY_URL, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) throw new Error("Upload failed");
  return await response.json();
}

// Validate mission picture
async function validateSpeciesPicture(species, file) {
  try {
    const jsonResponse = await identifyPicture(file);
    const bestMatch = jsonResponse.bestMatch;
    const plantnetImageId = jsonResponse.query.images[0];
    const clickedName = species.name;
    let modalContent = "";
    if (clickedName.trim().toLowerCase() === bestMatch.trim().toLowerCase()) {
      modalContent = `<p>Congratulations! Your photo matches the selected mission: <strong>${clickedName}</strong>.</p>`;
    } else {
      const identifiedLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(bestMatch)}/data`;
      modalContent = `<p style="color: red;">This was not the right species!</p>
                      <p style="color: red;">Your selected mission was: <strong>${clickedName}</strong></p>
                      <p style="color: red;">Instead, you made a new observation of: <strong><a href="${identifiedLink}" target="_blank">${bestMatch}</a></strong>.</p>`;
    }
    showModal(modalContent);
    
    // Get the device's current GPS coordinates
    const { lat, lon } = await getCoordinates();
    
    // Use the authenticated user's UID instead of a hardcoded value.
    const currentUserId = auth.currentUser.uid;
    await addObservation(currentUserId, bestMatch, lat, lon, plantnetImageId);
  } catch (err) {
    showModal(`<p style="color: red;">Error validating photo for ${species.name}: ${err.message}</p>`);
  }
}

// Validate general plant picture
async function validateGeneralPicture() {
  const file = photoInput.files[0];
  if (!file) {
    validationResult.innerHTML = `<p>Please capture or select a photo first.</p>`;
    return;
  }
  try {
    const jsonResponse = await identifyPicture(file);
    const bestMatch = jsonResponse.bestMatch;
    const plantnetImageId = jsonResponse.query.images[0];
    const identifiedLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(bestMatch)}/data`;
    const modalContent = `<p>Your plant was identified as: <strong><a href="${identifiedLink}" target="_blank">${bestMatch}</a></strong>.</p>`;
    showModal(modalContent);
    
    // Get the device's current GPS coordinates
    const { lat, lon } = await getCoordinates();
    
    // Use the authenticated user's UID
    const currentUserId = auth.currentUser.uid;
    await addObservation(currentUserId, bestMatch, lat, lon, plantnetImageId);
  } catch (err) {
    showModal(`<p style="color: red;">Error validating photo: ${err.message}</p>`);
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
  photoInput.click();
});
photoInput.addEventListener('change', async () => {
  await validateGeneralPicture();
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

// Fetch species missions via proxy
async function fetchSpecies(lat, lon) {
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
    await displaySpecies(jsonResponse);
  } catch (err) {
    suggestionsDiv.innerHTML = `<p>Error fetching missions: ${err.message}</p>`;
  }
}
