const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema({
  matchId: {
    type: String,
    required: true,
    unique: true,
  },
  teamA: {
    type: String,
    required: true,
  },
  teamB: {
    type: String,
    default: "",
  },
  isLive: {
    type: Boolean,
    default: false,
  },
  time: {
    type: String,
    default: "",
  },
  targetSiteUrl: {
    type: String,
    required: true,
  },
  alternativeUrls: {
    type: [String],
    default: [],
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("Match", MatchSchema);
