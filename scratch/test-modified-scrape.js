const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

let scrapedData = {
  arabicMovies: [],
  englishMovies: [],
  arabicSeries: [],
  englishSeries: [],
};

async function testScraper() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
    ],
  });

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
      fallbackBase: "https://m.asd.ink/category/arabic-movies-14/",
    },
  ];

  try {
    await Promise.all(
      tasks.map(async (task) => {
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setDefaultNavigationTimeout(60000);
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        );

        if (task.type === "direct_menu_site") {
          try {
            console.log(`📡 [${task.source}] جاري قنص النطاق الحي من جوجل...`);
            await page.goto(
              `https://www.google.com/search?q=${encodeURIComponent(task.searchKey)}`,
              { waitUntil: "domcontentloaded" }
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

            console.log(`📡 [${task.source}] Google returned baseUrl: ${baseUrl}`);
            baseUrl = baseUrl || task.fallbackBase;
            console.log(`📡 [${task.source}] Final baseUrl used: ${baseUrl}`);
            
            const isCategoryPage = baseUrl.includes("/category/");
            
            await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
            await new Promise((r) => setTimeout(r, 2000));

            const mappedSections = await page.evaluate(() => {
              const sectionsFound = {};
              const navLinks = document.querySelectorAll(
                "nav a, .menu a, header a, ul li a, .navbar a"
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

            console.log(`📡 [${task.source}] Mapped sections before fallback:`, mappedSections);

            if (isCategoryPage || Object.keys(mappedSections).length === 0) {
              if (task.fallbackBase.includes("category/arabic-movies") || task.fallbackBase.includes("arabic-movies")) {
                if (!mappedSections["arabicMovies"]) {
                  mappedSections["arabicMovies"] = baseUrl;
                }
              } else if (task.fallbackBase.includes("category/arabic-series") || task.fallbackBase.includes("arabic-series")) {
                if (!mappedSections["arabicSeries"]) {
                  mappedSections["arabicSeries"] = baseUrl;
                }
              }
            }

            console.log(`📡 [${task.source}] Mapped sections after fallback:`, mappedSections);

            for (let key in mappedSections) {
              const sectionUrl = mappedSections[key];
              console.log(`📡 [${task.source}] Scraping section [${key}] URL: ${sectionUrl}`);
              await page.goto(sectionUrl, { waitUntil: "domcontentloaded" });

              await page.evaluate(async () => {
                window.scrollBy(0, 1000);
                await new Promise((r) => setTimeout(r, 1500));
              });

              const extracted = await page.evaluate(() => {
                const items = [];
                const cards = document.querySelectorAll(
                  '.Small--Box, [class*="movie"], [class*="card"], a'
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
                    href.includes("/tags/")
                  )
                    return;

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
              });

              console.log(`📡 [${task.source}] Found ${extracted.length} raw cards in [${key}]`);

              extracted.forEach((item) => {
                let cleanTitle = item.title
                  .replace(/مشاهدة/g, "")
                  .replace(/فيلم/g, "")
                  .replace(/مسلسل/g, "")
                  .replace(/مترجم/g, "")
                  .replace(/اون لاين/g, "")
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
                `✅ [${task.source}] لقطنا ${scrapedData[key].length} عنوان في حقل [${key}]`
              );
            }
          } catch (err) {
            console.log(`❌ فشل في ${task.source}:`, err.message);
          } finally {
            await page.close();
          }
        }
      })
    );
  } catch (err) {
    console.error("General error:", err.message);
  } finally {
    await browser.close();
  }

  console.log("\n--- SCRAPED DATA SUMMARY ---");
  console.log("Arabic Movies count:", scrapedData.arabicMovies.length);
  if (scrapedData.arabicMovies.length > 0) {
    console.log("Arabic Movies Sample:", scrapedData.arabicMovies.slice(0, 3));
  }
  console.log("English Movies count:", scrapedData.englishMovies.length);
  console.log("Arabic Series count:", scrapedData.arabicSeries.length);
  console.log("English Series count:", scrapedData.englishSeries.length);
}

testScraper();
