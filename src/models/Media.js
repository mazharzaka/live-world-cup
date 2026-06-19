const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: false,
  },
  url: {
    type: String,
    required: true,
    unique: true, // we use the target movie page URL as a unique key forupsert
  },
  poster: {
    type: String,
  },
  streamUrl: {
    type: String,
  },
  type: {
    type: String, // 'hls', 'direct', 'iframe', etc.
  },
  platform: {
    type: String, // e.g., 'topcinema', 'arabsid', 'google', etc.
  },
  category: {
    type: String, // 'arabicMovies', 'englishMovies', 'arabicSeries', 'englishSeries'
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("Media", MediaSchema);
