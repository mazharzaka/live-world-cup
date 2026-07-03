const express = require("express");
const router = express.Router();
const matchController = require("../controllers/matchController");

router.get("/api/schedule", matchController.getSchedule);

module.exports = router;
