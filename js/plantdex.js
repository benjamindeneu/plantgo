import { auth } from './firebase-config.js';
import { collection, getDocs, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from './firebase-config.js';

// DOM reference
const discoveriesList = document.getElementById("discoveriesList");

// Check auth state and wait until Firebase loads
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User is logged in:", user.uid); // Debugging log
            await fetchDiscoveries(user.uid); // Pass user ID once authenticated
        } else {
            console.log("User is NOT logged in"); // Debugging log
            discoveriesList.innerHTML = "<p>You need to be logged in to see your discoveries.</p>";
        }
    });
});

// Fetch user's discoveries from Firestore
async function fetchDiscoveries(userId) {
    discoveriesList.innerHTML = "<p>Loading...</p>";

    try {
        const discoveriesRef = collection(db, 'users', userId, 'discoveries');
        const querySnapshot = await getDocs(discoveriesRef);

        if (querySnapshot.empty) {
            discoveriesList.innerHTML = "<p>No discoveries yet.</p>";
            return;
        }

        discoveriesList.innerHTML = ""; // Clear loading text

        for (const docSnap of querySnapshot.docs) {
            const discovery = docSnap.data();
            const speciesName = discovery.speciesName;

            // Get Wikipedia image
            const wikiImageUrl = await getWikipediaImage(speciesName);

            // Create discovery card
            const discoveryDiv = document.createElement("div");
            discoveryDiv.classList.add("species-item");
            discoveryDiv.innerHTML = `
                <div class="card-content">
                    <div class="species-image-container">
                        <img src="${wikiImageUrl || 'placeholder.jpg'}" alt="${speciesName}" class="species-image">
                    </div>
                    <div class="species-info">
                        <h3>${speciesName}</h3>
                        <p><strong>Discovered:</strong> ${discovery.discoveredAt.toDate().toLocaleDateString()}</p>
                        <p><a href="https://identify.plantnet.org/fr/k-world-flora/species/${encodeURIComponent(speciesName)}/data" target="_blank">More info</a></p>
                    </div>
                </div>
            `;

            discoveriesList.appendChild(discoveryDiv);
        }

    } catch (error) {
        console.error("Error fetching discoveries:", error);
        discoveriesList.innerHTML = "<p>Error loading discoveries.</p>";
    }
}

// Function to get Wikipedia image
async function getWikipediaImage(speciesFullName) {
    const binomial = speciesFullName.split(" ").slice(0, 2).join(" ");
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(binomial)}&prop=pageimages&format=json&pithumbsize=150&origin=*`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const pages = data.query.pages;
        for (let pageId in pages) {
            if (pages[pageId].thumbnail) {
                return pages[pageId].thumbnail.source;
            }
        }
    } catch (err) {
        console.error("Wikipedia API error:", err);
    }
    return null;
}
