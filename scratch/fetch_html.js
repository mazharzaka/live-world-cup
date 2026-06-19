const https = require("https");

const url = "https://vid.mycima.cc/categories-cimawbas.php?cat=5-cimawbas-aflam-3arby";
console.log("Fetching " + url);

https.get(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  }
}, (res) => {
  console.log("Status Code:", res.statusCode);
  console.log("Headers:", res.headers);
  
  let data = "";
  res.on("data", (chunk) => {
    if (data.length < 5000) {
      data += chunk;
    }
  });
  
  res.on("end", () => {
    console.log("Response (first 1000 chars):");
    console.log(data.substring(0, 1000));
  });
}).on("error", (err) => {
  console.error("Error:", err.message);
});
