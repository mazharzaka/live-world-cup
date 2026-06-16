const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const MOVIE_TARGETS = [
  "https://wecima.show",
  "https://arabseed.show",
  "https://egybest.mx",
];

async function movieSniffer() {
  console.log("🎬 [Movie Scraper] بدء شفط السينما الذكي (بدون كلاسات)...");
  let moviesFound = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
      "--ignore-ssl-errors=yes",
    ],
  });

  for (let url of MOVIE_TARGETS) {
    let page = null;
    try {
      console.log(`🎯 جاري فتح متصفح معزول للأفلام: ${url}`);
      page = await browser.newPage();
      page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
      await page.setDefaultNavigationTimeout(45000);
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      );

      await page.goto(url, { waitUntil: "domcontentloaded" });
      const pageTitle = await page.title();
      console.log(`Page title for ${url}: "${pageTitle}"`);
      
      const bodyLength = await page.evaluate(() => document.body ? document.body.innerText.length : 0);
      console.log(`Body text length for ${url}: ${bodyLength}`);

      console.log(`⏳ انتظار 5 ثوانٍ لفك الـ Lazy Load في: ${url}`);
      await new Promise((r) => setTimeout(r, 5000));

      const pageDiagnostics = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a")).map(a => ({
          href: a.href,
          text: a.innerText.trim(),
          hasImg: !!a.querySelector("img"),
          parentHasImg: !!(a.parentElement && a.parentElement.querySelector("img"))
        }));
        const imgs = Array.from(document.querySelectorAll("img")).map(img => ({
          src: img.src,
          dataSrc: img.getAttribute("data-src"),
          alt: img.getAttribute("alt")
        }));
        const bodySnippet = document.body ? document.body.innerText.substring(0, 800) : "";
        return { links: links.slice(0, 15), imgs: imgs.slice(0, 10), bodySnippet };
      });

      console.log(`--- DICTIONARY FOR ${url} ---`);
      console.log(`Body Snippet:`, pageDiagnostics.bodySnippet);
      console.log(`Sample Links:`, JSON.stringify(pageDiagnostics.links, null, 2));
      console.log(`Sample Imgs:`, JSON.stringify(pageDiagnostics.imgs, null, 2));

      const extractedMovies = await page.evaluate(() => {
        const items = [];
        const allLinks = document.querySelectorAll("a");
        const allImgs = document.querySelectorAll("img");
        
        allLinks.forEach((a) => {
          const href = a.href;
          if (
            !href ||
            !href.startsWith("http") ||
            href === window.location.href
          )
            return;

          const imgEl =
            a.querySelector("img") ||
            (a.parentElement ? a.parentElement.querySelector("img") : null);
          if (!imgEl) return;

          const posterUrl =
            imgEl.getAttribute("data-src") ||
            imgEl.getAttribute("data-lazy-src") ||
            imgEl.getAttribute("data-original") ||
            imgEl.getAttribute("lazy-src") ||
            imgEl.src;

          if (!posterUrl || !posterUrl.startsWith("http")) return;

          const altText = imgEl.getAttribute("alt") || "";
          const linkText = a.innerText || "";
          const parentText = a.parentElement ? a.parentElement.innerText : "";
          const combinedText = `${altText} ${linkText} ${parentText}`
            .replace(/\s+/g, " ")
            .trim();

          const isMovieOrSerie =
            combinedText.includes("فيلم") ||
            combinedText.includes("مسلسل") ||
            combinedText.includes("حلقة") ||
            combinedText.includes("مترجم") ||
            combinedText.includes("عرض");

          if (isMovieOrSerie && combinedText.length > 5) {
            if (!items.some((item) => item.link === href)) {
              items.push({
                rawTitle: combinedText,
                poster: posterUrl,
                link: href,
              });
            }
          }
        });
        return items;
      });

      console.log(`🔍 تم العثور على ${extractedMovies.length} عناصر خام في ${url}`);

      if (extractedMovies.length > 0) {
        extractedMovies.forEach((item) => {
          let text = item.rawTitle;
          let tag = "HD";
          if (text.includes("1080p")) tag = "1080p 🔥";
          else if (text.includes("BluRay")) tag = "BluRay 💿";
          else if (text.includes("مسلسل")) tag = "مسلسل 📺";
          else if (text.includes("حلقة")) tag = "حلقة 🎞️";
          else if (text.includes("مترجم")) tag = "مترجم 📝";

          let cleanTitle = text
            .split("مشاهدة")[0]
            .split("تحميل")[0]
            .replace(/فيلم/g, "")
            .replace(/مسلسل/g, "")
            .replace(/مترجم/g, "")
            .replace(/اون لاين/g, "")
            .replace(/بجودة/g, "")
            .replace(/كامل/g, "")
            .replace(/\d{4}/g, "")
            .replace(/[-|:|'|"|’|\[\]\(\)\/]/g, "")
            .replace(/\s+/g, " ")
            .trim();

          if (cleanTitle.length < 3) {
            cleanTitle = text.split(" ").slice(0, 4).join(" ");
          }

          moviesFound.push({
            title: cleanTitle,
            tag: tag,
            poster: item.poster,
            targetMovieUrl: item.link,
          });
        });
      }
    } catch (err) {
      console.log(`❌ فشل موقع الأفلام ${url}:`, err.message);
    } finally {
      if (page) await page.close();
    }
  }

  await browser.close();
  console.log(`🎯 إجمالي النتائج التي تم قشطها: ${moviesFound.length}`);
  if (moviesFound.length > 0) {
    console.log("نموذج من أول 3 نتائج:");
    console.log(moviesFound.slice(0, 3));
  }
}

movieSniffer().catch(console.error);
