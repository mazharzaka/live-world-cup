// Use global fetch (Node 18+)

async function testFetch() {
  const query = "باتمان";
  // Test Mycima
  const mycimaUrl = `https://vid.mycima.cc/search.php?keywords=${encodeURIComponent(query)}&video-id=`;
  // Test Arabseed
  const arabseedUrl = `https://a.asd.ink/?s=${encodeURIComponent(query)}`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8"
  };

  try {
    console.log("Fetching MyCima search page...");
    const resMycima = await fetch(mycimaUrl, { headers, timeout: 10000 });
    console.log("MyCima Status:", resMycima.status);
    const textMycima = await resMycima.text();
    console.log("MyCima body length:", textMycima.length);
    console.log("Is Cloudflare block?", textMycima.includes("Cloudflare") || textMycima.includes("Security Check") || textMycima.includes("Just a moment"));
    console.log("Sample HTML:", textMycima.substring(0, 500));
  } catch (err) {
    console.error("MyCima fetch error:", err.message);
  }

  try {
    console.log("\nFetching Arabseed search page...");
    const resSeed = await fetch(arabseedUrl, { headers, timeout: 10000 });
    console.log("Arabseed Status:", resSeed.status);
    const textSeed = await resSeed.text();
    console.log("Arabseed body length:", textSeed.length);
    console.log("Is Cloudflare block?", textSeed.includes("Cloudflare") || textSeed.includes("Security Check") || textSeed.includes("Just a moment"));
    console.log("Sample HTML:", textSeed.substring(0, 500));
  } catch (err) {
    console.error("Arabseed fetch error:", err.message);
  }
}

testFetch();
