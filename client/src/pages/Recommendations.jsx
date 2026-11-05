import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useMergedPlan, usePlan } from "../context/PlanContext";
import AppHeader from "../components/AppHeader";
import { savePlan } from "../services/planService";
import { travelApi } from "../services/api";
import { getDirectionsUrl, getGooglePlaceUrl, openInNewTab } from "../services/mapLinks";
import { getMoodBlurb, getPlaceCategories } from "../services/moodProfiles";
import PlanActions from "../components/PlanActions";
import SmartItinerary from "../components/SmartItinerary";

import "./Recommendations.css";

/*
=========================================================
MOOD MAPPING
=========================================================
*/

const moodMapping = {
  Happy: [
    "cafe",
    "restaurant",
    "mall",
    "cinema",
    "ice cream",
  ],

  Relaxed: [
    "cafe",
    "park",
    "bookstore",
    "tea house",
  ],

  Energetic: [
    "club",
    "lounge",
    "gaming zone",
    "bowling",
  ],

  Low: [
    "ice cream",
    "park",
    "temple",
    "quiet cafe",
  ],

  Romantic: [
    "rooftop restaurant",
    "garden",
    "beach",
    "cafe",
  ],

  Adventurous: [
    "escape room",
    "adventure park",
    "trekking",
    "gaming zone",
  ],

  Chill: [
    "cafe",
    "park",
    "bookstore",
    "tea house",
  ],

  Relax: [
    "park",
    "temple",
    "lake",
    "nature",
  ],

  Adventure: [
    "escape room",
    "adventure park",
    "trekking",
    "gaming zone",
  ],

  Party: [
    "club",
    "lounge",
    "pub",
    "restaurant",
  ],

  Sad: [
    "ice cream",
    "park",
    "temple",
    "quiet cafe",
  ],
};

/*
=========================================================
VIBE MAPPING
=========================================================
*/

const vibeMapping = {
  Cafés: [
    "cafe",
  ],

  Food: [
    "restaurant",
  ],

  Movies: [
    "cinema",
    "movie theater",
  ],

  Outdoors: [
    "park",
    "garden",
    "nature",
  ],

  Games: [
    "bowling",
    "gaming",
    "game center",
  ],

  Creative: [
    "art gallery",
    "museum",
    "art center",
  ],

  Music: [
    "music venue",
    "live music",
  ],

  Shopping: [
    "shopping mall",
    "shopping center",
  ],
};

const getMatchBadge = (place) => {
  if (place?.matchSource === "vibe") {
    return "Matches your activities";
  }

  if (place?.matchLevel === "top") {
    return "★ Perfect for your mood";
  }

  return place?.matchLevel === "good" ? "Good match for your mood" : "";
};

/*
=========================================================
RECOMMENDATIONS COMPONENT
=========================================================
*/

function Recommendations() {
  const navigate = useNavigate();
  const { updatePlan } = usePlan();
  const { user } = useAuth();
  const data = useMergedPlan();

  const {
    mood,
    memberCount,
    locationMode,
    travelMode,
    currentLocation,
    members,
    budget,
    vibes,
    midpoint,
  } = data;

  /*
  =========================================================
  STATE
  =========================================================
  */

  const [places, setPlaces] = useState([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState(false);

  const [saveError, setSaveError] = useState("");

  const [savedPlan, setSavedPlan] = useState(null);

  /*
  =========================================================
  ITINERARY STATE
  =========================================================
  */

  const [searchInfo, setSearchInfo] = useState(null);

  const [itineraryPlace, setItineraryPlace] = useState(null);

  const [smartItinerary, setSmartItinerary] = useState(null);

  /*
  =========================================================
  GET SEARCH LOCATION
  =========================================================
  */

  const getSearchLocation = () => {
    /*
    MIDPOINT FIRST
    */

    if (
      midpoint &&
      midpoint.lat != null &&
      midpoint.lng != null
    ) {
      const lat = Number(midpoint.lat);
      const lng = Number(midpoint.lng);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        return {
          lat,
          lng,
        };
      }
    }

    /*
    CURRENT LOCATION
    */

    if (
      currentLocation &&
      typeof currentLocation === "string" &&
      currentLocation.includes(",")
    ) {
      const parts = currentLocation
        .split(",")
        .map((value) =>
          Number(value.trim())
        );

      if (
        parts.length === 2 &&
        Number.isFinite(parts[0]) &&
        Number.isFinite(parts[1])
      ) {
        return {
          lat: parts[0],
          lng: parts[1],
        };
      }
    }

    return null;
  };

  /*
  =========================================================
  GET MOOD SEARCH TERMS
  =========================================================
  */

  const getMoodSearchTerms = () => {
    if (!mood) {
      return [];
    }

    if (moodMapping[mood]) {
      return moodMapping[mood];
    }

    const matchingMood =
      Object.keys(moodMapping).find(
        (item) =>
          item.toLowerCase() ===
          String(mood).toLowerCase()
      );

    if (matchingMood) {
      return moodMapping[matchingMood];
    }

    return [];
  };

  /*
  =========================================================
  GET VIBE SEARCH TERMS
  =========================================================
  */

  const getVibeSearchTerms = () => {
    const terms = [];

    if (!Array.isArray(vibes)) {
      return terms;
    }

    vibes.forEach((vibe) => {
      if (vibeMapping[vibe]) {
        terms.push(
          ...vibeMapping[vibe]
        );
      }
    });

    return terms;
  };

  /*
  =========================================================
  GET ALL SEARCH TERMS
  =========================================================
  */

  const getSearchTerms = () => {
    const moodTerms =
      getMoodSearchTerms();

    const vibeTerms =
      getVibeSearchTerms();

    const combined = [
      ...moodTerms,
      ...vibeTerms,
    ];

    const uniqueTerms = [
      ...new Set(
        combined.map((term) =>
          term.toLowerCase()
        )
      ),
    ];

    if (uniqueTerms.length === 0) {
      return [
        "restaurant",
        "cafe",
        "park",
      ];
    }

    return uniqueTerms;
  };

  /*
  =========================================================
  SEARCH PLACES USING OPENSTREETMAP
  =========================================================
  */

  const searchPlaces = async (searchLocation) => {
    try {
      const moodResponse = await travelApi.moodPlaces({
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        categories: getPlaceCategories(mood, vibes),
      });

      if (moodResponse?.success && Array.isArray(moodResponse.places)) {
        return {
          places: moodResponse.places,
          searchInfo: {
            searched: moodResponse.searched || [],
            widened: Boolean(moodResponse.widened),
          },
        };
      }
    } catch (moodError) {
      console.warn(
        "Mood-based search unavailable, using keyword search:",
        moodError
      );
    }

    try {
      const searchTerms =
        getSearchTerms();

      const response =
        await travelApi.places({
          lat: searchLocation.lat,
          lng: searchLocation.lng,
          terms: searchTerms,
          radius: 3000,
        });

      if (!response.success) {
        throw new Error(
          response.message ||
            "Unable to find recommended places."
        );
      }

      return {
        places: Array.isArray(response.places)
          ? response.places
          : [],
        searchInfo: null,
      };

    } catch (error) {
      console.error(
        "Recommendation error:",
        error
      );

      return { places: [], searchInfo: null };
    }
  };

  /*
  =========================================================
  LOAD RECOMMENDATIONS
  =========================================================
  */

  const hasSearchLocation = Boolean(getSearchLocation());

  useEffect(() => {
    const searchLocation = getSearchLocation();

    if (!searchLocation) {
      console.error("No midpoint location available.");
      return;
    }

    let cancelled = false;

    searchPlaces(searchLocation).then((result) => {
      if (cancelled) return;
      setPlaces(result.places);
      setSearchInfo(result.searchInfo);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
  =========================================================
  ITINERARY
  =========================================================
  */

  const createItinerary = (place) => {
    setItineraryPlace(place);
    setSmartItinerary(null);

    setTimeout(() => {
      document
        .getElementById("suggested-itinerary")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  };

  const closeItinerary = () => {
    setItineraryPlace(null);
    setSmartItinerary(null);
  };

  const openDirections = (place) => {
    if (place) {
      openInNewTab(getDirectionsUrl(place));
    }
  };

  /*
  =========================================================
  SAVE COMPLETE PLAN
  =========================================================
  */

  const handleSavePlan =
    async () => {

      if (!user) {
        navigate("/login");
        return;
      }

      if (
        saving ||
        saved
      ) {
        return;
      }

      try {
        setSaving(true);

        setSaveError("");

        const completePlanData = {
          mood:
            mood || "",

          memberCount:
            memberCount != null
              ? Number(memberCount)
              : Array.isArray(
                  members
                )
              ? members.length
              : 0,

          locationMode:
            locationMode || "",

          travelMode:
            travelMode || "",

          currentLocation:
            currentLocation || "",

          members:
            Array.isArray(
              members
            )
              ? members
              : [],

          budget:
            budget != null
              ? budget
              : "",

          vibes:
            Array.isArray(
              vibes
            )
              ? vibes
              : [],

          midpoint:
            midpoint || null,

          places:
            Array.isArray(
              places
            )
              ? places
              : [],

          itinerary:
            smartItinerary ||
            null,
        };

        console.log(
          "Saving complete plan:",
          completePlanData
        );

        const savedResult = await savePlan(
          user,
          completePlanData
        );

        setSavedPlan(savedResult);
        setSaved(true);

        console.log(
          "Plan saved successfully."
        );

      } catch (error) {
        console.error(
          "Error saving plan:",
          error
        );

        setSaveError(
          error.message ||
            "Unable to save plan."
        );

      } finally {
        setSaving(false);
      }
    };

  /*
  =========================================================
  BACK TO MIDPOINT
  =========================================================
  */

  const handleBack = () => {
    updatePlan(data);
    navigate(
      "/midpoint",
      {
        state: data,
      }
    );
  };

  /*
  =========================================================
  LOADING SCREEN
  =========================================================
  */

  if (loading && hasSearchLocation) {
    return (
      <div className="recommendations-page app-page">
        <AppHeader onBack={handleBack} />

        <div className="recommendations-container app-page-main">

          <div className="recommendations-loading">

            <div className="recommendation-loading-icon">
              ✨
            </div>

            <h2>
              Finding places for your group...
            </h2>

            <p>
              We're looking for places
              around your group's midpoint
              based on your mood and
              preferences.
            </p>

            <div className="recommendation-spinner"></div>

          </div>

        </div>

      </div>
    );
  }

  /*
  =========================================================
  MAIN PAGE
  =========================================================
  */

  return (
    <div className="recommendations-page app-page">
      <AppHeader
        onBack={handleBack}
        backLabel="← Back to Midpoint"
      />

      <div className="recommendations-container app-page-main">

        {/* HEADER */}

        <div className="recommendations-header">

          <span className="recommendations-step">
            YOUR RECOMMENDATIONS
          </span>

          <h1>
            Places you'll love.
          </h1>

          <p>
            We found places around your
            group's midpoint based on
            your mood and preferences.
          </p>

        </div>

        {/* SUMMARY */}

        <div className="recommendation-summary">

          <div className="summary-item">

            <span>
              MOOD
            </span>

            <strong>
              {mood || "Any mood"}
            </strong>

          </div>

          <div className="summary-item">

            <span>
              BUDGET
            </span>

            <strong>
              {budget
                ? `₹${budget} / person`
                : "Flexible"}
            </strong>

          </div>

          <div className="summary-item">

            <span>
              VIBES
            </span>

            <strong>
              {vibes?.length
                ? vibes.join(", ")
                : "Any"}
            </strong>

          </div>

        </div>

        {/* MOOD MATCH */}

        {mood && (
          <div
            style={{
              marginTop: "18px",
              padding: "18px 20px",
              borderRadius: "16px",
              background: "#faf7ff",
              border: "1px solid #e8ddf8",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >

            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "#eee3ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              ✦
            </div>

            <div>

              <span
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: "800",
                  letterSpacing: "1px",
                  color: "#8a55d5",
                  marginBottom: "4px",
                }}
              >
                MOOD MATCHED
              </span>

              <strong
                style={{
                  display: "block",
                  color: "#29252f",
                  fontSize: "15px",
                }}
              >
                Recommendations for your{" "}
                {mood} mood
              </strong>

              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "12px",
                  color: "#77717d",
                }}
              >
                {searchInfo?.searched?.length
                  ? `${getMoodBlurb(mood) || "Matched to your mood"}: ${searchInfo.searched
                      .slice(0, 6)
                      .map((item) => item.label)
                      .join(", ")}`
                  : getMoodSearchTerms()
                      .slice(0, 4)
                      .join(", ")}
              </p>

              {searchInfo?.widened && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "12px",
                    color: "#8a55d5",
                    fontWeight: 600,
                  }}
                >
                  Few matches close by, so we searched a wider area.
                </p>
              )}

            </div>

          </div>
        )}

        {/* MIDPOINT */}

        {midpoint && (
          <div className="recommendation-midpoint">

            <div className="recommendation-midpoint-icon">
              ★
            </div>

            <div>

              <span>
                SMART MIDPOINT
              </span>

              <strong>
                {midpoint.name
                  ? midpoint.name.split(",")[0]
                  : "Your group's sweet spot"}
              </strong>

            </div>

          </div>
        )}

        {/* =================================================
            ITINERARY
        ================================================= */}

        {itineraryPlace && (
          <SmartItinerary
            key={itineraryPlace.id || `${itineraryPlace.lat},${itineraryPlace.lng}`}
            place={itineraryPlace}
            onChange={setSmartItinerary}
            onClose={closeItinerary}
          />
        )}

        {/* =================================================
            RESULTS
        ================================================= */}

        <section className="places-section">

          <div className="places-heading">

            <div>

              <span>
                MATCHED FOR YOU
              </span>

              <h2>
                Recommended places
              </h2>

            </div>

            <div className="results-count">
              {places.length} places
            </div>

          </div>

          {/* NO RESULTS */}

          {places.length === 0 ? (

            <div className="no-results">

              <div>
                🔍
              </div>

              <h2>
                No places found
              </h2>

              <p>
                We couldn't find places
                matching your mood and
                preferences near the
                midpoint. Try different
                activities or another mood.
              </p>

              <button
                onClick={() =>
                  navigate(
                    "/preferences",
                    {
                      state: data,
                    }
                  )
                }
                type="button"
              >
                ← Change Preferences
              </button>

            </div>

          ) : (

            <div className="places-grid">

              {places.map(
                (place, index) => (

                  <div
                    className="place-card"
                    key={
                      place.id ||
                      `${place.name}-${index}`
                    }
                  >

                    <div className="place-number">
                      {index + 1}
                    </div>

                    <div className="place-card-content">

                      {/* CATEGORY */}

                      <div className="place-category">
                        {place.category}
                      </div>

                      {getMatchBadge(place) && (
                        <span
                          className={`place-match place-match-${place.matchLevel}`}
                        >
                          {getMatchBadge(place)}
                        </span>
                      )}

                      {/* NAME */}

                      <h3>
                        {place.name}
                      </h3>

                      {/* ADDRESS */}

                      <p className="place-address">
                        📍 {place.address}
                      </p>

                      {/* DISTANCE */}

                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "#8a55d5",
                          fontSize: "11px",
                          fontWeight: "700",
                        }}
                      >
                        📏 {place.distance} km
                        from midpoint
                      </p>

                      <a
                        className="place-google-link"
                        href={getGooglePlaceUrl(place)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        📷 Photos &amp; reviews on Google ↗
                      </a>

                      {/* ACTIONS */}

                      <div className="place-actions">

                        {/* DIRECTIONS */}

                        <button
                          className="place-direction-btn"
                          onClick={() =>
                            openDirections(
                              place
                            )
                          }
                          type="button"
                        >
                          🧭 Directions
                        </button>

                        {/* CREATE ITINERARY */}

                        <button
                          type="button"
                          className="place-direction-btn"
                          onClick={() =>
                            createItinerary(
                              place
                            )
                          }
                          style={{
                            background: "#8a55d5",
                            color: "#ffffff",
                            border:
                              "1px solid #8a55d5",
                          }}
                        >
                          ✨ Create Itinerary
                        </button>

                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>

        {/* =================================================
            SAVE PLAN
        ================================================= */}

        <section
          style={{
            marginTop: "40px",
            padding: "25px",
            borderRadius: "20px",
            background: "#f5f7f3",
            border: "1px solid #e2e5df",
            textAlign: "center",
          }}
        >

          <h3
            style={{
              color: "#174c3b",
              marginBottom: "8px",
            }}
          >
            Save this plan
          </h3>

          <p
            style={{
              color: "#7b8580",
              fontSize: "13px",
              marginBottom: "18px",
            }}
          >
            Save your mood, group,
            preferences, midpoint and
            recommendations to your
            MoodMate history.
            {smartItinerary?.stops?.length
              ? ` Your ${smartItinerary.stops.length}-stop itinerary will be saved too.`
              : " Create an itinerary first if you want it saved with the plan."}
          </p>

          {!user ? (

            <button
              className="primary-dashboard-btn"
              onClick={() =>
                navigate(
                  "/login"
                )
              }
              type="button"
            >
              Login to Save Plan
            </button>

          ) : (

            <button
              className="primary-dashboard-btn"
              onClick={
                handleSavePlan
              }
              disabled={
                saving ||
                saved
              }
              type="button"
            >
              {saving
                ? "Saving Plan..."
                : saved
                ? "✓ Plan Saved"
                : "♡ Save This Plan"}
            </button>

          )}

          {saveError && (
            <p
              style={{
                color: "#c0392b",
                fontSize: "13px",
                marginTop: "12px",
              }}
            >
              {saveError}
            </p>
          )}

          {saved && savedPlan && (
            <div style={{ marginTop: 18, textAlign: "left" }}>
              <p
                style={{
                  color: "#1f7a3f",
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                Plan saved. Share it, add to calendar, or favorite it.
              </p>
              <PlanActions
                plan={savedPlan}
                user={user}
                onPlanUpdate={setSavedPlan}
              />
            </div>
          )}

        </section>

        {/* =================================================
            BOTTOM
        ================================================= */}

        <div className="recommendations-bottom">

          <button
            className="change-preferences-btn"
            onClick={() =>
              navigate(
                "/preferences",
                {
                  state: data,
                }
              )
            }
            type="button"
          >
            ← Change Preferences
          </button>

          <p>
            Recommendations are based on
            your selected mood, budget,
            activities and group's
            midpoint.
          </p>

        </div>

      </div>

    </div>
  );
}

export default Recommendations;