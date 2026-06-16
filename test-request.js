const http = require("http");

const url = "http://localhost:3001/api/stream?url=https%3A%2F%2Fwww.yallashoot.video%2Fvideo%2Fcanada-vs-bosnia-and-herzegovina-live-stream-12-6-2026%2F&alts=https%3A%2F%2Fwww.lkora.live%2Fmatches%2Fknda-vs-bosna%2F";

console.log("Requesting " + url + " ...");
const req = http.get(url, (res) => {
  console.log("Response Status:", res.statusCode);
  console.log("Response Headers:", res.headers);
  
  res.on("data", (chunk) => {
    console.log(`Received ${chunk.length} bytes`);
  });
  
  res.on("end", () => {
    console.log("Response completed.");
  });
});

req.on("error", (err) => {
  console.error("Request Error:", err);
});
