const { state } = require("../services/scraperService");

const getSchedule = (req, res) => {
  try {
    return res.json(state.scrapedMatches);
  } catch (err) {
    console.error("❌ Error in getSchedule:", err.message);
    return res.status(500).json({ error: "Failed to fetch matches schedule" });
  }
};

module.exports = {
  getSchedule,
};
