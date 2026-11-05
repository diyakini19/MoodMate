import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useMergedPlan, usePlan } from "../context/PlanContext";
import "./Preferences.css";

const vibes = [
  { emoji: "☕", name: "Cafés" },
  { emoji: "🍽️", name: "Food" },
  { emoji: "🎬", name: "Movies" },
  { emoji: "🌳", name: "Outdoors" },
  { emoji: "🎮", name: "Games" },
  { emoji: "🎨", name: "Creative" },
  { emoji: "🎵", name: "Music" },
  { emoji: "🛍️", name: "Shopping" },
];

function Preferences() {
  const navigate = useNavigate();
  const { updatePlan } = usePlan();
  const previousData = useMergedPlan();

  const {
    mood,
    memberCount,
    locationMode,
    travelMode,
    currentLocation,
    members,

    // Previously selected preferences
    budget: previousBudget,
    vibes: previousVibes,
  } = previousData;

  /*
   * ==========================================
   * PREFERENCES STATE
   * ==========================================
   *
   * IMPORTANT:
   * Initialize these values from location.state.
   * This prevents the page from becoming blank
   * when the user comes back from Midpoint.
   */

  const [budget, setBudget] = useState(
    previousBudget
      ? Number(previousBudget)
      : ""
  );

  const [customBudget, setCustomBudget] = useState(
    previousBudget &&
    ![100, 200, 500, 1000].includes(
      Number(previousBudget)
    )
      ? String(previousBudget)
      : ""
  );

  const [selectedVibes, setSelectedVibes] =
    useState(
      Array.isArray(previousVibes)
        ? previousVibes
        : []
    );

  /*
   * ==========================================
   * BUDGET OPTIONS
   * ==========================================
   */

  const budgetOptions = [
    100,
    200,
    500,
    1000,
  ];

  /*
   * ==========================================
   * TOGGLE VIBE
   * ==========================================
   */

  const toggleVibe = (vibe) => {
    setSelectedVibes((current) =>
      current.includes(vibe)
        ? current.filter(
            (item) => item !== vibe
          )
        : [...current, vibe]
    );
  };

  /*
   * ==========================================
   * FINAL BUDGET
   * ==========================================
   */

  const finalBudget =
    budget === "custom"
      ? customBudget
      : budget;

  /*
   * ==========================================
   * CONTINUE
   * ==========================================
   */

  const handleContinue = () => {
    if (
      !finalBudget ||
      Number(finalBudget) <= 0
    ) {
      return;
    }

    if (
      selectedVibes.length === 0
    ) {
      return;
    }

    /*
     * Send ALL previous information
     * + current preferences
     * to Midpoint.
     */

    const nextPlan = {
      ...previousData,
      mood,
      memberCount,
      locationMode,
      travelMode,
      currentLocation,
      members,
      budget: Number(finalBudget),
      vibes: selectedVibes,
    };

    updatePlan(nextPlan);
    navigate("/midpoint", {
      state: nextPlan,
    });
  };

  /*
   * ==========================================
   * BACK TO GROUP
   * ==========================================
   *
   * IMPORTANT:
   * Send the current preference values
   * back to Group.
   *
   * This allows Group to restore everything
   * when the user goes back.
   */

  const handleBack = () => {
    const nextPlan = {
      ...previousData,
      mood,
      memberCount,
      locationMode,
      travelMode,
      currentLocation,
      members,
      budget: finalBudget ? Number(finalBudget) : "",
      vibes: selectedVibes,
    };

    updatePlan(nextPlan);
    navigate("/group", {
      state: nextPlan,
    });
  };

  return (
    <div className="preferences-page app-page">
      <AppHeader onBack={handleBack} />

      <div className="preferences-container app-page-main">

        {/* ==========================================
            HEADER
        ========================================== */}

        <div className="preferences-header">

          <span className="preferences-step">
            STEP 3 OF 4
          </span>

          <h1>
            Make it your kind of plan.
          </h1>

          <p>
            Tell us your budget and what
            you'd like to do.
          </p>

          {mood && (
            <div className="selected-mood">
              Mood:{" "}
              <strong>
                {mood}
              </strong>
            </div>
          )}

        </div>

        {/* ==========================================
            BUDGET
        ========================================== */}

        <section className="preference-section">

          <h2>
            What's your budget?
          </h2>

          <p className="section-description">
            Enter your budget per person.
          </p>

          <div className="budget-grid">

            {budgetOptions.map(
              (amount) => (

                <button
                  key={amount}
                  className={`budget-card ${
                    budget === amount
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setBudget(amount);
                    setCustomBudget("");
                  }}
                >

                  <span className="budget-symbol">
                    ₹
                  </span>

                  <strong>
                    {amount}
                  </strong>

                  <small>
                    per person
                  </small>

                  {budget === amount && (
                    <span className="selected-check">
                      ✓
                    </span>
                  )}

                </button>

              )
            )}

            {/* ======================================
                CUSTOM BUDGET
            ====================================== */}

            <button
              className={`budget-card ${
                budget === "custom"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setBudget("custom")
              }
            >

              <span className="budget-symbol">
                ₹+
              </span>

              <strong>
                Custom
              </strong>

              <small>
                Your own amount
              </small>

              {budget === "custom" && (
                <span className="selected-check">
                  ✓
                </span>
              )}

            </button>

          </div>

          {/* ======================================
              CUSTOM INPUT
          ====================================== */}

          {budget === "custom" && (
            <div className="custom-budget">

              <label>
                Enter amount per person
              </label>

              <div className="budget-input">

                <span>
                  ₹
                </span>

                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 750"
                  value={customBudget}
                  onChange={(e) =>
                    setCustomBudget(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>
          )}

          {/* ======================================
              BUDGET SUMMARY
          ====================================== */}

          {finalBudget && (
            <div className="budget-summary">

              Budget:{" "}

              <strong>
                ₹{finalBudget}
              </strong>{" "}

              per person

            </div>
          )}

        </section>

        {/* ==========================================
            VIBES
        ========================================== */}

        <section className="preference-section">

          <h2>
            What sounds good?
          </h2>

          <p className="section-description">
            Select one or more activities.
          </p>

          <div className="vibe-grid">

            {vibes.map(
              (vibe) => (

                <button
                  key={vibe.name}
                  className={`vibe-card ${
                    selectedVibes.includes(
                      vibe.name
                    )
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    toggleVibe(
                      vibe.name
                    )
                  }
                >

                  <span className="vibe-emoji">
                    {vibe.emoji}
                  </span>

                  {vibe.name}

                  {selectedVibes.includes(
                    vibe.name
                  ) && (
                    <span className="vibe-check">
                      ✓
                    </span>
                  )}

                </button>

              )
            )}

          </div>

        </section>

        {/* ==========================================
            GROUP SUMMARY
        ========================================== */}

        <section className="group-summary">

          <div className="summary-icon">
            👥
          </div>

          <div>

            <strong>

              {memberCount || 0}{" "}

              {memberCount === 1
                ? "person"
                : "people"}

            </strong>

            <p>

              {locationMode ===
              "together"
                ? "Everyone is together"
                : `${
                    members?.length || 0
                  } starting locations`}

            </p>

          </div>

        </section>

        {/* ==========================================
            TRAVEL SUMMARY
        ========================================== */}

        {locationMode ===
          "different" && (

          <section className="travel-summary">

            <span>
              {travelMode ===
              "public"
                ? "🚆"
                : "🚗"}
            </span>

            <div>

              <strong>

                {travelMode ===
                "public"
                  ? "Public Transport"
                  : "Private Vehicle"}

              </strong>

              <p>
                We'll use this when
                finding the most
                convenient meeting point.
              </p>

            </div>

          </section>

        )}

        {/* ==========================================
            CURRENT LOCATION
        ========================================== */}

        {locationMode ===
          "together" &&
          currentLocation && (

          <section className="travel-summary">

            <span>
              📍
            </span>

            <div>

              <strong>
                Current Location
              </strong>

              <p>
                Your group is currently
                together.
              </p>

            </div>

          </section>

        )}

        {/* ==========================================
            CONTINUE
        ========================================== */}

        <button
          className="preferences-continue"
          disabled={
            !finalBudget ||
            Number(finalBudget) <= 0 ||
            selectedVibes.length === 0
          }
          onClick={
            handleContinue
          }
        >
          Continue to Smart Midpoint →
        </button>

      </div>

    </div>
  );
}

export default Preferences;