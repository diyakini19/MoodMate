/*
 * =========================================================
 * MOOD PLACES SERVICE
 * =========================================================
 *
 * Finds places by their OpenStreetMap *type* (tags) rather
 * than by free-text name search, so "adventure park" means
 * a ropes course or escape room, never a children's park
 * that happens to have "Park" in its name.
 *
 * Each category has its own search radius: cafés are
 * everywhere (3 km is plenty), escape rooms and go-karting
 * are rare (search up to 15-20 km).
 * =========================================================
 */

const {
  runOverpassQuery,
  elementCoordinates,
  haversineKm,
} = require("./overpass");

/*
 * Each filter is a list of tag conditions that must all match.
 * A condition is [key, "exact value"] or [key, /regex/].
 */
const CATEGORIES = {
  cafe: { label: "Cafe", radius: 3000, filters: [[["amenity", "cafe"]]] },
  restaurant: {
    label: "Restaurant",
    radius: 3000,
    filters: [[["amenity", "restaurant"]]],
  },
  ice_cream: {
    label: "Ice Cream & Desserts",
    radius: 4000,
    filters: [[["amenity", "ice_cream"]], [["shop", "ice_cream"]]],
  },
  tea: {
    label: "Tea House",
    radius: 5000,
    filters: [[["shop", "tea"]], [["amenity", "cafe"], ["cuisine", /tea/]]],
  },
  bookstore: { label: "Bookstore", radius: 5000, filters: [[["shop", "books"]]] },
  park: { label: "Park", radius: 3000, filters: [[["leisure", "park"]]] },
  garden: { label: "Garden", radius: 5000, filters: [[["leisure", "garden"]]] },
  beach: { label: "Beach", radius: 12000, filters: [[["natural", "beach"]]] },
  lake: {
    label: "Lake",
    radius: 8000,
    filters: [[["natural", "water"], ["water", /^(lake|reservoir)$/]]],
  },
  viewpoint: {
    label: "Viewpoint",
    radius: 12000,
    filters: [[["tourism", "viewpoint"]]],
  },
  nature_reserve: {
    label: "Nature Reserve",
    radius: 20000,
    filters: [[["leisure", "nature_reserve"]]],
  },
  peak: {
    label: "Hill / Trek Spot",
    radius: 25000,
    filters: [[["natural", "peak"]]],
  },
  worship: {
    label: "Temple / Place of Worship",
    radius: 3000,
    filters: [[["amenity", "place_of_worship"]]],
  },
  mall: { label: "Shopping Mall", radius: 6000, filters: [[["shop", "mall"]]] },
  cinema: { label: "Cinema", radius: 6000, filters: [[["amenity", "cinema"]]] },
  bowling: {
    label: "Bowling",
    radius: 10000,
    filters: [[["leisure", "bowling_alley"]]],
  },
  arcade: {
    label: "Gaming Zone",
    radius: 8000,
    filters: [[["leisure", "amusement_arcade"]]],
  },
  nightclub: {
    label: "Nightclub",
    radius: 6000,
    filters: [[["amenity", "nightclub"]]],
  },
  bar: {
    label: "Bar & Lounge",
    radius: 4000,
    filters: [[["amenity", "bar"]], [["amenity", "pub"]]],
  },
  music_venue: {
    label: "Live Music",
    radius: 8000,
    filters: [[["amenity", "music_venue"]]],
  },
  museum: { label: "Museum", radius: 8000, filters: [[["tourism", "museum"]]] },
  gallery: {
    label: "Art Gallery",
    radius: 8000,
    filters: [[["tourism", "gallery"]]],
  },
  arts_centre: {
    label: "Arts Centre",
    radius: 8000,
    filters: [[["amenity", "arts_centre"]], [["amenity", "theatre"]]],
  },
  escape_room: {
    label: "Escape Room",
    radius: 15000,
    filters: [[["leisure", "escape_game"]]],
  },
  trampoline: {
    label: "Trampoline Park",
    radius: 15000,
    filters: [[["leisure", "trampoline_park"]]],
  },
  karting: {
    label: "Go-Karting",
    radius: 20000,
    filters: [[["sport", "karting"]]],
  },
  paintball: {
    label: "Paintball & Laser Tag",
    radius: 20000,
    filters: [[["sport", /paintball|laser_tag|airsoft/]]],
  },
  climbing: {
    label: "Rock Climbing",
    radius: 20000,
    filters: [[["sport", /climbing|bouldering/]]],
  },
  adventure_park: {
    label: "Adventure Park",
    radius: 15000,
    filters: [
      [["sport", "climbing_adventure"]],
      [["leisure", "park"], ["name", /adventure|zip ?line|ropes? course/]],
      [["tourism", "attraction"], ["name", /adventure|zip ?line|ropes? course/]],
    ],
  },
  theme_park: {
    label: "Theme Park",
    radius: 30000,
    filters: [[["tourism", "theme_park"]]],
  },
  water_park: {
    label: "Water Park",
    radius: 30000,
    filters: [[["leisure", "water_park"]]],
  },
  water_sports: {
    label: "Water Sports",
    radius: 20000,
    filters: [[["sport", /kayak|canoe|surfing|water_ski|scuba|sailing|rowing/]]],
  },
  ice_rink: {
    label: "Skating Rink",
    radius: 15000,
    filters: [[["leisure", "ice_rink"]], [["sport", /skating/]]],
  },
  fort: {
    label: "Fort / Heritage",
    radius: 30000,
    filters: [[["historic", "fort"]], [["historic", "castle"]]],
  },
  horse_riding: {
    label: "Horse Riding",
    radius: 20000,
    filters: [[["leisure", "horse_riding"]]],
  },
};

// Search words for the Nominatim fallback (used when Overpass is down).
// Results are still checked against the category's tags, so a word match
// alone ("Children's Park" for "adventure park") is not enough.
const FALLBACK_TERMS = {
  ice_cream: "ice cream",
  tea: "tea",
  worship: "temple",
  mall: "mall",
  arcade: "gaming zone",
  bar: "bar",
  arts_centre: "arts centre",
  escape_room: "escape room",
  trampoline: "trampoline park",
  karting: "go karting",
  climbing: "climbing",
  water_sports: "water sports",
  ice_rink: "skating rink",
  fort: "fort",
  peak: "peak",
};
const FALLBACK_MAX_CATEGORIES = 8;

const MAX_RADIUS = 40000;
const PER_CATEGORY_LIMIT = 3;
const KID_PLACE_NAME = /\b(children'?s?|kids?|bal ?udyan|playground|tot ?lot)\b/i;
const NOT_A_DESTINATION = /^playground$/;

const conditionToOverpass = ([key, value]) =>
  value instanceof RegExp
    ? `["${key}"~"${value.source}",i]`
    : `["${key}"="${value}"]`;

const conditionMatches = (tags, [key, value]) => {
  const tagValue = tags?.[key];

  if (tagValue == null) {
    return false;
  }

  return value instanceof RegExp
    ? new RegExp(value.source, "i").test(tagValue)
    : tagValue === value;
};

const buildQuery = (lat, lng, categories, radiusScale) => {
  const lines = [];

  categories.forEach(({ id }) => {
    const category = CATEGORIES[id];
    const radius = Math.min(MAX_RADIUS, Math.round(category.radius * radiusScale));

    category.filters.forEach((conditions) => {
      lines.push(
        `nwr${conditions.map(conditionToOverpass).join("")}["name"](around:${radius},${lat},${lng});`
      );
    });
  });

  return `[out:json][timeout:25];\n(\n${lines.join("\n")}\n);\nout center tags;`;
};

const ADMIN_ADDRESS_PART =
  /\b(ward|zone|district|taluka|tehsil|division|subdivision)\b|^\d{5,6}$|^india$/i;

const formatAddress = (tags) => {
  const street = [tags["addr:housenumber"], tags["addr:street"]]
    .filter(Boolean)
    .join(" ");

  const fromTags = [
    street,
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"],
  ]
    .filter(Boolean)
    .join(", ");

  if (fromTags || !tags._display_name) {
    return fromTags;
  }

  const name = String(tags.name || "").toLowerCase();

  return String(tags._display_name)
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) => part && part.toLowerCase() !== name && !ADMIN_ADDRESS_PART.test(part)
    )
    .slice(0, 4)
    .join(", ");
};

const classify = (tags, categories) => {
  for (const entry of categories) {
    const category = CATEGORIES[entry.id];

    if (
      category.filters.some((conditions) =>
        conditions.every((condition) => conditionMatches(tags, condition))
      )
    ) {
      return entry;
    }
  }

  return null;
};

const scorePlaces = (elements, center, categories, radiusScale) => {
  const sortedCategories = [...categories].sort((a, b) => b.weight - a.weight);
  const best = new Map();

  elements.forEach((element) => {
    const tags = element.tags || {};
    const coordinates = elementCoordinates(element);

    if (!coordinates || !tags.name || NOT_A_DESTINATION.test(tags.leisure || "")) {
      return;
    }

    const entry = classify(tags, sortedCategories);

    if (!entry) {
      return;
    }

    const category = CATEGORIES[entry.id];
    const radiusKm = (category.radius * radiusScale) / 1000;
    const distance = haversineKm(center.lat, center.lng, coordinates.lat, coordinates.lng);

    if (distance > Math.min(MAX_RADIUS / 1000, radiusKm) + 0.2) {
      return;
    }

    let weight = entry.weight;

    if (KID_PLACE_NAME.test(tags.name)) {
      weight -= 1.5;
    }

    const score = weight - 1.5 * (distance / radiusKm);
    const key = `${tags.name.toLowerCase()}|${coordinates.lat.toFixed(3)}|${coordinates.lng.toFixed(3)}`;
    const existing = best.get(key);

    if (existing && existing.score >= score) {
      return;
    }

    best.set(key, {
      id: `${element.type}/${element.id}`,
      name: tags.name,
      address: formatAddress(tags),
      lat: coordinates.lat,
      lng: coordinates.lng,
      category: category.label,
      categoryId: entry.id,
      searchTerm: entry.id,
      distance: Number(distance.toFixed(2)),
      matchLevel: weight >= 3 ? "top" : weight >= 2 ? "good" : "extra",
      matchSource: entry.source || "mood",
      score,
    });
  });

  return [...best.values()].sort((a, b) => b.score - a.score);
};

/*
 * Highest-scoring places first, but at most three per category so one
 * plentiful type (cafés, parks) can't fill the whole list.
 */
const pickBalanced = (scored, limit) => {
  const picked = [];
  const perCategory = new Map();
  const leftovers = [];

  scored.forEach((place) => {
    const count = perCategory.get(place.categoryId) || 0;

    if (picked.length < limit && count < PER_CATEGORY_LIMIT) {
      picked.push(place);
      perCategory.set(place.categoryId, count + 1);
    } else {
      leftovers.push(place);
    }
  });

  for (const place of leftovers) {
    if (picked.length >= limit) {
      break;
    }
    picked.push(place);
  }

  return picked.map(({ score: _score, ...place }) => place);
};

const normalizeCategories = (categories) => {
  const merged = new Map();

  (Array.isArray(categories) ? categories : []).forEach((item) => {
    const id = String(item?.id || "").trim();

    if (!CATEGORIES[id]) {
      return;
    }

    const weight = Math.max(0.5, Math.min(4, Number(item.weight) || 1));
    const existing = merged.get(id);

    if (!existing || existing.weight < weight) {
      merged.set(id, { id, weight, source: item.source || "mood" });
    }
  });

  return [...merged.values()].slice(0, 24);
};

/*
 * Nominatim results carry the main tag as category/type plus extratags,
 * which is enough to rebuild the tags our category filters check.
 */
const fallbackElements = async (nominatimSearch, lat, lng, categories, radiusScale) => {
  const elements = [];
  const top = [...categories]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, FALLBACK_MAX_CATEGORIES);

  for (const { id } of top) {
    const category = CATEGORIES[id];
    const term = FALLBACK_TERMS[id] || category.label.toLowerCase();
    const radius = Math.min(MAX_RADIUS, Math.round(category.radius * radiusScale));
    let results = [];

    try {
      results = await nominatimSearch(term, lat, lng, radius);
    } catch (error) {
      console.warn(`Fallback search skipped for ${term}:`, error.message);
    }

    results.forEach((result) => {
      elements.push({
        type: result.osm_type || "nominatim",
        id: result.osm_id || result.place_id,
        lat: Number(result.lat),
        lon: Number(result.lon),
        tags: {
          ...(result.extratags || {}),
          [result.category]: result.type,
          name: result.name || "",
          _display_name: result.display_name || "",
        },
      });
    });
  }

  return elements;
};

const findMoodPlaces = async ({
  lat,
  lng,
  categories,
  limit = 12,
  nominatimSearch = null,
}) => {
  const center = { lat, lng };
  const wanted = normalizeCategories(categories);

  if (!wanted.length) {
    throw new Error("At least one known place category is required.");
  }

  let source = "overpass";

  const search = async (radiusScale) => {
    let elements;

    if (source === "overpass") {
      try {
        elements = await runOverpassQuery(buildQuery(lat, lng, wanted, radiusScale), {
          timeoutMs: 15000,
          maxAttempts: 2,
        });
      } catch (error) {
        if (!nominatimSearch) {
          throw error;
        }

        console.warn("Overpass unavailable, using Nominatim fallback for mood places.");
        source = "nominatim";
      }
    }

    if (source === "nominatim") {
      elements = await fallbackElements(nominatimSearch, lat, lng, wanted, radiusScale);
    }

    return scorePlaces(elements, center, wanted, radiusScale);
  };

  let radiusScale = 1;
  let scored = await search(radiusScale);

  // Sparse areas (small towns, or a midpoint between cities) need a wider net.
  // The fallback costs ~1 s per category, so it only widens when nearly empty.
  if (scored.length < (source === "nominatim" ? 3 : 6)) {
    radiusScale = 2.5;
    scored = await search(radiusScale);
  }

  const searched = wanted
    .sort((a, b) => b.weight - a.weight)
    .map(({ id, weight, source }) => ({
      id,
      label: CATEGORIES[id].label,
      weight,
      source,
    }));

  return {
    places: pickBalanced(scored, limit),
    searched,
    widened: radiusScale > 1,
    totalFound: scored.length,
    source,
  };
};

module.exports = {
  CATEGORIES,
  findMoodPlaces,
};
