const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");

router.get("/api/movies/arabic", mediaController.getArabicMovies);
router.get("/api/movies/english", mediaController.getEnglishMovies);
router.get("/api/series/arabic", mediaController.getArabicSeries);
router.get("/api/series/english", mediaController.getEnglishSeries);
router.get("/api/movies", mediaController.getMovies);
router.get("/api/search", mediaController.search);
router.get("/api/stream", mediaController.stream);
router.get("/api/media/stream", mediaController.mediaStream);

module.exports = router;
