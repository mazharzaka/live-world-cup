const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// Fix the corruption: "res.json(scrapedData.e  // Layer 3: Puppeteer fallback"
// This is in the /api/series/english endpoint which got merged with search route

const brokenPart = 'res.json(scrapedData.e  // Layer 3: Puppeteer fallback';

// Find it
const brokenIdx = content.indexOf(brokenPart);
if (brokenIdx === -1) { console.log('Broken pattern not found!'); process.exit(1); }
console.log('Found corruption at index:', brokenIdx);

// The text around it should be:
// ...res.json(scrapedData.e  // Layer 3: Puppeteer fallback\n  console.log...
// up to the closing of the search route: });

// Find the closing of the messed-up search route - look for the ref.startsWith pattern
const trailingJunk = '});\r\nref.startsWith';
const trailingIdx = content.indexOf(trailingJunk, brokenIdx);

if (trailingIdx === -1) {
  // Try another approach - find end of the orphaned code
  console.log('Trailing junk not found, trying alternative...');
  
  // Look for the Endpoint للأفلام marker
  const endMarker = '\r\n\r\n// Endpoint للأفلام';
  const endIdx = content.indexOf(endMarker, brokenIdx);
  console.log('End marker at:', endIdx);
  
  const newSearchRoute = `res.json(scrapedData.englishSeries);
});

app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Search query required" });

  const q = query.toLowerCase().trim();
  console.log("[Search API] Query:", q);

  // Layer 1: In-memory
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
    console.log("[Search API] Layer1:", localResults.length, "from memory");
    return res.json(localResults);
  }

  // Layer 2: MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      const dbItems = await Media.find({ title: { $regex: q, $options: "i" } }).limit(50);
      if (dbItems && dbItems.length > 0) {
        console.log("[Search API] Layer2:", dbItems.length, "from MongoDB");
        return res.json(dbItems.map((item) => ({
          id: item._id.toString(), title: item.title,
          poster: item.poster, targetUrl: item.url, _source: "db",
        })));
      }
    } catch (dbErr) { console.error("[Search API] DB error:", dbErr.message); }
  }

  // Layer 3: Puppeteer
  console.log("[Search API] Layer3: Puppeteer...");
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
        try {
          await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 60000 });
          console.log("[Search] Loaded", task.source, await page.title());
        } catch (e) { console.log("[Search] Timeout:", task.source); }
        await new Promise(r => setTimeout(r, 2000));
        await page.evaluate(async () => {
          for (let i = 0; i < 3; i++) { window.scrollBy(0, 600); await new Promise(r => setTimeout(r, 400)); }
        });
        const extracted = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('.Small--Box, .pm-video-thumb, [class*="movie"], [class*="card"], article').forEach((card) => {
            const a = card.tagName === "A" ? card : card.querySelector("a");
            const href = a && a.href;
            if (!href || !href.startsWith("http")) return;
            const img = card.querySelector("img");
            let poster = img && (img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-echo") || img.src);
            if (!poster || poster.includes("logo") || poster.includes("blank")) {
              const bg = card.querySelector('[style*="background-image"]');
              if (bg) { const m = (bg.getAttribute("style")||"").match(/url\(['"]?(.*?)['"]?\)/); if (m&&m[1]) poster=m[1]; }
            }
            if (!poster) return;
            const titleEl = card.querySelector("h3") || card.querySelector(".title");
            const title = titleEl ? titleEl.innerText.trim() : (img && img.alt ? img.alt.trim() : "");
            if (title && title.length > 2 && !items.some(i => i.link === href))
              items.push({ title, poster, link: href });
          });
          return items;
        });
        console.log("[Search] Extracted", extracted.length, "from", task.source);
        extracted.forEach((item) => {
          const cleanTitle = item.title.replace(/\u0645\u0634\u0627\u0647\u062f\u0629|\u0641\u064a\u0644\u0645|\u0645\u0633\u0644\u0633\u0644|\u0645\u062a\u0631\u062c\u0645|\u0627\u0648\u0646 \u0644\u0627\u064a\u0646/g, "").trim();
          const targetLink = item.link.includes("mycima") ? item.link.replace("watch.php","play.php") : item.link;
          if (!results.some(r => r.targetUrl === targetLink))
            results.push({ id: task.key+"-"+Math.random().toString(36).substr(2,5), title: cleanTitle, poster: item.poster, targetUrl: targetLink });
        });
      } catch (err) { console.error("[Search] Error:", task.source, err.message); }
      finally { if (page) { try { await page.close(); } catch(e){} } }
    }));
    res.json(results);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: "Search failed: " + err.message });
  } finally {
    if (browser) { try { await browser.close(); } catch(e){} }
  }
})`;

  const newContent = content.substring(0, brokenIdx) + newSearchRoute + content.substring(endIdx);
  fs.writeFileSync('server.js', newContent, 'utf8');
  console.log('Fixed! New size:', newContent.length);
} else {
  // Found trailing junk
  const endOfJunk = content.indexOf('\r\n\r\n// Endpoint للأفلام', trailingIdx);
  console.log('Trailing junk end:', endOfJunk);
}
