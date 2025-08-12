// features/missions.js
// Purpose: location → missions fetch → render, with Wikipedia thumbnails (feature-parity).

import { els, busy, toast } from '../dom.js';
import { state, setGeo, setMissionsList, setSpeciesList } from '../state.js';
import { fetchMissions, fetchWikipediaImage } from '../api.js';

export function init() {
  if (!els.getLocationBtn) return;

  els.getLocationBtn.addEventListener('click', async () => {
    if (!navigator.geolocation) { toast('Geolocation not supported.'); return; }

    busy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      els.locationInfo.textContent = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;

      try {
        const data = await fetchMissions(lat, lon);

        // Keep your current mapping:
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

// Build cards exactly like your current UI (with Wikipedia image)
async function renderMissions(missions) {
  if (!missions?.length) {
    els.suggestions.innerHTML = '<p class="muted">No missions nearby right now.</p>';
    return;
  }

  // We fetch thumbnails in parallel (keeping UI same)
  const thumbs = await Promise.all(
    missions.map(sp => fetchWikipediaImage(sp?.name))
  );

  els.suggestions.innerHTML = missions.map((sp, i) => {
    const totalPoints = Object.values(sp?.points || {}).reduce((a, b) => a + Number(b || 0), 0);
    const img = thumbs[i] || '';
    const badges = [
      sp.is_tree ? `<span class="badge tree-badge">🌳 Tree</span>` : '',
      sp.is_invasive ? `<span class="badge invasive-badge">⚠️ Invasive</span>` : '',
      sp.is_flowering ? `<span class="badge flowering-badge">🌼 Flowering</span>` : ''
    ].join('');

    const breakdown = Object.entries(sp?.points || {})
      .map(([k, v]) => `<p>${k === 'base' ? 'Species observation' : k}: ${v} points</p>`)
      .join('');

    return `
      <div class="species-item">
        <div class="card-content">
          <div class="species-image-container">
            ${img ? `<img class="species-image" src="${img}" alt="${sp?.name}">` : ''}
          </div>
          <div class="species-info">
            <h3>Mission: ${sp?.name || ''}</h3>
            <p>${sp?.common_name || ''}</p>
            ${badges}
            <div class="validation-feedback">${breakdown}</div>
            <button class="validate-species-btn" data-species="${sp?.name}">Validate Mission (+${totalPoints})</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Wire mission buttons to your existing validation flow (no new feature)
  els.suggestions.querySelectorAll('button[data-species]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Your previous code just gave a quick acknowledgement; keep same UX
      btn.disabled = true;
      const fb = btn.parentElement?.querySelector('.validation-feedback');
      if (fb) fb.textContent = 'Mission validated!';
      setTimeout(() => { btn.disabled = false; if (fb) fb.textContent = ''; }, 1500);
    });
  });
}
