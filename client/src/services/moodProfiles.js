/*
 * Which kinds of places suit each mood, and how strongly.
 * Weight 3 = a perfect fit, 2 = a good fit, 1 = fine as a filler.
 * Category ids match the server's place catalogue
 * (server/services/moodPlacesService.js).
 */
export const MOOD_PROFILES = {
  Happy: {
    blurb: "Fun, lively places to enjoy together",
    categories: {
      cafe: 3,
      restaurant: 3,
      ice_cream: 3,
      cinema: 3,
      mall: 2,
      arcade: 2,
      bowling: 2,
      park: 1,
    },
  },
  Relaxed: {
    blurb: "Calm, slow-paced spots to unwind",
    categories: {
      cafe: 3,
      park: 3,
      garden: 3,
      tea: 3,
      bookstore: 2,
      beach: 2,
      lake: 2,
      museum: 1,
    },
  },
  Energetic: {
    blurb: "High-energy places to burn off steam",
    categories: {
      nightclub: 3,
      bowling: 3,
      arcade: 3,
      trampoline: 3,
      karting: 2,
      bar: 2,
      climbing: 2,
      music_venue: 2,
    },
  },
  Low: {
    blurb: "Comforting, quiet places to feel better",
    categories: {
      ice_cream: 3,
      cafe: 3,
      tea: 2,
      garden: 2,
      park: 2,
      bookstore: 2,
      worship: 2,
      beach: 1,
    },
  },
  Romantic: {
    blurb: "Scenic, cosy places for two",
    categories: {
      restaurant: 3,
      viewpoint: 3,
      beach: 3,
      garden: 3,
      cafe: 2,
      lake: 2,
      ice_cream: 1,
      cinema: 1,
    },
  },
  Adventurous: {
    blurb: "Thrills, challenges and something new",
    categories: {
      escape_room: 3,
      trampoline: 3,
      karting: 3,
      paintball: 3,
      climbing: 3,
      adventure_park: 3,
      theme_park: 3,
      water_sports: 2,
      water_park: 2,
      ice_rink: 2,
      fort: 2,
      peak: 2,
      nature_reserve: 2,
      horse_riding: 2,
      arcade: 1,
      bowling: 1,
    },
  },
};

const MOOD_ALIASES = {
  chill: "Relaxed",
  relax: "Relaxed",
  adventure: "Adventurous",
  party: "Energetic",
  sad: "Low",
};

export const VIBE_CATEGORIES = {
  Cafés: ["cafe"],
  Food: ["restaurant"],
  Movies: ["cinema"],
  Outdoors: ["park", "garden", "nature_reserve"],
  Games: ["bowling", "arcade"],
  Creative: ["museum", "gallery", "arts_centre"],
  Music: ["music_venue", "nightclub"],
  Shopping: ["mall"],
};

export function resolveMood(mood) {
  if (!mood) {
    return "";
  }

  if (MOOD_PROFILES[mood]) {
    return mood;
  }

  const lower = String(mood).toLowerCase();

  return (
    Object.keys(MOOD_PROFILES).find((name) => name.toLowerCase() === lower) ||
    MOOD_ALIASES[lower] ||
    ""
  );
}

/*
 * Mood categories keep their weight; a vibe that matches the mood gets a
 * boost, and vibe-only categories come in as a good (2) fit.
 */
export function getPlaceCategories(mood, vibes = []) {
  const profile = MOOD_PROFILES[resolveMood(mood)];
  const merged = new Map();

  Object.entries(profile?.categories || {}).forEach(([id, weight]) => {
    merged.set(id, { id, weight, source: "mood" });
  });

  (Array.isArray(vibes) ? vibes : []).forEach((vibe) => {
    (VIBE_CATEGORIES[vibe] || []).forEach((id) => {
      const existing = merged.get(id);

      merged.set(
        id,
        existing
          ? { id, weight: Math.min(4, existing.weight + 1), source: "both" }
          : { id, weight: 2, source: "vibe" }
      );
    });
  });

  if (merged.size === 0) {
    ["cafe", "restaurant", "park"].forEach((id) =>
      merged.set(id, { id, weight: 2, source: "default" })
    );
  }

  return [...merged.values()];
}

export function getMoodBlurb(mood) {
  return MOOD_PROFILES[resolveMood(mood)]?.blurb || "";
}
