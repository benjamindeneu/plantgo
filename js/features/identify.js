// features/identify.js
// Photo selection → identify → points → results modal. No server/API changes.

import { els, busy, toast, openModal, updateHeaderLevel, updateResultLevel, confettiBurst } from '../dom.js';
import { state, setTotalPoints, setLevel, setProgress } from '../state.js';
import { identifyImage, postPoints } from '../api.js';

export function init() {
  wireCamera();
  wireSubmit();
}

function renderPreviews(files) {
  els.preview.innerHTML = '';
  files.forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Selected plant photo ${idx + 1}`;
    img.style.width = '84px';
    img.style.height = '84px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '10px';
    img.loading = 'lazy';

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.appendChild(img);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove photo');
    Object.assign(removeBtn.style, {
      position: 'absolute', right: '4px', top: '4px',
      padding: '0 6px', borderRadius: '999px',
      background: 'rgba(0,0,0,.5)', color: '#fff'
    });
    removeBtn.onclick = () => {
      state.photoFiles.splice(idx, 1);
      renderPreviews(state.photoFiles);
    };
    wrap.appendChild(removeBtn);

    els.preview.appendChild(wrap);
  });
}

function wireCamera() {
  if (els.validateBtn) els.validateBtn.addEventListener('click', () => els.photoInput?.click());
  if (els.photoInput) {
    els.photoInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      state.photoFiles.push(...files);
      state.photoFiles = state.photoFiles.slice(0, 12);
      renderPreviews(state.photoFiles);
    });
  }
}

function wireSubmit() {
  if (!els.submitBtn) return;

  els.submitBtn.addEventListener('click', async () => {
    if (!state.photoFiles?.length) { toast('Please add at least one photo.'); return; }

    busy(true);
    try {
      const results = [];

      for (const file of state.photoFiles) {
        // Step 1: Identify (unchanged payload/shape)
        const identifyData = await identifyImage(file);

        // Step 2: Points (unchanged payload—include geo/species_list if you already do)
        const payload = {
          point: state.geo ? { lat: state.geo.lat, lon: state.geo.lon } : null,
          species_name: identifyData.speciesName,
          species_list: state.speciesList || [],
          nb_organs: identifyData.nb_organs || 1
        };
        const pointsData = await postPoints(payload);

        results.push({ ...identifyData, ...pointsData });
      }

      if (!results.length) { toast('No results to show.'); return; }

      // Aggregate+update
      const totalAdded = results.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
      const latest = results[results.length - 1];

      const newLevel = Number(latest?.newLevel ?? state.level);
      const newProgress = Number(latest?.newProgress ?? state.progress);
      setLevel(newLevel);
      setProgress(newProgress);

      const newTotal = Number(state.totalPoints || 0) + totalAdded;
      setTotalPoints(newTotal);

      updateResultLevel(newLevel, newProgress);
      updateHeaderLevel(newLevel, newProgress);

      // Modal HTML — same vibe as your original
      const lines = results.map((r) => {
        const pb = (r.pointsBreakdown || [])
          .map(p => `<span class="badge">${p.label}: <strong>+${p.points}</strong></span>`)
          .join(' ');
        const conf = Number(r.confidence || 0);
        return `
          <div class="species-item">
            <div class="card-content">
              <div class="species-info">
                <h3>${r.speciesName || 'Unknown species'}</h3>
                <p>Confidence: ${(conf * 100).toFixed(0)}%</p>
                ${pb}
              </div>
            </div>
          </div>`;
      }).join('');

      els.modalText.innerHTML = `
        <p class="mission-title">Great job! You earned <strong>+${totalAdded}</strong> points.</p>
        ${lines}
      `;

      openModal(els.resultModal);
      confettiBurst();

      // Reset queue
      state.photoFiles = [];
      renderPreviews(state.photoFiles);

    } catch (err) {
      console.error(err);
      toast('Validation failed for one or more photos.');
    } finally {
      busy(false);
    }
  });
}
