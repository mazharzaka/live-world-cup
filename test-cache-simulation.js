const http = require("http");

const url = "http://localhost:3001/api/stream?url=https%3A%2F%2Fwww.yallashoot.video%2Fvideo%2Fcanada-vs-bosnia-and-herzegovina-live-stream-12-6-2026%2F&alts=https%3A%2F%2Fwww.lkora.live%2Fmatches%2Fknda-vs-bosna%2F";

console.log("Simulating first request (browser probe)...");
const req1 = http.get(url, (res) => {
  console.log("Req 1: Status:", res.statusCode);
  
  // Abort after receiving first chunk of data or after 1 second
  res.on("data", (chunk) => {
    console.log(`Req 1: Received ${chunk.length} bytes. Aborting connection...`);
    req1.destroy();
    
    // Now trigger the second request immediately!
    setTimeout(makeSecondRequest, 500);
  });
});

req1.on("error", (err) => {
  console.log("Req 1 error (expected on destroy):", err.message);
});

function makeSecondRequest() {
  console.log("\nSimulating second request (playback)...");
  const startTime = Date.now();
  
  const req2 = http.get(url, (res) => {
    console.log("Req 2: Status:", res.statusCode, `(Response received in ${Date.now() - startTime}ms)`);
    console.log("Req 2: Headers:", res.headers);
    
    let bytes = 0;
    res.on("data", (chunk) => {
      bytes += chunk.length;
      console.log(`Req 2: Received ${chunk.length} bytes (Total: ${bytes})`);
      if (bytes > 100000) {
        console.log("Req 2: Success! Aborting second request.");
        req2.destroy();
        process.exit(0);
      }
    });
  });
  
  req2.on("error", (err) => {
    console.log("Req 2 error:", err.message);
  });
}
