import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";
import { db } from "../services/firebase";
import { planToFlowState } from "../services/planService";
import { getDirectionsUrl, getGooglePlaceUrl, openInNewTab } from "../services/mapLinks";
import AppHeader from "../components/AppHeader";
import ItineraryTimeline from "../components/ItineraryTimeline";
import PlanActions from "../components/PlanActions";

import "./Profile.css";
import "./PlanDetail.css";

function PlanDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { planId, userId: routeUserId } = useParams();
  const { user } = useAuth();
  const { updatePlan } = usePlan();
  const ownerId = routeUserId || user?.uid;
  const isOwnPlan = ownerId === user?.uid;
  const backTo = routeUserId ? "/admin/plans" : "/profile";

  const [plan, setPlan] = useState(location.state?.plan || null);
  const [loading, setLoading] = useState(!location.state?.plan);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPlan = async () => {
      if (plan || !ownerId || !planId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const snapshot = await getDoc(
          doc(db, "users", ownerId, "plans", planId)
        );

        if (!snapshot.exists()) {
          setError("This plan could not be found.");
          return;
        }

        setPlan({
          id: snapshot.id,
          ...snapshot.data(),
        });
      } catch (loadError) {
        console.error("Unable to load plan:", loadError);
        setError("Unable to load this plan. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [plan, planId, ownerId]);

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return "Date unavailable";
    }

    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }

      return new Date(timestamp).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Date unavailable";
    }
  };

  const handleGoAgain = () => {
    updatePlan(planToFlowState(plan));
    navigate("/mood", { state: planToFlowState(plan) });
  };

  if (loading) {
    return (
      <div className="profile-page app-page">
        <AppHeader backTo={backTo} />
        <main className="profile-container plan-detail-main app-page-main">
          <p>Loading your plan...</p>
        </main>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="profile-page app-page">
        <AppHeader backTo={backTo} />
        <main className="profile-container plan-detail-main app-page-main">
          <h1>Plan unavailable</h1>
          <p>{error || "This plan could not be opened."}</p>
        </main>
      </div>
    );
  }

  const places = Array.isArray(plan.places) ? plan.places : [];
  const members = Array.isArray(plan.members) ? plan.members : [];
  const vibes = Array.isArray(plan.vibes) ? plan.vibes : [];
  const hasItinerary =
    Array.isArray(plan.itinerary?.stops) && plan.itinerary.stops.length > 0;

  return (
    <div className="profile-page app-page">
      <AppHeader backTo={backTo} />
      <main className="profile-container plan-detail-main app-page-main">
        <span className="plan-detail-label">
          {isOwnPlan
            ? plan.favorite
              ? "FAVORITE PLAN"
              : "SAVED PLAN"
            : "VIEWING AS ADMIN · READ ONLY"}
        </span>
        <h1>{plan.mood ? `${plan.mood} hangout` : "Your MoodMate plan"}</h1>
        <p>
          {formatDate(plan.createdAt)}
          {!isOwnPlan && (plan.userName || plan.userEmail)
            ? ` · by ${plan.userName || plan.userEmail}`
            : ""}
        </p>

        {isOwnPlan && (
          <>
            <PlanActions
              plan={plan}
              user={user}
              onPlanUpdate={setPlan}
            />

            <div className="plan-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="plan-action-btn secondary"
                onClick={handleGoAgain}
              >
                Go again →
              </button>
            </div>
          </>
        )}

        <section className="plan-detail-card">
          <h2>Details</h2>
          <p>
            <strong>Mood:</strong> {plan.mood || "Not set"}
          </p>
          <p>
            <strong>People:</strong>{" "}
            {plan.memberCount || members.length || 0}
          </p>
          <p>
            <strong>Travel:</strong> {plan.travelMode || "Not set"}
          </p>
          <p>
            <strong>Budget:</strong>{" "}
            {plan.budget ? `₹${plan.budget} / person` : "Not set"}
          </p>
          <p>
            <strong>Vibes:</strong>{" "}
            {vibes.length ? vibes.join(", ") : "Not set"}
          </p>
          {plan.midpoint?.name && (
            <p>
              <strong>Meeting point:</strong> {plan.midpoint.name}
            </p>
          )}
          {plan.midpoint?.weather?.summary && (
            <p>
              <strong>Weather:</strong> {plan.midpoint.weather.summary}
              {plan.midpoint.weather.temperatureC != null
                ? ` · ${Math.round(plan.midpoint.weather.temperatureC)}°C`
                : ""}
            </p>
          )}
        </section>

        {members.length > 0 && (
          <section className="plan-detail-card">
            <h2>Group</h2>
            {members.map((member, index) => (
              <p key={`${member.name || "member"}-${index}`}>
                {member.name || `Friend ${index + 1}`}
                {member.location ? ` · ${member.location}` : ""}
              </p>
            ))}
          </section>
        )}

        {hasItinerary && (
          <section className="plan-detail-card">
            <h2>Itinerary</h2>
            <ItineraryTimeline itinerary={plan.itinerary} />
          </section>
        )}

        {places.length > 0 && (
          <section className="plan-detail-card">
            <h2>Recommended places</h2>
            {places.map((place, index) => (
              <article
                key={place.id || `${place.name}-${index}`}
                className="plan-detail-place"
              >
                <div>
                  <strong>{place.name}</strong>
                  <p>{place.address}</p>
                  <a
                    className="plan-detail-google-link"
                    href={getGooglePlaceUrl(place)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Photos &amp; reviews on Google ↗
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => openInNewTab(getDirectionsUrl(place))}
                >
                  Directions
                </button>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default PlanDetail;
