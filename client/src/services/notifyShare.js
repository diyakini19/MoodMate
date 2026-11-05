export function buildPlanShareText(plan, shareUrl = "") {
  const place =
    (Array.isArray(plan?.places) && plan.places[0]) || null;
  const lines = [
    "Let's hang out with MoodMate!",
    plan?.mood ? `Mood: ${plan.mood}` : "",
    plan?.midpoint?.name ? `Meet near: ${plan.midpoint.name}` : "",
    place?.name ? `Top place: ${place.name}` : "",
    place?.address ? `Address: ${place.address}` : "",
    plan?.budget ? `Budget: ₹${plan.budget} / person` : "",
    shareUrl ? `Plan link: ${shareUrl}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

export async function sharePlanWithFriends(plan, shareUrl = "") {
  const text = buildPlanShareText(plan, shareUrl);

  if (navigator.share) {
    await navigator.share({
      title: "MoodMate plan",
      text,
      url: shareUrl || undefined,
    });
    return { method: "native" };
  }

  await copyText(text);
  return { method: "clipboard" };
}

export function openWhatsAppShare(plan, shareUrl = "") {
  const text = buildPlanShareText(plan, shareUrl);
  window.open(
    `https://wa.me/?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer"
  );
}
