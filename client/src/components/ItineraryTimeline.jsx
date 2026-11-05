import { formatCategory, formatTime } from "../services/itineraryPlanner";
import { PlaceLinks } from "./SmartItinerary";

function isValidDate(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function ItineraryTimeline({ itinerary }) {
  const stops = Array.isArray(itinerary?.stops)
    ? itinerary.stops.filter((stop) => stop?.name)
    : [];

  if (!stops.length) {
    return null;
  }

  return (
    <ol className="smart-itinerary-stops">
      {stops.map((stop, index) => (
        <li
          key={`${stop.kind || "stop"}-${index}`}
          className={`itinerary-stop kind-${stop.kind || "nearby"}`}
        >
          <span className="itinerary-stop-number">{index + 1}</span>

          <div className="itinerary-stop-body">
            {isValidDate(stop.startsAt) && isValidDate(stop.endsAt) && (
              <span className="itinerary-stop-time">
                {formatTime(new Date(stop.startsAt))} –{" "}
                {formatTime(new Date(stop.endsAt))}
              </span>
            )}
            {stop.label && (
              <span className="itinerary-stop-label">{stop.label}</span>
            )}
            <strong>{stop.name}</strong>
            <p>
              {[
                stop.category ? formatCategory(stop.category) : "",
                stop.distanceKm
                  ? `${Number(stop.distanceKm).toFixed(1)} km away`
                  : "",
                stop.address,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <PlaceLinks place={stop} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default ItineraryTimeline;
