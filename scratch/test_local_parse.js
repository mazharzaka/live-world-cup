const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "mycima_full.html"), "utf8");

// Load jsdom or mock the evaluation.
// Since jsdom is not in package.json, we can use a basic HTML parser or mock the DOM with a simple regex/string extraction
// to simulate the page.evaluate() behavior on MyCima cards.
// In the browser, card is selected by '.Small--Box, [class*="movie"], [class*="card"]'
// Let's find thumbnail divs with class "thumbnail" and pull the watch.php links inside them.

const itemRegex = /<div class="thumbnail">([\s\S]*?)<\/div>\s*<\/div>/gi;
let match;
const extracted = [];

while ((match = itemRegex.exec(html)) !== null) {
  const itemHtml = match[1];
  
  // Find href
  const hrefMatch = itemHtml.match(/href="([^"]+watch\.php[^"]+)"/i);
  if (!hrefMatch) continue;
  const href = hrefMatch[1];
  
  // Find img and data-echo or data-src or src
  const imgMatch = itemHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
  if (!imgMatch) continue;
  const imgTag = imgMatch[0];
  
  let posterUrl = "";
  const dataEchoMatch = imgTag.match(/data-echo="([^"]+)"/i);
  const dataSrcMatch = imgTag.match(/data-src="([^"]+)"/i);
  const dataLazySrcMatch = imgTag.match(/data-lazy-src="([^"]+)"/i);
  const srcMatch = imgTag.match(/src="([^"]+)"/i);
  
  posterUrl = (dataSrcMatch && dataSrcMatch[1]) ||
              (dataLazySrcMatch && dataLazySrcMatch[1]) ||
              (dataEchoMatch && dataEchoMatch[1]) ||
              (srcMatch && srcMatch[1]);
              
  // Find title
  const titleMatch = itemHtml.match(/title="([^"]+)"/i);
  const title = titleMatch ? titleMatch[1] : "";
  
  extracted.push({
    title,
    poster: posterUrl,
    link: href
  });
}

console.log(`Locally parsed ${extracted.length} movies.`);
console.log("Showing top 10 results with their parsed posters:");
console.log(JSON.stringify(extracted.slice(0, 10), null, 2));
