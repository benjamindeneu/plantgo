// Centralized endpoints (preserved exactly as requested)
export const API_BASE_URL = "https://plantgo.onmypc.net/api/";
//export const API_BASE_URL = "http://localhost:8111/api/";

export const SPECIES_PROXY_URL = `${API_BASE_URL}missions`;       // /api/missions
export const IDENTIFY_PROXY_URL = `${API_BASE_URL}identify`;     // /api/identify
export const PREDICTION_PROXY_URL = `${API_BASE_URL}prediction`; // /api/prediction
export const QUIZ_PROXY_URL = `${API_BASE_URL}quiz`;             // /api/quiz
export const DESCRIPTION_PROXY_BASE = `${API_BASE_URL}description`; // /api/description/<gbif_id>
export const TRIVIA_PROXY_BASE = `${API_BASE_URL}trivia`;           // /api/trivia/<gbif_id>
export const SPECIES_IMAGES_BASE = `${API_BASE_URL}species`;      // /api/species/<gbif_id>/images
export const SDM_MODELS_URL = `${API_BASE_URL}sdm/available_models`;
export const ME_URL = `${API_BASE_URL}me`;                         // /api/me — the caller's roles
export const IDENTIFIER_MODELS_URL = `${API_BASE_URL}identify/available_models`; // image identifiers here
// Where this server answers from, for the paths it hands out (tiles it draws itself).
export const API_ORIGIN = new URL(API_BASE_URL).origin;
// Mapped Missions v2. The catalogue is precomputed offline, so the map
// endpoint is a spatial lookup rather than the per-request raster pipeline v1
// ran — same response shape, so nothing downstream of the fetch changed.
export const API_V2_BASE_URL = API_BASE_URL.replace(/api\/$/, "api/v2/");
export const MAP_MISSIONS_URL = `${API_V2_BASE_URL}missions/map`;   // /api/v2/missions/map
export const MISSION_DETAIL_BASE = `${API_BASE_URL}missions`;       // /api/missions/<mission_id>
export const MISSION_ONE_BASE = `${API_V2_BASE_URL}missions/one`;   // /api/v2/missions/one/<mission_id>
export const RASTER_MODELS_URL = `${API_V2_BASE_URL}rasters/available_models`; // mission raster sources here
export const SPECIES_LIST_URL = `${API_V2_BASE_URL}species`;           // /api/v2/species — every species of a raster source here

// GeoPl@ntNet species probability tiles, used as a Leaflet overlay behind a
// selected mission. Same host the backend reads mission extents from.
export const GPN_TILE_BASE = "https://geo-beta.plantnet.org/bff/tile/geoplantnet";
