import { auth } from './firebase-config.js';
import { collection, getDocs, doc } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { db } from './firebase-config.js';

// DOM reference
const discoveriesList = document.getElementById("discoveriesList");

// Fetch user's discoveries
async function fetchDiscoveries() {
    discoveriesList.innerHTML = "Loading...";

    try {
        const user = auth.currentUser;
        if (!user) {
            discoveriesList.innerHTML = "<p>You need to be logged in to see your discoveries.</p>";
            return;
        }

        const userId = user.uid;
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
            discoveryDiv.classList.add("discovery-item");
            discoveryDiv.innerHTML = `
                <div class="discovery-card">
                    <img src="${wikiImageUrl || 'placeholder.jpg'}" alt="${speciesName}" class="discovery-image">
                    <div class="discovery-info">
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

// Run on load
document.addEventListener("DOMContentLoaded", fetchDiscoveries);
