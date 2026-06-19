const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "mycima_full.html"), "utf8");
const target = "vid=81706cc64";
const index = html.indexOf(target);

if (index !== -1) {
  console.log("Found at index", index);
  const start = Math.max(0, index - 500);
  const end = Math.min(html.length, index + 2500);
  console.log(html.substring(start, end));
} else {
  console.log("Not found");
}
