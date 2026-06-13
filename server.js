// server.js
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
const resolvedStreamsCache = {};
const MOVIE_TARGETS = [
  // 1. فاصل إعلاني - النسخة البديلة الشغالة طيارة وجدولها محدث
  "https://www.faselhd.top",

  // 2. وي سيما (البديل الرسمي لـ ماي سيما - سيرفراته طلقة في الأفلام)
  "https://wecima.show",

  // 3. عرب سيد - من أقدم وأقوى السورس اللي كروتها واضحة جداً للـ DOM
  "https://arabseed.show",

  // 4. إيجي بست الأصلي المتجدد (دومين 2026 النظيف)
  "https://egybest.mx",
];
const EXPLOIT_TARGETS = [
  "https://koray.live",
  "https://365kora.net/",
  "https://kora-live.com",
  "https://koralive.online",
  "https://www.yallashoot.video",

  // 2. كورة سيتي الأصلي (جداول ماتشات حية في نص الصفحة)
  "https://k.kooracity.me",
  "https://www.lkora.live/",
  "https://365kora.com/",

  // 3. يلا شوت فور يو (دومين متجدد ونظيف جداً من الإعلانات)
  "https://www.yalla-shoot-4u.com",

  // 4. كورة ستار (سورس بديل وممتاز للـ Live Matches)
  "https://www.koora-star.tv",
];

// server.js (إضافة كود قشط الأفلام)
let scrapedMovies = [];

// async function movieSniffer() {
//     console.log("🎬 [Movie Scraper] بدء قشط أحدث الأفلام والمسلسلات...");
//     let moviesFound = [];

//     const browser = await puppeteer.launch({
//         headless: true,
//         args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-features=IsolateOrigins,site-per-process']
//     });

//     const page = await browser.newPage();
//     await page.setDefaultNavigationTimeout(45000);
//     await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

//     for (let url of MOVIE_TARGETS) {
//         try {
//             console.log(`🎯 جاري فحص موقع الأفلام: ${url}`);
//             await page.goto(url, { waitUntil: 'domcontentloaded' });
//             await new Promise(r => setTimeout(r, 4000)); // وقت لاستقرار البوسترات

//             const extractedMovies = await page.evaluate(() => {
//                 const items = [];
//                 // في مواقع الأفلام، الكروت دايماً بتكون جوه كلاسات مثل .movie أو .item أو شبكة blocks
//                 // القشط الذكي هنا بيلقط الروابط اللي جواها صور (البوسترات)
//                 const movieCards = document.querySelectorAll('a');

//                 movieCards.forEach(a => {
//                     const img = a.querySelector('img');
//                     const title = (a.innerText || img?.alt || "").trim();

//                     // تأكيد إن الكارت عبارة عن فيلم (جواه اسم وفيه كلمة فيلم أو مسلسل أو جودة)
//                     if (img && title.length > 3 && a.href.startsWith('http')) {
//                         items.push({
//                             title: title,
//                             poster: img.src,
//                             link: a.href
//                         });
//                     }
//                 });
//                 return items;
//             });

//             if (extractedMovies.length > 0) {
//                 extractedMovies.forEach(item => {
//                     let rawTitle = item.title;

//                     // فلترة وتنظيف الاسم ليكون شيك
//                     let quality = "HD";
//                     if (rawTitle.includes('1080p')) quality = "1080p 🔥";
//                     else if (rawTitle.includes('BluRay')) quality = "BluRay 💿";
//                     else if (rawTitle.includes('مترجم')) quality = "مترجم 📝";

//                     // تنظيف الحشو من اسم الفيلم
//                     let cleanTitle = rawTitle.replace(/فيلم/g, '')
//                                            .replace(/مشاهدة/g, '')
//                                            .replace(/مترجم/g, '')
//                                            .replace(/اون لاين/g, '')
//                                            .replace(/\d{4}/g, '') // يشيل السنة من الاسم
//                                            .replace(/[-|:]/g, '')
//                                            .trim();

//                     moviesFound.push({
//                         id: `movie-${Math.random().toString(36).substr(2, 5)}`,
//                         title: cleanTitle,  // اسم الفيلم الصافي (مثال: Venom)
//                         quality: quality,   // جودة الفيلم (مثال: BluRay)
//                         poster: item.poster || "https://placehold.co/400x600/0b0f19/fff?text=Movie", // البوستر
//                         targetMovieUrl: item.link // رابط صفحة السيرفرات
//                     });
//                 });
//                 console.log(`✅ قشط بنجاح ${extractedMovies.length} فيلم من ${url}`);
//                 break; // اكتفي بأول موقع شغال
//             }
//         } catch (err) {
//             console.log(`❌ تخطي موقع الأفلام ${url}:`, err.message);
//         }
//     }

//     await browser.close();

//     if (moviesFound.length > 0) {
//         // منع التكرار بناءً على اسم الفيلم
//         scrapedMovies = Array.from(new Map(moviesFound.map(m => [m.title, m])).values());
//         console.log(`📊 إجمالي الأفلام الجاهزة في المنصة حالا: ${scrapedMovies.length}`);
//     } else {
//         // Fallback الاحتياطي للأفلام
//         scrapedMovies = [
//             { id: "m-demo-1", title: "Avatar: The Way of Water", quality: "BluRay 💿", poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400", targetMovieUrl: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8" }
//         ];
//     }
// }

// // تشغيل الفحص فوراً
// movieSniffer();

// // Endpoint للأفلام
// app.get('/api/movies', (req, res) => res.json(scrapedMovies));
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

async function masterSniffer() {
  console.log("🥷 [Slayer Scraper] بدء عملية الشفط المتوازي والمستقل...");
  let matchesFound = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--ignore-certificate-errors",
    ],
  });

  const REAL_LIVE_TARGETS = [
    "https://www.yallashoot.video",
    "https://www.kooracity.com",
    "https://www.yalla-shoot-4u.com",
  ];

  // اللف على المواقع بفتح صفحات مستقلة تماماً
  for (let url of EXPLOIT_TARGETS) {
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
            const linkEl = card.querySelector('a[href*="/matches/"]');

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
                text.includes("مباراة")) &&
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
          const { teamA, teamB } = splitMatchTitle(item.title);
          const isLiveNow =
            item.link.includes("live") || item.title.includes("الآن") || item.title.includes("مباشر");

          matchesFound.push({
            id: `sniff-${Math.random().toString(36).substr(2, 5)}`,
            teamA: teamA,
            teamB: teamB,
            isLive: isLiveNow,
            time: isLiveNow ? "لايف 🔴" : "قريباً 🕒",
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
      if (page) await page.close();
    }
  }

  await browser.close();

  // فلترة وتجميع النهائي
  if (matchesFound.length > 0) {
    const grouped = [];
    for (const m of matchesFound) {
      const existing = grouped.find(g => areMatchesSame(g, m));
      if (!existing) {
        grouped.push({
          id: m.id,
          teamA: m.teamA,
          teamB: m.teamB,
          isLive: m.isLive,
          time: m.time,
          targetSiteUrl: m.targetSiteUrl,
          alternativeUrls: []
        });
      } else {
        if (existing.targetSiteUrl !== m.targetSiteUrl && !existing.alternativeUrls.includes(m.targetSiteUrl)) {
          existing.alternativeUrls.push(m.targetSiteUrl);
        }
        if (m.isLive) {
          existing.isLive = true;
          existing.time = "لايف 🔴";
        }
      }
    }
    scrapedMatches = grouped;
    console.log(
      `📊 إجمالي المباريات المجمعة من كل المواقع معاً: ${scrapedMatches.length}`,
    );
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
        "https://www.yallashoot.video/video/canada-vs-bosnia-and-herzegovina-live-stream-12-6-2026/"
      ]
    }
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
        referer: r.headers()["referer"] || ""
      };
    }
  };

  page.on("request", requestHandler);

  try {
    console.log(`[Sniffer] Loading: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise(r => setTimeout(r, 4000));

    if (caught) {
      page.off("request", requestHandler);
      return caught;
    }

    // Check for redirection links/hash parameter
    const redirectUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      let found = links.find(l => l.href.includes("hash="));
      if (found) return found.href;
      found = links.find(l => l.innerText.includes("انقر هنا") || l.innerText.includes("المشاهدة") || l.innerText.includes("صفحة المشاهدة"));
      if (found) return found.href;
      return null;
    });

    if (redirectUrl) {
      console.log(`[Sniffer] Found redirection URL: ${redirectUrl}`);
      if (redirectUrl.includes("hash=")) {
        const urlObj = new URL(redirectUrl);
        const hash = urlObj.searchParams.get("hash");
        if (hash) {
          const decoded = Buffer.from(hash.replace(/__/g, '/').replace(/-/g, '+'), 'base64').toString('utf8');
          const foundUrls = decoded.match(/https?:\/\/[^\s"'`>]+/g);
          if (foundUrls && foundUrls.length > 0) {
            console.log(`[Sniffer] Decoded hash player URLs:`, foundUrls);
            for (const playerUrl of foundUrls) {
              console.log(`[Sniffer] Trying player URL: ${playerUrl}`);
              try {
                await page.goto(playerUrl, { waitUntil: "domcontentloaded", timeout: 12000 });
                await new Promise(r => setTimeout(r, 5000));
                if (caught) {
                  page.off("request", requestHandler);
                  return caught;
                }
              } catch (err) {
                console.log(`[Sniffer] Error on player ${playerUrl}:`, err.message);
              }
            }
          }
        }
      } else {
        console.log(`[Sniffer] Navigating to redirect page directly: ${redirectUrl}`);
        await page.goto(redirectUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await new Promise(r => setTimeout(r, 5000));
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

app.get("/api/stream", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("الرابط مطلوب");

  // Check resolvedStreamsCache first
  if (resolvedStreamsCache[targetUrl]) {
    console.log(`[Stream API] Cache HIT for resolved stream:`, resolvedStreamsCache[targetUrl]);
    const cached = resolvedStreamsCache[targetUrl];
    return startFfmpeg(cached.m3u8Url, cached.referer, res, req);
  }

  // Check if we have alternatives in scrapedMatches
  let allUrls = [targetUrl];
  const matchObj = scrapedMatches.find(m => m.targetSiteUrl === targetUrl);
  if (matchObj && matchObj.alternativeUrls) {
    allUrls.push(...matchObj.alternativeUrls);
  }

  // Also accept from query parameter
  if (req.query.alts) {
    const queryAlts = req.query.alts.split(",");
    for (const alt of queryAlts) {
      if (alt && !allUrls.includes(alt)) {
        allUrls.push(alt);
      }
    }
  }

  console.log(`[Stream API] URLs to sniff:`, allUrls);

  // If the first one is an m3u8, play directly
  if (targetUrl.includes(".m3u8")) {
    return startFfmpeg(targetUrl, "", res, req);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  );
  let caught = null;

  for (const url of allUrls) {
    caught = await sniffStream(url, page);
    if (caught) {
      console.log(`[Stream API] Found working stream:`, caught);
      break;
    }
  }

  await browser.close();

  if (caught) {
    resolvedStreamsCache[targetUrl] = caught;
    startFfmpeg(caught.m3u8Url, caught.referer, res, req);
  } else {
    res.status(404).send("لم يتم العثور على إشارة بث حالية");
  }
});

function getFfmpegPath() {
  const fs = require("fs");
  const wingetPath = "C:\\Users\\mazha\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe";
  if (fs.existsSync(wingetPath)) {
    return wingetPath;
  }
  return "ffmpeg";
}

function startFfmpeg(url, referer, res, req) {
  res.setHeader("Content-Type", "video/mp4");
  const ffmpegBin = getFfmpegPath();

  const args = [];
  if (referer) {
    args.push("-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    args.push("-referer", referer);
  }

  args.push("-i", url);
  args.push(
    "-c:v", "copy",
    "-c:a", "copy",
    "-bsf:a", "aac_adtstoasc",
    "-movflags", "frag_keyframe+empty_moov+faststart",
    "-f", "mp4",
    "-"
  );

  console.log(`[Stream API] Spawning FFmpeg from: ${ffmpegBin}`);
  const ffmpeg = spawn(ffmpegBin, args);

  ffmpeg.on("error", (err) => {
    console.error("[Stream API] FFmpeg process error:", err);
  });

  ffmpeg.stdout.pipe(res);
  req.on("close", () => {
    console.log("[Stream API] Client connection closed, killing FFmpeg...");
    ffmpeg.kill();
  });
}

app.listen(3001, () => console.log("🚀 Slayer Scraper Running on Port 3001"));
