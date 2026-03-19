// src/ui/levelProgress.js
// Shared level calculation, progress animation and confetti — used by ResultModal and Quiz.
import confetti from "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.module.mjs";

const clamp01 = (v) => Math.max(0, Math.min(100, v));

function getEaseFn(name) {
  switch ((name || "linear").toLowerCase()) {
    case "easeout":
    case "ease-out":
      return (tt) => 1 - Math.pow(1 - tt, 3);
    default:
      return (tt) => tt;
  }
}

export function calcFromLevel(total) {
  const L = Math.floor(1 + total / 11000);
  const prev = (L - 1) * 11000, next = L * 11000;
  const pct = Math.round(((total - prev) / (next - prev)) * 100);
  return { fromLevel: L, nextLevel: L + 1, fromPct: clamp01(pct) };
}

export function calcToLevel(total) {
  const L = Math.floor(1 + total / 11000);
  const prev = (L - 1) * 11000, next = L * 11000;
  const pct = Math.round(((total - prev) / (next - prev)) * 100);
  return { toLevel: L, toPct: clamp01(pct) };
}

export function animateProgress(el, fromPct, toPct, options = {}) {
  const duration = 900, start = performance.now();
  const ease = getEaseFn(options.ease || "linear");
  return new Promise((res) => {
    function frame(ts) {
      const tt = Math.min(1, (ts - start) / duration);
      el.style.width = `${Math.round(fromPct + (toPct - fromPct) * ease(tt))}%`;
      if (tt < 1) requestAnimationFrame(frame); else res();
    }
    requestAnimationFrame(frame);
  });
}

/**
 * Fire botanical confetti anchored to the bottom of anchorEl.
 * Falls back to .modal-content.result → .modal-content → body.
 */
export function fireLevelUpConfetti(anchorEl = null) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  const card = anchorEl ||
    document.querySelector(".modal-content.result") ||
    document.querySelector(".modal-content") ||
    document.body;

  const r = card.getBoundingClientRect();
  const origin = {
    x: Math.max(0, Math.min(1, (r.left + r.width * 0.5) / window.innerWidth)),
    y: Math.max(0, Math.min(1, r.bottom / window.innerHeight)),
  };

  const randomInRange = (min, max) => Math.random() * (max - min) + min;
  const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const LEAF_COLORS = ["#27ae60", "#2ecc71", "#a2d149"];
  const FLOWER_COLORS = ["#ff79c6", "#ffb86c"];

  const flower = confetti.shapeFromPath({
    path: "M 9.1 8.0 A 4.5 4.5 0 1 1 14.9 8.0 A 4.5 4.5 0 1 1 16.8 13.5 A 4.5 4.5 0 1 1 12.0 17.0 A 4.5 4.5 0 1 1 7.2 13.5 A 4.5 4.5 0 1 1 9.1 8.0 Z",
  });
  const leafUp = confetti.shapeFromPath({ path: "M 12 2 C 20 5 22 15 12 22 C 2 15 4 5 12 2 Z" });
  const leafRight = confetti.shapeFromPath({ path: "M 22 12 C 19 20 9 22 2 12 C 9 2 19 4 22 12 Z" });
  const leafDown = confetti.shapeFromPath({ path: "M 12 22 C 4 19 2 9 12 2 C 22 9 20 19 12 22 Z" });
  const leafLeft = confetti.shapeFromPath({ path: "M 2 12 C 5 4 15 2 22 12 C 15 20 5 19 2 12 Z" });
  const leafTopRight = confetti.shapeFromPath({ path: "M2 22 C 2 10 10 2 22 2 C 22 14 14 22 2 22 Z" });
  const leafTopLeft = confetti.shapeFromPath({ path: "M22 22 C 22 10 14 2 2 2 C 2 14 10 22 22 22 Z" });
  const leafBottomRight = confetti.shapeFromPath({ path: "M2 2 C 2 14 10 22 22 22 C 22 10 14 2 2 2 Z" });
  const leafBottomLeft = confetti.shapeFromPath({ path: "M22 2 C 22 14 14 22 2 22 C 2 10 10 2 22 2 Z" });
  const allLeaves = [leafUp, leafRight, leafDown, leafLeft, leafTopRight, leafTopLeft, leafBottomRight, leafBottomLeft];

  const fireBatch = (count, isFlower, base) => {
    for (let i = 0; i < count; i++) {
      confetti({
        origin: { x: origin.x + randomInRange(-0.01, 0.01), y: origin.y + randomInRange(-0.01, 0.01) },
        particleCount: 1,
        shapes: isFlower ? [flower] : [getRandomItem(allLeaves)],
        colors: [getRandomItem(isFlower ? FLOWER_COLORS : LEAF_COLORS)],
        disableForReducedMotion: true,
        zIndex: 99999,
        flat: true,
        spread: base.spread + randomInRange(-5, 5),
        startVelocity: base.startVelocity + randomInRange(-4, 4),
        gravity: base.gravity + randomInRange(-0.05, 0.05),
        decay: base.decay + randomInRange(-0.005, 0.005),
        drift: base.drift + randomInRange(-0.2, 0.2),
        ticks: base.ticks + randomInRange(-20, 50),
        angle: base.angle + randomInRange(-5, 5),
        scalar: isFlower ? randomInRange(1.4, 1.9) : randomInRange(0.9, 1.3),
      });
    }
  };

  const pop = { spread: 50, startVelocity: 45, gravity: 0.8, decay: 0.9, drift: 0, ticks: 200, angle: 90 };
  fireBatch(80, false, pop); fireBatch(8, true, pop);

  setTimeout(() => {
    const bloom = { spread: 90, startVelocity: 35, gravity: 0.65, decay: 0.92, drift: 0, ticks: 300, angle: 90 };
    fireBatch(70, false, bloom); fireBatch(6, true, bloom);
  }, randomInRange(80, 120));

  setTimeout(() => {
    const drift = { spread: 130, startVelocity: 25, gravity: 0.5, decay: 0.94, drift: 0, ticks: 500, angle: 90 };
    fireBatch(60, false, drift); fireBatch(10, true, drift);
  }, randomInRange(230, 270));
}
