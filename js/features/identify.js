// features/identify.js
// Purpose: photo selection → identify → points → show modal (feature-parity).

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
    removeBtn.style.position = 'absolute';
    removeBtn.style.right = '4px';
    removeBtn.style.top = '4px';
    removeBtn.style.padding = '0 6px';
    removeBtn.style.borderRadius = '999px';
    removeBtn.style.background = 'rgba(0,0,0,.5)';
    removeBtn.style.color = '#fff';
    removeBtn.onclick = () => {
      state.photoFiles.splice(idx, 1);
      renderPreviews(state.photoFiles);
    };
    wrap.appendChild(removeBtn);

    els.preview.appendChild(wrap);
  });
}

function wireCamera() {
  if (els.validateBtn) {
    els.validateBtn.addEventListener('click', () => els.photoInput?.click());
  }
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
        // 1) Identify
        const identifyData = await identifyImage(file);

        // 2) Points (payload stays as your current server expects)
        const payload = {
          point: state.geo ? { lat: state.geo.lat, lon: state.geo.lon } : null,
          species_name: identifyData.speciesName,
          species_list: state.speciesList || [],
          nb_organs: identifyData.nb_organs || 1
        };
        const pointsData = await postPoints(payload);

        results.push({ ...identifyData, ...pointsData });
      }

      // Compute totals and update header, modal
      const totalAdded = results.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
      state.totalPoints += totalAdded;

      // Assume last result carries freshest level/progress (same as before)
      const latest = results[results.length - 1];
      const newLevel = Number(latest?.newLevel ?? state.level);
      const newProgress = Number(latest?.newProgress ?? state.progress);

      setLevel(newLevel);
      setProgress(newProgress);
      setTotalPoints(state.totalPoints);

      updateResultLevel(newLevel, newProgress);
      updateHeaderLevel(newLevel, newProgress);

      const lines = results.map((r) => {
        const pb = (r.pointsBreakdown || [])
          .map(p => `<span class="badge">${p.label}: <strong>+${p.points}</strong></span>`)
          .join(' ');
        return `
          <div class="species-item">
            <div class="card-content">
              <div class="species-info">
                <h3>${r.speciesName || 'Unknown species'}</h3>
                <p>Confidence: ${(Number(r.confidence || 0) * 100).toFixed(0)}%</p>
                ${pb}
              </div>
            </div>
          </div>`;
      }).join('');

      // Modal body is kept compatible with your existing UI
      els.modalText.innerHTML = `
        <p class="mission-title">Great job! You earned <strong>+${totalAdded}</strong> points.</p>
        ${lines}
      `;

      openModal(els.resultModal);
      confettiBurst();

      // Clear queue & preview
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
