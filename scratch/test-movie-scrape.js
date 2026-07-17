const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../src/config/db");
const { movieSniffer, runHourlyCronJob } = require("../src/services/scraperService");

async function test() {
  console.log("Connecting to database...");
  await connectDB();
  console.log("Database connected. Starting movieSniffer...");
  
  try {
    const count = await movieSniffer();
    console.log("Scraping completed! Total items scraped:", count);
  } catch (err) {
    console.error("Error running movieSniffer:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Database disconnected.");
  }
}

test().catch(console.error);
