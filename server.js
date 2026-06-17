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
  "https://wecima.show",
  "https://arabseed.show",
  "https://egybest.mx",
  "https://cima4u.vip",
  "https://movs4u.tv",
  "https://lodynet.asia",
  "https://animelek.me",
  "https://web.topcinemaa.com/",
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
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
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

            await page.goto(baseUrl, { waitUntil: "networkidle2" });
            await new Promise((r) => setTimeout(r, 2000));

            // If we ended up on Google (ISP block/bot detection in Egypt), dynamically fallback to wecima.cc
            if (page.url().includes("google.com") && baseUrl.includes("wecima.cx")) {
              console.log("⚠️ تم اكتشاف تحويل وي سيما الأصلي إلى جوجل. جاري الانتقال إلى النطاق البديل wecima.cc...");
              baseUrl = baseUrl.replace("wecima.cx", "wecima.cc");
              await page.goto(baseUrl, { waitUntil: "networkidle2" });
              await new Promise((r) => setTimeout(r, 2000));
            }

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
                  (!href.includes("/category/") && !href.includes("/movies/") && !href.includes("/series/") && !href.includes("/list/")) ||
                  href.includes("egyptian-movies")
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
                  if (isForeign) {
                    if (!sectionsFound["englishMovies"] || href.includes("/list/")) {
                      sectionsFound["englishMovies"] = href;
                    }
                  } else if (isArabic) {
                    if (!sectionsFound["arabicMovies"] || href.includes("/list/")) {
                      sectionsFound["arabicMovies"] = href;
                    }
                  }
                } else if (hasSeries) {
                  if (isForeign) {
                    if (!sectionsFound["englishSeries"] || href.includes("/list/")) {
                      sectionsFound["englishSeries"] = href;
                    }
                  } else if (isArabic) {
                    if (!sectionsFound["arabicSeries"] || href.includes("/list/")) {
                      sectionsFound["arabicSeries"] = href;
                    }
                  }
                }
              });
              return sectionsFound;
            });

            if (isCategoryPage || Object.keys(mappedSections).length === 0) {
              if (task.fallbackBase.includes("arabic-movies") || task.fallbackBase.includes("egyptian-movies") || task.fallbackBase.includes("aflam-3arby")) {
                if (!mappedSections["arabicMovies"]) {
                  mappedSections["arabicMovies"] = baseUrl;
                }
              } else if (task.fallbackBase.includes("arabic-series")) {
                if (!mappedSections["arabicSeries"]) {
                  mappedSections["arabicSeries"] = baseUrl;
                }
              }
            }

            for (let key in mappedSections) {
              const sectionUrl = mappedSections[key];
              console.log(`📡 [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] جاري قشط القسم [${key}] من الرابط: ${sectionUrl}`);
              
              let extracted = [];
              let success = false;
              let retries = 3;
              let actualSectionUrl = sectionUrl;
              while (retries > 0 && !success) {
                try {
                  await page.goto(actualSectionUrl, { waitUntil: "networkidle2" });

                  // If we ended up on Google (ISP block/bot detection in Egypt), dynamically fallback to wecima.cc
                  if (page.url().includes("google.com") && actualSectionUrl.includes("wecima.cx")) {
                    console.log("⚠️ تم اكتشاف تحويل رابط القسم إلى جوجل. جاري الانتقال للنطاق البديل wecima.cc...");
                    actualSectionUrl = actualSectionUrl.replace("wecima.cx", "wecima.cc");
                    await page.goto(actualSectionUrl, { waitUntil: "networkidle2" });
                  }

                  await page.evaluate(async () => {
                    // Auto Scroll 3000px progressively (6 steps of 500px) to load lazy-loaded elements
                    for (let i = 0; i < 6; i++) {
                      window.scrollBy(0, 500);
                      await new Promise((r) => setTimeout(r, 400));
                    }
                  });

                  extracted = await page.evaluate((currentSectionUrl) => {
                    const items = [];
                    const cards = document.querySelectorAll(
                      '[class*="Grid"], [class*="box"], [class*="Box"], .Small--Box, [class*="movie"], [class*="card"], a',
                    );

                    cards.forEach((card) => {
                      let href = card.href || card.querySelector("a")?.href;
                      if (!href || !href.startsWith("http")) return;

                      // Smart filtering: exclude section/category/tag/page/actor/year URLs to prevent capturing them by mistake
                      const cleanHref = href.toLowerCase().replace(/\/$/, "");
                      const cleanSection = currentSectionUrl.toLowerCase().replace(/\/$/, "");

                      if (
                        cleanHref === cleanSection ||
                        cleanHref.includes("/category/") ||
                        cleanHref.includes("/genres/") ||
                        cleanHref.includes("/genre/") ||
                        cleanHref.includes("/tag/") ||
                        cleanHref.includes("/tags/") ||
                        cleanHref.includes("/actor/") ||
                        cleanHref.includes("/year/") ||
                        cleanHref.includes("/page/") ||
                        cleanHref.includes("/section/") ||
                        cleanHref.includes("/sections/") ||
                        href.includes("rgetUrl") ||
                        href.includes("url=")
                      ) {
                        return;
                      }

                      const imgEl =
                        card.tagName === "IMG" ? card : card.querySelector("img");
                      if (!imgEl) return;

                      const posterUrl =
                        imgEl.getAttribute("data-src") ||
                        imgEl.getAttribute("data-lazy-src") ||
                        imgEl.src;
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
                  }, sectionUrl);
                  success = true;
                } catch (err) {
                  retries--;
                  console.log(`⚠️ [${task.source === "topcinema" ? "توب سينما" : "عرب سيد"}] خطأ أثناء قشط القسم [${key}]. محاولات متبقية: ${retries}. الخطأ: ${err.message}`);
                  if (retries === 0) {
                    console.log(`❌ فشل قشط القسم [${key}] نهائياً بعد عدة محاولات.`);
                  } else {
                    await new Promise((r) => setTimeout(r, 2000));
                  }
                }
              }

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
            await page.close();
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
            await page.close();
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
    await browser.close();
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
// تشغيل الفحص فوراً
movieSniffer();

// Endpoint للأفلام
app.get("/api/movies", (req, res) => res.json(scrapedMovies));
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
          const allLinks = document.querySelectorAll(
            "main a, #content a, .content a",
          );
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

  console.log(`📡 [Direct Stream] جاري تشغيل البث لـ: ${targetUrl}`);

  // لو الرابط المارر هو أصلاً سورس بث مباشر جاهز (HLS .m3u8) شغل الـ FFmpeg فوراً
  if (targetUrl.includes(".m3u8")) {
    return startFfmpeg(targetUrl, res, req);
  }

  // لو الرابط موقع، يفتح البابيتير ويقنص اللينك المخفي
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  let caughtM3u8 = null;
  let resolveStream;
  const streamPromise = new Promise((resolve) => {
    resolveStream = resolve;
  });

  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const reqUrl = r.url();
    if ((reqUrl.includes(".m3u8") || reqUrl.includes(".mp4")) && !caughtM3u8) {
      caughtM3u8 = reqUrl;
      resolveStream(reqUrl);
    }
    r.continue();
  });

  try {
    // سباق بين تحميل الصفحة، التقاط الـ m3u8، أو مهلة 6 ثوانٍ كحد أقصى للإنهاء الفوري
    await Promise.race([
      page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 10000 }),
      streamPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 6000))
    ]);
  } catch (e) {
    console.log(`ℹ️ [Direct Stream] انتهت مهلة القنص المبكرة للـ HLS: ${e.message}`);
  }

  await browser.close();

  if (caughtM3u8) {
    console.log(`🎯 [Direct Stream] تم قنص m3u8 والبدء بـ FFmpeg: ${caughtM3u8}`);
    startFfmpeg(caughtM3u8, res, req);
  } else {
    res.status(404).send("لم يتم العثور على إشارة بث حالية");
  }
});

// 2. Endpoint مشغل الأفلام النظيف (JSON metadata) لعنصر الـ iframe في الفرونت إند
app.get("/api/media/stream", async (req, res) => {
  let targetUrl = req.query.targetUrl || req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "الرابط مطلوب" });

  targetUrl = cleanMovieUrl(targetUrl);
  console.log(`🎬 [Media Stream API] جاري قنص رابط البث لـ: ${targetUrl}`);

  const browser = await puppeteer.launch({
    headless: false, // سيبها false عشان تراقب المتصفح وهو بيفك الحماية ويضغط بنفسه
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--ignore-certificate-errors'
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  let caughtStream = null;
  let fallbackEmbedUrl = null;
  let resolveStream;
  const streamPromise = new Promise((resolve) => {
    resolveStream = resolve;
  });

  // 🔥 تصليح 1: نظام الـ if-else المقفل بإحكام مع فحص مرن للرابط الرئيسي
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const reqUrl = r.url().toLowerCase();
    const cleanTarget = targetUrl.toLowerCase().replace("://m.", "://"); // إزالة m. للمقارنة المرنة

    // تكة الأمان: لو الطلب ده هو الصفحة الرئيسية أو تحويلاتها، عّديه فوراً بدون فلاتر
    if (reqUrl.includes(cleanTarget) && (r.resourceType() === 'document' || r.resourceType() === 'navigation')) {
      r.continue();
      return;
    }

    // حظر الإعلانات الشرسة فقط اللي بتعمل بوب اب وشلل
    if (
      reqUrl.includes("popads") ||
      reqUrl.includes("adsterra") ||
      reqUrl.includes("analytics") ||
      reqUrl.includes("doubleclick") ||
      reqUrl.includes("onclick") ||
      reqUrl.includes("exoclick")
    ) {
      r.abort();
    }
    else {
      // التقاط الـ m3u8 أو mp4 أو ts لايف من الشبكة
      if ((reqUrl.includes(".m3u8") || reqUrl.includes(".mp4") || reqUrl.includes(".ts")) && !caughtStream) {
        if (!reqUrl.includes("google") && !reqUrl.includes("facebook")) {
          caughtStream = r.url();
          resolveStream(caughtStream);
        }
      }
      r.continue();
    }
  });

  // 1. محاولة تحميل الصفحة الأب
  try {
    await Promise.race([
      // 🔥 تصليح 2: استبدال commit بـ domcontentloaded (القيمة الرسمية الصحيحة والسريعة)
      page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15000 }),
      streamPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
    ]);
  } catch (e) {
    console.log(`ℹ️ [Media Stream API] انتهت مهلة قنص الصفحة الرئيسية (متوقع): ${e.message}`);
  }

  // 2. تكتيك الفرز والضغط الذكي (عرب سيد + سينما فور اب)
  if (!caughtStream) {
    try {
      // فحص لو الـ iframe مش ظاهر في أول لقطة (حالة عرب سيد وعمليات الـ Defer)
      const hasIframe = await page.$("iframe");
      if (!hasIframe) {
        console.log(`⚙️ [تكتيك عرب سيد] الـ iframe مختفي، جاري محاكاة الضغط على قائمة السيرفرات...`);
        await page.evaluate(() => {
          // استهداف أزرار سيرفرات التشغيل في عرب سيد، سينما فور اب، وماي سيما
          const serverButtons = document.querySelectorAll(".servers-list li, .serversNav li, [class*=\"server\"] li, .watch-servers a, .ServersList a");
          if (serverButtons.length > 0) {
            serverButtons[0].click(); // اضغط على أول سيرفر متاح لتوليد الـ iframe ديناميكياً
          }
        });
        await new Promise((r) => setTimeout(r, 3000)); // انتظار 3 ثوانٍ كاملة لفرش الـ DOM الجديد وتوليد الـ iframe
      }

      // لقط الـ Embed URL من الـ iframe المكتشف أو المتولد
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
        console.log(`📡 [Media Stream API] تم العثور على مشغل خارجي: ${embedUrl}. جاري الاختراق العميق...`);

        // 🔥 تصليح 3: تعديل الـ waitUntil هنا أيضاً لـ domcontentloaded
        await page.goto(embedUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await new Promise((r) => setTimeout(r, 2000));

        // كليك ذكي جوه الـ Embed لتنشيط حزم الـ mp4/m3u8 المستهبلة في الشبكة
        if (!caughtStream) {
          console.log("🖱️ [Media Stream API] جاري عمل Click داخل المشغل لتفجير الـ Network Requests...");
          await page.mouse.click(680, 400);
        }

        await Promise.race([
          streamPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout inside embed")), 6000))
        ]);
      }
    } catch (err) {
      console.log(`ℹ️ [Media Stream API] فشل القنص العميق داخل المشغل: ${err.message}`);
    }
  }

  // 3. الإغلاق والإنقاذ
  await browser.close();

  if (!caughtStream && fallbackEmbedUrl) {
    caughtStream = fallbackEmbedUrl;
  }

  console.log("💎 الرابط النهائي المستخرج:", caughtStream);

  if (caughtStream) {
    console.log(`🎯 [Media Stream API] نجاح قنص الرابط: ${caughtStream}`);
    let type = "iframe";
    if (caughtStream.includes(".m3u8") || caughtStream.includes("urlset")) {
      type = "hls";
    } else if (caughtStream.includes(".mp4") || caughtStream.includes(".ts")) {
      type = "direct";
    }
    res.json({ streamUrl: caughtStream, type });
  } else {
    console.log(`❌ [Media Stream API] لم يتم العثور على رابط بث`);
    res.status(404).json({ error: "لم يتم العثور على رابط بث نظيف حالياً" });
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
