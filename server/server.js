const express = require("express");
const cors = require("cors");

const travelRoutes = require("./routes/travel");
const adminRoutes = require("./routes/admin");
const weatherRoutes = require("./routes/weather");

const app = express();

const PORT = Number(process.env.PORT) || 8080;

/*
 * =========================================================
 * MIDDLEWARE
 * =========================================================
 */

const allowedOrigins = [
  process.env.CLIENT_ORIGIN || "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  })
);

app.use(express.json({ limit: "200kb" }));


/*
 * =========================================================
 * HOME / SERVER TEST
 * =========================================================
 */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MoodMate server is running",
  });
});


/*
 * =========================================================
 * TRAVEL ROUTES
 * =========================================================
 *
 * Includes:
 *
 * GET  /api/travel/geocode
 * GET  /api/travel/reverse-geocode
 * POST  /api/travel/calculate
 *
 * =========================================================
 */

app.use(
  "/api/travel",
  travelRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/weather",
  weatherRoutes
);


/*
 * =========================================================
 * START SERVER
 * =========================================================
 */

const server = app.listen(PORT, () => {
  console.log(
    `MoodMate server running on http://localhost:${PORT}`
  );
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other process, or open http://localhost:${PORT}/ — the API may already be running.`
    );
  } else {
    console.error("Failed to start MoodMate server:", error.message);
  }
  process.exit(1);
});
