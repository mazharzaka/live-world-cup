const mongoose = require("mongoose");
require("dotenv").config();

const MediaSchema = new mongoose.Schema({
  title: String,
  url: String,
  streamUrl: String,
  type: String,
  fetchedAt: Date
});

const Media = mongoose.model("Media", MediaSchema, "medias");

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("DB Connected.");
  
  // Find movies matching Goodfellas or list some movies
  const movies = await Media.find({ title: /goodfellas/i });
  console.log("Goodfellas Movies in DB:", movies);
  
  if (movies.length === 0) {
    const sample = await Media.find({}).limit(5);
    console.log("Sample Movies in DB:", sample);
  }
  
  await mongoose.disconnect();
}

check().catch(console.error);
