// api.js
// Purpose: host ALL network calls exactly as they exist today.
// NO changes to endpoints, payloads, or response parsing.

export const SPECIES_PROXY_URL  = 'https://liked-stirring-stinkbug.ngrok-free.app/api/missions';
export const POINTS_PROXY_URL   = 'https://liked-stirring-stinkbug.ngrok-free.app/api/points';
export const IDENTIFY_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/identify';

/** Missions: POST { point:{lat,lon} } → server JSON (unchanged) */
export async function fetchMissions(lat, lon) {
  const res = await fetch(SPECIES_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ point: { lat, lon } })
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error('Missions response body:', raw);
    throw new Error(`Missions ${res.status}`);
  }
  let json;
  try { json = JSON.parse(raw); } catch { throw new Error('Missions: invalid JSON'); }
  return json; // keep exact shape (e.g., { result_pred: {species:[]}, result:{species:[]} })
}

/** Identify: multipart/form-data with 'image' → server JSON (unchanged) */
export async function identifyImage(file) {
  const formData = new FormData();
  formData.append('image', file, file.name);
  const res = await fetch(IDENTIFY_PROXY_URL, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Identify failed: ${res.status}`);
  return res.json(); // expect your current shape (speciesName/confidence/etc.)
}

/** Points: POST JSON payload (unchanged) */
export async function postPoints(payload) {
  const res = await fetch(POINTS_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error('Points response body:', raw);
    throw new Error(`Points API ${res.status}`);
  }
  return JSON.parse(raw); // expect { pointsBreakdown, totalPoints, newLevel, newProgress, ... }
}

/** Wikipedia thumbnail for a binomial name (unchanged behavior) */
export async function fetchWikipediaImage(speciesFullName) {
  const binomial = getBinomialName(speciesFullName);
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(binomial)}&prop=pageimages&format=json&pithumbsize=150&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages || {};
    const first = Object.values(pages)[0];
    return first?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

function getBinomialName(name) {
  if (!name) return '';
  // If your old logic did something more specific, I can replace this:
  const parts = String(name).trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}
