const DEFAULT_DURATION_MINUTES = 90;
const TRAVEL_BUFFER_MINUTES = 15;

const DURATION_MINUTES = {
  cinema: 180,
  "movie theater": 180,
  restaurant: 90,
  "rooftop restaurant": 105,
  cafe: 60,
  "quiet cafe": 60,
  "tea house": 60,
  "ice cream": 30,
  dessert: 30,
  beach: 120,
  park: 60,
  garden: 60,
  lake: 60,
  nature: 90,
  trekking: 240,
  temple: 45,
  mall: 120,
  "shopping mall": 120,
  "shopping center": 120,
  shopping: 90,
  museum: 120,
  "art gallery": 90,
  "art center": 90,
  "escape room": 90,
  "adventure park": 180,
  "gaming zone": 90,
  gaming: 90,
  "game center": 90,
  bowling: 90,
  club: 150,
  lounge: 120,
  pub: 120,
  "music venue": 150,
  "live music": 150,
  bookstore: 45,
};

const MEAL_CATEGORIES = [
  "restaurant",
  "rooftop restaurant",
  "cafe",
  "quiet cafe",
  "tea house",
];

const DESSERT_CATEGORIES = ["ice cream", "dessert"];

const NIGHTLIFE_CATEGORIES = [
  "club",
  "lounge",
  "pub",
  "music venue",
  "live music",
];

const OUTDOOR_CATEGORIES = [
  "park",
  "garden",
  "lake",
  "beach",
  "nature",
  "trekking",
];

const COMPANIONS = {
  cinema: ["gaming zone", "shopping mall"],
  "movie theater": ["gaming zone", "shopping mall"],
  beach: ["garden", "park"],
  park: ["garden", "lake"],
  garden: ["park", "lake"],
  lake: ["garden", "park"],
  nature: ["lake", "garden"],
  trekking: ["lake", "garden"],
  "adventure park": ["lake", "garden"],
  temple: ["garden", "park"],
  museum: ["art gallery", "park"],
  "art gallery": ["museum", "garden"],
  "art center": ["museum", "garden"],
  mall: ["gaming zone", "bowling"],
  "shopping mall": ["gaming zone", "bowling"],
  "shopping center": ["gaming zone", "bowling"],
  shopping: ["gaming zone", "bowling"],
  "gaming zone": ["shopping mall", "bowling"],
  gaming: ["shopping mall", "bowling"],
  "game center": ["shopping mall", "bowling"],
  bowling: ["gaming zone", "shopping mall"],
  "escape room": ["gaming zone", "shopping mall"],
  restaurant: ["park", "shopping mall"],
  "rooftop restaurant": ["garden", "park"],
  cafe: ["bookstore", "park"],
  "quiet cafe": ["bookstore", "park"],
  "tea house": ["bookstore", "garden"],
  bookstore: ["cafe", "park"],
  "ice cream": ["park", "shopping mall"],
  dessert: ["park", "shopping mall"],
};

const DEFAULT_COMPANIONS = ["park", "shopping mall"];
const INDOOR_EVENING_COMPANIONS = ["shopping mall", "gaming zone"];

export function normalizeCategory(category = "") {
  return String(category).toLowerCase().trim().replace(/_/g, " ");
}

export function formatCategory(category = "") {
  return String(category)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lookup(table, category) {
  const key = normalizeCategory(category);

  if (table[key] !== undefined) {
    return table[key];
  }

  const partial = Object.keys(table).find(
    (item) => key.includes(item) || item.includes(key)
  );

  return partial ? table[partial] : undefined;
}

function matchesAny(category, list) {
  const key = normalizeCategory(category);
  return list.some((item) => key === item || key.includes(item));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function roundUpToFive(date) {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const extra = (5 - (minutes % 5)) % 5;
  rounded.setMinutes(minutes + extra, 0, 0);
  return rounded;
}

function hourOf(date) {
  return date.getHours() + date.getMinutes() / 60;
}

export function isMovieCategory(category) {
  return matchesAny(category, ["cinema", "movie theater"]);
}

export function getDurationMinutes(category) {
  return lookup(DURATION_MINUTES, category) || DEFAULT_DURATION_MINUTES;
}

export function getMealForTime(date) {
  const hour = hourOf(date);

  if (hour >= 6 && hour < 11) {
    return { key: "breakfast", label: "Breakfast", terms: ["cafe", "bakery"], minutes: 45 };
  }

  if (hour >= 11 && hour < 15) {
    return { key: "lunch", label: "Lunch", terms: ["restaurant"], minutes: 75 };
  }

  if (hour >= 15 && hour < 18.5) {
    return { key: "snacks", label: "Snacks", terms: ["cafe", "bakery", "fast food"], minutes: 45 };
  }

  if (hour >= 18.5 && hour < 22.5) {
    return { key: "dinner", label: "Dinner", terms: ["restaurant"], minutes: 90 };
  }

  return { key: "dessert", label: "Late-night dessert", terms: ["ice cream", "dessert"], minutes: 30 };
}

/*
 * Nearby follow-up for the main category. Outdoor spots are swapped for
 * indoor ones once it's dark, and nothing is suggested very late at night.
 */
export function getCompanionTerms(category, date, excludeTerms = []) {
  const hour = hourOf(date);

  if (hour >= 22.5 || hour < 6) {
    return [];
  }

  if (matchesAny(category, NIGHTLIFE_CATEGORIES)) {
    return [];
  }

  let terms = lookup(COMPANIONS, category) || DEFAULT_COMPANIONS;

  if (hour >= 19) {
    terms = terms.some((term) => OUTDOOR_CATEGORIES.includes(term))
      ? INDOOR_EVENING_COMPANIONS
      : terms;
  }

  const main = normalizeCategory(category);
  const excluded = excludeTerms.map(normalizeCategory);

  return [...new Set(terms)].filter(
    (term) => term !== main && !excluded.includes(term)
  );
}

export function getDefaultStartTime(now = new Date()) {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return start;
}

export function toDateTimeInputValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/*
 * Builds the stop outline for an itinerary. Meal and nearby stops carry
 * search terms; the UI fills them with real places.
 */
export function buildItinerarySkeleton(place, startTime) {
  const category = normalizeCategory(place?.searchTerm || place?.category);
  const start = new Date(startTime);
  const mainEnd = addMinutes(start, getDurationMinutes(category));

  const stops = [
    {
      id: "main",
      kind: "main",
      label: isMovieCategory(category) ? "Movie" : "Start here",
      category,
      terms: [],
      startsAt: start,
      endsAt: mainEnd,
    },
  ];

  let cursor = mainEnd;
  let mealTerms = [];

  if (!matchesAny(category, DESSERT_CATEGORIES)) {
    const mealStart = roundUpToFive(addMinutes(cursor, TRAVEL_BUFFER_MINUTES));
    const meal = matchesAny(category, MEAL_CATEGORIES)
      ? { key: "dessert", label: "Dessert", terms: ["ice cream", "dessert"], minutes: 30 }
      : getMealForTime(mealStart);

    mealTerms = meal.terms;
    cursor = addMinutes(mealStart, meal.minutes);

    stops.push({
      id: "meal",
      kind: "meal",
      label: meal.label,
      category: meal.key,
      terms: meal.terms,
      startsAt: mealStart,
      endsAt: cursor,
    });
  }

  const nearbyStart = roundUpToFive(addMinutes(cursor, TRAVEL_BUFFER_MINUTES));
  const companionTerms = getCompanionTerms(category, nearbyStart, mealTerms);

  if (companionTerms.length > 0) {
    stops.push({
      id: "nearby",
      kind: "nearby",
      label: `Nearby ${companionTerms.map(formatCategory).join(" or ")}`,
      category: companionTerms[0],
      terms: companionTerms,
      startsAt: nearbyStart,
      endsAt: addMinutes(nearbyStart, getDurationMinutes(companionTerms[0])),
    });
  }

  return stops;
}
