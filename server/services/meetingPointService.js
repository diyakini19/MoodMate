/*
 * =========================================================
 * MEETING POINT CHECKS
 * =========================================================
 *
 * A geographic midpoint is only useful when the group is
 * reasonably close together. Mumbai + Delhi "meets" in a
 * small town in Madhya Pradesh; Mumbai + Toronto "meets"
 * in Finnish Lapland. These helpers rate how spread out a
 * group is and move the midpoint onto a real, named place.
 * =========================================================
 */

const { runOverpassQuery, elementCoordinates, haversineKm } = require("./overpass");

// Farthest member-to-midpoint travel before we warn / refuse.
const SPREAD_LIMITS_KM = {
  comfortable: 30,
  practical: 120,
};

const roundKm = (km) => (km >= 100 ? Math.round(km / 10) * 10 : Math.round(km));

const assessGroupSpread = (locations, center) => {
  const points = locations.map((location, index) => ({
    name: location.name || `Member ${index + 1}`,
    place: location.location || location.displayName || "",
    lat: Number(location.lat),
    lng: Number(location.lng),
  }));

  const maxDistanceKm = points.reduce(
    (max, point) =>
      Math.max(max, haversineKm(center.lat, center.lng, point.lat, point.lng)),
    0
  );

  let farthestPairKm = 0;
  let farthestPair = [];

  points.forEach((a, i) => {
    points.slice(i + 1).forEach((b) => {
      const km = haversineKm(a.lat, a.lng, b.lat, b.lng);

      if (km > farthestPairKm) {
        farthestPairKm = km;
        farthestPair = [a, b];
      }
    });
  });

  const level =
    maxDistanceKm <= SPREAD_LIMITS_KM.comfortable
      ? "ok"
      : maxDistanceKm <= SPREAD_LIMITS_KM.practical
      ? "wide"
      : "too_far";

  const describe = (point) => {
    const city = String(point.place).split(",")[0].trim();
    return city ? `${point.name} (${city})` : point.name;
  };

  const pairText =
    farthestPair.length === 2
      ? `${describe(farthestPair[0])} and ${describe(farthestPair[1])}`
      : "your group";

  const message =
    level === "ok"
      ? ""
      : level === "wide"
      ? `The farthest person travels about ${roundKm(
          maxDistanceKm
        )} km to reach the midpoint, so it may land in a quieter town between you.`
      : `${pairText} are about ${roundKm(
          farthestPairKm
        )} km apart. Meeting halfway would mean up to ${roundKm(
          maxDistanceKm
        )} km of travel each, so meeting in one person's city makes more sense.`;

  return {
    level,
    maxDistanceKm: Number(maxDistanceKm.toFixed(1)),
    farthestPairKm: Number(farthestPairKm.toFixed(1)),
    message,
  };
};

const PLACE_RANK = {
  suburb: 0,
  neighbourhood: 0,
  quarter: 0,
  town: 1,
  city: 1,
  village: 2,
};

/*
 * Moves the midpoint to the nearest named neighbourhood, town or village
 * so it is on land and reachable (a raw midpoint can fall in a creek, the
 * sea or an empty field). Returns null when nothing is found or the map
 * service is down; callers then keep the raw midpoint.
 */
const snapToNearestPlace = async (center, radiusKm) => {
  const radius = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:10];
node["place"~"^(city|town|suburb|neighbourhood|quarter|village)$"]["name"](around:${radius},${center.lat},${center.lng});
out body;`;

  let elements;

  try {
    elements = await runOverpassQuery(query, { timeoutMs: 10000, maxAttempts: 2 });
  } catch {
    return null;
  }

  let best = null;

  elements.forEach((element) => {
    const coordinates = elementCoordinates(element);

    if (!coordinates || !element.tags?.name) {
      return;
    }

    const distanceKm = haversineKm(center.lat, center.lng, coordinates.lat, coordinates.lng);
    const rank = PLACE_RANK[element.tags.place] ?? 3;
    // Prefer neighbourhoods/towns over villages unless the village is much closer.
    const effective = distanceKm + rank * 0.5;

    if (!best || effective < best.effective) {
      best = {
        ...coordinates,
        name: element.tags["name:en"] || element.tags.name,
        placeType: element.tags.place,
        distanceKm,
        effective,
      };
    }
  });

  if (!best) {
    return null;
  }

  const { effective: _effective, ...place } = best;
  return { ...place, distanceKm: Number(place.distanceKm.toFixed(2)) };
};

module.exports = {
  SPREAD_LIMITS_KM,
  assessGroupSpread,
  snapToNearestPlace,
};
