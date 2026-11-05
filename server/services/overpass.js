/*
 * =========================================================
 * OVERPASS API (OpenStreetMap tag search)
 * =========================================================
 *
 * The public Overpass servers are free but individually
 * unreliable, so every query tries each mirror in turn.
 * =========================================================
 */

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const OVERPASS_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "MoodMate/1.0 (moodmate-location-app)",
  Accept: "application/json",
};

const runOverpassQuery = async (
  query,
  { timeoutMs = 28000, maxAttempts = OVERPASS_ENDPOINTS.length } = {}
) => {
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS.slice(0, maxAttempts)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: OVERPASS_HEADERS,
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = new Error(
          `Overpass returned ${response.status} from ${endpoint}`
        );
        console.warn(lastError.message);
        continue;
      }

      const data = await response.json();

      return Array.isArray(data?.elements) ? data.elements : [];
    } catch (error) {
      lastError = error;
      console.warn(
        `Overpass request failed (${endpoint}):`,
        error.message || error
      );
    } finally {
      clearTimeout(timer);
    }
  }

  console.error(
    "All Overpass endpoints failed:",
    lastError?.message || lastError
  );

  const unavailable = new Error(
    "Live map data is temporarily unavailable. Please try again in a moment."
  );
  unavailable.code = "OVERPASS_UNAVAILABLE";
  throw unavailable;
};

const elementCoordinates = (element) => {
  const lat = Number(element?.lat ?? element?.center?.lat);
  const lng = Number(element?.lon ?? element?.center?.lon);

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

module.exports = {
  runOverpassQuery,
  elementCoordinates,
  haversineKm,
};
