const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

// Read original server.js and change port to 3002
console.log("Reading server.js...");
let serverCode = fs.readFileSync("d:\\bit68\\live-world-cup\\server.js", "utf8");
serverCode = serverCode.replace("app.listen(3001,", "app.listen(3002,");

const tempServerPath = "d:\\bit68\\live-world-cup\\server-debug.js";
fs.writeFileSync(tempServerPath, serverCode);
console.log("Written server-debug.js on port 3002");

// Launch the server process
console.log("Starting debug server...");
const serverProc = spawn("node", [tempServerPath], {
  env: { ...process.env }
});

serverProc.stdout.on("data", (data) => {
  console.log(`[SERVER-STDOUT]: ${data.toString().trim()}`);
});

serverProc.stderr.on("data", (data) => {
  console.error(`[SERVER-STDERR]: ${data.toString().trim()}`);
});

// Wait 5 seconds for server to start, then make request
setTimeout(async () => {
  const url = "http://localhost:3002/api/stream?url=https%3A%2F%2Fwww.yallashoot.video%2Fvideo%2Fcanada-vs-bosnia-and-herzegovina-live-stream-12-6-2026%2F";
  console.log(`\nMaking first request to: ${url}`);
  
  const req1 = http.get(url, (res) => {
    console.log(`[CLIENT] Req 1 Status: ${res.statusCode}`);
    
    res.on("data", (chunk) => {
      console.log(`[CLIENT] Req 1 got ${chunk.length} bytes. Aborting...`);
      req1.destroy();
      
      // Make second request after a short delay
      setTimeout(makeSecondRequest, 1000);
    });
  });

  req1.on("error", (err) => {
    console.log(`[CLIENT] Req 1 error (expected): ${err.message}`);
  });
}, 5000);

function makeSecondRequest() {
  const url = "http://localhost:3002/api/stream?url=https%3A%2F%2Fwww.yallashoot.video%2Fvideo%2Fcanada-vs-bosnia-and-herzegovina-live-stream-12-6-2026%2F";
  console.log(`\nMaking second request to: ${url}`);
  const startTime = Date.now();
  
  const req2 = http.get(url, (res) => {
    console.log(`[CLIENT] Req 2 Status: ${res.statusCode} (Received in ${Date.now() - startTime}ms)`);
    
    let bytes = 0;
    res.on("data", (chunk) => {
      bytes += chunk.length;
      console.log(`[CLIENT] Req 2 got ${chunk.length} bytes (Total: ${bytes})`);
      if (bytes > 150000) {
        console.log("[CLIENT] Req 2 Success! Shutting down server...");
        req2.destroy();
        serverProc.kill();
        fs.unlinkSync(tempServerPath);
        process.exit(0);
      }
    });
  });

  req2.on("error", (err) => {
    console.log(`[CLIENT] Req 2 error: ${err.message}`);
    serverProc.kill();
    fs.unlinkSync(tempServerPath);
    process.exit(1);
  });
}
