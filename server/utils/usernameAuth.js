const USERNAME_AUTH_DOMAIN = "users.moodmate.app";

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isValidUsername(username) {
  const value = normalizeUsername(username);
  return /^[a-z0-9_]{3,24}$/.test(value);
}

function usernameToAuthEmail(username) {
  const value = normalizeUsername(username);
  return `${value}@${USERNAME_AUTH_DOMAIN}`;
}

function normalizeRole(role) {
  const value = String(role || "user")
    .trim()
    .toLowerCase();

  if (value === "admin" || value === "administrator") {
    return "admin";
  }

  if (value === "moderator" || value === "mod" || value === "mods") {
    return "moderator";
  }

  return "user";
}

module.exports = {
  USERNAME_AUTH_DOMAIN,
  normalizeUsername,
  isValidUsername,
  usernameToAuthEmail,
  normalizeRole,
};
