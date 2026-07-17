const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../src/config/db");
const { runHourlyCronJob } = require("../src/services/scraperService");

async function test() {
  console.log("Connecting to database...");
  await connectDB();
  console.log("Database connected. Starting runHourlyCronJob...");
  
  try {
    await runHourlyCronJob();
    console.log("Cron job completed successfully!");
  } catch (err) {
    console.error("Error running runHourlyCronJob:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Database disconnected.");
  }
}

test().catch(console.error);
