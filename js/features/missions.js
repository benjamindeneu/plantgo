// features/missions.js
// Purpose: location → missions fetch → render cards with Wikipedia thumbnail.
// NO new buttons; NO behavior changes to your API usage.

import { els, busy, toast } from '../dom.js';
import { setGeo, setMissionsList, setSpeciesList } from '../state.js';
import { fetchMissions, fetchWikipediaImage } from '../api.js';

export function init() {
  if (!els.getLocationBtn) return;

  els.getLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Geolocation not supported.'); return; }

    busy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      els.locationInfo.textContent = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;

      try {
        // Keep your server contract unchanged (POST { point:{lat,lon} })
        const data = await fetchMissions(lat, lon);

        const speciesList = data?.result_pred?.species || [];
        const missionsList = data?.result?.species || [];

        setGeo({ lat, lon });
        setSpeciesList(speciesList);
        setMissionsList(missionsList);

        await renderMissions(missionsList);
      } catch (err) {
        console.error(err);
        toast('Could not fetch missions.');
      } finally {
        busy(false);
      }
    }, (err) => {
      busy(false);
      toast('Location permission denied.');
      console.warn(err);
    }, { enableHighAccuracy: true, timeout: 12000 });
  });
}

async function renderMissions(missions) {
  if (!missions?.length) {
    els.suggestions.innerHTML = '<p class="muted">No missions nearby right now.</p>';
    return;
  }

  // Preload Wikipedia thumbs (same behavior as before)
  const thumbs = await Promise.all(missions.map(sp => fetchWikipediaImage(sp?.name)));

  els.suggestions.innerHTML = missions.map((sp, i) => {
    const img = thumbs[i] || '';
    const badges = [
      sp.is_tree ? `<span class="badge tree-badge">🌳 Tree</span>` : '',
      sp.is_invasive ? `<span class="badge invasive-badge">⚠️ Invasive</span>` : '',
      sp.is_flowering ? `<span class="badge flowering-badge">🌼 Flowering</span>` : ''
    ].join('');

    const breakdown = Object.entries(sp?.points || {})
      .map(([k, v]) => `<p>${k === 'base' ? 'Species observation' : k}: ${v} points</p>`)
      .join('');

    // ⛔️ No mission button here. Just render the same info as your original.
    return `
      <div class="species-item">
        <div class="card-content">
          <div class="species-image-container">
            ${img ? `<img class="species-image" src="${img}" alt="${sp?.name}">` : ''}
          </div>
          <div class="species-info">
            <h3>${sp?.name || ''}</h3>
            <p>${sp?.common_name || ''}</p>
            ${badges}
            <div class="validation-feedback">${breakdown}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
