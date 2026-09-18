// src/ui/photoCredit.js
import { t } from "../language/i18n.js";
import { photoProviderName } from "../api/plantgo.js";

/**
 * One credit line for a photo from any source.
 *
 * The three sources spell their licences differently — Commons says
 * "CC BY-SA 4.0", Pl@ntNet "cc-by-sa", iNaturalist a creativecommons.org
 * URL the backend boils down to "cc-by-nc-4.0" — and a caption should not
 * betray where it came from by its spelling. Everything Creative Commons is
 * written the way Creative Commons writes it; anything else is shown as it
 * came.
 */
const CC_RE = /^cc[-_ ]?(0|by(?:[-_ ]nc)?(?:[-_ ]nd)?(?:[-_ ]sa)?)(?:[-_ ]?(\d\.\d))?$/i;

export function formatLicense(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = CC_RE.exec(s);
  if (m) {
    const kind = m[1] === "0" ? "CC0" : `CC ${m[1].toUpperCase().replace(/[_ ]/g, "-")}`;
    return m[2] ? `${kind} ${m[2]}` : kind;
  }
  if (/^(pd|public domain)$/i.test(s)) return "Public domain";
  return s;
}

/**
 * "© Photographer · CC BY-SA 4.0" whenever the photographer is known; the
 * licence alone when only that is; the source's name when neither is.
 */
export function photoCreditLine(photo) {
  const author = (photo?.author || "").trim();
  const license = formatLicense(photo?.license);
  if (author) return t("photo.credit", { author, license: license || "—" });
  return license || photoProviderName(photo?.provider);
}
