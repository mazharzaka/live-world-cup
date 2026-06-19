const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "mycima_full.html"), "utf8");

// Let's find matches for play.php or watch.php or any video link
const regex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
let match;
const items = [];

while ((match = regex.exec(html)) !== null) {
  const href = match[1];
  const innerHtml = match[2];
  
  if (href.includes("play.php") || href.includes("watch.php")) {
    items.push({ href, innerHtml });
  }
}

console.log(`Found ${items.length} links with play.php/watch.php`);
console.log("Showing first 10 examples:");
items.slice(0, 10).forEach((item, index) => {
  console.log(`\n--- Item ${index + 1} ---`);
  console.log(`Link: ${item.href}`);
  console.log(`HTML: ${item.innerHtml.trim().substring(0, 500)}`);
});
