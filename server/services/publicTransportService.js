/*
 * =========================================================
 * MOODMENT - PUBLIC TRANSPORT SERVICE
 * =========================================================
 *
 * Dynamically finds public transport near a user's
 * selected location.
 *
 * Data source:
 * OpenStreetMap + Overpass API
 *
 * Supported:
 * 🚆 Railway stations
 * 🚇 Metro stations
 * 🚌 Bus stops
 *
 * Search radius:
 * 5 km
 *
 * IMPORTANT:
 * We do NOT maintain a fixed station list.
 * The location is searched dynamically.
 * =========================================================
 */

const { runOverpassQuery } = require("./overpass");


/*
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const SEARCH_RADIUS = 5000;


/*
 * =========================================================
 * CALCULATE DISTANCE
 * =========================================================
 *
 * Returns distance in kilometres.
 *
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
    ((lat2 - lat1) * Math.PI) / 180;

  const dLng =
    ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +

    Math.cos(
      (lat1 * Math.PI) / 180
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180
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
 * GEOCODE LOCATION
 * =========================================================
 *
 * Example:
 *
 * "Vasai"
 * "Kharghar"
 * "Panvel"
 * "Thane"
 * "Pune"
 *
 * The location is converted into latitude/longitude.
 *
 * =========================================================
 */

const geocodeLocation = async (
  location
) => {

  if (!location) {
    throw new Error(
      "Location is required."
    );
  }

  const url =
    "https://nominatim.openstreetmap.org/search" +
    "?format=jsonv2" +
    "&limit=1" +
    `&q=${encodeURIComponent(location)}`;

  console.log(
    "Public transport geocoding:",
    location
  );

  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          "User-Agent":
            "Moodment/1.0 (moodment-app)",

          Accept:
            "application/json",
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      "Unable to find the selected location."
    );
  }

  const data =
    await response.json();

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      `Location "${location}" was not found.`
    );
  }

  return {
    lat:
      Number(data[0].lat),

    lng:
      Number(data[0].lon),

    displayName:
      data[0].display_name ||
      location,
  };
};


/*
 * =========================================================
 * SEARCH OPENSTREETMAP
 * =========================================================
 *
 * Searches ONLY around the selected location.
 *
 * Radius = 5 km.
 *
 * =========================================================
 */

const searchTransport = async (lat, lng) => {
  const query = `
[out:json][timeout:25];
(
  node["railway"="station"](around:${SEARCH_RADIUS},${lat},${lng});
  way["railway"="station"](around:${SEARCH_RADIUS},${lat},${lng});
  relation["railway"="station"](around:${SEARCH_RADIUS},${lat},${lng});
  node["railway"="halt"](around:${SEARCH_RADIUS},${lat},${lng});
  node["station"="subway"](around:${SEARCH_RADIUS},${lat},${lng});
  way["station"="subway"](around:${SEARCH_RADIUS},${lat},${lng});
  relation["station"="subway"](around:${SEARCH_RADIUS},${lat},${lng});
  node["railway"="subway_entrance"](around:${SEARCH_RADIUS},${lat},${lng});
  node["highway"="bus_stop"](around:${SEARCH_RADIUS},${lat},${lng});
  node["public_transport"="platform"]["bus"="yes"](around:${SEARCH_RADIUS},${lat},${lng});
  node["public_transport"="stop_position"]["bus"="yes"](around:${SEARCH_RADIUS},${lat},${lng});
);
out center tags;
`.trim();

  console.log("Searching public transport within 5 km...");

  try {
    return await runOverpassQuery(query);
  } catch {
    throw new Error(
      "Live public transport data is temporarily unavailable. Please try again in a moment."
    );
  }
};


/*
 * =========================================================
 * DETERMINE TRANSPORT TYPE
 * =========================================================
 */

const getTransportType = (
  tags
) => {

  /*
   * Metro / Subway
   */

  if (
    tags.station === "subway" ||
    tags.railway ===
      "subway_entrance"
  ) {

    return "Metro";

  }


  /*
   * Bus
   */

  if (
    tags.highway === "bus_stop" ||
    tags.bus === "yes" ||
    (
      tags.public_transport ===
        "platform" &&
      tags.bus === "yes"
    ) ||
    (
      tags.public_transport ===
        "stop_position" &&
      tags.bus === "yes"
    )
  ) {

    return "Bus";

  }


  /*
   * Railway
   */

  if (
    tags.railway === "station" ||
    tags.railway === "halt"
  ) {

    return "Train";

  }


  return "Public Transport";
};


/*
 * =========================================================
 * GET STATION COORDINATES
 * =========================================================
 */

const getCoordinates = (
  element
) => {

  const lat =
    Number(
      element.lat ??
      element.center?.lat
    );

  const lng =
    Number(
      element.lon ??
      element.center?.lon
    );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {

    return null;

  }

  return {
    lat,
    lng,
  };
};


/*
 * =========================================================
 * FORMAT TRANSPORT RESULT
 * =========================================================
 */

const formatTransportResults = (
  elements,
  location
) => {

  const results = [];

  for (
    const element of elements
  ) {

    const coordinates =
      getCoordinates(element);

    if (!coordinates) {
      continue;
    }


    const tags =
      element.tags || {};


    const type =
      getTransportType(tags);


    /*
     * Ignore unknown transport
     */

    if (
      type ===
      "Public Transport"
    ) {

      continue;

    }


    /*
     * Station / stop name
     */

    const name =
      tags.name ||
      tags["name:en"] ||
      tags.ref ||
      (
        type === "Bus"
          ? "Bus Stop"
          : type === "Metro"
          ? "Metro Station"
          : "Railway Station"
      );


    /*
     * Distance from selected location
     */

    const distance =
      calculateDistance(
        location.lat,
        location.lng,
        coordinates.lat,
        coordinates.lng
      );


    results.push({

      id:
        element.id,

      name,

      type,

      lat:
        coordinates.lat,

      lng:
        coordinates.lng,

      distance:
        Number(
          distance.toFixed(2)
        ),

      distanceText:
        distance < 1
          ? `${Math.round(
              distance * 1000
            )} m`
          : `${distance.toFixed(
              1
            )} km`,

      operator:
        tags.operator ||
        null,

      network:
        tags.network ||
        null,

      ref:
        tags.ref ||
        null,

    });

  }


  return results;
};


/*
 * =========================================================
 * REMOVE DUPLICATES
 * =========================================================
 *
 * Some OSM objects can represent the same station.
 *
 * =========================================================
 */

const removeDuplicates = (
  stations
) => {

  const seen =
    new Set();

  return stations.filter(
    (station) => {

      const key =
        `${station.type}-${station.name.toLowerCase()}-${station.lat.toFixed(4)}-${station.lng.toFixed(4)}`;

      if (
        seen.has(key)
      ) {

        return false;

      }

      seen.add(key);

      return true;

    }
  );
};


/*
 * =========================================================
 * SORT BY DISTANCE
 * =========================================================
 */

const sortByDistance = (
  stations
) => {

  return [
    ...stations,
  ].sort(
    (a, b) =>
      a.distance -
      b.distance
  );

};


/*
 * =========================================================
 * MAIN FUNCTION
 * =========================================================
 *
 * This is the function that your route will call.
 *
 * =========================================================
 */

const buildTransportResult = async (location, locationText) => {
  const elements = await searchTransport(location.lat, location.lng);

  let stations = formatTransportResults(elements, location);
  stations = removeDuplicates(stations);
  stations = sortByDistance(stations);

  const trains = stations.filter((station) => station.type === "Train");
  const metro = stations.filter((station) => station.type === "Metro");
  const buses = stations.filter((station) => station.type === "Bus");

  return {
    success: true,
    searchedLocation: {
      name: locationText,
      displayName: location.displayName,
      lat: location.lat,
      lng: location.lng,
    },
    searchRadius: SEARCH_RADIUS / 1000,
    totalResults: stations.length,
    trains,
    metro,
    buses,
    all: stations,
  };
};

const getPublicTransportNearLocation = async (locationText) => {
  const location = await geocodeLocation(locationText);
  return buildTransportResult(location, locationText);
};

const getPublicTransportNearCoordinates = async (lat, lng, name) => {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Valid midpoint coordinates are required.");
  }

  const locationLabel = name || "Smart Meeting Point";

  return buildTransportResult(
    {
      lat: latitude,
      lng: longitude,
      displayName: locationLabel,
    },
    locationLabel
  );
};

module.exports = {
  getPublicTransportNearLocation,
  getPublicTransportNearCoordinates,
  calculateDistance,
};