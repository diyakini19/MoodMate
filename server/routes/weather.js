const express = require("express");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "Valid lat and lng are required.",
      });
    }

    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lng)}` +
      "&current=temperature_2m,weather_code,wind_speed_10m" +
      "&timezone=auto";

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: "Unable to fetch weather right now.",
      });
    }

    const current = data.current || {};
    const code = Number(current.weather_code);
    const summary = weatherCodeToLabel(code);

    return res.json({
      success: true,
      weather: {
        temperatureC:
          current.temperature_2m != null
            ? Number(current.temperature_2m)
            : null,
        windKph:
          current.wind_speed_10m != null
            ? Number(current.wind_speed_10m)
            : null,
        code,
        summary,
        label: summary,
      },
    });
  } catch (error) {
    console.error("Weather error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Weather request failed.",
    });
  }
});

function weatherCodeToLabel(code) {
  if (code === 0) return "Clear sky";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Mixed conditions";
}

module.exports = router;
