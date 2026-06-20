const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const startMarker = '\r\n\r\n\r\n    const results = [];\r\n    const topCinemaUrl';
const endMarker = '\r\n\r\n// Endpoint للأفلام';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

console.log('Start at:', startIdx, 'End at:', endIdx);
if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found!');
  process.exit(1);
}

const newSearchRoute = `

app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Search query required" });

  const q = query.toLowerCase().trim();
  console.log("[Search API] Query:", q);

  // Layer 1: Search in-memory scraped data (instant)
  const localResults = [];
  const allCats = ["englishMovies", "arabicMovies", "englishSeries", "arabicSeries"];
  for (const cat of allCats) {
    if (scrapedData[cat] && scrapedData[cat].length > 0) {
      for (const item of scrapedData[cat]) {
        if (item.title && item.title.toLowerCase().includes(q)) {
          if (!localResults.some((r) => r.targetUrl === item.targetUrl))
            localResults.push({ ...item, _source: "memory" });
        }
      }
    }
  }
  if (localResults.length > 0) {
    console.log("[Search API] Found", localResults.length, "results from memory");
    return res.json(localResults);
  }

  // Layer 2: Search MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      const dbItems = await Media.find({ title: { $regex: q, $options: "i" } }).limit(50);
      if (dbItems && dbItems.length > 0) {
        console.log("[Search API] Found", dbItems.length, "results from MongoDB");
        return res.json(dbItems.map((item) => ({
          id: item._id.toString(), title: item.title,
          poster: item.poster, targetUrl: item.url, _source: "db",
        })));
      }
    } catch (dbErr) { console.error("[Search API] DB error:", dbErr.message); }
  }

  // Layer 3: Puppeteer fallback
  console.log("[Search API] Falling back to Puppeteer...");
  let browser;
  try {
    browser = await launchBrowser();
    const results = [];
    const tasks = [
      { url: "https://web.topcinemaa.com/search/?query=" + encodeURIComponent(query) + "&type=all", source: "topcinema", key: "englishMovies" },
      { url: "https://vid.mycima.cc/search.php?keywords=" + encodeURIComponent(query) + "&video-id=", source: "mycima", key: "arabicMovies" },
    ];
    await Promise.all(tasks.map(async (task) => {
      let page;
      try {
        page = await browser.newPage();
        await configurePage(page);
        await blockPageResources(page);
        try {
          await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 60000 });
          console.log("[Search] Loaded", task.source, await page.title());
        } catch (e) { console.log("[Search] Timeout for", task.source); }
        await page.evaluate(async () => {
          for (let i = 0; i < 3; i++) { window.scrollBy(0, 600); await new Promise(r => setTimeout(r, 300)); }
        });
        const extracted = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('.Small--Box, [class*="movie"], [class*="card"], article').forEach((card) => {
            const a = card.tagName === "A" ? card : card.querySelector("a");
            const href = a && a.href;
            if (!href || !href.startsWith("http")) return;
            const img = card.querySelector("img");
            const poster = img && (img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.src);
            if (!poster || poster.includes("logo") || poster.includes("blank")) return;
            const titleEl = card.querySelector("h3") || card.querySelector(".title");
            const title = titleEl ? titleEl.innerText.trim() : (img && img.alt ? img.alt : "");
            if (title && title.length > 2 && !items.some(i => i.link === href))
              items.push({ title, poster, link: href });
          });
          return items;
        });
        extracted.forEach((item) => {
          const cleanTitle = item.title.replace(/\u0645\u0634\u0627\u0647\u062f\u0629|\u0641\u064a\u0644\u0645|\u0645\u0633\u0644\u0633\u0644|\u0645\u062a\u0631\u062c\u0645|\u0627\u0648\u0646 \u0644\u0627\u064a\u0646/g, "").trim();
          const targetLink = item.link.includes("mycima") ? item.link.replace("watch.php", "play.php") : item.link;
          if (!results.some(r => r.targetUrl === targetLink))
            results.push({ id: task.key + "-" + Math.random().toString(36).substr(2, 5), title: cleanTitle, poster: item.poster, targetUrl: targetLink });
        });
      } catch (err) { console.error("[Search API] Error on", task.source, err.message); }
      finally { if (page) { try { await page.close(); } catch (e) {} } }
    }));
    res.json(results);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: "Search failed: " + err.message });
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
  }
})`;

const newContent = content.substring(0, startIdx) + newSearchRoute + content.substring(endIdx);
fs.writeFileSync('server.js', newContent, 'utf8');
console.log('File repaired! New length:', newContent.length);
