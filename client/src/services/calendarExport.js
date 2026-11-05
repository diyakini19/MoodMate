function pad(value) {
  return String(value).padStart(2, "0");
}

function toIcsDate(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcs(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatStopTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getItineraryStops(plan) {
  const stops = plan?.itinerary?.stops;
  return Array.isArray(stops) ? stops.filter((stop) => stop?.name) : [];
}

export function getPlanEventDetails(plan, when = new Date()) {
  const stops = getItineraryStops(plan);
  const place =
    stops[0] ||
    (Array.isArray(plan?.places) && plan.places[0]) ||
    null;
  const title = plan?.mood
    ? `MoodMate: ${plan.mood} hangout`
    : "MoodMate hangout";
  const location =
    place?.address ||
    place?.name ||
    plan?.midpoint?.name ||
    "Meeting point";
  const itineraryLines = stops.map((stop, index) => {
    const time = validDate(stop.startsAt)
      ? `${formatStopTime(stop.startsAt)} `
      : "";
    return `${index + 1}. ${time}${stop.label ? `${stop.label}: ` : ""}${stop.name}`;
  });
  const description = [
    plan?.mood ? `Mood: ${plan.mood}` : "",
    plan?.midpoint?.name ? `Midpoint: ${plan.midpoint.name}` : "",
    !stops.length && place?.name ? `Place: ${place.name}` : "",
    plan?.budget ? `Budget: ₹${plan.budget} / person` : "",
    itineraryLines.length ? `\nItinerary:\n${itineraryLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const itineraryStart = validDate(stops[0]?.startsAt);
  const itineraryEnd = validDate(stops[stops.length - 1]?.endsAt);

  let start;
  let end;

  if (itineraryStart && itineraryEnd && itineraryEnd > itineraryStart) {
    start = itineraryStart;
    end = itineraryEnd;
  } else {
    start = new Date(when);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 2);

    end = new Date(start);
    end.setHours(end.getHours() + 2);
  }

  return {
    title,
    location,
    description,
    start,
    end,
    place,
  };
}

export function buildGoogleCalendarUrl(plan, when) {
  const event = getPlanEventDetails(plan, when);
  const dates = `${toIcsDate(event.start)}/${toIcsDate(event.end)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    details: event.description,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadPlanIcs(plan, when) {
  const event = getPlanEventDetails(plan, when);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MoodMate//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:moodmate-${Date.now()}@moodmate.app`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(event.start)}`,
    `DTEND:${toIcsDate(event.end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    `LOCATION:${escapeIcs(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "moodmate-plan.ics";
  anchor.click();
  URL.revokeObjectURL(url);
}
