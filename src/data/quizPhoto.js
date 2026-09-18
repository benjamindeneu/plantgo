// src/data/quizPhoto.js
import { getWikipediaImage, getWikipediaImageInfo } from "./wiki.service.js";

/**
 * The picture a quiz shows for a species, with the credit that goes on it.
 *
 * It is Wikipedia's picture — the same one the species cards lead with, and
 * fetched through the same cache, so a plant you just looked at on the map
 * turns up in the quiz wearing the same photo. The card's thumbnail is only
 * ~320px wide, which is fine in a 76px row and not in a hero, so Commons is
 * asked for a larger rendition; that same call carries the photographer and
 * licence the picture has to be shown with.
 *
 * The backend's iNaturalist URL is kept only as a fallback for a species
 * Wikipedia has no picture of. It comes without a credit, so the caption
 * can only name the source.
 *
 * `exactTitle` is for a wrong answer in the picture round: Wikipedia
 * redirects a synonym to the accepted species, so without it a distractor
 * that is merely another name for the answer would show the answer's own
 * photo. The right answer is looked up the ordinary way, as the card is.
 *
 * Returns { url, author, license, provider } or null when there is nothing
 * to show at all.
 */
export async function resolveQuizPhoto(speciesName, fallbackUrl, { exactTitle = false } = {}) {
  let thumb = null;
  try { thumb = await getWikipediaImage(speciesName, { exactTitle }); } catch { /* fall through */ }

  if (thumb) {
    let info = null;
    try { info = await getWikipediaImageInfo(thumb, { width: 800 }); } catch { /* keep the thumbnail */ }
    return {
      url: info?.large || thumb,
      author: info?.author || "",
      license: info?.license || "",
      provider: "wikipedia",
    };
  }

  return fallbackPhoto(fallbackUrl);
}

function fallbackPhoto(url) {
  return url ? { url, author: "", license: "", provider: "inaturalist" } : null;
}

/**
 * Attach a photo to a question in place: on the question itself, or — for
 * "which image shows this plant?" — on each of its choices. Never throws;
 * a photo that cannot be resolved is simply absent.
 */
export async function attachQuizPhotos(question) {
  if (!question) return question;
  if (question.quiz_type !== "species_image") {
    question.photo = await resolveQuizPhoto(question.species_name, question.image_url);
    return question;
  }

  const choices = question.choices || {};
  await Promise.all(
    Object.entries(choices).map(async ([key, choice]) => {
      choice.photo = await resolveQuizPhoto(choice.name, choice.image_url, { exactTitle: key !== question.answer });
    })
  );

  // Two tiles must never show the same picture: the answer keeps its photo,
  // and any other tile that came back with an identical one falls back to
  // its own iNaturalist photo — or to nothing, rather than to a giveaway.
  const seen = new Set();
  const keys = [question.answer, ...Object.keys(choices).filter((k) => k !== question.answer)];
  for (const key of keys) {
    const choice = choices[key];
    if (!choice) continue;
    if (choice.photo?.url && seen.has(choice.photo.url)) {
      choice.photo = seen.has(choice.image_url) ? null : fallbackPhoto(choice.image_url);
    }
    if (choice.photo?.url) seen.add(choice.photo.url);
  }
  return question;
}
