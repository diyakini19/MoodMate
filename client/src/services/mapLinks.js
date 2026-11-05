function hasCoordinates(place) {
  return (
    place?.lat != null &&
    place?.lng != null &&
    Number.isFinite(Number(place.lat)) &&
    Number.isFinite(Number(place.lng))
  );
}

// OpenStreetMap addresses include municipal labels ("K/W Ward", "Mumbai Zone 3",
// postcodes) that make Google's search less likely to land on the place itself.
const ADMIN_ADDRESS_PART =
  /\b(ward|zone|district|taluka|tehsil|division|subdivision)\b|^\d{5,6}$|^india$/i;

/*
 * Name plus the first few address parts is usually enough for Google to open
 * the place's own page (photos, rating, reviews) instead of a bare pin.
 */
export function getGooglePlaceUrl(place) {
  const name = String(place?.name || "").trim();
  const addressParts = String(place?.address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        part.toLowerCase() !== name.toLowerCase() &&
        !ADMIN_ADDRESS_PART.test(part)
    )
    .slice(0, 3);

  const query = [name, ...addressParts].filter(Boolean).join(", ");

  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  if (hasCoordinates(place)) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }

  return "";
}

export function getDirectionsUrl(place) {
  if (hasCoordinates(place)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  }

  const query = [place?.name, place?.address].filter(Boolean).join(", ");
  return query
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
    : "";
}

export function openInNewTab(url) {
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
