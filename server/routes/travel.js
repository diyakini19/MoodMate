const express = require("express");

const {
  getPublicTransportNearCoordinates,
  getPublicTransportNearLocation,
} = require("../services/publicTransportService");
const { findMoodPlaces } = require("../services/moodPlacesService");
const { assessGroupSpread, snapToNearestPlace } = require("../services/meetingPointService");

const router = express.Router();

/*
 * =========================================================
 * TRAVEL ROUTES
 * =========================================================
 *
 * Handles:
 * 1. Geocoding
 * 2. Reverse geocoding
 * 3. Geographic midpoint calculation
 *
 * =========================================================
 */

/*
 * =========================================================
 * NOMINATIM CONFIGURATION
 * =========================================================
 */

const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org";

/*
 * =========================================================
 * NOMINATIM HEADERS
 * =========================================================
 */

const nominatimHeaders = {
  "User-Agent":
    "MoodMate/1.0 (moodmate-location-app)",

  Accept:
    "application/json",

  "Accept-Language":
    "en",
};

/*
 * =========================================================
 * SIMPLE CACHE
 * =========================================================
 *
 * Prevents repeatedly asking Nominatim for the same place.
 * This is especially useful during development because
 * React StrictMode can cause requests more than once.
 * =========================================================
 */

const geocodeCache = new Map();

const reverseGeocodeCache = new Map();

/*
 * =========================================================
 * REQUEST DELAY
 * =========================================================
 *
 * Nominatim has rate limits.
 * Keep requests spaced apart.
 * =========================================================
 */

let lastNominatimRequest = 0;

const waitForNominatim = async () => {
  const now = Date.now();

  const elapsed =
    now - lastNominatimRequest;

  const minimumDelay = 1100;

  if (elapsed < minimumDelay) {
    await new Promise((resolve) => {
      setTimeout(
        resolve,
        minimumDelay - elapsed
      );
    });
  }

  lastNominatimRequest = Date.now();
};

/*
 * =========================================================
 * GEOCODE PLACE
 * =========================================================
 */

const geocodePlace = async (place) => {

  if (
    !place ||
    typeof place !== "string" ||
    !place.trim()
  ) {
    return null;
  }

  const cleanPlace =
    place.trim();

  const cacheKey =
    cleanPlace.toLowerCase();

  /*
   * Return cached result
   */

  if (geocodeCache.has(cacheKey)) {
    console.log(
      "Using cached geocode:",
      cleanPlace
    );

    return geocodeCache.get(cacheKey);
  }

  /*
   * Wait before contacting Nominatim
   */

  await waitForNominatim();

  const query =
    encodeURIComponent(
      cleanPlace
    );

  const url =
    `${NOMINATIM_URL}/search` +
    `?format=jsonv2` +
    `&q=${query}` +
    `&limit=1` +
    `&addressdetails=1`;

  console.log(
    "Nominatim geocoding:",
    cleanPlace
  );

  const response =
    await fetch(
      url,
      {
        method: "GET",
        headers: nominatimHeaders,
      }
    );

  if (!response.ok) {

    throw new Error(
      `Geocoding service returned ${response.status}.`
    );
  }

  const data =
    await response.json();

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    return null;
  }

  const result =
    data[0];

  const lat =
    Number(result.lat);

  const lng =
    Number(result.lon);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const finalResult = {

    lat,

    lng,

    displayName:
      result.display_name ||
      cleanPlace,

    address:
      result.address ||
      {},
  };

  /*
   * Save in cache
   */

  geocodeCache.set(
    cacheKey,
    finalResult
  );

  return finalResult;
};

/*
 * =========================================================
 * REVERSE GEOCODE
 * =========================================================
 *
 * IMPORTANT:
 *
 * Reverse geocoding is OPTIONAL.
 *
 * If Nominatim returns 429 or another error,
 * we return null instead of breaking the midpoint.
 *
 * =========================================================
 */

const reverseGeocodePlace =
  async (lat, lng) => {

    const cacheKey =
      `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;

    /*
     * Check cache
     */

    if (
      reverseGeocodeCache.has(
        cacheKey
      )
    ) {

      console.log(
        "Using cached reverse geocode:",
        cacheKey
      );

      return reverseGeocodeCache.get(
        cacheKey
      );
    }

    try {

      await waitForNominatim();

      const url =
        `${NOMINATIM_URL}/reverse` +
        `?format=jsonv2` +
        `&lat=${encodeURIComponent(lat)}` +
        `&lon=${encodeURIComponent(lng)}` +
        `&zoom=18` +
        `&addressdetails=1`;

      console.log(
        "Nominatim reverse geocoding:",
        lat,
        lng
      );

      const response =
        await fetch(
          url,
          {
            method: "GET",
            headers: nominatimHeaders,
          }
        );

      /*
       * IMPORTANT:
       * Do NOT throw on 429.
       */

      if (!response.ok) {

        console.warn(
          `Reverse geocoding skipped. Nominatim returned ${response.status}.`
        );

        return null;
      }

      const data =
        await response.json();

      if (
        !data ||
        !data.display_name
      ) {

        return null;
      }

      const result = {

        displayName:
          data.display_name,

        address:
          data.address ||
          {},
      };

      reverseGeocodeCache.set(
        cacheKey,
        result
      );

      return result;

    } catch (error) {

      /*
       * Reverse geocoding should NEVER
       * stop the midpoint calculation.
       */

      console.warn(
        "Reverse geocoding skipped:",
        error.message
      );

      return null;
    }
  };

/*
 * =========================================================
 * HAVERSINE DISTANCE
 * =========================================================
 */

const calculateDistance = (
  lat1,
  lng1,
  lat2,
  lng2
) => {

  const R = 6371;

  const dLat =
    ((lat2 - lat1) *
      Math.PI) /
    180;

  const dLng =
    ((lng2 - lng1) *
      Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +

    Math.cos(
      (lat1 * Math.PI) /
        180
    ) *

      Math.cos(
        (lat2 * Math.PI) /
          180
      ) *

      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
};

/*
 * =========================================================
 * CALCULATE GEOGRAPHIC CENTER
 * =========================================================
 */

const calculateCenter =
  (locations) => {

    if (
      !Array.isArray(locations) ||
      locations.length === 0
    ) {

      return null;
    }

    let x = 0;
    let y = 0;
    let z = 0;

    locations.forEach(
      (location) => {

        const lat =
          Number(
            location.lat
          );

        const lng =
          Number(
            location.lng
          );

        const latitude =
          (lat * Math.PI) /
          180;

        const longitude =
          (lng * Math.PI) /
          180;

        x +=
          Math.cos(latitude) *
          Math.cos(longitude);

        y +=
          Math.cos(latitude) *
          Math.sin(longitude);

        z +=
          Math.sin(latitude);
      }
    );

    x /=
      locations.length;

    y /=
      locations.length;

    z /=
      locations.length;

    const longitude =
      Math.atan2(
        y,
        x
      );

    const hyp =
      Math.sqrt(
        x * x +
        y * y
      );

    const latitude =
      Math.atan2(
        z,
        hyp
      );

    return {

      lat:
        (latitude * 180) /
        Math.PI,

      lng:
        (longitude * 180) /
        Math.PI,
    };
  };

/*
 * =========================================================
 * VALIDATE COORDINATE
 * =========================================================
 */

const isValidCoordinate =
  (location) => {

    if (!location) {
      return false;
    }

    const lat =
      Number(
        location.lat
      );

    const lng =
      Number(
        location.lng
      );

    return (

      Number.isFinite(lat) &&

      Number.isFinite(lng) &&

      lat >= -90 &&

      lat <= 90 &&

      lng >= -180 &&

      lng <= 180
    );
  };

/*
 * =========================================================
 * GEOCODE API
 * =========================================================
 */

router.get(
  "/geocode",
  async (req, res) => {

    try {

      const place =
        String(
          req.query.place || ""
        ).trim();

      if (!place) {

        return res.status(400).json({

          success: false,

          message:
            "Please provide a location.",
        });
      }

      console.log(
        "Geocoding location:",
        place
      );

      const result =
        await geocodePlace(
          place
        );

      if (!result) {

        return res.status(404).json({

          success: false,

          message:
            `Location "${place}" could not be found.`,
        });
      }

      return res.json({

        success: true,

        lat:
          result.lat,

        lng:
          result.lng,

        displayName:
          result.displayName,

        address:
          result.address,
      });

    } catch (error) {

      console.error(
        "Geocode error:",
        error.message
      );

      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Unable to geocode location.",
      });
    }
  }
);

/*
 * =========================================================
 * REVERSE GEOCODE API
 * =========================================================
 */

router.get(
  "/reverse-geocode",
  async (req, res) => {

    try {

      const lat =
        Number(
          req.query.lat
        );

      const lng =
        Number(
          req.query.lng
        );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid coordinates.",
        });
      }

      const result =
        await reverseGeocodePlace(
          lat,
          lng
        );

      /*
       * Reverse geocoding failure is NOT
       * considered a midpoint failure.
       */

      if (!result) {

        return res.json({

          success: false,

          displayName:
            "Smart Meeting Point",

          address: {},
        });
      }

      return res.json({

        success: true,

        displayName:
          result.displayName,

        address:
          result.address,
      });

    } catch (error) {

      /*
       * This should almost never be reached
       * because reverseGeocodePlace already
       * handles its own errors.
       */

      console.warn(
        "Reverse geocode skipped:",
        error.message
      );

      return res.json({

        success: false,

        displayName:
          "Smart Meeting Point",

        address: {},
      });
    }
  }
);

/*
 * =========================================================
 * CALCULATE MEETING POINT
 * =========================================================
 */

router.post(
  "/calculate",
  async (req, res) => {

    try {

      const {
        locations,
        travelMode = "private",
      } = req.body;

      /*
       * VALIDATE LOCATIONS
       */

      if (
        !Array.isArray(
          locations
        ) ||
        locations.length === 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "No locations were provided.",
        });
      }

      /*
       * VALID COORDINATES
       */

      const validLocations =
        locations
          .filter(
            isValidCoordinate
          )
          .map(
            (location) => ({

              ...location,

              lat:
                Number(
                  location.lat
                ),

              lng:
                Number(
                  location.lng
                ),
            })
          );

      if (
        validLocations.length === 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "No valid coordinates were provided.",
        });
      }

      /*
       * CALCULATE MIDPOINT
       */

      const center =
        calculateCenter(
          validLocations
        );

      if (!center) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to calculate meeting point.",
        });
      }

      /*
       * GROUP SPREAD + SNAP TO A REAL PLACE
       *
       * Too-far groups are not snapped: the client asks them to
       * meet in one person's city instead.
       */

      const spread =
        assessGroupSpread(
          validLocations,
          center
        );

      let adjustment = null;

      if (spread.level !== "too_far") {
        const snapped =
          await snapToNearestPlace(
            center,
            spread.level === "wide" ? 25 : 8
          );

        if (snapped) {
          adjustment = {
            fromLat: center.lat,
            fromLng: center.lng,
            distanceKm: snapped.distanceKm,
            placeName: snapped.name,
            placeType: snapped.placeType,
          };

          center.lat = snapped.lat;
          center.lng = snapped.lng;
        }
      }

      /*
       * CALCULATE DISTANCES
       */

      const distances =
        validLocations.map(
          (location) => ({

            name:
              location.name ||
              "Group Member",

            location:
              location.location ||
              location.displayName ||
              "",

            distanceFromMidpoint:
              Number(
                calculateDistance(
                  center.lat,
                  center.lng,
                  location.lat,
                  location.lng
                ).toFixed(2)
              ),
          })
        );

      console.log(
        "Calculated meeting point:",
        center
      );

      /*
       * IMPORTANT
       *
       * We DO NOT call reverse geocoding here.
       *
       * This prevents the 429 problem from
       * affecting the midpoint calculation.
       */

      const midpoint = {

        lat:
          center.lat,

        lng:
          center.lng,

        name:
          "Smart Meeting Point",
      };

      /*
       * RESPONSE
       */

      return res.json({

        success: true,

        meetingPoint: {

          lat:
            center.lat,

          lng:
            center.lng,

          name:
            "Smart Meeting Point",

          type:
            travelMode === "public"
              ? "Public Transport"
              : "Private Vehicle",
        },

        midpoint,

        travelMode,

        description:
          travelMode === "public"

            ? "A central meeting point was calculated from the group's locations. Public transport information will be added around this exact midpoint."

            : "A central meeting point was calculated from the group's locations.",

        method:
          "geographic-center",

        distances,

        spread,

        adjustment,

        locations:
          validLocations,
      });

    } catch (error) {

      console.error(
        "Travel calculation error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Unable to calculate meeting point.",
      });
    }
  }
);

/*
 * =========================================================
 * TEST ROUTE
 * =========================================================
 */

const toClientStation = (station) => ({
  name: station.name,
  lat: station.lat,
  lng: station.lng,
  distanceFromCenter: station.distance,
  operator: station.operator,
  line: station.network || station.ref,
  route: station.ref || station.network,
});

const buildClientTransport = (result) => ({
  bus: {
    count: result.buses.length,
    stops: result.buses.map(toClientStation),
  },
  train: {
    count: result.trains.length,
    stations: result.trains.map(toClientStation),
  },
  metro: {
    count: result.metro.length,
    stations: result.metro.map(toClientStation),
  },
});

router.post("/public-transport", async (req, res) => {
  try {
    const { midpoint, location, locations } = req.body || {};

    const midpointLat = Number(midpoint?.lat);
    const midpointLng = Number(midpoint?.lng);

    let result;

    if (Number.isFinite(midpointLat) && Number.isFinite(midpointLng)) {
      result = await getPublicTransportNearCoordinates(
        midpointLat,
        midpointLng,
        midpoint?.name || "Smart Meeting Point"
      );
    } else if (typeof location === "string" && location.trim()) {
      result = await getPublicTransportNearLocation(location.trim());
    } else {
      const fallback = Array.isArray(locations)
        ? locations.find(
            (item) =>
              Number.isFinite(Number(item?.lat)) &&
              Number.isFinite(Number(item?.lng))
          )
        : null;

      if (!fallback) {
        return res.status(400).json({
          success: false,
          message: "Midpoint coordinates are required.",
        });
      }

      result = await getPublicTransportNearCoordinates(
        fallback.lat,
        fallback.lng,
        fallback.name || "Group location"
      );
    }

    return res.json({
      success: true,
      transport: buildClientTransport(result),
      searchedLocation: result.searchedLocation,
      searchRadius: result.searchRadius,
      totalResults: result.totalResults,
    });
  } catch (error) {
    console.error("Public transport error:", error.message);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Unable to load public transport information.",
    });
  }
});

const searchNominatimNear = async (term, lat, lng, radiusMeters) => {
  const latRadius = radiusMeters / 111000;
  const lngRadius =
    radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

  await waitForNominatim();

  const url =
    `${NOMINATIM_URL}/search` +
    `?format=jsonv2` +
    `&q=${encodeURIComponent(term)}` +
    `&limit=10` +
    `&extratags=1` +
    `&bounded=1` +
    `&viewbox=${lng - lngRadius},${lat + latRadius},${lng + lngRadius},${lat - latRadius}`;

  const response = await fetch(url, { method: "GET", headers: nominatimHeaders });

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  const results = await response.json();
  return Array.isArray(results) ? results : [];
};

const areaNameFromAddress = (address = {}) =>
  [
    address.suburb || address.neighbourhood || address.quarter || address.village,
    address.city || address.town || address.county || address.state_district,
  ]
    .filter(Boolean)
    .join(", ");

router.post("/mood-places", async (req, res) => {
  try {
    const { lat, lng, categories, limit = 12 } = req.body || {};
    const searchLat = Number(lat);
    const searchLng = Number(lng);

    if (!Number.isFinite(searchLat) || !Number.isFinite(searchLng)) {
      return res.status(400).json({
        success: false,
        message: "Valid coordinates are required.",
      });
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one place category is required.",
      });
    }

    const [area, result] = await Promise.all([
      reverseGeocodePlace(searchLat, searchLng),
      findMoodPlaces({
        lat: searchLat,
        lng: searchLng,
        categories,
        limit: Math.max(1, Math.min(24, Number(limit) || 12)),
        nominatimSearch: searchNominatimNear,
      }),
    ]);

    const areaName = areaNameFromAddress(area?.address);
    const cityName =
      area?.address?.city ||
      area?.address?.town ||
      area?.address?.state_district ||
      "";

    const fallbackAddress = (place) => {
      if (place.distance <= 2 && areaName) {
        return `Near ${areaName}`;
      }

      return cityName ? `${cityName} area` : "";
    };

    return res.json({
      success: true,
      ...result,
      places: result.places.map((place) => ({
        ...place,
        address: place.address || fallbackAddress(place),
      })),
    });
  } catch (error) {
    console.error("Mood places error:", error.message);

    return res.status(error.code === "OVERPASS_UNAVAILABLE" ? 503 : 500).json({
      success: false,
      code: error.code || "",
      message: error.message || "Unable to find recommended places.",
    });
  }
});

router.post("/places", async (req, res) => {
  try {
    const { lat, lng, terms, radius = 3000 } = req.body || {};

    const searchLat = Number(lat);
    const searchLng = Number(lng);

    if (!Number.isFinite(searchLat) || !Number.isFinite(searchLng)) {
      return res.status(400).json({
        success: false,
        message: "Valid coordinates are required.",
      });
    }

    const searchTerms = Array.isArray(terms)
      ? terms
          .map((term) => String(term || "").trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    if (searchTerms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one search term is required.",
      });
    }

    const searchRadius = Number(radius) || 3000;
    const latRadius = searchRadius / 111000;
    const lngRadius =
      searchRadius /
      (111000 * Math.cos((searchLat * Math.PI) / 180));

    const south = searchLat - latRadius;
    const north = searchLat + latRadius;
    const west = searchLng - lngRadius;
    const east = searchLng + lngRadius;

    const places = [];

    for (const term of searchTerms) {
      await waitForNominatim();

      const url =
        `${NOMINATIM_URL}/search` +
        `?format=jsonv2` +
        `&q=${encodeURIComponent(term)}` +
        `&limit=12` +
        `&bounded=1` +
        `&viewbox=${west},${north},${east},${south}`;

      const response = await fetch(url, {
        method: "GET",
        headers: nominatimHeaders,
      });

      if (!response.ok) {
        console.warn(`Places search skipped for ${term}: ${response.status}`);
        continue;
      }

      const searchData = await response.json();

      if (!Array.isArray(searchData)) {
        continue;
      }

      const category = term
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

      searchData.forEach((place) => {
        const placeLat = Number(place.lat);
        const placeLng = Number(place.lon);

        if (!Number.isFinite(placeLat) || !Number.isFinite(placeLng)) {
          return;
        }

        const distance = calculateDistance(
          searchLat,
          searchLng,
          placeLat,
          placeLng
        );

        if (distance > searchRadius / 1000) {
          return;
        }

        places.push({
          id: place.place_id || `${placeLat}-${placeLng}-${place.name || term}`,
          name:
            place.name ||
            place.display_name?.split(",")[0] ||
            "Recommended Place",
          address: place.display_name || "Location unavailable",
          lat: placeLat,
          lng: placeLng,
          category,
          searchTerm: term,
          distance: Number(distance.toFixed(2)),
        });
      });
    }

    const uniquePlaces = [];
    const seen = new Set();

    places.forEach((place) => {
      const key = `${place.lat.toFixed(5)}-${place.lng.toFixed(5)}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      uniquePlaces.push(place);
    });

    uniquePlaces.sort((a, b) => a.distance - b.distance);

    return res.json({
      success: true,
      places: uniquePlaces.slice(0, 12),
    });
  } catch (error) {
    console.error("Places search error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to find recommended places.",
    });
  }
});

router.get(
  "/test",
  (req, res) => {

    res.json({

      success: true,

      message:
        "Travel API is working.",

      endpoints: {

        geocode:
          "/api/travel/geocode?place=Dadar",

        reverseGeocode:
          "/api/travel/reverse-geocode?lat=19.0192269&lng=72.8428479",

        calculate:
          "/api/travel/calculate",

        publicTransport:
          "/api/travel/public-transport",

        places:
          "/api/travel/places",
      },
    });
  }
);

/*
 * =========================================================
 * EXPORT
 * =========================================================
 */

module.exports =
  router;