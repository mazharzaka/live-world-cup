const mongoose = require("mongoose");
const { spawn } = require("child_process");
const Media = require("../models/Media");
const { getFfmpegPath, launchBrowser, configurePage, blockPageResources } = require("../config/puppeteer");
const {
  state,
  fetchCategoryFromDB,
  parseSearchHTML,
  isValidMovieUrl,
  fetchSearchHTTP,
  getOrSniffStream,
  cleanMovieUrl,
} = require("../services/scraperService");

// ── Category Endpoints ──
const getArabicMovies = async (req, res) => {
  try {
    if (!state.scrapedData.arabicMovies || state.scrapedData.arabicMovies.length === 0) {
      await fetchCategoryFromDB("arabicMovies");
    }
    return res.json(state.scrapedData.arabicMovies);
  } catch (err) {
    console.error("❌ Error in getArabicMovies:", err.message);
    return res.status(500).json({ error: "Failed to fetch Arabic movies" });
  }
};

const getEnglishMovies = async (req, res) => {
  try {
    if (!state.scrapedData.englishMovies || state.scrapedData.englishMovies.length === 0) {
      await fetchCategoryFromDB("englishMovies");
    }
    return res.json(state.scrapedData.englishMovies);
  } catch (err) {
    console.error("❌ Error in getEnglishMovies:", err.message);
    return res.status(500).json({ error: "Failed to fetch English movies" });
  }
};

const getArabicSeries = async (req, res) => {
  try {
    if (!state.scrapedData.arabicSeries || state.scrapedData.arabicSeries.length === 0) {
      await fetchCategoryFromDB("arabicSeries");
    }
    return res.json(state.scrapedData.arabicSeries);
  } catch (err) {
    console.error("❌ Error in getArabicSeries:", err.message);
    return res.status(500).json({ error: "Failed to fetch Arabic series" });
  }
};

const getEnglishSeries = async (req, res) => {
  try {
    if (!state.scrapedData.englishSeries || state.scrapedData.englishSeries.length === 0) {
      await fetchCategoryFromDB("englishSeries");
    }
    return res.json(state.scrapedData.englishSeries);
  } catch (err) {
    console.error("❌ Error in getEnglishSeries:", err.message);
    return res.status(500).json({ error: "Failed to fetch English series" });
  }
};

const getMovies = (req, res) => {
  return res.json(state.scrapedMovies);
};

// ── Search Endpoint ──
const search = async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Search query required" });

  const q = query.toLowerCase().trim();
  console.log(`🔍 [Search API] Query: "${q}" (Cache bypassed/disabled)`);

  // Define active domains for search targets
  const activeDomains = {
    topcinema: "https://topcinemaa.cam",
    mycima: "https://vid.mycima.cc"
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const topDoc = await Media.findOne({ url: { $regex: "topcinema|topcinma" } }).sort({ fetchedAt: -1 });
      if (topDoc) activeDomains.topcinema = new URL(topDoc.url).origin;

      const seedDoc = await Media.findOne({ url: { $regex: "asd|arabseed" } }).sort({ fetchedAt: -1 });
      if (seedDoc) activeDomains.arabseed = new URL(seedDoc.url).origin;

      const cimaDoc = await Media.findOne({ url: { $regex: "mycima" } }).sort({ fetchedAt: -1 });
      if (cimaDoc) activeDomains.mycima = new URL(cimaDoc.url).origin;
    } catch (dbErr) {
      console.error("⚠️ [Search API] Domain retrieval error:", dbErr.message);
    }
  }

  // Language Detection: Only scrape relevant sources to save RAM and time
  const isArabic = /[\u0600-\u06FF]/.test(q);
  const tasks = [];
  
  if (isArabic) {
    tasks.push(
      {
        url: `${activeDomains.mycima}/search.php?keywords=${encodeURIComponent(query)}&video-id=`,
        source: "mycima",
        key: "arabicMovies"
      }
    );
  } else {
    tasks.push({
      url: `https://web.topcinemaa.com/search/?query=${encodeURIComponent(query)}&type=all`,
      source: "egydead",
      key: "englishMovies"
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // Layer 3: Fast HTTP Fetch Search (Instant — 0MB RAM)
  // ══════════════════════════════════════════════════════════════════
  console.log(`🔍 [Search API] Trying Fast HTTP fetch for: "${q}"...`);
  const httpResults = [];
  let httpSucceeded = false;

  for (const task of tasks) {
    try {
      console.log(`📡 [Search HTTP] Fetching ${task.source} search page: ${task.url}`);
      const html = await fetchSearchHTTP(task.url);
      
      const extracted = parseSearchHTML(html, task.key);
      console.log(`✅ [Search HTTP] Extracted ${extracted.length} movies from ${task.source}`);

      extracted.forEach((item) => {
        let cleanTitle = item.title
          .replace(/مشاهدة|فيلم|مسلسل|مترجم|اون لاين/g, "")
          .trim();
        let targetLink = item.link;
        if (targetLink.includes("mycima") && targetLink.includes("watch.php")) {
          targetLink = targetLink.replace("watch.php", "play.php");
        }
        if (!httpResults.some((r) => r.targetUrl === targetLink)) {
          const newItem = {
            id: `${task.key}-${Math.random().toString(36).substr(2, 5)}`,
            title: cleanTitle,
            poster: item.poster,
            targetUrl: targetLink,
            _source: "http_fetch",
          };
          httpResults.push(newItem);

          // Cache in DB in background
          if (mongoose.connection.readyState === 1) {
            Media.findOneAndUpdate(
              { url: targetLink },
              {
                title: cleanTitle,
                url: targetLink,
                poster: item.poster,
                category: task.key,
                fetchedAt: new Date(),
              },
              { upsert: true, new: true }
            ).catch((err) => console.error("❌ [Search HTTP] DB Cache error:", err.message));
          }
        }
      });
      httpSucceeded = true;
    } catch (err) {
      console.warn(`⚠️ [Search HTTP] Failed for ${task.source}: ${err.message}`);
    }
  }

  if (httpSucceeded && httpResults.length > 0) {
    console.log(`✅ [Search API] Return HTTP fetch results: ${httpResults.length} items`);
    return res.json(httpResults);
  }

  // ══════════════════════════════════════════════════════════════════
  // Layer 4: Puppeteer fallback (only if memory, DB, and HTTP fetches all failed)
  // ══════════════════════════════════════════════════════════════════
  console.log(`🚨 [Search API] All HTTP fetches failed/blocked. Falling back to Puppeteer...`);
  
  let browser;
  try {
    browser = await launchBrowser();
    const results = [];

    // Run scraping tasks SEQUENTIALLY to stay strictly under Render's 512MB memory limit
    for (const task of tasks) {
      let page;
      try {
        console.log(`🚀 [Search API] Starting scraping task: ${task.source}`);
        page = await browser.newPage();
        await configurePage(page);
        await blockPageResources(page);

        try {
          await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 45000 });
          console.log(`🔍 [Search API] Loaded ${task.source}: "${await page.title()}"`);
        } catch (e) {
          console.log(`⚠️ [Search API] ${task.source} timeout — trying extraction anyway: ${e.message}`);
        }

        await new Promise((r) => setTimeout(r, 1500));
        await page.evaluate(async () => {
          for (let i = 0; i < 3; i++) {
            window.scrollBy(0, 600);
            await new Promise((r) => setTimeout(r, 300));
          }
        });

        const extracted = await page.evaluate(() => {
          const items = [];
          const cards = document.querySelectorAll(
            '.Small--Box, .pm-video-thumb, .pm-li-video, .thumbnail, [class*="movie"], [class*="card"], article'
          );
          cards.forEach((card) => {
            let validAnchor = null;
            if (card.tagName === "A") {
              validAnchor = card;
            } else {
              const anchors = Array.from(card.querySelectorAll('a'));
              validAnchor = anchors.find(a => {
                const href = a.getAttribute('href') || '';
                return href && !href.startsWith('#') && !href.includes('javascript:') && !href.includes('modal-login-form');
              }) || anchors[0];
            }

            const href = validAnchor?.href;
            if (!href || !href.startsWith("http")) return;

            let posterUrl = "";
            const imgEl = card.querySelector("img");
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

            const titleEl = card.querySelector("h3") || card.querySelector(".title") || card.querySelector(".ellipsis") || card.querySelector(".pm-title-link");
            let title = titleEl ? titleEl.innerText.trim() : (imgEl && imgEl.alt ? imgEl.alt.trim() : "");
            if (!title || title.length < 2) {
              title = (validAnchor ? (validAnchor.innerText || validAnchor.textContent) : "").split('\n')[0].trim();
            }

            if (title && title.length > 2) {
              if (!items.some((i) => i.link === href)) {
                items.push({ title, poster: posterUrl, link: href });
              }
            }
          });
          return items;
        });

        console.log(`🔍 [Search API] Extracted ${extracted.length} from ${task.source}`);
        extracted.forEach((item) => {
          let targetLink = item.link;
          if (!isValidMovieUrl(targetLink)) return;

          let cleanTitle = item.title
            .replace(/مشاهدة|فيلم|مسلسل|مترجم|اون لاين/g, "")
            .trim();
          if (targetLink.includes("mycima") && targetLink.includes("watch.php")) {
            targetLink = targetLink.replace("watch.php", "play.php");
          }
          if (!results.some((r) => r.targetUrl === targetLink)) {
            const newItem = {
              id: `${task.key}-${Math.random().toString(36).substr(2, 5)}`,
              title: cleanTitle,
              poster: item.poster,
              targetUrl: targetLink,
              _source: "puppeteer",
            };
            results.push(newItem);

            if (mongoose.connection.readyState === 1) {
              Media.findOneAndUpdate(
                { url: targetLink },
                {
                  title: cleanTitle,
                  url: targetLink,
                  poster: item.poster,
                  category: task.key,
                  fetchedAt: new Date(),
                },
                { upsert: true, new: true }
              ).catch((err) => console.error("❌ [Search API] DB Cache error:", err.message));
            }
          }
        });
      } catch (err) {
        console.error(`❌ [Search API] Error on ${task.source}:`, err.message);
      } finally {
        if (page) { try { await page.close(); } catch (e) {} }
      }
    }

    return res.json(results);
  } catch (err) {
    console.error("Search API Error:", err);
    if (!res.headersSent) return res.status(500).json({ error: "Search failed: " + err.message });
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
  }
};

// ── Streaming API (HLS and segment proxies / FFmpeg fallback) ──
const stream = async (req, res) => {
  let targetUrl = req.query.url || req.query.targetUrl;
  if (!targetUrl) return res.status(400).send("الرابط مطلوب");

  targetUrl = cleanMovieUrl(targetUrl);
  
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    console.log(`⚠️ [Stream API] URL is invalid. Searching DB for query: "${targetUrl}"`);
    if (mongoose.connection.readyState === 1) {
      try {
        const match = await Media.findOne({
          $or: [
            { title: { $regex: targetUrl, $options: "i" } },
            { url: { $regex: targetUrl, $options: "i" } }
          ]
        }).sort({ fetchedAt: -1 });
        if (match) {
          console.log(`🎯 [Stream API] Found matching URL for stream: ${match.url}`);
          targetUrl = match.url;
        } else {
          return res.status(400).send("الرابط غير صالح ولم يتم العثور على فيلم مطابق");
        }
      } catch (e) {
        return res.status(400).send("الرابط غير صالح");
      }
    } else {
      return res.status(400).send("الرابط غير صالح");
    }
  }

  console.log(`📡 [Direct Stream] Proxying stream for: ${targetUrl}`);

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  const referer = req.query.referer || "";

  try {
    let finalStreamUrl = targetUrl;
    let finalReferer = referer;

    const isDirect = targetUrl.includes(".m3u8") || 
                     targetUrl.includes(".mp4") || 
                     targetUrl.includes(".ts") || 
                     targetUrl.includes(".image") || 
                     targetUrl.includes("urlset") || 
                     targetUrl.includes("segment") || 
                     targetUrl.includes("chunk") || 
                     req.query.referer;

    if (!isDirect) {
      const result = await getOrSniffStream(targetUrl);
      if (result && result.streamUrl) {
        finalStreamUrl = result.streamUrl;
        finalReferer = result.referer || referer;
      } else {
        return res.status(404).send("لم يتم العثور على إشارة بث حالية");
      }
    }

    const parsedUrl = new URL(finalStreamUrl);
    const isM3u8 = parsedUrl.pathname.endsWith(".m3u8") || finalStreamUrl.includes("urlset") || finalStreamUrl.includes(".m3u8");

    const fetchHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    };
    if (finalReferer) {
      fetchHeaders["Referer"] = finalReferer;
    }

    if (isM3u8) {
      console.log(`📡 [HLS Proxy] Fetching and parsing playlist: ${finalStreamUrl}`);
      const response = await fetch(finalStreamUrl, { headers: fetchHeaders });
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch playlist: ${response.statusText}`);
      }
      
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        let processedLine = line;
        
        if (processedLine.startsWith("#")) {
          if (processedLine.includes("URI=")) {
            processedLine = processedLine.replace(/URI="([^"]+)"/g, (match, urlValue) => {
              let absoluteUrl = urlValue;
              try {
                absoluteUrl = new URL(urlValue, finalStreamUrl).href;
              } catch (e) {}
              
              const host = req.headers.host;
              const protocol = req.secure ? "https" : "http";
              const proxiedUrl = `${protocol}://${host}/api/stream?url=${encodeURIComponent(absoluteUrl)}${finalReferer ? `&referer=${encodeURIComponent(finalReferer)}` : ""}`;
              return `URI="${proxiedUrl}"`;
            });
          }
          return processedLine;
        }
        
        let absoluteUrl = trimmed;
        try {
          absoluteUrl = new URL(trimmed, finalStreamUrl).href;
        } catch (e) {}

        const host = req.headers.host;
        const protocol = req.secure ? "https" : "http";
        return `${protocol}://${host}/api/stream?url=${encodeURIComponent(absoluteUrl)}${finalReferer ? `&referer=${encodeURIComponent(finalReferer)}` : ""}`;
      });

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.send(rewrittenLines.join("\n"));
    } else {
      const response = await fetch(finalStreamUrl, { headers: fetchHeaders });
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch segment: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const contentLengthStr = response.headers.get("content-length");
      const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;

      const isSegment = finalStreamUrl.includes(".ts") || finalStreamUrl.includes(".image") || finalStreamUrl.includes("segment") || contentLength < 15 * 1024 * 1024;

      if (!isSegment) {
        console.log(`📡 [Segment Proxy] Piping large file directly (${contentLengthStr} bytes)`);
        res.setHeader("Content-Type", contentType);
        if (contentLengthStr) res.setHeader("Content-Length", contentLengthStr);
        
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);

      if (buffer.length > 8 && buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a") {
        const tsOffset = buffer.indexOf(0x47, 8);
        if (tsOffset !== -1) {
          buffer = buffer.slice(tsOffset);
        }
      }

      res.setHeader("Content-Type", contentType || "video/mp2t");
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    }
  } catch (err) {
    console.error(`❌ Error in /api/stream proxy:`, err.stack || err.message);
    if (!res.headersSent) {
      return res.status(500).send("حدث خطأ أثناء قنص البث");
    }
  }
};

// ── Stream JSON Metadata Endpoint for Frontend iframe ──
const mediaStream = async (req, res) => {
  let targetUrl = req.query.targetUrl || req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "الرابط مطلوب" });

  targetUrl = cleanMovieUrl(targetUrl);

  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    console.log(`⚠️ [Media Stream API] URL is invalid. Searching DB for query: "${targetUrl}"`);
    if (mongoose.connection.readyState === 1) {
      try {
        const match = await Media.findOne({
          $or: [
            { title: { $regex: targetUrl, $options: "i" } },
            { url: { $regex: targetUrl, $options: "i" } }
          ]
        }).sort({ fetchedAt: -1 });
        if (match) {
          console.log(`🎯 [Media Stream API] Found matching URL for movie: ${match.url}`);
          targetUrl = match.url;
        } else {
          return res.status(400).json({ error: "الرابط غير صالح ولم يتم العثور على نتائج بحث مطابقة له" });
        }
      } catch (e) {
        return res.status(400).json({ error: "الرابط غير صالح" });
      }
    } else {
      return res.status(400).json({ error: "الرابط غير صالح" });
    }
  }

  const bypassCache = req.query.bypassCache === "true" || req.query.refresh === "true";
  console.log(`🎬 [Media Stream API] Request for: ${targetUrl} (bypassCache: ${bypassCache})`);

  try {
    const cached = await Media.findOne({ url: targetUrl });
    console.log("cached", cached);
    
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const isCachedStreamInvalid = cached && cached.streamUrl && (cached.streamUrl.includes("youtube.com") || cached.streamUrl.includes("youtu.be"));
    
    if (!bypassCache && cached && cached.streamUrl && cached.fetchedAt && cached.fetchedAt > oneHourAgo && !isCachedStreamInvalid) {
      console.log(
        `⚡ [Cache Hit - DB] Found fresh stream in database for: ${targetUrl}`,
      );
      
      let finalUrl = cached.streamUrl;
      let finalType = cached.type;
      
      if (finalUrl.includes(".m3u8") || finalUrl.includes("urlset")) {
        console.log(`📡 [Proxy Stream Redirect] Proxying HLS stream to bypass IP/CORS lock: ${finalUrl}`);
        const protocol = req.secure ? "https" : "http";
        finalUrl = `${protocol}://${req.headers.host}/api/stream?url=${encodeURIComponent(finalUrl)}${targetUrl ? `&referer=${encodeURIComponent(targetUrl)}` : ""}`;
        finalType = "direct";
      }
      
      return res.json({ streamUrl: finalUrl, type: finalType });
    }

    console.log(
      `🔍 [Cache Miss - DB] Sniffing stream using Puppeteer for: ${targetUrl}`,
    );
    const result = await getOrSniffStream(targetUrl);

    if (result && result.streamUrl) {
      Media.findOneAndUpdate(
        { url: targetUrl },
        {
          url: targetUrl,
          streamUrl: result.streamUrl,
          type: result.type,
          fetchedAt: new Date(),
        },
        { upsert: true, new: true },
      ).catch((err) =>
        console.error(
          "❌ Failed to update DB on fallback stream sniff:",
          err.message,
        ),
      );

      let finalUrl = result.streamUrl;
      let finalType = result.type;
      
      if (finalUrl.includes(".m3u8") || finalUrl.includes("urlset")) {
        console.log(`📡 [Proxy Stream Redirect] Proxying HLS stream to bypass IP/CORS lock: ${finalUrl}`);
        const protocol = req.secure ? "https" : "http";
        finalUrl = `${protocol}://${req.headers.host}/api/stream?url=${encodeURIComponent(finalUrl)}${targetUrl ? `&referer=${encodeURIComponent(targetUrl)}` : ""}`;
        finalType = "direct";
      }

      return res.json({ streamUrl: finalUrl, type: finalType });
    } else {
      return res
        .status(404)
        .json({ error: "لم يتم العثور على رابط بث نظيف حالياً" });
    }
  } catch (err) {
    console.error(`❌ Error in /api/media/stream:`, err.stack || err.message);
    return res.status(500).json({ error: "حدث خطأ أثناء قنص البث", debug: err.message, stack: err.stack });
  }
};

// ── FFmpeg direct stream logic (if client requests streaming video via custom transcode) ──
function startFfmpegStream(url, res, req, referer) {
  res.setHeader("Content-Type", "video/mp4");
  const ffmpegBin = getFfmpegPath();

  const args = [];
  if (typeof referer !== "undefined" && referer) {
    args.push(
      "-user_agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );
    args.push("-referer", referer);
  }

  args.push("-allowed_extensions", "ALL");
  args.push("-allowed_segment_extensions", "ALL");
  args.push("-extension_picky", "0");

  args.push("-i", url);
  args.push(
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-bsf:a",
    "aac_adtstoasc",
    "-movflags",
    "frag_keyframe+empty_moov",
    "-f",
    "mp4",
    "-",
  );

  console.log(`[Stream API] Spawning FFmpeg from: ${ffmpegBin}`);
  const ffmpeg = spawn(ffmpegBin, args);

  ffmpeg.on("error", (err) => {
    console.error("[Stream API] FFmpeg process error:", err);
  });

  ffmpeg.stderr.on("data", (data) => {
    // Consume stderr silently
  });

  ffmpeg.stdout.pipe(res);
  req.on("close", () => {
    console.log("[Stream API] Client connection closed, killing FFmpeg...");
    ffmpeg.kill();
  });
}

module.exports = {
  getArabicMovies,
  getEnglishMovies,
  getArabicSeries,
  getEnglishSeries,
  getMovies,
  search,
  stream,
  mediaStream,
  startFfmpegStream,
};
