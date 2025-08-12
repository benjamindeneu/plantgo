// api.js
export const SPECIES_PROXY_URL  = 'https://liked-stirring-stinkbug.ngrok-free.app/api/missions';
export const POINTS_PROXY_URL   = 'https://liked-stirring-stinkbug.ngrok-free.app/api/points';
export const IDENTIFY_PROXY_URL = 'https://liked-stirring-stinkbug.ngrok-free.app/api/identify';

export async function fetchMissions(lat, lon) {
  const res = await fetch(SPECIES_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ point: { lat, lon } })
  });
  const raw = await res.text();
  if (!res.ok) { console.error('Missions response body:', raw); throw new Error(`Missions ${res.status}`); }
  return JSON.parse(raw); // unchanged shape
}

export async function identifyImage(file) {
  const formData = new FormData();
  formData.append('image', file, file.name);
  const res = await fetch(IDENTIFY_PROXY_URL, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Identify failed: ${res.status}`);
  return res.json(); // unchanged shape
}

export async function postPoints(payload) {
  const res = await fetch(POINTS_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const raw = await res.text();
  if (!res.ok) { console.error('Points response body:', raw); throw new Error(`Points API ${res.status}`); }
  return JSON.parse(raw); // unchanged shape
}

// --- Wikipedia helpers (client-side only; doesn’t touch your server) ---
export async function fetchWikipediaImage(speciesFullName) {
  const binomial = getBinomialName(speciesFullName);
  if (!binomial) return null;
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(binomial)}&prop=pageimages&format=json&pithumbsize=150&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages || {};
    const first = Object.values(pages)[0];
    return first?.thumbnail?.source || null;
  } catch { return null; }
}

export function wikipediaPageUrl(speciesFullName) {
  const binomial = getBinomialName(speciesFullName);
  return binomial ? `https://en.wikipedia.org/wiki/${encodeURIComponent(binomial)}` : '#';
}

function getBinomialName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}
