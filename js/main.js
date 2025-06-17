// main.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { collection, doc, addDoc, setDoc, getDoc, serverTimestamp, GeoPoint, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from './firebase-config.js';

const missionPoints = 500;
let missionsList = [];
let speciesList = [];

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

const SPECIES_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/missions';
const POINTS_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/points';
const IDENTIFY_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/identify';

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
async function displaySpecies(response) {
  suggestionsDiv.innerHTML = '';
  if (!response.species || response.species.length === 0) {
    suggestionsDiv.innerHTML = `<p>No missions found.</p>`;
    return;
  }

  // Header with info button
  const header = document.createElement('h3');
  header.innerHTML = `Missions (${response.species.length}) <button id="infoButton" style="background:none;border:none;color:#388e3c;cursor:pointer;">
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
    if (totalPoints >= 0 && totalPoints < 500) {
      pointsBtn.classList.add('common-points');
    } else if (totalPoints >= 500 && totalPoints < 1000) {
      pointsBtn.classList.add('rare-points');
    } else if (totalPoints >= 1000 && totalPoints < 1500) {
      pointsBtn.classList.add('epic-points');
    } else if (totalPoints >= 1500) {
      pointsBtn.classList.add('legendary-points');
    }
    pointsBtn.addEventListener('click', () => {
      let detail = `<h2>Point details</h2><p><small>Mission: ${species.name}</small></p>`;
      let missionLevel = "";
      let levelClass = "";
      if (totalPoints >= 0 && totalPoints < 500) {
        missionLevel = "Common";
        levelClass = "common-points";
      } else if (totalPoints >= 500 && totalPoints < 1000) {
        missionLevel = "Rare";
        levelClass = "rare-points";
      } else if (totalPoints >= 1000 && totalPoints < 1500) {
        missionLevel = "Epic";
        levelClass = "epic-points";
      } else if (totalPoints >= 1500) {
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

    // Send all images together
    const formData = new FormData();
    files.forEach(file => {
      formData.append('image', file, file.name);
    });

    const response = await fetch(IDENTIFY_PROXY_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error("Upload failed");

    const jsonResponse = await response.json();

    // 🔍 One identification result
    const bestMatch = jsonResponse.bestMatch;
    const plantnetImageId = jsonResponse.query?.images?.[0];
    const identification_score = jsonResponse.results?.[0]?.score || 0;
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
        const result = await getPoints(lat, lon, bestMatch);
        total_points = result.total_points;
        points = result.points;
      }
    } else {
      const result = await getPoints(lat, lon, bestMatch);
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

    await new Promise(resolve => setTimeout(resolve, 1500));

    const newUserSnap = await getDoc(userRef);
    const newUserData = newUserSnap.data();
    const newTotalPoints = newUserData.total_points || 0;
    const newLevel = Math.floor(1 + (newTotalPoints / 11000));
    const newPrevLevelThreshold = (newLevel - 1) * 11000;
    const newNextLevelThreshold = newLevel * 11000;
    const newProgress = ((newTotalPoints - newPrevLevelThreshold) / (newNextLevelThreshold - newPrevLevelThreshold)) * 100;

    // Build result UI
    let resultHtml = `
      <h3>
        <button 
          onclick="window.open('${speciesLink}', '_blank')" 
          class="species-button"
        >
          ${bestMatch}
        </button>
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
        ${files.map(file => `
          <img src="${URL.createObjectURL(file)}" alt="Uploaded image" 
               style="max-width: 120px; max-height: 120px; object-fit: contain; 
               border-radius: 8px; display: inline-block; margin: 5px;">
        `).join('')}
      </div>
    `;

    // Compute observation points
    let observationPointsTotal = 0;
    if (points) {
      for (const key in points) {
        if (key !== "mission validated") {
          observationPointsTotal += points[key];
        }
      }
    }

    let observationLevel = "";
    let observationClass = "";
    if (observationPointsTotal < 500) {
      observationLevel = "Common";
      observationClass = "common-points";
    } else if (observationPointsTotal < 1000) {
      observationLevel = "Rare";
      observationClass = "rare-points";
    } else if (observationPointsTotal < 1500) {
      observationLevel = "Epic";
      observationClass = "epic-points";
    } else {
      observationLevel = "Legendary";
      observationClass = "legendary-points";
    }

    resultHtml += `
      <h3>Observation Points: 
        <span class="points-btn ${observationClass}">${observationPointsTotal} points</span>
      </h3>
      <h4>Observation Points:</h4>
      <div id="pointsContainer"></div>
    `;

    document.getElementById('modalText').innerHTML = resultHtml;
    animateValue("totalPoints", 0, total_points, 2000);

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

    if (isMissionValidated || discoveryBonus > 0) {
      setTimeout(() => {
        let bonusHtml = "<h4>Bonus Points:</h4>";
        if (isMissionValidated) {
          bonusHtml += `<p class="fade-in">Mission validated: ${missionPoints} points</p>`;
        }
        if (discoveryBonus > 0) {
          bonusHtml += `<p class="fade-in">New species discovery: 500 points</p>`;
        }
        document.getElementById("pointsContainer").insertAdjacentHTML("beforeend", bonusHtml);
      }, delay);
    }

    const totalAnimationDuration = Math.max(2000, delay) + 200;
    setTimeout(() => {
      document.getElementById('resultLevelNumber').textContent = newLevel;
      document.getElementById('resultLevelProgressBar').style.width = `${newProgress}%`;

      console.log(`[validateMultiplePictures] Updated Level: ${newLevel}, Progress: ${newProgress}`);

      if (newLevel > oldLevel) {
        triggerLevelUpAnimation(newLevel);
      }

      document.getElementById('resultLevelProgressBar').dataset.locked = "false";
      console.log("[validateMultiplePictures] Progress bar UNLOCKED.");
    }, totalAnimationDuration);

  } catch (err) {
    showModal(`<p style="color: red;">Error validating photo(s): ${err.message}</p>`);
  }
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
        total_points = missionMatch.total_points + missionPoints;
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

    // Use the user-uploaded image instead of fetching from Wikipedia
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
    let resultHtml = `
      <h3>
        <button 
          onclick="window.open('${speciesLink}', '_blank')" 
          class="species-button"
        >
          ${bestMatch}
        </button>
      </h3>
    `;
    if (isMissionValidated) {
      resultHtml += `<p style="color: green;"><strong>Mission validated!</strong></p>`;
    }
    // Show user-uploaded image instead
    resultHtml += `
    <h3 style="text-align: center;">Points: 
      <span id="totalPoints">0</span>
    </h3>
    <div style="text-align: center;">
      <h4>Your observation:</h4>
      <img src="${uploadedImageUrl}" alt="Uploaded plant image" 
        style="max-width: 120px; max-height: 120px; object-fit: contain; 
        border-radius: 8px; display: block; margin: 5px auto;">
    </div>`;

    // Compute total observation points alone (excluding mission bonus)
    let observationPointsTotal = 0;
    if (points) {
      for (const key in points) {
        if (key !== "mission validated") {
          observationPointsTotal += points[key];
        }
      }
    }
    
    // Determine category for observation points (Common, Rare, Epic, Legendary)
    let observationLevel = "";
    let observationClass = "";
    if (observationPointsTotal >= 0 && observationPointsTotal < 500) {
      observationLevel = "Common";
      observationClass = "common-points";
    } else if (observationPointsTotal >= 500 && observationPointsTotal < 1000) {
      observationLevel = "Rare";
      observationClass = "rare-points";
    } else if (observationPointsTotal >= 1000 && observationPointsTotal < 1500) {
      observationLevel = "Epic";
      observationClass = "epic-points";
    } else if (observationPointsTotal >= 1500) {
      observationLevel = "Legendary";
      observationClass = "legendary-points";
    }
    
    // Add observation points badge to the result modal
    resultHtml += `
      <h3>Observation Points: 
        <span class="points-btn ${observationClass}">${observationPointsTotal} points</span>
      </h3>
    `;
    
    // Continue with total points as a separate section
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
    // If mission validated, show bonus points
    if (isMissionValidated || discoveryBonus > 0) {
      setTimeout(() => {
        let bonusHtml = "<h4>Bonus Points:</h4>";
        if (isMissionValidated) {
          bonusHtml += `<p class="fade-in">Mission validated: ${missionPoints} points</p>`;
        }
        if (discoveryBonus > 0) {
          bonusHtml += `<p class="fade-in">New species discovery: 500 points</p>`;
        }
        document.getElementById("pointsContainer").insertAdjacentHTML("beforeend", bonusHtml);
      }, delay);
    }

    // Wait before updating progress bar and level
    const totalAnimationDuration = Math.max(2000, delay) + 200;
    setTimeout(() => {
      document.getElementById('resultLevelNumber').textContent = newLevel;
      document.getElementById('resultLevelProgressBar').style.width = `${newProgress}%`;

      console.log(`[validateGeneralPicture] Updated Level: ${newLevel}, Progress: ${newProgress}`);

      if (newLevel > oldLevel) {
        triggerLevelUpAnimation(newLevel);
      }

      // Unlock the progress bar only after confirming updates
      document.getElementById('resultLevelProgressBar').dataset.locked = "false";
      console.log("[validateGeneralPicture] Progress bar UNLOCKED.");

    }, totalAnimationDuration);

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
//photoInput.addEventListener('change', async () => {
//  await validateGeneralPicture();
//});
photoInput.addEventListener('change', async () => {
  const files = Array.from(photoInput.files);
  if (files.length === 0) {
    validationResult.innerHTML = `<p>Please capture or select at least one photo.</p>`;
    return;
  }

  await validateMultiplePictures(files);
  photoInput.value = ''; // allow re-selection
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
    // Save the missions globally for later lookup
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

  // Get the last fetch time (convert Firestore Timestamp to JS time)
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

  // Update UI while loading
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
  
    await displaySpecies(jsonResponse.result);
  
    // ✅ Store the new fetch time in Firestore
    await updateDoc(userRef, {
      last_species_fetch: serverTimestamp()
    });
  
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


