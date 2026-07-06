const mongoose = require("mongoose");

const connectDB = () => {
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/stream-hunter";
  
  mongoose.set("bufferCommands", false); // Disable command buffering so disconnected queries fail fast instead of hanging
  
  const dbConnectPromise = mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log("🔌 Connected to MongoDB Successfully!");
    })
    .catch((err) => {
      console.error("❌ MongoDB Connection Error:", err);
      throw err;
    });
    
  return dbConnectPromise;
};

module.exports = connectDB;
