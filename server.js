// server.js
require("dotenv").config();
const mongoose = require("mongoose");
const cron = require("node-cron");
const Media = require("./src/models/Media");
const Match = require("./src/models/Match");

// Connect to MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/stream-hunter";
mongoose.set("bufferCommands", false); // Disable command buffering so disconnected queries fail fast instead of hanging
const dbConnectPromise = mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("🔌 Connected to MongoDB Successfully!");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    throw err;
  });

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const app = express();
app.use(cors());

let scrapedMatches = [];
let scrapedMovies = [];
const resolvedStreamsCache = {};

function splitMatchTitle(title) {
  let clean = title
    .replace(/مشاهدة مباراة/g, "")
    .replace(/اليوم \d{1,2}-\d{1,2}-\d{2,4}/g, "")
    .replace(/قمة ملعب.*/g, "")
    .replace(/بث مباشر/g, "")
    .trim();

  let separator = null;
  if (/[vV]s/i.test(clean)) separator = /[vV]s/i;
  else if (clean.includes(" 🆚 ")) separator = " 🆚 ";
  else if (clean.includes(" ضد ")) separator = " ضد ";
  else if (clean.includes(" و ")) separator = " و ";
  else if (clean.includes(" و")) separator = " و";

  let teamA = "فريق أ";
  let teamB = "فريق ب";

  if (separator) {
    const parts = clean.split(separator);
    teamA = parts[0] ? parts[0].trim() : "فريق أ";
    teamB = parts[1] ? parts[1].trim() : "فريق ب";

    if (teamB.startsWith("و")) {
      teamB = teamB.substring(1).trim();
    }
  } else {
    teamA = clean;
    teamB = "";
  }

  if (teamB.includes("في")) teamB = teamB.split("في")[0];
  if (teamB.includes("ضمن")) teamB = teamB.split("ضمن")[0];
  teamB = teamB.trim();

  return { teamA, teamB };
}

function areMatchesSame(m1, m2) {
  const cleanStr1 = `${m1.teamA} ${m1.teamB}`
    .replace(/ال/g, "")
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "")
    .trim();
  const cleanStr2 = `${m2.teamA} ${m2.teamB}`
    .replace(/ال/g, "")
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "")
    .trim();

  const words1 = `${m1.teamA} ${m1.teamB}`
    .toLowerCase()
    .split(/[\s🆚]+/)
    .map((w) => w.replace(/^ال/, "").trim())
    .filter((w) => w.length > 2);
  const words2 = `${m2.teamA} ${m2.teamB}`
    .toLowerCase()
    .split(/[\s🆚]+/)
    .map((w) => w.replace(/^ال/, "").trim())
    .filter((w) => w.length > 2);

  let matches = 0;
  for (const w of words1) {
    if (words2.includes(w)) matches++;
  }

  return (
    matches >= 2 ||
    (words1.length === 2 && matches >= 1) ||
    cleanStr1.includes(cleanStr2) ||
    cleanStr2.includes(cleanStr1)
  );
}

function getFfmpegPath() {
  const fs = require("fs");
  const path = require("path");
  const userProfile = process.env.USERPROFILE || "C:\\Users\\mazharm";
  const wingetPath = path.join(
    userProfile,
    "AppData",
    "Local",
    "Microsoft",
    "WinGet",
    "Packages",
    "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build",
    "bin",
    "ffmpeg.exe",
  );
  if (fs.existsSync(wingetPath)) {
    return wingetPath;
  }
  return "ffmpeg";
}
const MOVIE_TARGETS = [
  "https://wecima.show",
  "https://arabseed.show",
  "https://egybest.mx",
  "https://cima4u.vip",
  "https://movs4u.tv",
  "https://lodynet.asia",
  "https://animelek.me",
  "https://web.topcinemaa.com/",
];

// ─── Helper: Launch Puppeteer optimized for low-RAM servers (Render free tier) ───
async function launchBrowser() {
  const args = [
    // ── Security (required for containerized / sandbox-free envs) ──
    "--no-sandbox",
    "--disable-setuid-sandbox",

    // ── RAM & CPU savings ──
    '--disable-dev-shm-usage',        // use /tmp instead of /dev/shm (critical on Render)
    '--disable-gpu',                   // no GPU needed in headless
    '--disable-accelerated-2d-canvas', // remove canvas GPU layer
    '--no-zygote',                     // skip zygote process (saves ~30 MB)
    '--disable-extensions',            // no extensions
    '--disable-background-networking', // no background HTTP calls
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees,ImprovedCookieControls,LazyFrameLoading',
    '--disable-ipc-flooding-protection',
    '--disable-notifications',
    '--disable-sync',
    '--no-first-run',
    '--metrics-recording-only',
    '--mute-audio',

    // ── Network / SSL ──
    "--ignore-certificate-errors",
    "--ignore-ssl-errors=yes",

    // ── Media: disable images globally at blink level ──
    "--blink-settings=imagesEnabled=false",
  ];

  const proxyServer = process.env.PROXY_SERVER; // e.g. http://p.webshare.io:80
  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
    console.log(`📡 [Proxy] Launching browser with proxy: ${proxyServer}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args,
  });

  return browser;
}

// ─── Helper: Configure page with Cloudflare-bypass headers + timeout ───────────
async function configurePage(page) {
  // Longer timeout to tolerate slow Render cold starts & CF challenges
  await page.setDefaultNavigationTimeout(60000);

  // Full real-browser User-Agent (matches Chrome 126 on Windows)
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  );

  // Cloudflare-bypass extra headers — makes the request look like a real browser
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "sec-ch-ua":
      '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
  });

  // Proxy authentication (if configured)
  const proxyUser = process.env.PROXY_USERNAME;
  const proxyPass = process.env.PROXY_PASSWORD;
  if (proxyUser && proxyPass) {
    console.log(
      `📡 [Proxy] Authenticating proxy for page with user: ${proxyUser}`,
    );
    await page.authenticate({ username: proxyUser, password: proxyPass });
  }
}

// ─── Helper: Block heavy resources (images/CSS/fonts/media) to save RAM & speed ─
// Use this for SCRAPER pages only — NOT for the sniffer (which needs to intercept)
async function blockPageResources(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    // Block everything that isn't needed for DOM extraction
    if (
      [
        "image",
        "stylesheet",
        "font",
        "media",
        "ping",
        "manifest",
        "other",
      ].includes(type)
    ) {
      req.abort().catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });
}

async function movieSnifferOld() {
  console.log("🎬 [Movie Scraper] بدء شفط السينما الذكي (بدون كلاسات)...");
  let moviesFound = [];

  const browser = await launchBrowser();

  for (let url of MOVIE_TARGETS) {
    let page = null;
    try {
      console.log(`🎯 جاري فتح متصفح معزول للأفلام: ${url}`);
      page = await browser.newPage();
      await page.setDefaultNavigationTimeout(45000);
      await configurePage(page);
    } catch (error) {
      console.error(`❌ [${url}] خطأ في فتح الصفحة:`, error);
    }
  }
}
// server.js (إضافة كود قشط الأفلام)

// 🆕 مصفوفات منفصلة لكل تصنيف عشان الفرونت إند يستلمهم على الجاهز
let scrapedData = {
  arabicMovies: [],
  englishMovies: [],
  arabicSeries: [],
  englishSeries: [],
};
async function movieSniffer() {
  console.log(
    "🚀 [⚡ Ultimate Parallel Scraper] تشغيل توب سينما الديناميكي وجوجل المرن للعربي بالتوازي...",
  );

  console.log("🚀 [Ultimate Scraper] Launching Puppeteer browser...");
  const browser = await launchBrowser();
  console.log("🚀 [Ultimate Scraper] Puppeteer browser launched successfully!");

  const tempScrapedData = {
    arabicMovies: [],
    englishMovies: [],
    arabicSeries: [],
    englishSeries: [],
  };

  const tasks = [
    {
      type: "direct_menu_site",
      source: "topcinema",
      searchKey: "topcinema توب سينما",
      fallbackBase: "https://web.topcinemaa.com",
    },
    {
      type: "direct_menu_site",
      source: "arabsid",
      searchKey: "عرب سيد",
      fallbackBase:
        "https://vid.mycima.cc/categories-cimawbas.php?cat=5-cimawbas-aflam-3arby",
    },
      {
      type: "direct_menu_site",
      source: "egydead",
      searchKey: "ايجى ديد",
      fallbackBase:
        "https://tv9.egydead.live/",
    },
    // {
    //   type: "google_search",
    //   source: "google_arabic",
    //   queries: {
    //     arabicMovies: "مشاهدة افلام عربية 2026 اون لاين حصري سينما",
    //     arabicSeries: "مشاهدة مسلسلات عربية رمضان 2026 اون لاين حصري",
    //   },
    // },
  ];

  try {
    for (const task of tasks) {
        console.log(
          `🚀 [Ultimate Scraper] Opening new page for task: ${task.source}`,
        );
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await configurePage(page);
        await blockPageResources(page); // 💾 Block images/CSS/fonts to save RAM
        console.log(
          `🚀 [Ultimate Scraper] Page configured + resources blocked for: ${task.source}`,
        );

        // 👑 المسار الأول: توب سينما للأجنبي بالمنيو الديناميكي (شغال الله ينور)
        if (task.type === "direct_menu_site") {
          try {
            console.log(
              `📡 [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] جاري قنص النطاق الحي من جوجل...`,
            );
            console.log(
              `📡 [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] Navigating to Google search...`,
            );
            await page.goto(
              `https://www.google.com/search?q=${encodeURIComponent(task.searchKey)}`,
              { waitUntil: "domcontentloaded", timeout: 30000 },
            );
            console.log(
              `📡 [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] Google search page loaded.`,
            );

            let baseUrl = await page.evaluate((key) => {
              const searchLinks = document.querySelectorAll("#search a");
              for (let a of searchLinks) {
                const href = a.href ? a.href.toLowerCase() : "";
                if (
                  href &&
                  (href.includes(key) ||
                    href.includes("arabseed") ||
                    href.includes("asd")) &&
                  !href.includes("google")
                )
                  return new URL(a.href).origin;
              }
              return null;
            }, task.source);

            baseUrl = baseUrl || task.fallbackBase;
            const isCategoryPage =
              baseUrl.includes("/category/") ||
              baseUrl.includes("/list/") ||
              baseUrl.includes("categories-cimawbas") ||
              baseUrl.includes("aflam-3arby");

            console.log(
              `📡 [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] Navigating to base URL: ${baseUrl}`,
            );
            await page.goto(baseUrl, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            console.log("📄 Page Title:", await page.title());
            console.log("🌐 Current URL:", page.url());
            const bodyHTML = await page.evaluate(() =>
              document.body ? document.body.innerHTML : "",
            );
            console.log(
              "🔍 First 500 chars of HTML:",
              bodyHTML.substring(0, 500),
            );
            console.log(
              `📡 [${task.source === "topcinema" ? "توب سينما" : task.source === "egydead" ? "ايجي ديد" : "عرب سيد"}] Base URL loaded. Waiting 2 seconds...`,
            );
            await new Promise((r) => setTimeout(r, 2000));

            const mappedSections = await page.evaluate(() => {
              const sectionsFound = {};
              const navLinks = document.querySelectorAll(
                "nav a, .menu a, header a, ul li a, .navbar a, .slideMenu a, #pushList a",
              );

              navLinks.forEach((a) => {
                const text = (a.textContent || a.innerText || "").toLowerCase().trim();
                const href = a.href;
                if (
                  !href ||
                  !href.startsWith("http") ||
                  href === window.location.href ||
                  (!href.includes("/category/") &&
                    !href.includes("/movies/") &&
                    !href.includes("/series/") &&
                    !href.includes("/series-category/"))
                )
                  return;

                const cleanText = text
                  .replace(/أ/g, "ا")
                  .replace(/إ/g, "ا")
                  .replace(/آ/g, "ا")
                  .replace(/ة/g, "ه")
                  .replace(/ى/g, "ي")
                  .replace(/ال/g, "");

                const hasMovies =
                  cleanText.includes("فيلم") || cleanText.includes("افلام");
                const hasSeries =
                  cleanText.includes("مسلسل") || cleanText.includes("مسلسلات");
                const isForeign =
                  cleanText.includes("اجني") ||
                  cleanText.includes("اجنبي") ||
                  cleanText.includes("اجنبيه") ||
                  cleanText.includes("انقليزي") ||
                  cleanText.includes("انجليزي");
                const isArabic =
                  cleanText.includes("عربي") ||
                  cleanText.includes("مصرى") ||
                  cleanText.includes("مصريه") ||
                  cleanText.includes("خليجي") ||
                  cleanText.includes("سوري") ||
                  cleanText.includes("لبناني");

                const isDubbed = cleanText.includes("مدبلج") || cleanText.includes("مدبلجه") || href.includes("dubbed") || href.includes("%d9%85%d8%af%d8%a8%d9%84%d8%ac");
                const isCartoon = cleanText.includes("كرتون") || cleanText.includes("انمي") || cleanText.includes("ديزني") || href.includes("cartoon") || href.includes("anime") || href.includes("%d9%83%d8%b1%d8%aa%d9%88%d9%86") || href.includes("%d8%a7%d9%86%d9%85%d9%8a");

                if (hasMovies) {
                  if (isForeign && !isDubbed && !isCartoon) sectionsFound["englishMovies"] = href;
                  else if (isArabic && !isCartoon) sectionsFound["arabicMovies"] = href;
                } else if (hasSeries) {
                  if (isForeign && !isDubbed && !isCartoon) sectionsFound["englishSeries"] = href;
                  else if (isArabic && !isCartoon) sectionsFound["arabicSeries"] = href;
                }
              });
              return sectionsFound;
            });

            if (isCategoryPage || Object.keys(mappedSections).length === 0) {
              if (
                task.fallbackBase.includes("category/arabic-movies") ||
                task.fallbackBase.includes("arabic-movies") ||
                task.fallbackBase.includes("aflam-3arby")
              ) {
                if (!mappedSections["arabicMovies"]) {
                  mappedSections["arabicMovies"] = baseUrl;
                }
              } else if (
                task.fallbackBase.includes("category/arabic-series") ||
                task.fallbackBase.includes("arabic-series")
              ) {
                if (!mappedSections["arabicSeries"]) {
                  mappedSections["arabicSeries"] = baseUrl;
                }
              }
            }

            for (let key in mappedSections) {
              const sectionUrl = mappedSections[key];
              console.log(
                `📡 [${task.source === "topcinema" ? "توب سينما" : task.source === "egydead" ? "ايجي ديد" : "عرب سيد"}] جاري قشط القسم [${key}] من الرابط: ${sectionUrl}`,
              );
              console.log(
                `📡 [${task.source === "topcinema" ? "توب سينما" : task.source === "egydead" ? "ايجي ديد" : "عرب سيد"}] Navigating to section URL: ${sectionUrl}`,
              );
              await page.goto(sectionUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
              });
              console.log("📄 Page Title:", await page.title());
              console.log("🌐 Current URL:", page.url());
              const bodyHTML = await page.evaluate(() =>
                document.body ? document.body.innerHTML : "",
              );
              console.log(
                "🔍 First 500 chars of HTML:",
                bodyHTML.substring(0, 500),
              );
              console.log(
                `📡 [${task.source === "topcinema" ? "توب سينما" : task.source === "egydead" ? "ايجي ديد" : "عرب سيد"}] Section URL loaded. Scrolling...`,
              );

              await page.evaluate(async () => {
                for (let i = 0; i < 5; i++) {
                  window.scrollBy(0, 600);
                  await new Promise((r) => setTimeout(r, 400));
                }
              });

              const extracted = await page.evaluate(() => {
                const items = [];
                const cards = document.querySelectorAll(
                  '.Small--Box, [class*="movie"], [class*="card"], a',
                );

                cards.forEach((card) => {
                  let href = card.href || card.querySelector("a")?.href;
                  if (
                    !href ||
                    !href.startsWith("http") ||
                    href.includes("twitter.com") ||
                    href.includes("x.com") ||
                    href.includes("youtube.com") ||
                    href.includes("facebook.com") ||
                    href.includes("instagram.com") ||
                    href.includes("t.me") ||
                    href.includes("telegram") ||
                    href.includes("/category/") ||
                    href.includes("/actor/") ||
                    href.includes("/genre/") ||
                    href.includes("/year/") ||
                    href.includes("/tag/") ||
                    href.includes("/tags/") ||
                    href.includes("rgetUrl") ||
                    href.includes("url=")
                  )
                    return;

                  let posterUrl = "";

                  const imgEl =
                    card.tagName === "IMG" ? card : card.querySelector("img");
                  if (imgEl) {
                    posterUrl =
                      imgEl.getAttribute("data-src") ||
                      imgEl.getAttribute("data-lazy-src") ||
                      imgEl.getAttribute("data-echo") ||
                      imgEl.getAttribute("data-lazy-style") ||
                      imgEl.src;
                  }

                  if (!posterUrl || posterUrl.includes("melody-lzld")) {
                    const bgSpan = card.querySelector(
                      '[data-lazy-style], [style*="background-image"]',
                    );
                    if (bgSpan) {
                      const styleStr =
                        bgSpan.getAttribute("data-lazy-style") ||
                        bgSpan.getAttribute("style");
                      const match = styleStr.match(/url\(['"]?(.*?)['"]?\)/);
                      if (match && match[1]) {
                        posterUrl = match[1];
                      }
                    }
                  }

                  if (!posterUrl || posterUrl.includes("melody-lzld")) {
                    const allLazy = card.querySelectorAll(
                      "[data-lazy-src], [data-src], [data-echo]",
                    );
                    for (let el of allLazy) {
                      const src =
                        el.getAttribute("data-lazy-src") ||
                        el.getAttribute("data-src") ||
                        el.getAttribute("data-echo");
                      if (src && !src.includes("melody-lzld")) {
                        posterUrl = src;
                        break;
                      }
                    }
                  }

                  if (posterUrl && posterUrl.includes("melody-lzld")) {
                    // Don't drop it, just use a fallback or keep it so we don't lose the movie!
                    posterUrl =
                      "https://placehold.co/300x450/1a1a1a/FFF?text=Poster";
                  }

                  if (
                    !posterUrl ||
                    posterUrl.includes("logo") ||
                    posterUrl.includes("blank") ||
                    posterUrl.includes("cover.jpg")
                  )
                    return;

                  const titleEl =
                    card.querySelector("h3") || card.querySelector(".title");
                  let titleText = titleEl
                    ? titleEl.innerText.trim()
                    : (imgEl ? (imgEl.getAttribute("alt") || imgEl.alt || "").trim() : "");

                  if (!titleText || titleText.length < 2) {
                    titleText = (card.innerText || card.textContent || "").split('\n')[0].trim();
                  }

                  if (titleText && titleText.length > 2) {
                    if (!items.some((item) => item.link === href))
                      items.push({
                        title: titleText,
                        poster: posterUrl,
                        link: href,
                      });
                  }
                });
                return items;
              });
              console.log(
                `🔍 [${task.source === "topcinema" ? "توب سينما" : task.source === "egydead" ? "ايجي ديد" : "عرب سيد"}] Element selection results count: ${extracted.length}`,
              );

              extracted.forEach((item) => {
                let cleanTitle = item.title
                  .replace(/مشاهدة/g, "")
                  .replace(/فيلم/g, "")
                  .replace(/مسلسل/g, "")
                  .replace(/مترجم/g, "")
                  .replace(/اون لاين/g, "")
                  .trim();
                let targetLink = item.link;
                if (
                  targetLink.includes("mycima") &&
                  targetLink.includes("watch.php")
                ) {
                  targetLink = targetLink.replace("watch.php", "play.php");
                }
                if (
                  !tempScrapedData[key].some((el) => el.targetUrl === targetLink)
                ) {
                  tempScrapedData[key].push({
                    id: `${key}-${Math.random().toString(36).substr(2, 5)}`,
                    title: cleanTitle,
                    poster: item.poster,
                    targetUrl: targetLink,
                  });
                }
              });
              console.log(
                `✅ [${task.source === "topcinema" ? "توب سينما" : task.source === "egydead" ? "ايجي ديد" : "عرب سيد"}] لقطنا ${tempScrapedData[key].length} عنوان في حقل [${key}]`,
              );
            }
          } catch (err) {
            console.log(`❌ فشل في ${task.source === "topcinema" ? "توب سينما" : task.source === "egydead" ? "ايجي ديد" : "عرب سيد"}:`, err.message);
          } finally {
            try {
              await page.close();
            } catch (e) {
              console.log(`⚠️ فشل إغلاق الصفحة (${task.source === "topcinema" ? "توب سينما" : task.source === "egydead" ? "ايجي ديد" : "عرب سيد"}):`, e.message);
            }
          }
        }

        // 👑 المسار الثاني: جوجل المفتوح والمصحح بالكامل للأفلام والمسلسلات العربي
        if (task.type === "google_search") {
          try {
            for (let key in task.queries) {
              console.log(
                `🔍 [جوجل عربي] جاري صيد المحتوى العربي عبر البحث عن: [${task.queries[key]}]...`,
              );
              await page.goto(
                `https://www.google.com/search?q=${encodeURIComponent(task.queries[key])}`,
                { waitUntil: "domcontentloaded" },
              );
              console.log("📄 Google Search Page Title:", await page.title());
              console.log("🌐 Google Search Current URL:", page.url());
              const bodyHTML = await page.evaluate(() =>
                document.body ? document.body.innerHTML : "",
              );
              console.log(
                "🔍 First 500 chars of Google Search HTML:",
                bodyHTML.substring(0, 500),
              );

              // 🔥 تصليح الفلترة: قشط نتايج جوجل بدون شروط استبعاد تسبب الأصفار
              const results = await page.evaluate(() => {
                const items = [];
                // لقط روابط البحث العضوية من جوجل الصريحة
                const searchLinks =
                  document.querySelectorAll("#search a[jsname]");

                searchLinks.forEach((link) => {
                  const href = link.href;
                  const titleEl = link.querySelector("h3");
                  if (!href || !titleEl) return;

                  // تصفية روابط جوجل الداخلية فقط
                  if (
                    href.includes("google.com") ||
                    href.includes("wikipedia") ||
                    href.includes("youtube.com")
                  )
                    return;

                  let titleText = titleEl.innerText.trim();
                  // بوستر افتراضي أنيق للمحتوى العربي
                  const defaultPoster =
                    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400";

                  if (titleText && titleText.length > 5) {
                    // منع التكرار داخل اللفة الحالية
                    if (!items.some((item) => item.link === href)) {
                      items.push({
                        title: titleText,
                        poster: defaultPoster,
                        link: href,
                      });
                    }
                  }
                });
                return items;
              });
              console.log(
                `🔍 [جوجل عربي] Extracted results count from search: ${results.length}`,
              );

              results.forEach((item) => {
                // تنظيف العناوين الطويلة لتظهر كأسماء أفلام شيك في الـ UI
                let cleanTitle = item.title
                  .replace(/مشاهدة/g, "")
                  .replace(/فيلم/g, "")
                  .replace(/مسلسل/g, "")
                  .replace(/اون لاين/g, "")
                  .replace(/HD/g, "")
                  .replace(/تحميل/g, "")
                  .replace(/موقع/g, "")
                  .replace(/حصري/g, "")
                  .replace(/كامل/g, "")
                  .split("-")[0]
                  .split("|")[0]
                  .trim();

                if (
                  !tempScrapedData[key].some((el) => el.targetUrl === item.link)
                ) {
                  tempScrapedData[key].push({
                    id: `${key}-${Math.random().toString(36).substr(2, 5)}`,
                    title: cleanTitle,
                    poster: item.poster,
                    targetUrl: item.link,
                  });
                }
              });
              console.log(
                `✅ [جوجل عربي] لقطنا بنجاح ${tempScrapedData[key].length} عنوان عربي في حقل [${key}]`,
              );
            }
          } catch (err) {
            console.log("❌ فشل صيد العربي من جوجل:", err.message);
          } finally {
            try {
              await page.close();
            } catch (e) {
              console.log("⚠️ فشل إغلاق الصفحة (جوجل عربي):", e.message);
            }
          }
        }
    }

    console.log(
      "📊 ⚡ [المعمارية قفلت اللعبة] توب سينما قشط الأجنبي لايف، وجوجل قشط العربي لايف بنجاح توازي تامة!",
    );
  } catch (err) {
    console.log(`❌ خطأ عام بالسيرفر:`, err.message);
  } finally {
    try {
      await browser.close();
    } catch (e) {
      console.log("⚠️ فشل إغلاق المتصفح (أفلام):", e.message);
    }
  }

  // 🛡️ Safe check: only overwrite global cache if we successfully scraped movies
  const totalCount = tempScrapedData.arabicMovies.length + 
                     tempScrapedData.englishMovies.length + 
                     tempScrapedData.arabicSeries.length + 
                     tempScrapedData.englishSeries.length;
                    
  if (totalCount > 0) {
    scrapedData = tempScrapedData;
    console.log(`✅ [Scraper] Successfully updated scrapedData cache with ${totalCount} items.`);
  } else {
    console.warn("⚠️ [Scraper] Scraped 0 items. Retaining previous in-memory cache data to prevent empty UI.");
  }
  return totalCount;
}

async function fetchCategoryFromDB(category) {
  if (mongoose.connection.readyState !== 1) {
    console.log(
      `⚠️ [DB] Skip loading category ${category} because database is not connected (state: ${mongoose.connection.readyState})`,
    );
    return;
  }
  try {
    const items = await Media.find({ category });
    if (items && items.length > 0) {
      scrapedData[category] = items.map((item) => ({
        id: item._id.toString(),
        title: item.title,
        poster: item.poster,
        targetUrl: item.url,
      }));
      console.log(`🔌 [DB] Loaded ${scrapedData[category].length} items for category: ${category}`);
    }
  } catch (err) {
    console.error(`❌ [DB] Error loading category ${category}:`, err.message);
  }
}

// ── Category Endpoints ──
app.get("/api/movies/arabic", async (req, res) => {
  if (!scrapedData.arabicMovies || scrapedData.arabicMovies.length === 0)
    await fetchCategoryFromDB("arabicMovies");
  res.json(scrapedData.arabicMovies);
});
app.get("/api/movies/english", async (req, res) => {
  if (!scrapedData.englishMovies || scrapedData.englishMovies.length === 0)
    await fetchCategoryFromDB("englishMovies");
  res.json(scrapedData.englishMovies);
});
app.get("/api/series/arabic", async (req, res) => {
  if (!scrapedData.arabicSeries || scrapedData.arabicSeries.length === 0)
    await fetchCategoryFromDB("arabicSeries");
  res.json(scrapedData.arabicSeries);
});
app.get("/api/series/english", async (req, res) => {
  if (!scrapedData.englishSeries || scrapedData.englishSeries.length === 0)
    await fetchCategoryFromDB("englishSeries");
  res.json(scrapedData.englishSeries);
});

// ─── Fast HTTP Fetch Search Parser ───
function parseSearchHTML(html, taskKey) {
  const items = [];
  
  // 1. Scan structural anchor tags wrapping images (extremely generic, bypasses class name changes)
  // This matches: <a ... href="URL" ...> ... <img ... src="POSTER" ... alt="TITLE" ...> ... </a>
  const anchorImgRegex = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?<img\s+[^>]*>[\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = anchorImgRegex.exec(html)) !== null) {
    const href = match[1];
    const innerContent = match[2];
    
    // Ignore non-movie links
    if (
      href.includes("/category/") || 
      href.includes("/actor/") || 
      href.includes("/genre/") || 
      href.includes("/year/") || 
      href.includes("/tag/") ||
      href.includes("/tags/") ||
      href.includes("twitter.com") ||
      href.includes("x.com") ||
      href.includes("youtube.com") ||
      href.includes("facebook.com") ||
      href.includes("instagram.com") ||
      href.includes("t.me") ||
      href.includes("telegram") ||
      href.includes("javascript:") ||
      href.includes("#")
    ) {
      continue;
    }
    
    // Extract poster from img tag
    let poster = "";
    const imgMatch = innerContent.match(/<img\s+[^>]*(?:data-src|data-lazy-src|data-echo|src)=["'](https?:\/\/[^"']+)["']/i);
    if (imgMatch) {
      poster = imgMatch[1];
    }
    if (!poster || poster.includes("melody-lzld") || poster.includes("logo") || poster.includes("blank")) {
      // Try standard src if data-src was not matched
      const srcMatch = innerContent.match(/<img\s+[^>]*src=["'](https?:\/\/[^"']+)["']/i);
      if (srcMatch) poster = srcMatch[1];
    }
    if (!poster || poster.includes("melody-lzld") || poster.includes("logo") || poster.includes("blank")) {
      poster = "https://placehold.co/300x450/1a1a1a/FFF?text=Poster";
    }
    
    // Extract title from img alt, title, or text
    let title = "";
    const altMatch = innerContent.match(/alt=["']([^"']+)["']/i) || innerContent.match(/title=["']([^"']+)["']/i);
    if (altMatch) {
      title = altMatch[1].trim();
    }
    
    // If title not found in img alt, try text contents inside the anchor
    if (!title || title.length < 2) {
      const textMatch = innerContent.replace(/<[^>]*>/g, "").trim();
      if (textMatch) title = textMatch;
    }
    
    // Clean up title
    title = title.replace(/\s+/g, " ").trim();
    
    if (title && title.length > 2) {
      if (!items.some(i => i.link === href)) {
        items.push({ title, poster, link: href });
      }
    }
  }
  
  // 2. Fallback to card-class regex if the structural scan found nothing
  if (items.length === 0) {
    const cardRegex = /<(div|a|article)[^>]+class="[^"]*(Small--Box|pm-video-thumb|pm-li-video|thumbnail|movie|card|content)[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
    let cardMatch;
    while ((cardMatch = cardRegex.exec(html)) !== null) {
      const cardContent = cardMatch[3];
      const hrefMatch = cardContent.match(/href=["'](https?:\/\/[^"']+)["']/i);
      if (!hrefMatch) continue;
      const href = hrefMatch[1];
      if (
        href.includes("/category/") || 
        href.includes("/actor/") || 
        href.includes("/genre/") ||
        href.includes("twitter.com") ||
        href.includes("x.com") ||
        href.includes("youtube.com") ||
        href.includes("facebook.com") ||
        href.includes("instagram.com") ||
        href.includes("t.me") ||
        href.includes("telegram")
      ) continue;
      
      let poster = "";
      const imgMatch = cardContent.match(/(?:data-src|data-lazy-src|data-echo|src)=["'](https?:\/\/[^"']+)["']/i);
      if (imgMatch) poster = imgMatch[1];
      
      let title = "";
      const h3Match = cardContent.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      if (h3Match) title = h3Match[1].replace(/<[^>]*>/g, "").trim();
      
      if (title && title.length > 2 && !items.some(i => i.link === href)) {
        items.push({ title, poster, link: href });
      }
    }
  }
  
  return items;
}

async function fetchSearchHTTP(url) {
  const urlObj = new URL(url);
  const origin = urlObj.origin;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": `${origin}/`,
    "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1"
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout
  try {
    const response = await fetch(url, {
      headers,
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }
    const html = await response.text();
    const isCF = html.includes("Cloudflare") || html.includes("Just a moment") || html.includes("Security Check");
    if (isCF) {
      throw new Error("Blocked by Cloudflare DDoS page");
    }
    return html;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

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

  // Define active domains for search targets
  const activeDomains = {
    topcinema: "https://topcinemaa.cam",
    mycima: "https://vid.mycima.cc"
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const topDoc = await Media.findOne({ url: { $regex: "topcinema" } }).sort({ fetchedAt: -1 });
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
      url: `https://tv9.egydead.live/?s=${encodeURIComponent(query)}`,
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
      console.log(task.url);
      
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
            if (
              !href ||
              !href.startsWith("http") ||
              href.includes("twitter.com") ||
              href.includes("x.com") ||
              href.includes("youtube.com") ||
              href.includes("facebook.com") ||
              href.includes("instagram.com") ||
              href.includes("t.me") ||
              href.includes("telegram")
            )
              return;

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
          let cleanTitle = item.title
            .replace(/مشاهدة|فيلم|مسلسل|مترجم|اون لاين/g, "")
            .trim();
          let targetLink = item.link;
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

    res.json(results);
  } catch (err) {
    console.error("Search API Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Search failed: " + err.message });
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
  }
})

// Endpoint للأفلام
app.get("/api/movies", (req, res) => res.json(scrapedMovies));

// ─── Stream Cache & background pre-sniffer ───────────────────────────
const streamCache = new Map(); // key: watchUrl, value: { streamUrl, type, referer, timestamp }

async function getOrSniffStream(url) {
  if (!url) return null;
  const cleanUrl = cleanMovieUrl(url);
  const cached = streamCache.get(cleanUrl);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    console.log(`⚡ [Cache Hit] Stream found in cache for: ${cleanUrl}`);
    return cached;
  }

  console.log(`🔍 [Cache Miss] Sniffing stream for: ${cleanUrl}`);
  let browser;
  let caughtStream = null;
  let fallbackEmbedUrl = null;
  let resolveStream;
  const streamPromise = new Promise((resolve) => {
    resolveStream = resolve;
  });

  try {
    console.log(
      `🔍 [Sniffer] Launching Puppeteer browser with 'shell' headless mode for: ${cleanUrl}...`,
    );
    browser = await launchBrowser();
    console.log("🔍 [Sniffer] Puppeteer browser launched successfully!");

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await configurePage(page);

    // ── Network interception: catch m3u8/mp4 URLs as they fire ──
    console.log("🔍 [Sniffer] Intercepting network requests...");
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      try {
        const reqUrl = r.url().toLowerCase();

        // 1. Block heavy resources that are NOT needed for sniffing
        const resourceType = r.resourceType();
        if (
          ["image", "stylesheet", "font", "ping", "manifest"].includes(resourceType)
        ) {
          r.abort().catch(() => {});
          return;
        }

        // 2. Block known ad/tracker domains to speed things up
        if (
          reqUrl.includes("popads") ||
          reqUrl.includes("adsterra") ||
          reqUrl.includes("analytics") ||
          reqUrl.includes("doubleclick") ||
          reqUrl.includes("onclick") ||
          reqUrl.includes("exoclick") ||
          reqUrl.includes("a.orbsrv.com") ||
          reqUrl.includes("juicyads") ||
          reqUrl.includes("exdynsrv")
        ) {
          r.abort().catch(() => {});
          return;
        }

        // 3. Catch stream URLs
        if (
          (reqUrl.includes(".m3u8") ||
            reqUrl.includes(".mp4") ||
            reqUrl.includes(".ts")) &&
          !caughtStream
        ) {
          if (!reqUrl.includes("google") && !reqUrl.includes("facebook")) {
            console.log(
              `🎯 [Sniffer] ✅ Caught stream via network: ${r.url()}`,
            );
            caughtStream = r.url();
            resolveStream(caughtStream);
          }
        }
        r.continue().catch(() => {});
      } catch (err) {
        console.error("⚠️ [Sniffer] Interception error:", err.message);
      }
    });

    // Also intercept responses to catch m3u8 by Content-Type from the very beginning!
    // (some players use CDN URLs that don't contain .m3u8 in the path)
    page.on("response", async (response) => {
      try {
        const respUrl = response.url();
        const ct = response.headers()["content-type"] || "";
        if (
          (ct.includes("mpegurl") ||
            ct.includes("x-mpegURL") ||
            ct.includes("m3u8")) &&
          !caughtStream
        ) {
          console.log(
            `🎯 [Sniffer] ✅ Caught m3u8 via response Content-Type: ${respUrl}`,
          );
          caughtStream = respUrl;
          resolveStream(respUrl);
        }
      } catch (e) {}
    });

    // Helper to throw specific exception when caughtStream is populated
    const checkEarlyExit = () => {
      if (caughtStream) {
        throw new Error("STREAM_CAUGHT");
      }
    };

    // ── Step 1: Navigate to movie page (tolerate timeout — content may already be in DOM) ──
    console.log(`🔍 [Sniffer] Navigating to movie page: ${cleanUrl}`);
    try {
      await page.goto(cleanUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000, // Increased to 30000 for slow Render servers
      });
      console.log("🔍 [Sniffer] Movie page loaded. Title:", await page.title());
    } catch (e) {
      console.log(
        `⚠️ [Sniffer] Navigation timeout: ${e.message}`,
      );
    }

    checkEarlyExit();

    // Check if there is a "Watch Now" (المشاهدة والتحميل) button that needs to be clicked
    try {
      const watchNowSelector = ".watchNow button, button.watchNow, .watchNow input[type='submit']";
      const hasWatchButton = await page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) return true;
        const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], a"));
        for (let b of buttons) {
          const txt = b.innerText || b.textContent || "";
          if (txt.includes("المشاهده والتحميل") || txt.includes("المشاهدة والتحميل")) {
            return true;
          }
        }
        return false;
      }, watchNowSelector);

      if (hasWatchButton) {
        console.log("🎯 [Sniffer] Found a 'Watch Now' button/form. Clicking it to reveal streams...");
        await page.evaluate((sel) => {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return;
          }
          const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], a"));
          for (let b of buttons) {
            const txt = b.innerText || b.textContent || "";
            if (txt.includes("المشاهده والتحميل") || txt.includes("المشاهدة والتحميل")) {
              b.click();
              return;
            }
          }
        }, watchNowSelector);
        
        console.log("🎯 [Sniffer] Clicked button, waiting for page navigation...");
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 8000 }).catch((e) => {
          console.log(`⚠️ [Sniffer] Navigation warning after click: ${e.message}`);
        });
      }
    } catch (btnErr) {
      console.error("⚠️ [Sniffer] Error checking/clicking Watch Now button:", btnErr.message);
    }

    checkEarlyExit();

    // Dynamic wait up to 4 seconds, checking every 500ms
    console.log("🔍 [Sniffer] Dynamic waiting for stream...");
    for (let i = 0; i < 8; i++) {
      checkEarlyExit();
      await new Promise((r) => setTimeout(r, 500));
    }
    checkEarlyExit();

    // ── Step 2: Always extract embed URL even after timeout ──
    console.log("🔍 [Sniffer] Extracting embed player from page DOM...");
    let embedUrl = null;
    try {
      embedUrl = await page.evaluate(() => {
        // 0. Prioritize checking for explicit server elements (e.g. EgyDead .servers buttons, or class/id containing server)
        const serverElements = document.querySelectorAll(".servers, .serversList li, [class*=\"server\"] li, [class*=\"server\"] a, [class*=\"server\"] button, [class*=\"server\"], [id*=\"server\"], .server-item");
        for (let el of serverElements) {
          const src = el.getAttribute("data-url") || el.getAttribute("data-src") || el.getAttribute("data-link") || el.href;
          if (
            src && 
            src.startsWith("http") && 
            !src.includes("youtube.com") && 
            !src.includes("youtu.be") && 
            !src.includes("facebook.com") && 
            !src.includes("twitter.com") &&
            !src.includes("google.com")
          ) {
            return src;
          }
        }

        // 1. Check all iframes, ignoring social/trailer iframes
        const iframes = Array.from(document.querySelectorAll("iframe"));
        for (let iframe of iframes) {
          const src =
            iframe.src ||
            iframe.getAttribute("data-src") ||
            iframe.getAttribute("data-lazy-src");
          if (
            src && 
            src.startsWith("http") && 
            !src.includes("youtube.com") && 
            !src.includes("youtu.be") && 
            !src.includes("facebook.com") && 
            !src.includes("google.com") &&
            !src.includes("twitter.com") &&
            !src.includes("instagram.com")
          ) {
            return src;
          }
        }
        // 2. Check video elements directly
        const videos = Array.from(
          document.querySelectorAll("video source, video[src]"),
        );
        for (let v of videos) {
          const src = v.src || v.getAttribute("data-src");
          if (src && src.startsWith("http")) return src;
        }
        // 3. Scan inline scripts for m3u8 URLs
        const scripts = Array.from(
          document.querySelectorAll("script:not([src])"),
        );
        for (let s of scripts) {
          const m = (s.textContent || "").match(
            /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/,
          );
          if (m) return m[1];
        }
        return null;
      });
      console.log(
        `🔍 [Sniffer] Embed URL extracted: ${embedUrl || "none found"}`,
      );
    } catch (evalErr) {
      console.log(`⚠️ [Sniffer] DOM evaluation error: ${evalErr.message}`);
    }

    checkEarlyExit();

    // ── Step 3: Navigate into embed player and wait for stream ──
    if (embedUrl) {
      fallbackEmbedUrl = embedUrl;
      console.log(`🔍 [Sniffer] Navigating into embed player: ${embedUrl}`);

      try {
        await page.goto(embedUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000, // Reduced from 60000
        });
        console.log(
          "🔍 [Sniffer] Embed player loaded. Title:",
          await page.title(),
        );
      } catch (e) {
        console.log(`⚠️ [Sniffer] Embed navigation warning: ${e.message}`);
        // Dynamic wait check before delay
        for (let i = 0; i < 6; i++) {
          checkEarlyExit();
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      checkEarlyExit();

      // Wait up to 15s (reduced from 25s) for network interceptor to catch a stream
      await Promise.race([
        streamPromise,
        new Promise((r) => {
          const interval = setInterval(() => {
            if (caughtStream) {
              clearInterval(interval);
              r();
            }
          }, 200);
          setTimeout(() => {
            clearInterval(interval);
            r();
          }, 15000);
        }),
      ]);

      checkEarlyExit();

      // ── Step 3b: Extract from JS player APIs (JW Player, VideoJS, Plyr, etc.) ──
      console.log(
        "🔍 [Sniffer] Trying to extract stream from JS player APIs...",
      );
      try {
        const playerSrc = await page.evaluate(() => {
          // 1. JW Player
          try {
            if (window.jwplayer) {
              const p = window.jwplayer();
              if (p && p.getConfig) {
                const cfg = p.getConfig();
                const file =
                  cfg.file ||
                  (cfg.playlist &&
                    cfg.playlist[0] &&
                    (cfg.playlist[0].file ||
                      cfg.playlist[0].sources?.[0]?.file));
                if (file) return file;
              }
              // also try getPlaylist
              if (p && p.getPlaylist) {
                const pl = p.getPlaylist();
                if (pl && pl[0] && pl[0].file) return pl[0].file;
              }
            }
          } catch (e) {}

          // 2. VideoJS
          try {
            if (window.videojs && window.videojs.players) {
              for (let key of Object.keys(window.videojs.players)) {
                const p = window.videojs.players[key];
                if (p && p.currentSrc && p.currentSrc())
                  return p.currentSrc();
                if (p && p.src && p.src()) return p.src();
              }
            }
          } catch (e) {}

          // 3. Plyr
          try {
            if (window.player && window.player.source) {
              const src = window.player.source;
              if (typeof src === "string") return src;
            }
          } catch (e) {}

          // 4. Scan all inline scripts for any m3u8 or mp4 URL
          const scripts = Array.from(
            document.querySelectorAll("script:not([src])"),
          );
          for (let s of scripts) {
            const text = s.textContent || "";
            // m3u8
            let m = text.match(
              /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)["'`]/,
            );
            if (m) return m[1];
            // mp4
            m = text.match(/["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)["'`]/);
            if (m) return m[1];
          }

          // 5. Check video[src] directly
          const vid = document.querySelector("video[src], video source[src]");
          if (vid) return vid.src || vid.getAttribute("src");

          return null;
        });

        if (playerSrc && !caughtStream) {
          console.log(
            `🎯 [Sniffer] ✅ Extracted stream from JS player: ${playerSrc}`,
          );
          caughtStream = playerSrc;
          resolveStream(caughtStream);
        }
      } catch (evalErr) {
        console.log(
          `⚠️ [Sniffer] JS player extraction error: ${evalErr.message}`,
        );
      }

      checkEarlyExit();

      // ── Step 3c: Check for nested iframe inside embed player ──
      console.log(
        "🔍 [Sniffer] Checking for nested iframes inside embed player...",
      );
      try {
        const nestedEmbed = await page.evaluate(() => {
          const iframes = Array.from(document.querySelectorAll("iframe"));
          for (let f of iframes) {
            const src = f.src || f.getAttribute("data-src");
            if (src && src.startsWith("http")) return src;
          }
          return null;
        });
        if (nestedEmbed && nestedEmbed !== embedUrl) {
          console.log(`🔍 [Sniffer] Found nested player: ${nestedEmbed}`);
          try {
            await page.goto(nestedEmbed, {
              waitUntil: "domcontentloaded",
              timeout: 30000, // Increased to 30000 for slow Render servers
            });
          } catch (e) {
            for (let i = 0; i < 4; i++) {
              checkEarlyExit();
              await new Promise((r) => setTimeout(r, 500));
            }
          }
          
          checkEarlyExit();

          await Promise.race([
            streamPromise,
            new Promise((r) => {
              const interval = setInterval(() => {
                if (caughtStream) {
                  clearInterval(interval);
                  r();
                }
              }, 200);
              setTimeout(() => {
                clearInterval(interval);
                r();
              }, 8000);
            }),
          ]);

          checkEarlyExit();

          // Try JS extraction again on nested player
          try {
            const nestedSrc = await page.evaluate(() => {
              const vid = document.querySelector(
                "video[src], video source[src]",
              );
              if (vid) return vid.src || vid.getAttribute("src");
              const scripts = Array.from(
                document.querySelectorAll("script:not([src])"),
              );
              for (let s of scripts) {
                const m = (s.textContent || "").match(
                  /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)["'`]/,
                );
                if (m) return m[1];
              }
              return null;
            });
            if (nestedSrc) {
              console.log(
                `🎯 [Sniffer] ✅ Caught stream from nested player JS: ${nestedSrc}`,
              );
              caughtStream = nestedSrc;
              resolveStream(nestedSrc);
            }
          } catch (e) {}
        }
      } catch (nestedErr) {
        console.log(`⚠️ [Sniffer] Nested check error: ${nestedErr.message}`);
      }
    } else {
      // No embed iframe — just wait for direct network stream
      console.log(
        "🔍 [Sniffer] No embed iframe found — waiting for direct network stream...",
      );
      await Promise.race([
        streamPromise,
        new Promise((r) => {
          const interval = setInterval(() => {
            if (caughtStream) {
              clearInterval(interval);
              r();
            }
          }, 200);
          setTimeout(() => {
            clearInterval(interval);
            r();
          }, 15000);
        }),
      ]);
    }
  } catch (err) {
    if (err.message === "STREAM_CAUGHT") {
      console.log(`🎯 [Sniffer] Stream caught! Closing browser and returning.`);
    } else {
      console.error(`❌ Sniffer error:`, err.stack || err.message);
      throw err;
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
  }

  // Prefer the direct caught m3u8 stream — only fall back to iframe as last resort
  const finalStream =
    caughtStream || (fallbackEmbedUrl ? fallbackEmbedUrl : null);
  console.log(
    `🔍 [Sniffer] Result → stream: ${caughtStream || "none"}, embed: ${fallbackEmbedUrl || "none"}`,
  );
  if (finalStream) {
    // If we only have an iframe (no m3u8), log a warning
    if (!caughtStream && fallbackEmbedUrl) {
      console.log(
        `⚠️ [Sniffer] Returning iframe fallback — ads may appear in player`,
      );
    }
    const data = {
      streamUrl: finalStream,
      type: caughtStream
        ? caughtStream.includes(".m3u8")
          ? "hls"
          : "direct"
        : "iframe",
      referer: cleanUrl,
      timestamp: Date.now(),
    };
    streamCache.set(cleanUrl, data);
    return data;
  }
  return null;
}

function isValidStreamLink(urlStr, sourceUrl) {
  if (!urlStr || !urlStr.startsWith("http")) return false;
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // 1. Blacklisted domains (ads, spam blogs, social media)
    const blockedDomains = [
      "poiy.online",
      "fila7lam.com",
      "blogspot.com",
      "wordpress.com",
      "google.com",
      "facebook.com",
      "twitter.com",
      "instagram.com",
      "telegram.me",
      "t.me",
      "whatsapp.com",
      "youtube.com",
      "pinterest.com",
      "doubleclick.net",
      "adservice",
      "analytics",
    ];
    if (blockedDomains.some((d) => hostname.includes(d))) return false;

    // 2. Blog post patterns (e.g. /2026/06/ or /2025/11/)
    if (/\/\d{4}\/\d{2}\//.test(pathname)) return false;

    // 3. Spam/Ad keywords in pathname
    const spamKeywords = [
      "scholarship",
      "insurance",
      "loan",
      "credit",
      "investing",
      "marketing",
      "finance",
      "wealth",
      "estate",
      "download",
      "ads",
      "click",
      "privacy-policy",
      "contact-us",
      "about-us",
      "terms-of-service",
      "terms-and-conditions",
      "dmca",
    ];
    if (spamKeywords.some((kw) => pathname.includes(kw))) return false;

    // 4. If it's external, ensure it has match-related keywords or at least doesn't look like generic spam
    const sourceHost = new URL(sourceUrl).hostname.toLowerCase();
    if (!hostname.includes(sourceHost.replace("www.", ""))) {
      // It's an external domain link
      const sportsKeywords = [
        "match",
        "kora",
        "live",
        "stream",
        "shoot",
        "player",
        "tv",
        "bein",
        "ch",
        "koora",
        "yalla",
      ];
      const hasSportsKw = sportsKeywords.some(
        (kw) => hostname.includes(kw) || pathname.includes(kw),
      );
      if (!hasSportsKw) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

async function masterSniffer() {
  console.log("🥷 [Slayer Scraper] بدء عملية الشفط المتوازي والمستقل...");
  let matchesFound = [];
  let browser;

  try {
    console.log(
      "🥷 [Slayer Scraper] Launching Puppeteer browser with 'shell' headless mode...",
    );
    browser = await launchBrowser();
    console.log("🥷 [Slayer Scraper] Puppeteer browser launched successfully!");

    const REAL_LIVE_TARGETS = [
      "https://www.kooracity.com",
      "https://www.yalla-shoot-4u.com",
      "https://egykoora.com/",
      "https://live-soccer.tv/",
      "https://koora-llive.best/",
      "https://www.freekora.com",
    ];

    // اللف على المواقع بفتح صفحات مستقلة تماماً
    for (let url of REAL_LIVE_TARGETS) {
      let page = null;
      try {
        console.log(`🎯 [Slayer Scraper] Opening page for: ${url}`);
        page = await browser.newPage();
        await configurePage(page);
        await blockPageResources(page); // 💾 Block images/CSS/fonts to save RAM

        // Navigate
        console.log(`🎯 [Slayer Scraper] Navigating to: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        console.log("📄 Page Title:", await page.title());
        console.log("🌐 Current URL:", page.url());
        const bodyHTML = await page.evaluate(() =>
          document.body ? document.body.innerHTML : "",
        );
        console.log("🔍 First 500 chars of HTML:", bodyHTML.substring(0, 500));
        console.log(
          `🎯 [Slayer Scraper] Navigation completed. Waiting 4 seconds for stabilization...`,
        );
        await new Promise((r) => setTimeout(r, 4000));

        console.log(
          `🎯 [Slayer Scraper] Evaluating match elements on page: ${url}`,
        );
        const extractedLinks = await page.evaluate(() => {
          const items = [];

          // 1. استهدف حاويات المباريات المخصصة في هذا السورس
          const matchCards = document.querySelectorAll(".AY_Match");

          if (matchCards.length > 0) {
            matchCards.forEach((card) => {
              // قنص الفريق الأول والثاني من الكلاسات المخصصة
              const teamAEl = card.querySelector(".TM1 .TM_Name");
              const teamBEl = card.querySelector(".TM2 .TM_Name");

              // قنص رابط البث الشفاف
              const linkEl = card.querySelector("a");

              if (teamAEl && teamBEl && linkEl) {
                const teamA = teamAEl.innerText.trim();
                const teamB = teamBEl.innerText.trim();
                const href = linkEl.href;

                items.push({
                  title: `${teamA} 🆚 ${teamB}`,
                  link: href,
                });
              }
            });
          }

          // 2. Fallback الكلاسيكي للمواقع التانية لو ملقاش الستركتشر ده
          if (items.length === 0) {
            const allLinks = document.querySelectorAll("a");
            allLinks.forEach((a) => {
              const text = (a.innerText || "").trim();
              if (
                (text.includes("🆚") ||
                  text.includes("ضد") ||
                  text.includes("مباراة") ||
                  text.includes("مباشر") ||
                  text.includes("جارية") ||
                  text.includes("الان") ||
                  text.includes("LIVE")) &&
                a.href.startsWith("http")
              ) {
                items.push({ title: text, link: a.href });
              }
            });
          }

          return items;
        });

        console.log(
          `🎯 [Slayer Scraper] Extracted ${extractedLinks.length} links from ${url}`,
        );
        if (extractedLinks.length > 0) {
          extractedLinks.forEach((item) => {
            // تنظيف أحرف الـ HTML
            const cleanTitle = (item.title || "")
              .replace(/<\/?[^>]+(>|$)/g, "")
              .trim();

            const { teamA, teamB } = splitMatchTitle(cleanTitle);

            const linkLower = item.link.toLowerCase();
            const titleLower = cleanTitle.toLowerCase();

            // لو لقط كلمة "مباشر" أو "الآن" أو أي إشارة للبث، نجبر isLive على true والـ time على "لايف 🔴"
            const isLiveNow =
              linkLower.includes("live") ||
              linkLower.includes("watch") ||
              linkLower.includes("stream") ||
              titleLower.includes("الآن") ||
              titleLower.includes("الان") ||
              titleLower.includes("مباشر") ||
              titleLower.includes("لايف") ||
              titleLower.includes("live") ||
              titleLower.includes("جارية") ||
              titleLower.includes("جاريه");

            matchesFound.push({
              id: `sniff-${Math.random().toString(36).substr(2, 5)}`,
              teamA: teamA,
              teamB: teamB,
              isLive: isLiveNow,
              time: isLiveNow ? "لايف 🔴" : "بعد قليل 🕒",
              targetSiteUrl: item.link,
            });
          });
          console.log(
            `✅ [نجاح] تم قشط ${extractedLinks.length} رابط من الموقع الحالي: ${url}`,
          );
        } else {
          console.log(
            `⚠️ الموقع فتح بنجاح ولكن جدول مبارياته فارغ حالياً: ${url}`,
          );
        }
      } catch (err) {
        console.log(`❌ فشل تحميل أو معالجة ${url}:`, err.message);
      } finally {
        // 🆕 قفل الصفحة الحالية فوراً لتوفير الرام قبل الانتقال للموقع التالي
        if (page) {
          try {
            console.log(`🎯 [Slayer Scraper] Closing page for: ${url}`);
            await page.close();
          } catch (e) {
            console.log(`⚠️ فشل إغلاق الصفحة لـ ${url}:`, e.message);
          }
        }
      }
    }
  } catch (err) {
    console.log("❌ خطأ عام بالسيرفر في masterSniffer:", err.message);
  } finally {
    if (browser) {
      try {
        console.log("🥷 [Slayer Scraper] Closing browser...");
        await browser.close();
        console.log("🥷 [Slayer Scraper] Browser closed successfully.");
      } catch (e) {
        console.log("⚠️ فشل إغلاق المتصفح (مباريات):", e.message);
      }
    }
  }

  // فلترة وتجميع النهائي
  if (matchesFound.length > 0) {
    const grouped = [];
    for (const m of matchesFound) {
      const existing = grouped.find((g) => areMatchesSame(g, m));
      if (!existing) {
        grouped.push({
          id: m.id,
          teamA: m.teamA,
          teamB: m.teamB,
          isLive: m.isLive,
          time: m.time,
          targetSiteUrl: m.targetSiteUrl,
          alternativeUrls: [],
        });
      } else {
        if (
          existing.targetSiteUrl !== m.targetSiteUrl &&
          !existing.alternativeUrls.includes(m.targetSiteUrl)
        ) {
          existing.alternativeUrls.push(m.targetSiteUrl);
        }
        if (m.isLive) {
          existing.isLive = true;
          existing.time = "لايف 🔴";
        }
      }
    }

    // ترتيب المباريات بحيث يظهر المباشر أولاً ثم بعد قليل
    grouped.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return 0;
    });

    scrapedMatches = grouped;
    console.log(
      `📊 إجمالي المباريات المجمعة من كل المواقع معاً مرتبة: ${scrapedMatches.length}`,
    );

    // حفظ المباريات في قاعدة البيانات لمشاركتها مع خوادم الإنتاج
    try {
      await Match.deleteMany({});
      for (const match of grouped) {
        await Match.create({
          matchId: match.id,
          teamA: match.teamA,
          teamB: match.teamB,
          isLive: match.isLive,
          time: match.time,
          targetSiteUrl: match.targetSiteUrl,
          alternativeUrls: match.alternativeUrls,
        });
      }
      console.log("💾 [DB] Successfully saved scraped matches to database.");
    } catch (err) {
      console.error("❌ [DB] Error saving matches to database:", err.message);
    }

    // Background stream pre-sniffing disabled to prevent OOM crashes on Render
  } else {
    // محاولة جلب المباريات من قاعدة البيانات قبل التحميل الوهمي
    try {
      const cached = await Match.find({});
      if (cached && cached.length > 0) {
        console.log(
          `🔌 [DB] Loaded ${cached.length} cached matches from database instead of demo data.`,
        );
        scrapedMatches = cached.map((c) => ({
          id: c.matchId,
          teamA: c.teamA,
          teamB: c.teamB,
          isLive: c.isLive,
          time: c.time,
          targetSiteUrl: c.targetSiteUrl,
          alternativeUrls: c.alternativeUrls,
        }));
      } else {
        console.log("🔄 شحن داتا الديمو...");
        loadFallback();
      }
    } catch (err) {
      console.error(
        "❌ [DB] Error loading fallback matches from database:",
        err.message,
      );
      loadFallback();
    }
  }
}

function loadFallback() {
  scrapedMatches = [
    {
      id: "sniff-demo1",
      teamA: "كندا",
      teamB: "البوسنة والهرسك",
      isLive: true,
      time: "لايف 🔴",
      targetSiteUrl: "https://www.lkora.live/matches/knda-vs-bosna/",
      alternativeUrls: [
        "https://www.yallashoot.video/video/canada-vs-bosnia-and-herzegovina-live-stream-12-6-2026/",
      ],
    },
    {
      id: "sniff-demo2",
      teamA: "مصر",
      teamB: "السنغال",
      isLive: false,
      time: "بعد قليل 🕒",
      targetSiteUrl: "https://www.lkora.live/matches/egypt-vs-senegal/",
      alternativeUrls: [],
    },
  ];
}

async function sniffStream(url, page) {
  if (!url) return null;
  if (url.includes(".m3u8")) {
    return { m3u8Url: url, referer: "" };
  }

  let caught = null;
  const requestHandler = (r) => {
    const u = r.url();
    if (u.includes(".m3u8") && !caught) {
      console.log(`[Sniffer] Caught .m3u8 URL: ${u}`);
      caught = {
        m3u8Url: u,
        referer: r.headers()["referer"] || "",
      };
    }
  };

  page.on("request", requestHandler);

  try {
    console.log(`[Sniffer] Loading: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4000));

    if (caught) {
      page.off("request", requestHandler);
      return caught;
    }

    // Check for redirection links/hash parameter
    const redirectUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      let found = links.find((l) => l.href.includes("hash="));
      if (found) return found.href;
      found = links.find(
        (l) =>
          l.innerText.includes("انقر هنا") ||
          l.innerText.includes("المشاهدة") ||
          l.innerText.includes("صفحة المشاهدة"),
      );
      if (found) return found.href;
      return null;
    });

    if (redirectUrl) {
      console.log(`[Sniffer] Found redirection URL: ${redirectUrl}`);
      if (redirectUrl.includes("hash=")) {
        const urlObj = new URL(redirectUrl);
        const hash = urlObj.searchParams.get("hash");
        if (hash) {
          const decoded = Buffer.from(
            hash.replace(/__/g, "/").replace(/-/g, "+"),
            "base64",
          ).toString("utf8");
          const foundUrls = decoded.match(/https?:\/\/[^\s"'`>]+/g);
          if (foundUrls && foundUrls.length > 0) {
            console.log(`[Sniffer] Decoded hash player URLs:`, foundUrls);
            for (const playerUrl of foundUrls) {
              console.log(`[Sniffer] Trying player URL: ${playerUrl}`);
              try {
                await page.goto(playerUrl, {
                  waitUntil: "domcontentloaded",
                  timeout: 12000,
                });
                await new Promise((r) => setTimeout(r, 5000));
                if (caught) {
                  page.off("request", requestHandler);
                  return caught;
                }
              } catch (err) {
                console.log(
                  `[Sniffer] Error on player ${playerUrl}:`,
                  err.message,
                );
              }
            }
          }
        }
      } else {
        console.log(
          `[Sniffer] Navigating to redirect page directly: ${redirectUrl}`,
        );
        await page.goto(redirectUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  } catch (err) {
    console.log(`[Sniffer] Error sniffing URL ${url}:`, err.message);
  } finally {
    page.off("request", requestHandler);
  }

  return caught;
}

// Schedule initial matches scraping after 45 seconds to avoid high RAM/CPU on boot
setTimeout(() => {
  console.log("⏰ [Startup Background] Starting initial matches scraping (masterSniffer) now...");
  masterSniffer().catch((err) => console.error("Error in initial masterSniffer:", err));
  
  // Repeat the process every 15 minutes
  setInterval(masterSniffer, 15 * 60 * 1000);
}, 45000);

// الـ APIs للـ Frontend
app.get("/api/schedule", (req, res) => res.json(scrapedMatches));

// تنظيف وتصحيح رابط المشاهدة لسينما وتجنب //watch
function cleanMovieUrl(url) {
  if (!url) return url;
  let clean = url;
  if (clean.includes("rgetUrl=")) {
    clean = decodeURIComponent(clean.split("rgetUrl=")[1]);
  }
  if (clean.includes("topcinema")) {
    // إزالة أي لاحقة watch أو /watch مكررة في النهاية
    clean = clean.replace(/\/+watch\/?$/, "");
    // إضافة /watch بشكل صحيح ونظيف
    clean = clean.endsWith("/") ? clean + "watch" : clean + "/watch";
  } else if (clean.includes("asd.ink") || clean.includes("arabseed")) {
    // إزالة أي لاحقة watch أو /watch مكررة في النهاية
    clean = clean.replace(/\/+watch\/?$/, "");
    // إضافة /watch/ بشكل صحيح ونظيف للأفلام العربية
    clean = clean.endsWith("/") ? clean + "watch/" : clean + "/watch/";
  }
  return clean;
}

// 1. Endpoint البث المباشر (FFmpeg streaming) للمباريات والأفلام (إذا أراد المستخدم تشغيل الفيديو مباشرة)
app.get("/api/stream", async (req, res) => {
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

  console.log(`📡 [Direct Stream] طلب تشغيل البث لـ: ${targetUrl}`);

  if (targetUrl.includes(".m3u8")) {
    return startFfmpeg(targetUrl, res, req);
  }

  try {
    const result = await getOrSniffStream(targetUrl);
    if (result && result.streamUrl) {
      console.log(`🎯 [Direct Stream] بدء بث FFmpeg لـ: ${result.streamUrl}`);
      return startFfmpeg(result.streamUrl, res, req, result.referer);
    } else {
      res.status(404).send("لم يتم العثور على إشارة بث حالية");
    }
  } catch (err) {
    console.error(`❌ Error in /api/stream:`, err.message);
    res.status(500).send("حدث خطأ أثناء قنص البث");
  }
});

// 2. Endpoint مشغل الأفلام النظيف (JSON metadata) لعنصر الـ iframe في الفرونت إند
app.get("/api/media/stream", async (req, res) => {
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
    // 1. Check MongoDB first (Cache-First)
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
        const isLocalhost = req.headers.host && (req.headers.host.includes("localhost") || req.headers.host.includes("127.0.0.1"));
        if (!isLocalhost) {
          console.log(`📡 [Proxy Stream Redirect] Proxying HLS stream to bypass IP lock: ${finalUrl}`);
          const protocol = req.secure ? "https" : "http";
          finalUrl = `${protocol}://${req.headers.host}/api/stream?url=${encodeURIComponent(finalUrl)}`;
          finalType = "direct";
        }
      }
      
      return res.json({ streamUrl: finalUrl, type: finalType });
    }

    console.log(
      `🔍 [Cache Miss - DB] Sniffing stream using Puppeteer for: ${targetUrl}`,
    );
    // 2. Fallback to Puppeteer if not in DB or streamUrl is missing
    const result = await getOrSniffStream(targetUrl);

    if (result && result.streamUrl) {
      // Save/update to MongoDB in the background
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
        const isLocalhost = req.headers.host && (req.headers.host.includes("localhost") || req.headers.host.includes("127.0.0.1"));
        if (!isLocalhost) {
          console.log(`📡 [Proxy Stream Redirect] Proxying HLS stream to bypass IP lock: ${finalUrl}`);
          const protocol = req.secure ? "https" : "http";
          finalUrl = `${protocol}://${req.headers.host}/api/stream?url=${encodeURIComponent(finalUrl)}`;
          finalType = "direct";
        }
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
});

function startFfmpeg(url, res, req, referer) {
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
    // Consume stderr to avoid process blocking, but do not print/log the progress frames.
  });

  ffmpeg.stdout.pipe(res);
  req.on("close", () => {
    console.log("[Stream API] Client connection closed, killing FFmpeg...");
    ffmpeg.kill();
  });
}

// Hourly Cron Job using node-cron (0 * * * * = every hour)
cron.schedule("0 * * * *", async () => {
  console.log(
    "⏰ [Cron] Starting hourly movie scraping and stream sniffing job...",
  );
  try {
    await runHourlyCronJob();
  } catch (err) {
    console.error("❌ [Cron] Error in hourly movie job:", err.message);
  }
});

async function runHourlyCronJob() {
  console.log("🎬 [Cron Job] Running movieSniffer to update movie lists...");
  const totalScraped = await movieSniffer();
  if (!totalScraped || totalScraped === 0) {
    console.warn("⚠️ [Cron Job] movieSniffer returned 0 items. Skipping database update to preserve existing cache.");
    return;
  }

  const categories = [
    "arabicMovies",
    "englishMovies",
    "arabicSeries",
    "englishSeries",
  ];

  for (const category of categories) {
    const items = scrapedData[category] || [];
    console.log(
      `🎬 [Cron Job] Processing ${items.length} items in category: ${category}`,
    );

    for (const item of items) {
      try {
        await Media.findOneAndUpdate(
          { url: item.targetUrl },
          {
            title: item.title,
            url: item.targetUrl,
            poster: item.poster,
            platform: item.targetUrl.includes("topcinema")
              ? "topcinema"
              : item.targetUrl.includes("arabseed") ||
                  item.targetUrl.includes("asd")
                ? "arabseed"
                : "other",
            category: category,
          },
          { upsert: true, new: true },
        );
        console.log(`✅ [Cron] Saved metadata for: ${item.title}`);
      } catch (err) {
        console.error(
          `❌ [Cron] Error processing item ${item.title}:`,
          err.message,
        );
      }
    }
  }
  console.log("🏁 [Cron Job] Hourly movie scraping and sniffing completed.");
}

// Initialize startup tasks immediately on boot
async function initializeStartup() {
  console.log("🚀 Restoring cache from DB on startup...");

  if (mongoose.connection.readyState === 1) {
    // استعادة مباريات اليوم من قاعدة البيانات لتجنب البيانات الوهمية
    try {
      const cachedMatches = await Match.find({});
      if (cachedMatches && cachedMatches.length > 0) {
        scrapedMatches = cachedMatches.map((c) => ({
          id: c.matchId,
          teamA: c.teamA,
          teamB: c.teamB,
          isLive: c.isLive,
          time: c.time,
          targetSiteUrl: c.targetSiteUrl,
          alternativeUrls: c.alternativeUrls,
        }));
        console.log(
          `🔌 [DB] Loaded ${scrapedMatches.length} cached matches from database.`,
        );
      } else {
        console.log("🔄 No cached matches in DB, loading fallback...");
        loadFallback();
      }
    } catch (err) {
      console.error("❌ [DB] Error loading matches on startup:", err.message);
      loadFallback();
    }

    const categories = [
      "arabicMovies",
      "englishMovies",
      "arabicSeries",
      "englishSeries",
    ];
    for (const cat of categories) {
      await fetchCategoryFromDB(cat);
    }
  } else {
    console.log(
      `⚠️ [DB] MongoDB not connected yet (state: ${mongoose.connection.readyState}). Skipping cache restore, loading fallback matches.`,
    );
    loadFallback();
  }

  console.log("🚀 Starting initial startup checks...");
  let movieCount = 0;
  if (mongoose.connection.readyState === 1) {
    try {
      movieCount = await Media.countDocuments({});
      console.log(`🔌 [DB Check] Database contains ${movieCount} media items.`);
    } catch (err) {
      console.error("❌ [DB Check] Error counting media documents:", err.message);
    }
  }

  if (movieCount > 0) {
    console.log("🚀 [Startup] Skipping initial scraping job since database has seeded data.");
  } else {
    console.log("🚀 [Startup] Database is empty. Scheduling initial movie scraping in the background after 90 seconds...");
    setTimeout(() => {
      console.log("⏰ [Startup Background] Starting initial movie scraping job now...");
      runHourlyCronJob().catch((err) =>
        console.error("Error running background startup cron job:", err)
      );
    }, 90000); // 90 seconds delay
  }
}

// Pre-populate with fallback matches immediately to have data during DB connection phase
loadFallback();

// Start Express server immediately and bind to the PORT to avoid 502 Bad Gateway on Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Slayer Scraper Running on Port ${PORT} (Initializing DB connection in background...)`);
});

// Handle the background DB connection results when they resolve
dbConnectPromise
  .then(async () => {
    await initializeStartup();
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error on startup:", err.message || err);
    console.log("⚠️ Starting server in Fallback Mode (No DB connection)...");
    initializeStartup();
  });
