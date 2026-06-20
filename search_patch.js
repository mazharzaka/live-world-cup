// NEW SEARCH ENDPOINT - replace the old one in server.js from line 805 to end of the route

app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Search query required" });

  const q = query.toLowerCase().trim();
  console.log(`🔍 [Search API] Query: "${q}"`);

  // ══════════════════════════════════════════════════════════════════
  // Layer 1: Search in-memory scraped data (instant — no Puppeteer)
  // ══════════════════════════════════════════════════════════════════
  const localResults = [];
  const allCats = ["englishMovies", "arabicMovies", "englishSeries", "arabicSeries"];
  for (const cat of allCats) {
    if (scrapedData[cat] && scrapedData[cat].length > 0) {
      for (const item of scrapedData[cat]) {
        if (item.title && item.title.toLowerCase().includes(q)) {
          if (!localResults.some((r) => r.targetUrl === item.targetUrl)) {
            localResults.push({ ...item, _source: "memory" });
          }
        }
      }
    }
  }
  if (localResults.length > 0) {
    console.log(`✅ [Search API] Found ${localResults.length} results from in-memory cache`);
    return res.json(localResults);
  }

  // ══════════════════════════════════════════════════════════════════
  // Layer 2: Search MongoDB (if memory is empty / server just started)
  // ══════════════════════════════════════════════════════════════════
  if (mongoose.connection.readyState === 1) {
    try {
      const dbItems = await Media.find({
        title: { $regex: q, $options: "i" },
      }).limit(50);
      if (dbItems && dbItems.length > 0) {
        const dbResults = dbItems.map((item) => ({
          id: item._id.toString(),
          title: item.title,
          poster: item.poster,
          targetUrl: item.url,
          _source: "db",
        }));
        console.log(`✅ [Search API] Found ${dbResults.length} results from MongoDB`);
        return res.json(dbResults);
      }
    } catch (dbErr) {
      console.error("⚠️ [Search API] DB search error:", dbErr.message);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Layer 3: Puppeteer fallback (only if memory + DB are both empty)
  // ══════════════════════════════════════════════════════════════════
  console.log(`🔍 [Search API] No local results — falling back to Puppeteer scraping...`);
  let browser;
  try {
    browser = await launchBrowser();
    const results = [];
    const topCinemaUrl = `https://web.topcinemaa.com/search/?query=${encodeURIComponent(query)}&type=all`;
    const myCimaUrl = `https://vid.mycima.cc/search.php?keywords=${encodeURIComponent(query)}&video-id=`;
    const tasks = [
      { url: topCinemaUrl, source: "topcinema", key: "englishMovies" },
      { url: myCimaUrl, source: "mycima", key: "arabicMovies" },
    ];

    await Promise.all(
      tasks.map(async (task) => {
        let page;
        try {
          page = await browser.newPage();
          await configurePage(page);
          await blockPageResources(page);

          try {
            await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 60000 });
            console.log(`🔍 [Search API] Loaded ${task.source}: ${await page.title()}`);
          } catch (e) {
            console.log(`⚠️ [Search API] ${task.source} timeout — trying extraction anyway: ${e.message}`);
          }

          await page.evaluate(async () => {
            for (let i = 0; i < 5; i++) {
              window.scrollBy(0, 600);
              await new Promise((r) => setTimeout(r, 400));
            }
          });

          const extracted = await page.evaluate(() => {
            const items = [];
            const cards = document.querySelectorAll(
              '.Small--Box, [class*="movie"], [class*="card"], .pm-video-thumb, article'
            );
            cards.forEach((card) => {
              let validAnchor =
                card.tagName === "A"
                  ? card
                  : card.querySelector('a:not([href*="#"])') || card.querySelector("a");
              let href = validAnchor?.href;
              if (!href || !href.startsWith("http")) return;

              let posterUrl = "";
              const imgEl = card.tagName === "IMG" ? card : card.querySelector("img");
              if (imgEl) {
                posterUrl =
                  imgEl.getAttribute("data-src") ||
                  imgEl.getAttribute("data-lazy-src") ||
                  imgEl.getAttribute("data-echo") ||
                  imgEl.src;
              }
              if (!posterUrl || posterUrl.includes("melody-lzld")) {
                const bgSpan = card.querySelector('[data-lazy-style], [style*="background-image"]');
                if (bgSpan) {
                  const styleStr = bgSpan.getAttribute("data-lazy-style") || bgSpan.getAttribute("style");
                  const match = styleStr?.match(/url\(['"]?(.*?)['"]?\)/);
                  if (match?.[1]) posterUrl = match[1];
                }
              }
              if (posterUrl && posterUrl.includes("melody-lzld"))
                posterUrl = "https://placehold.co/300x450/1a1a1a/FFF?text=Poster";
              if (!posterUrl || posterUrl.includes("logo") || posterUrl.includes("blank")) return;

              const titleEl = card.querySelector("h3") || card.querySelector(".title");
              const titleText = titleEl
                ? titleEl.innerText.trim()
                : (imgEl?.getAttribute("alt") || "").trim();

              if (titleText && titleText.length > 2) {
                if (!items.some((i) => i.link === href)) {
                  items.push({ title: titleText, poster: posterUrl, link: href });
                }
              }
            });
            return items;
          });

          console.log(`🔍 [Search API] Puppeteer extracted ${extracted.length} from ${task.source}`);
          extracted.forEach((item) => {
            let cleanTitle = item.title
              .replace(/مشاهدة|فيلم|مسلسل|مترجم|اون لاين/g, "")
              .trim();
            let targetLink = item.link;
            if (targetLink.includes("mycima") && targetLink.includes("watch.php"))
              targetLink = targetLink.replace("watch.php", "play.php");
            if (!results.some((r) => r.targetUrl === targetLink)) {
              results.push({
                id: `${task.key}-${Math.random().toString(36).substr(2, 5)}`,
                title: cleanTitle,
                poster: item.poster,
                targetUrl: targetLink,
                _source: "puppeteer",
              });
            }
          });
        } catch (err) {
          console.error(`❌ [Search API] Error on ${task.source}:`, err.message);
        } finally {
          if (page) { try { await page.close(); } catch (e) {} }
        }
      })
    );
    res.json(results);
  } catch (err) {
    console.error("Search API Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Search failed: " + err.message });
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
  }
});
