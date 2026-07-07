// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const connectDB = require("./src/config/db");
const matchRoutes = require("./src/routes/matchRoutes");
const mediaRoutes = require("./src/routes/mediaRoutes");
const {
  initializeStartup,
  runHourlyCronJob,
  masterSniffer,
} = require("./src/services/scraperService");

const app = express();
app.use(cors());

// Register API Routes
app.use(matchRoutes);
app.use(mediaRoutes);

// Start Express server immediately and bind to the PORT to avoid 502 Bad Gateway on Render
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(
    `🚀 Slayer Scraper Running on Port ${PORT} (Initializing DB connection in background...)`,
  );
});

// Handle the background DB connection results when they resolve
connectDB()
  .then(async () => {
    await initializeStartup();

    // Schedule initial matches scraping after 45 seconds to avoid high RAM/CPU on boot
    setTimeout(() => {
      console.log(
        "⏰ [Startup Background] Starting initial matches scraping (masterSniffer) now...",
      );
      masterSniffer().catch((err) =>
        console.error("Error in initial masterSniffer:", err),
      );

      // Repeat the process every 15 minutes
      setInterval(masterSniffer, 15 * 60 * 1000);
    }, 45000);

    // Hourly Cron Job using node-cron (0 * * * * = every hour)
    cron.schedule("0 * * * *", async () => {
      console.log(
        "⏰ [Cron] Starting hourly movie scraping and stream sniffing job...",
      );
      try {
        await runHourlyCronJob();
      } catch (err) {
        console.error("❌ [Cron] Error in hourly movie job:", err.message);
      }
    });
  })
  .catch((err) => {
    console.error(
      "❌ MongoDB Connection Error on startup:",
      err.message || err,
    );
    console.log("⚠️ Starting server in Fallback Mode (No DB connection)...");
    initializeStartup();
  });
