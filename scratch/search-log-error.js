const fs = require("fs");
const logPath = "C:\\Users\\mazharm\\.gemini\\antigravity\\brain\\1fb934bd-cda4-4827-9c59-c1073451e385\\.system_generated\\tasks\\task-307.log";

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, "utf8");
  const lines = content.split("\n");
  console.log("Searching for stream api request or errors...");
  lines.forEach((line, index) => {
    if (line.includes("/api/media/stream") || line.includes("Error") || line.includes("Error:") || line.includes("err") || line.includes("Exception") || line.includes("fail") || line.includes("Sniffer")) {
      console.log(`${index + 1}: ${line}`);
    }
  });
} else {
  console.log("Log file does not exist.");
}
