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
    const matchCards = document.querySelectorAll('.AY_Match');

    if (matchCards.length > 0) {
        matchCards.forEach(card => {
            // قنص الفريق الأول والثاني من الكلاسات المخصصة
            const teamAEl = card.querySelector('.TM1 .TM_Name');
            const teamBEl = card.querySelector('.TM2 .TM_Name');
            
            // قنص رابط البث الشفاف
            const linkEl = card.querySelector('a[href*="/matches/"]');

            if (teamAEl && teamBEl && linkEl) {
                const teamA = teamAEl.innerText.trim();
                const teamB = teamBEl.innerText.trim();
                const href = linkEl.href;

                items.push({
                    title: `${teamA} 🆚 ${teamB}`,
                    link: href
                });
            }
        });
    } 
    
    // 2. Fallback الكلاسيكي للمواقع التانية لو ملقاش الستركتشر ده
    if (items.length === 0) {
        const allLinks = document.querySelectorAll('main a, #content a, .content a');
        allLinks.forEach(a => {
            const text = (a.innerText || "").trim();
            if ((text.includes('🆚') || text.includes('ضد') || text.includes('مباراة')) && a.href.startsWith('http')) {
                items.push({ title: text, link: a.href });
            }
        });
    }

    return items;
});

      if (extractedLinks.length > 0) {
        extractedLinks.forEach((item) => {
          let cleanTitle = item.title;
          cleanTitle = cleanTitle
            .replace(/مشاهدة مباراة/g, "")
            .replace(/اليوم \d{1,2}-\d{1,2}-\d{2,4}/g, "")
            .replace(/قمة ملعب.*/g, "")
            .trim();

          let separator = " و ";
          if (cleanTitle.includes(" ضد ")) separator = " ضد ";
          else if (cleanTitle.includes(" 🆚 ")) separator = " 🆚 ";

          const parts = cleanTitle.split(separator);
          let teamA = parts[0] ? parts[0].trim() : "فريق أ";
          let teamB = parts[1] ? parts[1].trim() : "فريق ب";

          if (teamB.includes("في")) teamB = teamB.split("في")[0];
          if (teamB.includes("ضمن")) teamB = teamB.split("ضمن")[0];
          teamB = teamB.trim();

          const isLiveNow =
            item.link.includes("live") || item.title.includes("الآن");

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
    scrapedMatches = Array.from(
      new Map(matchesFound.map((m) => [`${m.teamA}-${m.teamB}`, m])).values(),
    );
    console.log(
      `📊 إجمالي المباريات المجمعة من كل المواقع معاً: ${scrapedMatches.length}`,
    );
  } else {
    console.log("🔄 شحن داتا الديمو...");
    loadFallback();
  }
}
// تشغيل وتكرار العملية كل 15 دقيقة
masterSniffer();
setInterval(masterSniffer, 15 * 60 * 1000);

// الـ APIs للـ Frontend
app.get("/api/schedule", (req, res) => res.json(scrapedMatches));

app.get("/api/stream", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("الرابط مطلوب");

  // لو الرابط المارر هو أصلاً سورس بث مباشر جاهز (HLS .m3u8) شغل الـ FFmpeg فوراً
  if (targetUrl.includes(".m3u8")) {
    return startFfmpeg(targetUrl, res, req);
  }

  // لو الرابط موقع، يفتح البابيتير ويقنص اللينك المخفي
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  let caughtM3u8 = null;

  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (r.url().includes(".m3u8")) caughtM3u8 = r.url();
    r.continue();
  });

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 15000 });
  } catch (e) {}

  await browser.close();

  if (caughtM3u8) {
    startFfmpeg(caughtM3u8, res, req);
  } else {
    res.status(404).send("لم يتم العثور على إشارة بث حالية");
  }
});

function startFfmpeg(url, res, req) {
  res.setHeader("Content-Type", "video/mp4");
  const ffmpeg = spawn("ffmpeg", [
    "-i",
    url,
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-movflags",
    "frag_keyframe+empty_moov+faststart",
    "-f",
    "mp4",
    "-",
  ]);
  ffmpeg.stdout.pipe(res);
  req.on("close", () => ffmpeg.kill());
}

app.listen(3001, () => console.log("🚀 Slayer Scraper Running on Port 3001"));
