import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";
import { db } from "../services/firebase";
import AppHeader from "../components/AppHeader";
import {
  planToFlowState,
  toggleFavoritePlan,
} from "../services/planService";
import { getDirectionsUrl, openInNewTab } from "../services/mapLinks";

import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resetPlan, updatePlan } = usePlan();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  /*
  ==================================================
  LOAD SAVED PLANS FROM FIREBASE
  ==================================================
  */

  useEffect(() => {
    const loadPlans = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        /*
        Firebase structure:

        users
          └── USER_UID
               └── plans
                    └── PLAN_ID
        */

        const plansRef = collection(
          db,
          "users",
          user.uid,
          "plans"
        );

        /*
        Try to load newest plans first.
        */

        let snapshot;

        try {
          const plansQuery = query(
            plansRef,
            orderBy("createdAt", "desc")
          );

          snapshot = await getDocs(plansQuery);
        } catch (orderError) {
          /*
          If some older document doesn't have
          createdAt, load without ordering.
          */

          console.warn(
            "Could not order plans by createdAt. Loading normally.",
            orderError
          );

          snapshot = await getDocs(plansRef);
        }

        const loadedPlans = snapshot.docs.map(
          (document) => ({
            id: document.id,
            ...document.data(),
          })
        );

        /*
        If fallback query was used,
        sort manually.
        */

        loadedPlans.sort((a, b) => {
          const dateA =
            a.createdAt?.toDate?.() || new Date(0);

          const dateB =
            b.createdAt?.toDate?.() || new Date(0);

          return dateB - dateA;
        });

        setPlans(loadedPlans);
      } catch (firebaseError) {
        console.error(
          "Error loading saved plans:",
          firebaseError
        );

        setError(
          "Unable to load your saved plans. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, [user]);


  /*
  ==================================================
  FORMAT DATE
  ==================================================
  */

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return "Date unavailable";
    }

    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString(
          "en-IN",
          {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }
        );
      }

      return new Date(timestamp).toLocaleString(
        "en-IN",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return "Date unavailable";
    }
  };


  /*
  ==================================================
  OPEN PLACE DIRECTIONS
  ==================================================
  */

  const openDirections = (place) => {
    openInNewTab(getDirectionsUrl(place));
  };


  /*
  ==================================================
  OPEN COMPLETE PLAN
  ==================================================
  */

  const viewPlan = (plan) => {
    navigate(`/profile/plan/${plan.id}`, {
      state: {
        plan,
      },
    });
  };

  const handleGoAgain = (plan) => {
    const flow = planToFlowState(plan);
    updatePlan(flow);
    navigate("/mood", { state: flow });
  };

  const handleToggleFavorite = async (plan) => {
    try {
      const next = !plan.favorite;
      await toggleFavoritePlan(user.uid, plan.id, next);
      setPlans((current) =>
        current.map((item) =>
          item.id === plan.id
            ? { ...item, favorite: next }
            : item
        )
      );
    } catch (favoriteError) {
      console.error(favoriteError);
      setError("Unable to update favorite.");
    }
  };

  const visiblePlans = showFavoritesOnly
    ? plans.filter((plan) => plan.favorite)
    : plans;


  /*
  ==================================================
  USER INFORMATION
  ==================================================
  */

  const userName =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "MoodMate User";


  /*
  ==================================================
  NOT LOGGED IN
  ==================================================
  */

  if (!user) {
    return (
      <div className="profile-page app-page">
        <AppHeader
          backTo="/"
          showDashboard={false}
        />

        <div className="profile-container profile-login-message app-page-main">
          <div className="profile-empty-icon">◉</div>

          <h2>Please login first</h2>

          <p>
            Login to view your profile and saved MoodMate plans.
          </p>

          <button
            className="profile-primary-btn"
            onClick={() => navigate("/login")}
          >
            Go to Login →
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="profile-page app-page">
      <AppHeader backTo="/dashboard" />

      <main className="profile-container app-page-main">


        {/* ==================================================
            PROFILE HEADER
        ================================================== */}

        <div className="profile-header">

          <span className="profile-label">
            YOUR ACCOUNT
          </span>

          <h1>
            My Profile
          </h1>

          <p>
            Everything you've saved with MoodMate,
            all in one place.
          </p>

        </div>


        {/* ==================================================
            USER CARD
        ================================================== */}

        <section className="profile-user-card">

          <div className="profile-avatar">

            {userName
              .charAt(0)
              .toUpperCase()}

          </div>

          <div className="profile-user-details">

            <span className="profile-detail-label">
              NAME
            </span>

            <h2>
              {userName}
            </h2>

            <span className="profile-detail-label">
              EMAIL
            </span>

            <p>
              {user.email}
            </p>

          </div>

          <div className="profile-account-badge">
            <span>
              ✓
            </span>

            Account active
          </div>

        </section>


        {/* ==================================================
            QUICK STATS
        ================================================== */}

        <section className="profile-stats">

          <div className="profile-stat-card">

            <span>
              SAVED PLANS
            </span>

            <strong>
              {plans.length}
            </strong>

          </div>


          <div className="profile-stat-card">

            <span>
              SAVED PLACES
            </span>

            <strong>
              {
                plans.reduce(
                  (total, plan) =>
                    total +
                    (Array.isArray(
                      plan.places
                    )
                      ? plan.places.length
                      : 0),
                  0
                )
              }
            </strong>

          </div>


          <div className="profile-stat-card">

            <span>
              GROUP MEMBERS
            </span>

            <strong>
              {
                plans.reduce(
                  (total, plan) =>
                    total +
                    (Array.isArray(
                      plan.members
                    )
                      ? plan.members.length
                      : 0),
                  0
                )
              }
            </strong>

          </div>

        </section>


        {/* ==================================================
            SAVED PLANS
        ================================================== */}

        <section className="saved-plans-section">

          <div className="saved-plans-heading">

            <div>

              <span>
                YOUR HISTORY
              </span>

              <h2>
                Previous Plans
              </h2>

            </div>

            <span className="plan-count">
              {visiblePlans.length}
              {showFavoritesOnly ? " favorites" : plans.length === 1 ? " plan" : " plans"}
            </span>

          </div>

          <div className="profile-plan-filters" style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <button
              type="button"
              className="profile-dashboard-btn"
              style={{
                background: !showFavoritesOnly ? "#174c3b" : "#fff",
                color: !showFavoritesOnly ? "#fff" : "#174c3b",
                border: "1px solid #d7ddd8",
                borderRadius: 999,
                padding: "8px 14px",
                fontWeight: 700,
              }}
              onClick={() => setShowFavoritesOnly(false)}
            >
              All plans
            </button>
            <button
              type="button"
              className="profile-dashboard-btn"
              style={{
                background: showFavoritesOnly ? "#174c3b" : "#fff",
                color: showFavoritesOnly ? "#fff" : "#174c3b",
                border: "1px solid #d7ddd8",
                borderRadius: 999,
                padding: "8px 14px",
                fontWeight: 700,
              }}
              onClick={() => setShowFavoritesOnly(true)}
            >
              ★ Favorites
            </button>
          </div>


          {/* ==================================================
              LOADING
          ================================================== */}

          {loading && (

            <div className="profile-message">

              <div className="profile-spinner"></div>

              <p>
                Loading your saved plans...
              </p>

            </div>

          )}


          {/* ==================================================
              ERROR
          ================================================== */}

          {!loading && error && (

            <div className="profile-message">

              <div className="profile-message-icon">
                !
              </div>

              <h3>
                Something went wrong
              </h3>

              <p>
                {error}
              </p>

            </div>

          )}


          {/* ==================================================
              NO PLANS
          ================================================== */}

          {!loading &&
            !error &&
            plans.length === 0 && (

              <div className="profile-empty">

                <div className="profile-empty-icon">
                  ✦
                </div>

                <h3>
                  No saved plans yet
                </h3>

                <p>
                  Your saved MoodMate plans will
                  appear here once you create one.
                </p>

                <button
                  className="profile-primary-btn"
                  onClick={() => {
              resetPlan();
              navigate("/mood");
            }}
                >
                  Create Your First Plan →
                </button>

              </div>

            )}


          {/* ==================================================
              PLAN CARDS
          ================================================== */}

          {!loading &&
            !error &&
            plans.length > 0 &&
            visiblePlans.length === 0 && (
              <div className="profile-empty">
                <h3>No favorites yet</h3>
                <p>Star a plan to see it here.</p>
              </div>
            )}

          {!loading &&
            !error &&
            visiblePlans.length > 0 && (

              <div className="saved-plans-grid">

                {visiblePlans.map((plan, index) => {

                  const members =
                    Array.isArray(plan.members)
                      ? plan.members
                      : [];

                  const places =
                    Array.isArray(plan.places)
                      ? plan.places
                      : [];

                  const vibes =
                    Array.isArray(plan.vibes)
                      ? plan.vibes
                      : [];

                  return (

                    <article
                      className="saved-plan-card"
                      key={plan.id}
                    >

                      {/* PLAN HEADER */}

                      <div className="saved-plan-card-top">

                        <div>

                          <span className="saved-plan-number">
                            PLAN {index + 1}
                          </span>

                          <h3>
                            {plan.midpoint?.name
                              ? plan.midpoint.name
                                  .split(",")[0]
                              : "MoodMate Plan"}
                          </h3>

                        </div>

                        <span className="saved-plan-date">
                          {formatDate(
                            plan.createdAt
                          )}
                        </span>

                      </div>


                      {/* MOOD */}

                      <div className="saved-plan-mood">

                        <span>
                          MOOD
                        </span>

                        <strong>
                          {plan.mood ||
                            "Any mood"}
                        </strong>

                      </div>


                      {/* PLAN STATS */}

                      <div className="saved-plan-stats">

                        <div>

                          <span>
                            MEMBERS
                          </span>

                          <strong>
                            {plan.memberCount ??
                              members.length}
                          </strong>

                        </div>


                        <div>

                          <span>
                            BUDGET
                          </span>

                          <strong>
                            {plan.budget
                              ? `₹${plan.budget}`
                              : "Flexible"}
                          </strong>

                        </div>


                        <div>

                          <span>
                            PLACES
                          </span>

                          <strong>
                            {places.length}
                          </strong>

                        </div>

                      </div>


                      {/* VIBES */}

                      {vibes.length > 0 && (

                        <div className="saved-plan-vibes">

                          {vibes.map(
                            (vibe, vibeIndex) => (

                              <span
                                key={`${vibe}-${vibeIndex}`}
                              >
                                {vibe}
                              </span>

                            )
                          )}

                        </div>

                      )}


                      {/* MIDPOINT */}

                      {plan.midpoint && (

                        <div className="saved-plan-midpoint">

                          <div className="saved-section-icon">
                            ★
                          </div>

                          <div>

                            <span>
                              MEETING POINT
                            </span>

                            <strong>
                              {plan.midpoint.name ||
                                "Smart midpoint"}
                            </strong>

                          </div>

                        </div>

                      )}


                      {/* GROUP MEMBERS */}

                      {members.length > 0 && (

                        <div className="saved-plan-list">

                          <div className="saved-list-heading">
                            Group Members
                          </div>

                          {members
                            .slice(0, 4)
                            .map(
                              (
                                member,
                                memberIndex
                              ) => (

                                <div
                                  className="saved-member"
                                  key={
                                    memberIndex
                                  }
                                >

                                  <span>
                                    {member.name
                                      ?.charAt(0)
                                      ?.toUpperCase() ||
                                      "M"}
                                  </span>

                                  <div>

                                    <strong>
                                      {member.name ||
                                        `Member ${
                                          memberIndex +
                                          1
                                        }`}
                                    </strong>

                                    {member.location && (

                                      <small>
                                        {member.location}
                                      </small>

                                    )}

                                  </div>

                                </div>

                              )
                            )}

                          {members.length > 4 && (

                            <small className="more-items">
                              +{" "}
                              {members.length - 4}{" "}
                              more members
                            </small>

                          )}

                        </div>

                      )}


                      {/* PLACES */}

                      {places.length > 0 && (

                        <div className="saved-plan-list">

                          <div className="saved-list-heading">
                            Recommended Places
                          </div>

                          {places
                            .slice(0, 3)
                            .map(
                              (
                                place,
                                placeIndex
                              ) => (

                                <div
                                  className="saved-place"
                                  key={
                                    place.id ||
                                    `${place.name}-${placeIndex}`
                                  }
                                >

                                  <div className="saved-place-number">
                                    {placeIndex + 1}
                                  </div>

                                  <div className="saved-place-info">

                                    <strong>
                                      {place.name ||
                                        "Recommended place"}
                                    </strong>

                                    <small>
                                      {place.address ||
                                        "Address unavailable"}
                                    </small>

                                  </div>

                                  {place.distance !=
                                    null && (

                                    <span className="saved-place-distance">
                                      {place.distance} km
                                    </span>

                                  )}

                                  {place.lat != null &&
                                    place.lng != null && (

                                    <button
                                      className="mini-direction-btn"
                                      onClick={() =>
                                        openDirections(
                                          place
                                        )
                                      }
                                      title="Open directions"
                                    >
                                      ↗
                                    </button>

                                  )}

                                </div>

                              )
                            )}

                          {places.length > 3 && (

                            <small className="more-items">
                              +{" "}
                              {places.length - 3}{" "}
                              more places
                            </small>

                          )}

                        </div>

                      )}


                      {/* VIEW COMPLETE PLAN */}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <button
                          className="view-plan-btn"
                          onClick={() =>
                            viewPlan(plan)
                          }
                        >
                          View Complete Plan →
                        </button>

                        <button
                          className="view-plan-btn"
                          type="button"
                          onClick={() => handleGoAgain(plan)}
                          style={{ background: "#fff", color: "#174c3b", border: "1px solid #d7ddd8" }}
                        >
                          Go again
                        </button>

                        <button
                          className="view-plan-btn"
                          type="button"
                          onClick={() => handleToggleFavorite(plan)}
                          style={{ background: plan.favorite ? "#174c3b" : "#fff", color: plan.favorite ? "#fff" : "#174c3b", border: "1px solid #d7ddd8" }}
                        >
                          {plan.favorite ? "★ Favorited" : "☆ Favorite"}
                        </button>
                      </div>

                    </article>

                  );

                })}

              </div>

            )}

        </section>


        {/* ==================================================
            BOTTOM CTA
        ================================================== */}

        <section className="profile-bottom-cta">

          <div>

            <span>
              READY FOR ANOTHER ONE?
            </span>

            <h2>
              Plan your next hangout.
            </h2>

          </div>

          <button
            onClick={() => {
              resetPlan();
              navigate("/mood");
            }}
          >
            Create a New Plan →
          </button>

        </section>

      </main>

    </div>
  );
}

export default Profile;