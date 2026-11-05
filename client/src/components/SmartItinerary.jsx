import { useEffect, useMemo, useRef, useState } from "react";
import { travelApi } from "../services/api";
import {
  buildItinerarySkeleton,
  formatTime,
  getDefaultStartTime,
  isMovieCategory,
  toDateTimeInputValue,
} from "../services/itineraryPlanner";
import {
  getDirectionsUrl,
  getGooglePlaceUrl,
  openInNewTab,
} from "../services/mapLinks";
import "./SmartItinerary.css";

const SEARCH_RADIUS_METERS = 2000;
const OPTIONS_PER_STOP = 3;

function placeKeyOf(place) {
  return place?.id || `${place?.lat},${place?.lng}`;
}

function resultKey(placeKey, stop) {
  return `${placeKey}|${stop.id}|${stop.terms.join(",")}`;
}

function chosenOption(result, pickedId) {
  const options = result?.options || [];
  return options.find((option) => option.id === pickedId) || options[0] || null;
}

export function PlaceLinks({ place }) {
  const googleUrl = getGooglePlaceUrl(place);
  const directionsUrl = getDirectionsUrl(place);

  return (
    <div className="itinerary-links">
      {googleUrl && (
        <a href={googleUrl} target="_blank" rel="noopener noreferrer">
          Photos & reviews on Google ↗
        </a>
      )}
      {directionsUrl && (
        <button type="button" onClick={() => openInNewTab(directionsUrl)}>
          Directions
        </button>
      )}
    </div>
  );
}

function SmartItinerary({ place, onChange, onClose }) {
  const [startValue, setStartValue] = useState(() =>
    toDateTimeInputValue(getDefaultStartTime())
  );
  const [results, setResults] = useState({});
  const [picked, setPicked] = useState({});
  const requested = useRef(new Set());

  const placeKey = placeKeyOf(place);
  const isMovie = isMovieCategory(place?.searchTerm || place?.category);

  const stops = useMemo(() => {
    const start = new Date(startValue);
    if (Number.isNaN(start.getTime())) {
      return [];
    }
    return buildItinerarySkeleton(place, start);
  }, [place, startValue]);

  useEffect(() => {
    stops
      .filter((stop) => stop.kind !== "main")
      .forEach((stop) => {
        const key = resultKey(placeKey, stop);

        if (requested.current.has(key)) {
          return;
        }

        requested.current.add(key);

        travelApi
          .places({
            lat: place.lat,
            lng: place.lng,
            terms: stop.terms,
            radius: SEARCH_RADIUS_METERS,
          })
          .then((response) => {
            const options = (response.places || [])
              .filter(
                (option) =>
                  option.id !== place.id && Number(option.distance) > 0.03
              )
              .slice(0, OPTIONS_PER_STOP);

            setResults((current) => ({
              ...current,
              [key]: { status: "done", options },
            }));
          })
          .catch((error) => {
            console.error("Itinerary search error:", error);
            setResults((current) => ({
              ...current,
              [key]: { status: "error", options: [] },
            }));
          });
      });
  }, [stops, place, placeKey]);

  const retry = (stop) => {
    const key = resultKey(placeKey, stop);
    requested.current.delete(key);
    setResults((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const itinerary = useMemo(() => {
    if (stops.length === 0) {
      return null;
    }

    const serialized = stops
      .map((stop) => {
        const chosen =
          stop.kind === "main"
            ? place
            : chosenOption(results[resultKey(placeKey, stop)], picked[stop.id]);

        if (!chosen) {
          return null;
        }

        return {
          kind: stop.kind,
          label: stop.label,
          category: stop.category,
          name: chosen.name || "",
          address: chosen.address || "",
          lat: chosen.lat ?? null,
          lng: chosen.lng ?? null,
          distanceKm: stop.kind === "main" ? 0 : Number(chosen.distance) || 0,
          startsAt: stop.startsAt.toISOString(),
          endsAt: stop.endsAt.toISOString(),
        };
      })
      .filter(Boolean);

    return {
      startTime: stops[0].startsAt.toISOString(),
      stops: serialized,
    };
  }, [stops, results, picked, place, placeKey]);

  useEffect(() => {
    onChange?.(itinerary);
  }, [itinerary, onChange]);

  return (
    <section id="suggested-itinerary" className="smart-itinerary">
      <div className="smart-itinerary-head">
        <div>
          <span className="smart-itinerary-eyebrow">YOUR SMART ITINERARY</span>
          <h2>Plan around {place.name}</h2>
          <p>
            Stops are timed from when your {isMovie ? "movie" : "visit"} ends,
            with real places nearby.
          </p>
        </div>
        <button
          type="button"
          className="smart-itinerary-close"
          onClick={onClose}
          aria-label="Close itinerary"
        >
          ×
        </button>
      </div>

      <label className="smart-itinerary-time">
        <span>{isMovie ? "Movie starts at" : "Arriving at"}</span>
        <input
          type="datetime-local"
          value={startValue}
          onChange={(event) => setStartValue(event.target.value)}
        />
      </label>

      <ol className="smart-itinerary-stops">
        {stops.map((stop, index) => {
          const result = results[resultKey(placeKey, stop)];
          const selected =
            stop.kind === "main" ? place : chosenOption(result, picked[stop.id]);

          return (
            <li key={stop.id} className={`itinerary-stop kind-${stop.kind}`}>
              <div className="itinerary-stop-number">{index + 1}</div>

              <div className="itinerary-stop-body">
                <span className="itinerary-stop-time">
                  {formatTime(stop.startsAt)} – {formatTime(stop.endsAt)}
                </span>
                <span className="itinerary-stop-label">{stop.label}</span>

                {stop.kind === "main" ? (
                  <>
                    <strong>{place.name}</strong>
                    {place.address && <p>{place.address}</p>}
                    <PlaceLinks place={place} />
                  </>
                ) : !result ? (
                  <p className="itinerary-stop-status">Finding places nearby...</p>
                ) : result.status === "error" ? (
                  <p className="itinerary-stop-status">
                    Couldn't load suggestions.{" "}
                    <button type="button" onClick={() => retry(stop)}>
                      Try again
                    </button>
                  </p>
                ) : result.options.length === 0 ? (
                  <p className="itinerary-stop-status">
                    No {stop.terms.join(" or ")} found within 2 km.
                  </p>
                ) : (
                  <div className="itinerary-options">
                    {result.options.map((option) => {
                      const isSelected = selected?.id === option.id;

                      return (
                        <div
                          key={option.id}
                          className={`itinerary-option ${isSelected ? "is-selected" : ""}`}
                        >
                          <button
                            type="button"
                            className="itinerary-option-pick"
                            onClick={() =>
                              setPicked((current) => ({
                                ...current,
                                [stop.id]: option.id,
                              }))
                            }
                          >
                            <span className="itinerary-option-radio">
                              {isSelected ? "✓" : ""}
                            </span>
                            <span>
                              <strong>{option.name}</strong>
                              <small>
                                {option.distance} km away
                                {option.category ? ` · ${option.category}` : ""}
                              </small>
                            </span>
                          </button>
                          <PlaceLinks place={option} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="smart-itinerary-note">
        Times are estimates: movies take about 3 hours, meals 45–90 minutes,
        plus 15 minutes to get between stops.
      </p>
    </section>
  );
}

export default SmartItinerary;
