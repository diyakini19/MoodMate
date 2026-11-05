import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ItineraryTimeline from "../components/ItineraryTimeline";
import {
  getQrImageUrl,
  getSharedPlan,
  getShareUrl,
} from "../services/shareService";
import {
  getDirectionsUrl,
  getGooglePlaceUrl,
  openInNewTab,
} from "../services/mapLinks";
import {
  openWhatsAppShare,
  sharePlanWithFriends,
} from "../services/notifyShare";
import {
  buildGoogleCalendarUrl,
  downloadPlanIcs,
} from "../services/calendarExport";
import "./SharedPlan.css";

function SharedPlan() {
  const { shareId } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getSharedPlan(shareId);

        if (!data) {
          setError("This shared plan was not found.");
          return;
        }

        setPlan(data);
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to open this shared plan.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [shareId]);

  const shareUrl = getShareUrl(shareId);
  const places = Array.isArray(plan?.places) ? plan.places : [];
  const hasItinerary =
    Array.isArray(plan?.itinerary?.stops) && plan.itinerary.stops.length > 0;

  if (loading) {
    return (
      <div className="shared-plan-page app-page">
        <AppHeader showBack backTo="/" showDashboard={false} />
        <main className="shared-plan-main app-page-main">
          <p>Loading shared plan...</p>
        </main>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="shared-plan-page app-page">
        <AppHeader showBack backTo="/" showDashboard={false} />
        <main className="shared-plan-main app-page-main">
          <h1>Plan unavailable</h1>
          <p>{error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="shared-plan-page app-page">
      <AppHeader showBack backTo="/" />
      <main className="shared-plan-main app-page-main">
        <span className="shared-eyebrow">SHARED PLAN</span>
        <h1>{plan.mood ? `${plan.mood} hangout` : "MoodMate plan"}</h1>
        <p>
          Hosted by {plan.ownerName || "a friend"}.
        </p>

        <section className="shared-card">
          <p>
            <strong>Meet near:</strong> {plan.midpoint?.name || "TBD"}
          </p>
          {plan.midpoint?.weather?.summary && (
            <p>
              <strong>Weather:</strong> {plan.midpoint.weather.summary}
              {plan.midpoint.weather.temperatureC != null
                ? ` · ${Math.round(plan.midpoint.weather.temperatureC)}°C`
                : ""}
            </p>
          )}
          <p>
            <strong>People:</strong> {plan.memberCount || "—"}
          </p>
          <p>
            <strong>Budget:</strong>{" "}
            {plan.budget ? `₹${plan.budget} / person` : "Not set"}
          </p>
        </section>

        {hasItinerary && (
          <section className="shared-card">
            <h2>Itinerary</h2>
            <ItineraryTimeline itinerary={plan.itinerary} />
          </section>
        )}

        <section className="shared-card">
          <h2>Recommended places</h2>
          {places.length === 0 && <p>No places on this plan yet.</p>}
          {places.map((place) => (
            <article key={place.id || place.name} className="shared-place">
              <div>
                <strong>{place.name}</strong>
                <p>{place.address}</p>
                <a
                  className="shared-google-link"
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

        <section className="shared-card shared-tools">
          <h2>Share & calendar</h2>
          <div className="shared-tools-row">
            <button
              type="button"
              onClick={() => sharePlanWithFriends(plan, shareUrl)}
            >
              Notify friends
            </button>
            <button
              type="button"
              onClick={() => openWhatsAppShare(plan, shareUrl)}
            >
              WhatsApp
            </button>
            <button type="button" onClick={() => downloadPlanIcs(plan)}>
              Download .ics
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(
                  buildGoogleCalendarUrl(plan),
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              Google Calendar
            </button>
          </div>
          <img
            className="shared-qr"
            src={getQrImageUrl(shareUrl)}
            alt="QR code for this plan"
          />
          <p className="shared-url">{shareUrl}</p>
        </section>
      </main>
    </div>
  );
}

export default SharedPlan;
