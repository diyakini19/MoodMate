const USERNAME_AUTH_DOMAIN = "users.moodmate.app";

export function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function isValidUsername(username) {
  const value = normalizeUsername(username);
  return /^[a-z0-9_]{3,24}$/.test(value);
}

export function usernameToAuthEmail(username) {
  const value = normalizeUsername(username);
  return `${value}@${USERNAME_AUTH_DOMAIN}`;
}

export function suggestUsernameFromIdentity({ email = "", displayName = "" }) {
  const fromEmail = String(email).split("@")[0] || "";
  const fromName = String(displayName).replace(/\s+/g, "_");

  let base = normalizeUsername(fromEmail || fromName || "user");
  base = base.replace(/[^a-z0-9_]/g, "");

  if (base.length < 3) {
    base = `user_${base}`.slice(0, 24);
  }

  if (base.length < 3) {
    base = `user_${Date.now().toString().slice(-6)}`;
  }

  return base.slice(0, 24);
}

export function looksLikeEmail(value) {
  return String(value || "").includes("@");
}
