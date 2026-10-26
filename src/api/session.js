// src/api/session.js
//
// Signs API requests with the signed-in player's Firebase ID token, so the
// server knows who is asking (field testers are served more). Imported for
// this effect by the Header controller, which every signed-in page has; the
// public mission page has no header and stays free of Firebase.
import { auth } from "../../firebase-config.js";
import { setTokenProvider } from "./plantgo.js";

// The SDK keeps the token and refreshes it before it expires.
setTokenProvider(() => auth.currentUser?.getIdToken() ?? null);
