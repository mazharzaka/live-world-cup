// server.js
require("dotenv").config();
const mongoose = require("mongoose");
const cron = require("node-cron");
const Media = require("./src/models/Media");

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/stream-hunter";
mongoose.connect(MONGODB_URI)
  .then(() => console.log("🔌 Connected to MongoDB Successfully!"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

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
  const cleanStr1 = `${m1.teamA} ${m1.teamB}`.replace(/ال/g, '').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '').trim();
  const cleanStr2 = `${m2.teamA} ${m2.teamB}`.replace(/ال/g, '').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '').trim();

  const words1 = `${m1.teamA} ${m1.teamB}`.toLowerCase().split(/[\s🆚]+/).map(w => w.replace(/^ال/, '').trim()).filter(w => w.length > 2);
  const words2 = `${m2.teamA} ${m2.teamB}`.toLowerCase().split(/[\s🆚]+/).map(w => w.replace(/^ال/, '').trim()).filter(w => w.length > 2);
  
  let matches = 0;
  for (const w of words1) {
    if (words2.includes(w)) matches++;
  }
  
  return matches >= 2 || (words1.length === 2 && matches >= 1) || cleanStr1.includes(cleanStr2) || cleanStr2.includes(cleanStr1);
}

function getFfmpegPath() {
  const fs = require("fs");
  const path = require("path");
  const userProfile = process.env.USERPROFILE || "C:\\Users\\mazharm";
  const wingetPath = path.join(userProfile, "AppData", "Local", "Microsoft", "WinGet", "Packages", "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe", "ffmpeg-8.1.1-full_build", "bin", "ffmpeg.exe");
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

async function movieSniffer() {
  console.log("🎬 [Movie Scraper] بدء شفط السينما الذكي (بدون كلاسات)...");
  let moviesFound = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors", // عشان ننسى حوار شهادات الأمان تماماً
      "--ignore-ssl-errors=yes",
    ],
  });

  for (let url of MOVIE_TARGETS) {
    let page = null;
    try {
      console.log(`🎯 جاري فتح متصفح معزول للأفلام: ${url}`);
      page = await browser.newPage();
      await page.setDefaultNavigationTimeout(45000);
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      );
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

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
      "--window-size=1366,768",
    ],
  });

  scrapedData = {
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
      fallbackBase: "https://vid.mycima.cc/categories-cimawbas.php?cat=5-cimawbas-aflam-3arby",
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
    await Promise.all(
      tasks.map(async (task) => {
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setDefaultNavigationTimeout(60000);
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        );

        // 👑 المسار الأول: توب سينما للأجنبي بالمنيو الديناميكي (شغال الله ينور)
        if (task.type === "direct_menu_site") {
          try {
            console.log(`📡 [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] جاري قنص النطاق الحي من جوجل...`);
            await page.goto(
              `https://www.google.com/search?q=${encodeURIComponent(task.searchKey)}`,
              { waitUntil: "domcontentloaded" },
            );

            let baseUrl = await page.evaluate((key) => {
              const searchLinks = document.querySelectorAll("#search a");
              for (let a of searchLinks) {
                const href = a.href ? a.href.toLowerCase() : "";
                if (
                  href &&
                  (href.includes(key) || href.includes("arabseed") || href.includes("asd")) &&
                  !href.includes("google")
                )
                  return new URL(a.href).origin;
              }
              return null;
            }, task.source);

            baseUrl = baseUrl || task.fallbackBase;
            const isCategoryPage = baseUrl.includes("/category/") || baseUrl.includes("/list/") || baseUrl.includes("categories-cimawbas") || baseUrl.includes("aflam-3arby");

            await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
            await new Promise((r) => setTimeout(r, 2000));

            const mappedSections = await page.evaluate(() => {
              const sectionsFound = {};
              const navLinks = document.querySelectorAll(
                "nav a, .menu a, header a, ul li a, .navbar a",
              );

              navLinks.forEach((a) => {
                const text = a.innerText.toLowerCase().trim();
                const href = a.href;
                if (
                  !href ||
                  !href.startsWith("http") ||
                  href === window.location.href ||
                  (!href.includes("/category/") && !href.includes("/movies/") && !href.includes("/series/"))
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

                if (hasMovies) {
                  if (isForeign) sectionsFound["englishMovies"] = href;
                  else if (isArabic) sectionsFound["arabicMovies"] = href;
                } else if (hasSeries) {
                  if (isForeign) sectionsFound["englishSeries"] = href;
                  else if (isArabic) sectionsFound["arabicSeries"] = href;
                }
              });
              return sectionsFound;
            });

            if (isCategoryPage || Object.keys(mappedSections).length === 0) {
              if (task.fallbackBase.includes("category/arabic-movies") || task.fallbackBase.includes("arabic-movies") || task.fallbackBase.includes("aflam-3arby")) {
                if (!mappedSections["arabicMovies"]) {
                  mappedSections["arabicMovies"] = baseUrl;
                }
              } else if (task.fallbackBase.includes("category/arabic-series") || task.fallbackBase.includes("arabic-series")) {
                if (!mappedSections["arabicSeries"]) {
                  mappedSections["arabicSeries"] = baseUrl;
                }
              }
            }

            for (let key in mappedSections) {
              const sectionUrl = mappedSections[key];
              console.log(`📡 [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] جاري قشط القسم [${key}] من الرابط: ${sectionUrl}`);
              await page.goto(sectionUrl, { waitUntil: "domcontentloaded" });

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
                  
                  const imgEl = card.tagName === "IMG" ? card : card.querySelector("img");
                  if (imgEl) {
                    posterUrl = imgEl.getAttribute("data-src") || imgEl.getAttribute("data-lazy-src") || imgEl.getAttribute("data-echo") || imgEl.getAttribute("data-lazy-style") || imgEl.src;
                  }

                  if (!posterUrl || posterUrl.includes("melody-lzld")) {
                    const bgSpan = card.querySelector('[data-lazy-style], [style*="background-image"]');
                    if (bgSpan) {
                      const styleStr = bgSpan.getAttribute("data-lazy-style") || bgSpan.getAttribute("style");
                      const match = styleStr.match(/url\(['"]?(.*?)['"]?\)/);
                      if (match && match[1]) {
                        posterUrl = match[1];
                      }
                    }
                  }

                  if (!posterUrl || posterUrl.includes("melody-lzld")) {
                     const allLazy = card.querySelectorAll('[data-lazy-src], [data-src], [data-echo]');
                     for(let el of allLazy) {
                         const src = el.getAttribute("data-lazy-src") || el.getAttribute("data-src") || el.getAttribute("data-echo");
                         if (src && !src.includes("melody-lzld")) {
                             posterUrl = src;
                             break;
                         }
                     }
                  }

                  if (posterUrl && posterUrl.includes("melody-lzld")) {
                      // Don't drop it, just use a fallback or keep it so we don't lose the movie!
                      posterUrl = "https://placehold.co/300x450/1a1a1a/FFF?text=Poster";
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
                  const titleText = titleEl
                    ? titleEl.innerText.trim()
                    : (imgEl.getAttribute("alt") || "").trim();

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

              extracted.forEach((item) => {
                let cleanTitle = item.title
                  .replace(/مشاهدة/g, "")
                  .replace(/فيلم/g, "")
                  .replace(/مسلسل/g, "")
                  .replace(/مترجم/g, "")
                  .replace(/اون لاين/g, "")
                  .trim();
                let targetLink = item.link;
                if (targetLink.includes("mycima") && targetLink.includes("watch.php")) {
                  targetLink = targetLink.replace("watch.php", "play.php");
                }
                if (
                  !scrapedData[key].some((el) => el.targetUrl === targetLink)
                ) {
                  scrapedData[key].push({
                    id: `${key}-${Math.random().toString(36).substr(2, 5)}`,
                    title: cleanTitle,
                    poster: item.poster,
                    targetUrl: targetLink,
                  });
                }
              });
              console.log(
                `✅ [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] لقطنا ${scrapedData[key].length} عنوان في حقل [${key}]`
              );
            }
          } catch (err) {
            console.log("❌ فشل في توب سينما:", err.message);
          } finally {
            try {
              await page.close();
            } catch (e) {
              console.log("⚠️ فشل إغلاق الصفحة (توب سينما):", e.message);
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
                  !scrapedData[key].some((el) => el.targetUrl === item.link)
                ) {
                  scrapedData[key].push({
                    id: `${key}-${Math.random().toString(36).substr(2, 5)}`,
                    title: cleanTitle,
                    poster: item.poster,
                    targetUrl: item.link,
                  });
                }
              });
              console.log(
                `✅ [جوجل عربي] لقطنا بنجاح ${scrapedData[key].length} عنوان عربي في حقل [${key}]`,
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
      }),
    );

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
}

// 4️⃣ رابعاً: تحديث الـ Endpoint عشان ترجع الداتا المتفصصة دي
// 1. Endpoint الأفلام العربي
app.get("/api/movies/arabic", (req, res) => {
  console.log("🎬 [API] طلب قائمة الأفلام العربية...");
  res.json(scrapedData.arabicMovies);
});

// 2. Endpoint الأفلام الأجنبي
app.get("/api/movies/english", (req, res) => {
  console.log("🎬 [API] طلب قائمة الأفلام الأجنبية...");
  res.json(scrapedData.englishMovies);
});

// 3. Endpoint المسلسلات العربي
app.get("/api/series/arabic", (req, res) => {
  console.log("📺 [API] طلب قائمة المسلسلات العربية...");
  res.json(scrapedData.arabicSeries);
});

// 4. Endpoint المسلسلات الأجنبي
app.get("/api/series/english", (req, res) => {
  console.log("📺 [API] طلب قائمة المسلسلات الأجنبية...");
  res.json(scrapedData.englishSeries);
});
// Disabled immediate sniffer call since it's now handled by runHourlyCronJob on startup
// movieSniffer();

app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Search query required" });
  
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--ignore-certificate-errors",
        "--window-size=1366,768",
      ],
    });

    const results = [];
    const topCinemaUrl = `https://web.topcinemaa.com/search/?query=${encodeURIComponent(query)}&type=all`;
    const myCimaUrl = `https://vid.mycima.cc/search.php?keywords=${encodeURIComponent(query)}&video-id=`;

    const tasks = [
      { url: topCinemaUrl, source: "topcinema", key: "englishMovies" },
      { url: myCimaUrl, source: "mycima", key: "arabicMovies" }
    ];

    await Promise.all(tasks.map(async (task) => {
      let page;
      try {
        page = await browser.newPage();
        await page.setDefaultNavigationTimeout(45000);
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        
        try {
          await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        } catch (e) {
          console.log(`[Search] Navigation timeout for ${task.source}, but continuing with extraction...`);
        }
        
        await page.evaluate(async () => {
          for (let i = 0; i < 5; i++) {
            window.scrollBy(0, 600);
            await new Promise((r) => setTimeout(r, 400));
          }
        });

        const extracted = await page.evaluate(() => {
          const items = [];
          const cards = document.querySelectorAll('.Small--Box, [class*="movie"], [class*="card"], .pm-video-thumb');
          cards.forEach((card) => {
            let validAnchor = card.tagName === "A" ? card : (card.querySelector('a:not([href*="#"])') || card.querySelector("a"));
            let href = validAnchor?.href;
            if (!href || !href.startsWith("http")) return;

            let posterUrl = "";
            const imgEl = card.tagName === "IMG" ? card : card.querySelector("img");
            if (imgEl) {
              posterUrl = imgEl.getAttribute("data-src") || imgEl.getAttribute("data-lazy-src") || imgEl.getAttribute("data-echo") || imgEl.getAttribute("data-lazy-style") || imgEl.src;
            }

            if (!posterUrl || posterUrl.includes("melody-lzld")) {
              const bgSpan = card.querySelector('[data-lazy-style], [style*="background-image"]');
              if (bgSpan) {
                const styleStr = bgSpan.getAttribute("data-lazy-style") || bgSpan.getAttribute("style");
                const match = styleStr.match(/url\(['"]?(.*?)['"]?\)/);
                if (match && match[1]) posterUrl = match[1];
              }
            }

            if (!posterUrl || posterUrl.includes("melody-lzld")) {
              const allLazy = card.querySelectorAll('[data-lazy-src], [data-src], [data-echo]');
              for(let el of allLazy) {
                const src = el.getAttribute("data-lazy-src") || el.getAttribute("data-src") || el.getAttribute("data-echo");
                if (src && !src.includes("melody-lzld")) {
                  posterUrl = src;
                  break;
                }
              }
            }

            if (posterUrl && posterUrl.includes("melody-lzld")) {
                posterUrl = "https://placehold.co/300x450/1a1a1a/FFF?text=Poster";
            }

            if (!posterUrl || posterUrl.includes("logo") || posterUrl.includes("blank") || posterUrl.includes("cover.jpg")) return;

            const titleEl = card.querySelector("h3") || card.querySelector(".title");
            const titleText = titleEl ? titleEl.innerText.trim() : (imgEl?.getAttribute("alt") || "").trim();

            if (titleText && titleText.length > 2) {
              if (!items.some(i => i.link === href)) {
                items.push({ title: titleText, poster: posterUrl, link: href });
              }
            }
          });
          return items;
        });

        extracted.forEach((item) => {
          let cleanTitle = item.title.replace(/مشاهدة/g, "").replace(/فيلم/g, "").replace(/مسلسل/g, "").replace(/مترجم/g, "").replace(/اون لاين/g, "").trim();
          let targetLink = item.link;
          if (targetLink.includes("mycima") && targetLink.includes("watch.php")) {
            targetLink = targetLink.replace("watch.php", "play.php");
          }
          if (!results.some(r => r.targetUrl === targetLink)) {
            results.push({
              id: `${task.key}-${Math.random().toString(36).substr(2, 5)}`,
              title: cleanTitle,
              poster: item.poster,
              targetUrl: targetLink
            });
          }
        });
      } catch (err) {
        console.error(`❌ Search error on ${task.source}:`, err.message);
      } finally {
        if (page) await page.close();
      }
    }));

    await browser.close();
    res.json(results);
  } catch (err) {
    console.error("Search API Error:", err);
    res.status(500).json({ error: "Internal Search Error" });
  }
});

// Endpoint للأفلام
app.get("/api/movies", (req, res) => res.json(scrapedMovies));

// ─── Stream Cache & background pre-sniffer ───────────────────────────
const streamCache = new Map(); // key: watchUrl, value: { streamUrl, type, referer, timestamp }

async function getOrSniffStream(url) {
  if (!url) return null;
  
  // Clean URL first
  const cleanUrl = cleanMovieUrl(url);
  
  // 1. Check cache (valid for 10 minutes)
  const cached = streamCache.get(cleanUrl);
  if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
    console.log(`⚡ [Cache Hit] Stream found in cache for: ${cleanUrl}`);
    return cached;
  }
  
  console.log(`🔍 [Cache Miss] Sniffing stream for: ${cleanUrl}`);
  // Launch Puppeteer to resolve the stream URL
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--ignore-certificate-errors",
    ],
  });
  
  let caughtStream = null;
  let fallbackEmbedUrl = null;
  let resolveStream;
  const streamPromise = new Promise((resolve) => {
    resolveStream = resolve;
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const reqUrl = r.url().toLowerCase();
      const cleanTarget = cleanUrl.toLowerCase().replace("://m.", "://");
      
      if (reqUrl.includes(cleanTarget) && (r.resourceType() === 'document' || r.resourceType() === 'navigation')) {
        r.continue();
        return;
      }
      
      if (
        reqUrl.includes("popads") ||
        reqUrl.includes("adsterra") ||
        reqUrl.includes("analytics") ||
        reqUrl.includes("doubleclick") ||
        reqUrl.includes("onclick") ||
        reqUrl.includes("exoclick")
      ) {
        r.abort();
      } else {
        if ((reqUrl.includes(".m3u8") || reqUrl.includes(".mp4") || reqUrl.includes(".ts")) && !caughtStream) {
          if (!reqUrl.includes("google") && !reqUrl.includes("facebook")) {
            caughtStream = r.url();
            resolveStream(caughtStream);
          }
        }
        r.continue();
      }
    });
    
    try {
      await Promise.race([
        page.goto(cleanUrl, { waitUntil: "domcontentloaded", timeout: 15000 }),
        streamPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
      ]);
    } catch (e) {
      console.log(`ℹ️ [Sniffer] Page load timeout: ${e.message}`);
    }
    
    if (!caughtStream) {
      const hasIframe = await page.$("iframe");
      if (!hasIframe) {
        await page.evaluate(() => {
          const serverButtons = document.querySelectorAll(".servers-list li, .serversNav li, [class*=\"server\"] li, .watch-servers a, .ServersList a");
          if (serverButtons.length > 0) {
            serverButtons[0].click();
          }
        });
        await new Promise((r) => setTimeout(r, 3000));
      }
      
      await page.waitForSelector("iframe", { timeout: 5000 });
      const embedUrl = await page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll("iframe"));
        for (let iframe of iframes) {
          const src = iframe.src || iframe.getAttribute("data-src") || iframe.getAttribute("data-lazy-src");
          if (src && (src.includes("embed") || src.includes("player") || src.includes("vidtube") || src.includes("asd") || src.includes("arabseed"))) {
            return src;
          }
        }
        return null;
      });
      
      if (embedUrl) {
        fallbackEmbedUrl = embedUrl;
        await page.goto(embedUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await new Promise((r) => setTimeout(r, 2000));
        
        if (!caughtStream) {
          await page.mouse.click(680, 400);
        }
        
        await Promise.race([
          streamPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout inside embed")), 6000))
        ]);
      }
    }
  } catch (err) {
    console.error(`❌ Sniffer helper error for ${cleanUrl}:`, err.message);
  } finally {
    try {
      await browser.close();
    } catch (e) {}
  }
  
  if (!caughtStream && fallbackEmbedUrl) {
    caughtStream = fallbackEmbedUrl;
  }
  
  if (caughtStream) {
    let type = "iframe";
    if (caughtStream.includes(".m3u8") || caughtStream.includes("urlset")) {
      type = "hls";
    } else if (caughtStream.includes(".mp4") || caughtStream.includes(".ts")) {
      type = "direct";
    }
    const data = {
      streamUrl: caughtStream,
      type,
      referer: cleanUrl,
      timestamp: Date.now()
    };
    streamCache.set(cleanUrl, data);
    console.log(`🎯 [Sniffer success] Cached stream for: ${cleanUrl} -> ${caughtStream}`);
    return data;
  }
  
  return null;
}

async function masterSniffer() {
  console.log("🥷 [Slayer Scraper] بدء عملية الشفط المتوازي والمستقل...");
  let matchesFound = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--ignore-certificate-errors",
    ],
  });

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
      console.log(`🎯 جاري فتح متصفح مستقل لـ: ${url}`);

      // 🆕 التكتيك السحري: فتح صفحة جديدة لكل موقع لمنع تداخل الكاش والحجب
      page = await browser.newPage();
      await page.setDefaultNavigationTimeout(35000);
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      );

      // الدخول للموقع
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await new Promise((r) => setTimeout(r, 4000)); // وقت لاستقرار الجدول
      // console.log(await page.content());
      const extractedLinks = await page.evaluate(() => {
        const items = [];

        // 1. استهداف حاويات المباريات المخصصة في هذا السورس
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
      console.log(`❌ فشل تحميل ${url}:`, err.message);
    } finally {
      // 🆕 قفل الصفحة الحالية فوراً لتوفير الرام قبل الانتقال للموقع التالي
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.log(`⚠️ فشل إغلاق الصفحة لـ ${url}:`, e.message);
        }
      }
    }
  }

  try {
    await browser.close();
  } catch (e) {
    console.log("⚠️ فشل إغلاق المتصفح (مباريات):", e.message);
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

    // Pre-sniff the main stream URL for all live matches in the background
    for (const match of grouped) {
      if (match.isLive && match.targetSiteUrl) {
        getOrSniffStream(match.targetSiteUrl).catch(() => {});
      }
    }
  } else {
    console.log("🔄 شحن داتا الديمو...");
    loadFallback();
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
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
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

// تشغيل وتكرار العملية كل 15 دقيقة
masterSniffer();
setInterval(masterSniffer, 15 * 60 * 1000);

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
  console.log(`🎬 [Media Stream API] Cache-First request for: ${targetUrl}`);
  
  try {
    // 1. Check MongoDB first (Cache-First)
    const cached = await Media.findOne({ url: targetUrl });
    if (cached && cached.streamUrl) {
      console.log(`⚡ [Cache Hit - DB] Found stream in database for: ${targetUrl}`);
      return res.json({ streamUrl: cached.streamUrl, type: cached.type });
    }
    
    console.log(`🔍 [Cache Miss - DB] Sniffing stream using Puppeteer for: ${targetUrl}`);
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
          fetchedAt: new Date()
        },
        { upsert: true, new: true }
      ).catch(err => console.error("❌ Failed to update DB on fallback stream sniff:", err.message));
      
      return res.json({ streamUrl: result.streamUrl, type: result.type });
    } else {
      return res.status(404).json({ error: "لم يتم العثور على رابط بث نظيف حالياً" });
    }
  } catch (err) {
    console.error(`❌ Error in /api/media/stream:`, err.message);
    return res.status(500).json({ error: "حدث خطأ أثناء قنص البث" });
  }
});

function startFfmpeg(url, res, req, referer) {
  res.setHeader("Content-Type", "video/mp4");
  const ffmpegBin = getFfmpegPath();

  const args = [];
  if (typeof referer !== 'undefined' && referer) {
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
  console.log("⏰ [Cron] Starting hourly movie scraping and stream sniffing job...");
  try {
    await runHourlyCronJob();
  } catch (err) {
    console.error("❌ [Cron] Error in hourly movie job:", err.message);
  }
});

async function runHourlyCronJob() {
  console.log("🎬 [Cron Job] Running movieSniffer to update movie lists...");
  await movieSniffer();
  
  const categories = ["arabicMovies", "englishMovies", "arabicSeries", "englishSeries"];
  
  for (const category of categories) {
    const items = scrapedData[category] || [];
    console.log(`🎬 [Cron Job] Processing ${items.length} items in category: ${category}`);
    
    for (const item of items) {
      try {
        const existing = await Media.findOne({ url: item.targetUrl });
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        let streamInfo = null;
        if (existing && existing.streamUrl && existing.fetchedAt > twoHoursAgo) {
          console.log(`[Cron] Using cached stream for ${item.title}`);
          streamInfo = {
            streamUrl: existing.streamUrl,
            type: existing.type
          };
        } else {
          console.log(`[Cron] Sniffing stream for ${item.title} (${item.targetUrl})...`);
          // Wait a short delay to be nice to websites
          await new Promise(r => setTimeout(r, 2000));
          streamInfo = await getOrSniffStream(item.targetUrl);
        }
        
        if (streamInfo && streamInfo.streamUrl) {
          await Media.findOneAndUpdate(
            { url: item.targetUrl },
            {
              title: item.title,
              url: item.targetUrl,
              poster: item.poster,
              streamUrl: streamInfo.streamUrl,
              type: streamInfo.type,
              platform: item.targetUrl.includes("topcinema") ? "topcinema" : (item.targetUrl.includes("arabseed") || item.targetUrl.includes("asd") ? "arabseed" : "other"),
              category: category,
              fetchedAt: new Date()
            },
            { upsert: true, new: true }
          );
          console.log(`✅ [Cron] Upserted stream for: ${item.title}`);
        } else {
          await Media.findOneAndUpdate(
            { url: item.targetUrl },
            {
              title: item.title,
              url: item.targetUrl,
              poster: item.poster,
              platform: item.targetUrl.includes("topcinema") ? "topcinema" : (item.targetUrl.includes("arabseed") || item.targetUrl.includes("asd") ? "arabseed" : "other"),
              category: category
            },
            { upsert: true, new: true }
          );
          console.log(`⚠️ [Cron] Saved metadata only (sniff failed) for: ${item.title}`);
        }
      } catch (err) {
        console.error(`❌ [Cron] Error processing item ${item.title}:`, err.message);
      }
    }
  }
  console.log("🏁 [Cron Job] Hourly movie scraping and sniffing completed.");
}

// Run initial job on startup once DB is connected
mongoose.connection.once("open", () => {
  console.log("🚀 Running initial movie scraping and sniffing job...");
  runHourlyCronJob().catch(err => console.error("Error running initial cron job:", err));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Slayer Scraper Running on Port ${PORT}`));
