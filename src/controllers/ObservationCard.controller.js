// src/controllers/ObservationCard.controller.js
import { createObservationCardView } from "../ui/components/ObservationCard.view.js";
import { getWikipediaImage } from "../data/wiki.service.js";

// Session-level cache shared across all observation cards
const wikiImageCache = new Map(); // name -> Promise<string>

const MAX_CONCURRENT = 4;
let inFlight = 0;
const queue = [];

function runLimited(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    pumpQueue();
  });
}

function pumpQueue() {
  while (inFlight < MAX_CONCURRENT && queue.length) {
    const { task, resolve, reject } = queue.shift();
    inFlight++;
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        inFlight--;
        pumpQueue();
      });
  }
}

export function ObservationCard(obs) {
  const view = createObservationCardView(obs);

  if (obs.speciesName) {
    const key = obs.speciesName.trim().toLowerCase();

    if (!wikiImageCache.has(key)) {
      wikiImageCache.set(
        key,
        runLimited(async () => {
          const url = await getWikipediaImage(obs.speciesName);
          return url || "";
        }).catch(() => "")
      );
    }

    Promise.resolve(wikiImageCache.get(key)).then((url) => {
      if (!view.element.isConnected) return;
      view.setImage(url);
    });
  } else {
    view.setImage("");
  }

  return view.element;
}
