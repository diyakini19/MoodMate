const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The travel server returned an invalid response.");
    }
  }

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed with status ${response.status}.`
    );
  }

  return data;
}

export const travelApi = {
  geocode(place) {
    return request(
      `/api/travel/geocode?place=${encodeURIComponent(place)}`
    );
  },

  reverseGeocode(lat, lng) {
    return request(
      `/api/travel/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );
  },

  calculate(payload) {
    return request("/api/travel/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  publicTransport(payload) {
    return request("/api/travel/public-transport", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  places(payload) {
    return request("/api/travel/places", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  moodPlaces(payload) {
    return request("/api/travel/mood-places", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  weather(lat, lng) {
    return request(
      `/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );
  },
};

export const adminApi = {
  createUser(idToken, payload) {
    return request("/api/admin/create-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
  },

  resetPassword(idToken, { uid, newPassword }) {
    return request("/api/admin/reset-password", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid, newPassword }),
    });
  },

  setStatus(idToken, { uid, status }) {
    return request("/api/admin/set-status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid, status }),
    });
  },
};
