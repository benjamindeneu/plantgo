// features/missions.js
// Renders mission cards with: Title, total points tag + level, ⓘ info toggle, wiki image, More info link.
// No server API/shape changes.

import { els, busy, toast } from '../dom.js';
import { setGeo, setMissionsList, setSpeciesList } from '../state.js';
import { fetchMissions, fetchWikipediaImage, wikipediaPageUrl } from '../api.js';

export function init() {
  refreshEls();
  if (!els.getLocationBtn) return;

  els.getLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Geolocation not supported.'); return; }

    busy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      els.locationInfo.textContent = `Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;

      try {
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

function levelFromTotal(total) {
  if (total >= 1500) return { label: 'Legendary', cls: 'legendary-points' };
  if (total >= 1000) return { label: 'Epic',       cls: 'epic-points' };
  if (total >= 500)  return { label: 'Rare',       cls: 'rare-points' };
  return { label: 'Common', cls: 'common-points' };
}

async function renderMissions(missions) {
  if (!missions?.length) {
    els.suggestions.innerHTML = '<p class="muted">No missions nearby right now.</p>';
    return;
  }

  // Preload thumbs in parallel
  const thumbs = await Promise.all(missions.map(sp => fetchWikipediaImage(sp?.name)));
  els.suggestions.innerHTML = `
    <h2 class="mission-title">Missions near you</h2>
    ${missions.map((sp, i) => {
      const total = Object.values(sp?.points || {}).reduce((a, b) => a + Number(b || 0), 0);
      const { label, cls } = levelFromTotal(total);
      const img = thumbs[i] || '';
      const badges = [
        sp.is_tree ? `<span class="badge tree-badge">🌳 Tree</span>` : '',
        sp.is_invasive ? `<span class="badge invasive-badge">⚠️ Invasive</span>` : '',
        sp.is_flowering ? `<span class="badge flowering-badge">🌼 Flowering</span>` : ''
      ].join('');
      const wikiHref = wikipediaPageUrl(sp?.name);

      // Details content (hidden by default)
      const detailsId = `mi-${i}`;
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
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                <span class="mission-level ${cls}">+${total} · ${label}</span>
                <button class="validate-species-btn" data-info-id="${detailsId}" aria-expanded="false" aria-controls="${detailsId}" title="More details">ⓘ</button>
                <a class="validate-species-btn" href="${wikiHref}" target="_blank" rel="noopener">More info</a>
              </div>
              <div id="${detailsId}" class="validation-feedback" style="display:none;margin-top:8px;">
                ${breakdown || '<p>No details available.</p>'}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;

  // Wire ⓘ info toggles
  els.suggestions.querySelectorAll('button[data-info-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-info-id');
      const panel = document.getElementById(id);
      if (!panel) return;
      const open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!open));
    });
  });
}
