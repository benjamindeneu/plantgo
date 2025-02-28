// main.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-auth.js";
import { collection, doc, addDoc, setDoc, getDoc, serverTimestamp, GeoPoint, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from './firebase-config.js';

// --- Authentication check ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById('userName').textContent = `${user.displayName || user.email}`;

    // Get user reference
    const userRef = doc(db, 'users', user.uid);

    // Subscribe to real-time updates on total_points
    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const totalPoints = userData.total_points || 0;

        // Calculate level and progress
        const level = Math.floor(1 + (totalPoints / 11000));
        const nextLevelThreshold = level * 11000;
        const prevLevelThreshold = (level - 1) * 11000;
        const progress = ((totalPoints - prevLevelThreshold) / (nextLevelThreshold - prevLevelThreshold)) * 100;

        // Update the UI
        document.getElementById('levelNumber').textContent = level;
        document.getElementById('levelProgressBar').style.width = `${progress}%`;

        // Add dynamic color based on level range
        const levelBadge = document.getElementById('userLevel');
        levelBadge.className = "level-badge"; // Reset class first
        if (level < 5) {
          levelBadge.classList.add("beginner-level");
        } else if (level < 10) {
          levelBadge.classList.add("intermediate-level");
        } else {
          levelBadge.classList.add("expert-level");
        }
      }
    });
  } else {
    window.location.href = "login.html"; // Redirect if not logged in
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
  console.log('test')
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

    // Create the points button and assign a color class based on points value
    const pointsBtn = document.createElement('button');
    pointsBtn.classList.add('points-btn');
    pointsBtn.textContent = `${totalPoints} points`;
    if (totalPoints >= 500 && totalPoints < 1000) {
      pointsBtn.classList.add('common-points'); // Grey
    } else if (totalPoints >= 1000 && totalPoints < 1500) {
      pointsBtn.classList.add('rare-points'); // Blue
    } else if (totalPoints >= 1500 && totalPoints < 2000) {
      pointsBtn.classList.add('epic-points'); // Purple
    } else if (totalPoints >= 2000) {
      pointsBtn.classList.add('legendary-points'); // Golden
    }

    // Points button event listener to show breakdown
    pointsBtn.addEventListener('click', () => {
      let detail = `<h2>Point details</h2><p><small>Mission: ${species.name}</small></p>`;
    
      // Determine mission level
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
    
      // Add the mission level tag
      detail += `<p class="mission-level ${levelClass}">${missionLevel}</p>`;
    
      if (species.points) {
        for (const key in species.points) {
          let displayKey = key === 'base' ? 'Species observation' : key;
          detail += `<p>${displayKey}: ${species.points[key]} points</p>`;
        }
      }
    
      showModal(detail);
    });

    // Append the points button to the info container
    infoContainer.appendChild(pointsBtn);

    // If legendary, add sparkle elements
    if (totalPoints >= 1500) {
      const sides = ['top', 'right', 'bottom', 'left'];
      // Create 5 sparkles for a random effect
      for (let i = 0; i < 5; i++) {
        const sparkle = document.createElement('span');
        sparkle.classList.add('sparkle');
        sparkle.textContent = "★";
        const side = sides[Math.floor(Math.random() * sides.length)];
        // Reset positions
        sparkle.style.top = "";
        sparkle.style.right = "";
        sparkle.style.bottom = "";
        sparkle.style.left = "";
        if (side === 'top') {
          sparkle.style.top = "0%";
          sparkle.style.left = Math.random() * 100 + "%";
        } else if (side === 'bottom') {
          sparkle.style.bottom = "0%";
          sparkle.style.left = Math.random() * 100 + "%";
        } else if (side === 'left') {
          sparkle.style.left = "0%";
          sparkle.style.top = Math.random() * 100 + "%";
        } else if (side === 'right') {
          sparkle.style.right = "0%";
          sparkle.style.top = Math.random() * 100 + "%";
        }
        sparkle.style.animationDelay = Math.random() * 2 + "s";
        pointsBtn.appendChild(sparkle);
      }
    }

    // Build remaining info elements using DOM methods

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

    // Validation button
    const validateSpeciesBtn = document.createElement('button');
    validateSpeciesBtn.classList.add('validate-species-btn');
    validateSpeciesBtn.textContent = "Validate this mission";
    infoContainer.appendChild(validateSpeciesBtn);

    // File input for validation
    const fileInput = document.createElement('input');
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.capture = "environment";
    infoContainer.appendChild(fileInput);

    // Feedback div
    const feedbackDiv = document.createElement('div');
    feedbackDiv.classList.add('validation-feedback');
    infoContainer.appendChild(feedbackDiv);

    cardContent.appendChild(imageContainer);
    cardContent.appendChild(infoContainer);
    item.appendChild(cardContent);
    suggestionsDiv.appendChild(item);

    // Set up per-mission validation events
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
    // Show full-screen loading overlay immediately
    document.getElementById("fullscreenLoading").style.display = "flex";

    const jsonResponse = await identifyPicture(file);
    const bestMatch = jsonResponse.bestMatch;
    const plantnetImageId = jsonResponse.query.images[0];
    const identification_score = jsonResponse.results[0].score;
    const clickedName = species.name;

    const { lat, lon } = await getCoordinates();
    
    let total_points, points;
    let isMissionValidated = false;

    if (clickedName.trim().toLowerCase() === bestMatch.trim().toLowerCase()) {
      total_points = species.total_points;
      points = species.points;
      isMissionValidated = true;
    } else {
      const result = await getPoints(lat, lon, bestMatch);
      total_points = result.total_points;
      points = result.points;
    }

    // Determine mission level
    let missionLevel = "Common";
    let levelClass = "common-points";
    
    if (total_points >= 500 && total_points < 1000) {
      missionLevel = "Common";
      levelClass = "common-points";
    } else if (total_points >= 1000 && total_points < 1500) {
      missionLevel = "Rare";
      levelClass = "rare-points";
    } else if (total_points >= 1500 && total_points < 2000) {
      missionLevel = "Epic";
      levelClass = "epic-points";
    } else if (total_points >= 2000) {
      missionLevel = "Legendary";
      levelClass = "legendary-points";
    }

    let pointsBreakdown = `<h2>Identification Results</h2>`;
    if (isMissionValidated) {
      pointsBreakdown += `<p style="color: green;"><strong>Mission validated!</strong> You successfully identified <strong>${clickedName}</strong>.</p>`;
    } else {
      const identifiedLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(bestMatch)}/data`;
      pointsBreakdown += `<p style="color: red;"><strong>Mission NOT validated!</strong> Your selected mission was <strong>${clickedName}</strong>, but the plant identified was <strong><a href="${identifiedLink}" target="_blank">${bestMatch}</a></strong>.</p>`;
    }
    pointsBreakdown += `<p class="mission-level ${levelClass}">${missionLevel}</p>`;
    pointsBreakdown += `<h3>Total Points: ${total_points}</h3>`;
    pointsBreakdown += `<h4>Points Breakdown:</h4>`;
    for (const key in points) {
      let displayKey = key === 'base' ? 'Species observation' : key;
      pointsBreakdown += `<p>${displayKey}: ${points[key]} points</p>`;
    }

    // Log the observation first
    const currentUserId = auth.currentUser.uid;
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

    // Set an intro text specific to species validation
    //const introText = `<p><strong>Species Validation Complete!</strong></p>`;

    // Store results in session storage
    //sessionStorage.setItem('introText', introText);
    sessionStorage.setItem('resultsHTML', pointsBreakdown);

    // Instead of redirecting, load the validation view in the iframe
    document.getElementById('validationFrame').src = "validation.html";
    document.getElementById('validationFrameContainer').style.display = "block";

  } catch (err) {
    sessionStorage.setItem('introText', `<p style="color: red;">Error validating photo for ${species.name}</p>`);
    sessionStorage.setItem('resultsHTML', `<p style="color: red;">${err.message}</p>`);
    document.getElementById('validationFrame').src = "validation.html";
    document.getElementById('validationFrameContainer').style.display = "block";
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
    // Show full-screen loading overlay immediately
    document.getElementById("fullscreenLoading").style.display = "flex";

    const jsonResponse = await identifyPicture(file);
    const bestMatch = jsonResponse.bestMatch;
    const plantnetImageId = jsonResponse.query.images[0];
    const identification_score = jsonResponse.results[0].score;

    const { lat, lon } = await getCoordinates();

    const { total_points, points } = await getPoints(lat, lon, bestMatch);

    // Determine mission level
    let missionLevel = "Common";
    let levelClass = "common-points";
    
    if (total_points >= 500 && total_points < 1000) {
      missionLevel = "Common";
      levelClass = "common-points";
    } else if (total_points >= 1000 && total_points < 1500) {
      missionLevel = "Rare";
      levelClass = "rare-points";
    } else if (total_points >= 1500 && total_points < 2000) {
      missionLevel = "Epic";
      levelClass = "epic-points";
    } else if (total_points >= 2000) {
      missionLevel = "Legendary";
      levelClass = "legendary-points";
    }

    const speciesLink = `https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(bestMatch)}/data`;

    let pointsBreakdown = `<h2>Identification Results</h2>`;
    pointsBreakdown += `<p><strong>Species Identified:</strong> <a href="${speciesLink}" target="_blank">${bestMatch}</a></p>`;
    pointsBreakdown += `<p class="mission-level ${levelClass}">${missionLevel}</p>`;
    pointsBreakdown += `<h3>Total Points: ${total_points}</h3>`;
    pointsBreakdown += `<h4>Points Breakdown:</h4>`;
    for (const key in points) {
      let displayKey = key === 'base' ? 'Species observation' : key;
      pointsBreakdown += `<p>${displayKey}: ${points[key]} points</p>`;
    }

    // Log the observation first
    const currentUserId = auth.currentUser.uid;
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

    // Set an intro text specific to general picture validation
    //const introText = `<p><strong>General Plant Picture Validation Complete!</strong></p>`;

    //sessionStorage.setItem('introText', introText);
    sessionStorage.setItem('resultsHTML', pointsBreakdown);
    
    // Load the validation view in the iframe instead of redirecting
    document.getElementById('validationFrame').src = "validation.html";
    document.getElementById('validationFrameContainer').style.display = "block";

  } catch (err) {
    sessionStorage.setItem('introText', `<p style="color: red;">Error validating photo</p>`);
    sessionStorage.setItem('resultsHTML', `<p style="color: red;">${err.message}</p>`);
    document.getElementById('validationFrame').src = "validation.html";
    document.getElementById('validationFrameContainer').style.display = "block";
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
