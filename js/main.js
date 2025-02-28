// main.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { collection, doc, addDoc, setDoc, getDoc, serverTimestamp, GeoPoint, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from './firebase-config.js';

let missionsList = [];

let currentUserProgress = {
  total_points: 0,
  level: 1,
  progress: 0
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById('userName').textContent = user.displayName || user.email;
    const userRef = doc(db, 'users', user.uid);
    
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

document.getElementById('plantDexBtn').addEventListener('click', () => {
  window.location.href = "plantdex.html";
});

// Proxy server endpoints
const SPECIES_PROXY_URL = 'https://giving-winning-mastodon.ngrok-free.app/api/missions';
const POINTS_PROXY_URL = 'https://giving-winning-mastodon.ngrok-free.app/api/points';
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
async function addObservation(userId, speciesName, lat, lng, plantnetImageCode, total_points, points, plantnet_identify_score) {
  try {
    const observationData = {
      speciesName,
      observedAt: serverTimestamp(),
      location: new GeoPoint(lat, lng),
      plantnetImageCode,
      total_points,
      points,                     // integer value
      plantnet_identify_score     // float value
    };

    const observationsRef = collection(db, 'users', userId, 'observations');
    const observationDoc = await addDoc(observationsRef, observationData);
    console.log("Observation added with ID:", observationDoc.id);

    // Create or check discovery document
    const discoveryRef = doc(db, 'users', userId, 'discoveries', speciesName);
    const discoverySnap = await getDoc(discoveryRef);
    if (!discoverySnap.exists()) {
      // Discovery data now includes the observation ID instead of points and plantnet_identify_score
      const discoveryData = {
        speciesName,
        discoveredAt: serverTimestamp(),
        location: new GeoPoint(lat, lng),
        observationId: observationDoc.id  // reference to the original observation
      };
      await setDoc(discoveryRef, discoveryData);
      console.log("Discovery added for species:", speciesName);
    } else {
      console.log("Species already discovered.");
    }

    // Update the user's total_points field atomically.
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      total_points: increment(total_points)
    });
    console.log("User's total_points updated.");
    
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

  // Loop through each mission and build its card (without a validate button)
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

    // Points button with color coding based on totalPoints
    const pointsBtn = document.createElement('button');
    pointsBtn.classList.add('points-btn');
    pointsBtn.textContent = `${totalPoints} points`;
    if (totalPoints >= 500 && totalPoints < 1000) {
      pointsBtn.classList.add('common-points');
    } else if (totalPoints >= 1000 && totalPoints < 1500) {
      pointsBtn.classList.add('rare-points');
    } else if (totalPoints >= 1500 && totalPoints < 2000) {
      pointsBtn.classList.add('epic-points');
    } else if (totalPoints >= 2000) {
      pointsBtn.classList.add('legendary-points');
    }
    pointsBtn.addEventListener('click', () => {
      let detail = `<h2>Point details</h2><p><small>Mission: ${species.name}</small></p>`;
      let missionLevel = "";
      let levelClass = "";
      if (totalPoints >= 500 && totalPoints < 1000) {
        missionLevel = "Common";
        levelClass = "common-points";
      } else if (totalPoints >= 1000 && totalPoints < 1500) {
        missionLevel = "Rare";
        levelClass = "rare-points";
      } else if (totalPoints >= 1500 && totalPoints < 2000) {
        missionLevel = "Epic";
        levelClass = "epic-points";
      } else if (totalPoints >= 2000) {
        missionLevel = "Legendary";
        levelClass = "legendary-points";
      }
      detail += `<p class="mission-level ${levelClass}">${missionLevel}</p>`;
      if (species.points) {
        for (const key in species.points) {
          let displayKey = key === 'base' ? 'Species observation' : key;
          detail += `<p>${displayKey}: ${species.points[key]} points</p>`;
        }
      }
      showModal(detail);
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
    moreInfoLink.textContent = "More info";
    moreInfoP.appendChild(moreInfoLink);
    infoContainer.appendChild(moreInfoP);

    cardContent.appendChild(imageContainer);
    cardContent.appendChild(infoContainer);
    item.appendChild(cardContent);
    suggestionsDiv.appendChild(item);

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


// Validate general plant picture
async function validateGeneralPicture() {
  const file = photoInput.files[0];
  if (!file) {
    validationResult.innerHTML = `<p>Please capture or select a photo first.</p>`;
    return;
  }

  // Lock the progress bar to prevent unwanted updates
  document.getElementById('resultLevelProgressBar').dataset.locked = "true";
  console.log("[validateGeneralPicture] Progress bar LOCKED from updates.");

  const spinner = document.getElementById('spinner');
  spinner.style.display = 'block';

  try {
    const currentUserId = auth.currentUser.uid;
    const userRef = doc(db, 'users', currentUserId);

    // Fetch latest user data before starting validation
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User document not found.");

    const userData = userSnap.data();
    const oldTotalPoints = userData.total_points || 0;
    const oldLevel = Math.floor(1 + (oldTotalPoints / 11000));
    const prevLevelThreshold = (oldLevel - 1) * 11000;
    const nextLevelThreshold = oldLevel * 11000;
    const oldProgress = ((oldTotalPoints - prevLevelThreshold) / (nextLevelThreshold - prevLevelThreshold)) * 100;

    // Display initial values
    document.getElementById('resultLevelNumber').textContent = oldLevel;
    document.getElementById('resultLevelProgressBar').style.width = `${oldProgress}%`;
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
        total_points = missionMatch.total_points;
        points = missionMatch.points;
        isMissionValidated = true;
      } else {
        const result = await getPoints(lat, lon, bestMatch);
        total_points = result.total_points;
        points = result.points;
      }
    } else {
      const result = await getPoints(lat, lon, bestMatch);
      total_points = result.total_points;
      points = result.points;
    }

    // Fetch Wikipedia Image
    const wikiImageUrl = await getWikipediaImage(bestMatch);

    // Add observation to Firestore
    await addObservation(
      currentUserId,
      bestMatch,
      lat,
      lon,
      plantnetImageId,
      total_points,
      points,
      identification_score
    );

    // Wait for Firestore update
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Fetch updated user data
    const newUserSnap = await getDoc(userRef);
    const newUserData = newUserSnap.data();
    const newTotalPoints = newUserData.total_points || 0;
    const newLevel = Math.floor(1 + (newTotalPoints / 11000));
    const newPrevLevelThreshold = (newLevel - 1) * 11000;
    const newNextLevelThreshold = newLevel * 11000;
    const newProgress = ((newTotalPoints - newPrevLevelThreshold) / (newNextLevelThreshold - newPrevLevelThreshold)) * 100;

    // Build identification result UI
    let resultHtml = `<p>Identified species: <strong><a href="${speciesLink}" target="_blank">${bestMatch}</a></strong></p>`;
    if (isMissionValidated) {
      resultHtml += `<p style="color: green;"><strong>Mission validated!</strong></p>`;
    }
    if (wikiImageUrl) {
      resultHtml += `<img src="${wikiImageUrl}" alt="${bestMatch}" style="max-width: 150px; display: block; margin: 10px auto;">`;
    }
    resultHtml += `<h3>Total Points: <span id="totalPoints">0</span></h3>`;
    resultHtml += `<h4>Observation Points:</h4>`;
    resultHtml += `<div id="pointsContainer"></div>`;
    document.getElementById('modalText').innerHTML = resultHtml;

    // Animate total points
    animateValue("totalPoints", 0, total_points, 2000);

    // Animate each point row
    let delay = 0;
    const keys = Object.keys(points).filter(key => key !== "mission validated");
    keys.forEach(key => {
      setTimeout(() => {
        const p = document.createElement("p");
        p.textContent = `${key}: ${points[key]} points`;
        p.classList.add("fade-in");
        document.getElementById("pointsContainer").appendChild(p);
      }, delay);
      delay += 300;
    });

    // If mission validated, show bonus points
    if (isMissionValidated && points["mission validated"]) {
      setTimeout(() => {
        const bonusHtml = `<h4>Bonus Points:</h4><p class="fade-in">Mission validated: ${points["mission validated"]} points</p>`;
        document.getElementById("pointsContainer").insertAdjacentHTML("beforeend", bonusHtml);
      }, delay);
      delay += 300;
    }

    // Wait before updating progress bar and level
    const totalAnimationDuration = Math.max(2000, delay) + 1000;
    setTimeout(() => {
      document.getElementById('resultLevelNumber').textContent = newLevel;
      document.getElementById('resultLevelProgressBar').style.width = `${newProgress}%`;

      console.log(`[validateGeneralPicture] Updated Level: ${newLevel}, Progress: ${newProgress}`);

      if (newLevel > oldLevel) {
        triggerLevelUpAnimation(newLevel);
      }

      // Unlock the progress bar only after confirming updates
      document.getElementById('resultProgressBar').dataset.locked = "false";
      console.log("[validateGeneralPicture] Progress bar UNLOCKED.");

    }, totalAnimationDuration);

  } catch (err) {
    showModal(`<p style="color: red;">Error validating photo: ${err.message}</p>`);
  } finally {
    spinner.style.display = 'none';
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
    // Save the missions globally for later lookup
    missionsList = jsonResponse.species;
    await displaySpecies(jsonResponse);
  } catch (err) {
    suggestionsDiv.innerHTML = `<p>Error fetching missions: ${err.message}</p>`;
  }
}

// Fetch species missions via proxy
async function getPoints(lat, lon, species) {
  const data = { point: { lat, lon }, species_name: species };
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
  const levelText = document.getElementById('resultLevelNumber');
  const modalText = document.getElementById("modalText");

  // Add a glowing effect
  levelText.classList.add("level-up-glow");

  // Display a celebratory message
  const celebrationMessage = document.createElement("p");
  celebrationMessage.innerHTML = `🎉 <strong>Congratulations!</strong> You reached Level ${newLevel}! 🎉`;
  celebrationMessage.classList.add("level-up-message");
  
  // Insert the message at the top of the modal text
  modalText.prepend(celebrationMessage);

  // Remove the glow effect after animation
  setTimeout(() => {
    levelText.classList.remove("level-up-glow");
  }, 3000);
}

