import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useMergedPlan, usePlan } from "../context/PlanContext";
import "./Group.css";

function Group() {
  const navigate = useNavigate();
  const { updatePlan } = usePlan();
  const previousData = useMergedPlan();

  const mood = previousData.mood || "";

  /*
   * ==================================================
   * MEMBER COUNT
   * ==================================================
   */

  const [memberCount, setMemberCount] = useState(
    previousData.memberCount
      ? Number(previousData.memberCount)
      : 2
  );

  /*
   * ==================================================
   * LOCATION MODE
   * ==================================================
   */

  const [locationMode, setLocationMode] = useState(
    previousData.locationMode || "together"
  );

  /*
   * ==================================================
   * TRAVEL MODE
   * ==================================================
   */

  const [travelMode, setTravelMode] = useState(
    previousData.travelMode || "public"
  );

  /*
   * ==================================================
   * CURRENT LOCATION
   * ==================================================
   */

  const [currentLocation, setCurrentLocation] =
    useState(previousData.currentLocation || "");

  const [gettingLocation, setGettingLocation] =
    useState(false);

  const [locationError, setLocationError] =
    useState("");

  /*
   * ==================================================
   * MEMBERS
   * ==================================================
   *
   * If previous member locations exist, restore them.
   * Otherwise create the default members.
   */

  const createDefaultMembers = (count) => {
    const members = [];

    for (let i = 0; i < count; i++) {
      members.push({
        id: i + 1,
        name: i === 0 ? "You" : `Friend ${i}`,
        location: "",
      });
    }

    return members;
  };

  const [members, setMembers] = useState(() => {
    if (
      Array.isArray(previousData.members) &&
      previousData.members.length > 0
    ) {
      return previousData.members;
    }

    return createDefaultMembers(
      previousData.memberCount
        ? Number(previousData.memberCount)
        : 2
    );
  });

  /*
   * ==================================================
   * CHANGE MEMBER COUNT
   * ==================================================
   */

  const updateMemberCount = (count) => {
    setMemberCount(count);

    setMembers((current) => {
      const updated = [...current];

      /*
       * Add new members if count increases.
       */

      while (updated.length < count) {
        const number = updated.length;

        updated.push({
          id: Date.now() + number,
          name: `Friend ${number}`,
          location: "",
        });
      }

      /*
       * Remove members if count decreases.
       */

      return updated.slice(0, count);
    });
  };

  /*
   * ==================================================
   * UPDATE MEMBER LOCATION
   * ==================================================
   */

  const updateMemberLocation = (id, value) => {
    setMembers((current) =>
      current.map((member) =>
        member.id === id
          ? {
              ...member,
              location: value,
            }
          : member
      )
    );
  };

  /*
   * ==================================================
   * GET CURRENT LOCATION
   * ==================================================
   */

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location access."
      );

      return;
    }

    setGettingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } =
          position.coords;

        const detectedLocation =
          `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

        setCurrentLocation(detectedLocation);

        /*
         * Also store current location in
         * the first member ("You").
         */

        setMembers((current) =>
          current.map((member, index) =>
            index === 0
              ? {
                  ...member,
                  location: detectedLocation,
                }
              : member
          )
        );

        setGettingLocation(false);
      },

      () => {
        setLocationError(
          "Unable to get your location. Please allow location access and try again."
        );

        setGettingLocation(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  /*
   * ==================================================
   * CHANGE LOCATION MODE
   * ==================================================
   */

  const handleLocationModeChange = (mode) => {
    setLocationMode(mode);
    setLocationError("");

    /*
     * If everyone is together,
     * use current location for "You".
     */

    if (mode === "together") {
      setMembers((current) =>
        current.map((member, index) => ({
          ...member,
          location:
            index === 0
              ? currentLocation || member.location || ""
              : "",
        }))
      );
    }

    /*
     * If everyone is in different places,
     * keep the existing member locations if they
     * already exist.
     *
     * Do NOT clear them.
     */

    if (mode === "different") {
      /*
       * We intentionally don't clear currentLocation
       * or member locations here.
       */
    }
  };

  /*
   * ==================================================
   * CONTINUE TO PREFERENCES
   * ==================================================
   */

  const handleContinue = () => {
    /*
     * Everyone together
     */

    if (
      locationMode === "together" &&
      !currentLocation
    ) {
      /*
       * If currentLocation is empty but the first
       * member already contains a location, use it.
       */

      const firstMemberLocation =
        members[0]?.location || "";

      if (!firstMemberLocation) {
        return;
      }
    }

    /*
     * Everyone in different places
     */

    if (
      locationMode === "different" &&
      members.some(
        (member) =>
          !member.location ||
          !member.location.trim()
      )
    ) {
      return;
    }

    /*
     * For "together", make sure currentLocation
     * contains the first member location if needed.
     */

    const finalCurrentLocation =
      currentLocation ||
      members[0]?.location ||
      "";

    /*
     * ==================================================
     * PRESERVE ALL DATA
     * ==================================================
     *
     * We also preserve budget and vibes if the user
     * came back from Preferences.
     */

    const nextPlan = {
      ...previousData,
      mood,
      memberCount,
      locationMode,
      travelMode,
      currentLocation: finalCurrentLocation,
      members,
      budget: previousData.budget || "",
      vibes: Array.isArray(previousData.vibes)
        ? previousData.vibes
        : [],
    };

    updatePlan(nextPlan);
    navigate("/preferences", {
      state: nextPlan,
    });
  };

  /*
   * ==================================================
   * CHECK IF READY
   * ==================================================
   */

  const isReady =
    locationMode === "together"
      ? currentLocation !== "" ||
        members[0]?.location
      : members.every(
          (member) =>
            member.location &&
            member.location.trim() !== ""
        );

  /*
   * ==================================================
   * PAGE
   * ==================================================
   */

  return (
    <div className="group-page app-page">
      <AppHeader
        onBack={() => navigate("/mood", { state: { mood } })}
      />

      <div className="group-container app-page-main">

        {/* HEADER */}

        <div className="group-header">

          <span className="group-step">
            STEP 2 OF 4
          </span>

          <h1>
            Who's coming along?
          </h1>

          <p>
            Tell us who's joining and where everyone
            is starting from.
          </p>

          {mood && (
            <div className="group-mood">
              Mood: <strong>{mood}</strong>
            </div>
          )}

        </div>

        {/* ==================================================
            MEMBER COUNT
        ================================================== */}

        <section className="group-section">

          <h2>
            How many people?
          </h2>

          <p className="group-description">
            Include yourself in the count.
          </p>

          <div className="member-counter">

            <button
              onClick={() =>
                updateMemberCount(
                  Math.max(
                    1,
                    memberCount - 1
                  )
                )
              }
              disabled={memberCount === 1}
            >
              −
            </button>

            <div className="member-count-number">

              <strong>
                {memberCount}
              </strong>

              <span>
                {memberCount === 1
                  ? "person"
                  : "people"}
              </span>

            </div>

            <button
              onClick={() =>
                updateMemberCount(
                  Math.min(
                    10,
                    memberCount + 1
                  )
                )
              }
              disabled={memberCount === 10}
            >
              +
            </button>

          </div>

          <p className="counter-note">
            Maximum 10 people
          </p>

        </section>

        {/* ==================================================
            LOCATION MODE
        ================================================== */}

        <section className="group-section">

          <h2>
            Where is everyone?
          </h2>

          <p className="group-description">
            Choose whether everyone is already together
            or coming from different places.
          </p>

          <div className="location-mode-grid">

            {/* TOGETHER */}

            <button
              className={`location-mode-card ${
                locationMode === "together"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleLocationModeChange(
                  "together"
                )
              }
            >

              <div className="mode-icon">
                📍
              </div>

              <div className="mode-content">

                <strong>
                  We're all together
                </strong>

                <span>
                  Find places near our current location
                </span>

              </div>

              {locationMode === "together" && (
                <div className="mode-check">
                  ✓
                </div>
              )}

            </button>

            {/* DIFFERENT */}

            <button
              className={`location-mode-card ${
                locationMode === "different"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleLocationModeChange(
                  "different"
                )
              }
            >

              <div className="mode-icon">
                👥
              </div>

              <div className="mode-content">

                <strong>
                  We're in different places
                </strong>

                <span>
                  Find a convenient meeting point
                </span>

              </div>

              {locationMode === "different" && (
                <div className="mode-check">
                  ✓
                </div>
              )}

            </button>

          </div>

          {/* ==================================================
              CURRENT LOCATION
          ================================================== */}

          {locationMode === "together" && (
            <div className="current-location-box">

              <div className="current-location-info">

                <div className="current-location-icon">
                  ⌖
                </div>

                <div>

                  <strong>
                    Use your current location
                  </strong>

                  <p>
                    We'll find places around where
                    you are right now.
                  </p>

                </div>

              </div>

              <button
                className="location-button"
                onClick={getCurrentLocation}
                disabled={gettingLocation}
              >
                {gettingLocation
                  ? "Getting location..."
                  : currentLocation
                  ? "Location detected ✓"
                  : "Use Current Location"}
              </button>

              {currentLocation && (
                <div className="detected-location">
                  📍 Location detected
                </div>
              )}

              {locationError && (
                <div className="location-error">
                  {locationError}
                </div>
              )}

            </div>
          )}

          {/* ==================================================
              DIFFERENT LOCATIONS
          ================================================== */}

          {locationMode === "different" && (
            <div className="different-location-box">

              <div className="member-list">

                {members.map(
                  (member, index) => (
                    <div
                      className="member-row"
                      key={member.id}
                    >

                      <div className="member-avatar">
                        {index === 0
                          ? "You"
                          : index + 1}
                      </div>

                      <div className="member-info">

                        <strong>
                          {member.name}
                        </strong>

                        <input
                          type="text"
                          placeholder="Enter city or area"
                          value={
                            member.location || ""
                          }
                          onChange={(event) =>
                            updateMemberLocation(
                              member.id,
                              event.target.value
                            )
                          }
                        />

                      </div>

                    </div>
                  )
                )}

              </div>

              <div className="location-tip">
                💡 Example: Andheri, Thane, Vashi,
                Bandra or any nearby area.
              </div>

            </div>
          )}

        </section>

        {/* ==================================================
            TRAVEL MODE
        ================================================== */}

        {locationMode === "different" && (
          <section className="group-section">

            <h2>
              How will you travel?
            </h2>

            <p className="group-description">
              This helps MoodMate find a more practical
              meeting point.
            </p>

            <div className="travel-grid">

              {/* PUBLIC */}

              <button
                className={`travel-card ${
                  travelMode === "public"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setTravelMode("public")
                }
              >

                <div className="travel-icon">
                  🚆
                </div>

                <div>

                  <strong>
                    Public Transport
                  </strong>

                  <span>
                    Train · Metro · Bus
                  </span>

                </div>

                {travelMode === "public" && (
                  <div className="travel-check">
                    ✓
                  </div>
                )}

              </button>

              {/* PRIVATE */}

              <button
                className={`travel-card ${
                  travelMode === "private"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setTravelMode("private")
                }
              >

                <div className="travel-icon">
                  🚗
                </div>

                <div>

                  <strong>
                    Private Vehicle
                  </strong>

                  <span>
                    Car · Bike
                  </span>

                </div>

                {travelMode === "private" && (
                  <div className="travel-check">
                    ✓
                  </div>
                )}

              </button>

            </div>

          </section>
        )}

        {/* ==================================================
            SMART MIDPOINT PREVIEW
        ================================================== */}

        <div className="midpoint-preview">

          <div className="midpoint-icon">
            ⌖
          </div>

          <div>

            <strong>
              {locationMode === "together"
                ? "Nearby Places"
                : "Smart Midpoint"}
            </strong>

            <p>
              {locationMode === "together"
                ? "We'll search for places around your current location."
                : travelMode === "public"
                ? "We'll find a meeting area that works well with public transport."
                : "We'll find a meeting area that's practical for driving."}
            </p>

          </div>

        </div>

        {/* ==================================================
            CONTINUE
        ================================================== */}

        <button
          className="group-continue"
          disabled={!isReady}
          onClick={handleContinue}
        >
          Continue to Preferences →
        </button>

      </div>
    </div>
  );
}

export default Group;