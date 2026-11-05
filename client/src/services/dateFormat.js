export function formatDateTime(timestamp) {
  if (!timestamp) {
    return "—";
  }

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function toDate(timestamp) {
  if (!timestamp) {
    return null;
  }

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}
