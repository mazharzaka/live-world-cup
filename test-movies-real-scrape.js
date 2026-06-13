const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function runScraperTest() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
      "--ignore-ssl-errors=yes"
    ]
  });

  const targets = [
    { name: "Wecima Click", url: "https://wecima.click/" },
    { name: "ArabSeed Real", url: "https://m.asd.ink/home7/" }
  ];

  for (const target of targets) {
    const page = await browser.newPage();
    try {
      console.log(`\n--- Testing ${target.name} (${target.url}) ---`);
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await new Promise(r => setTimeout(r, 6000));

      const title = await page.title();
      console.log(`Title: "${title}"`);

      const extracted = await page.evaluate(() => {
        const items = [];
        const allLinks = document.querySelectorAll("a");
        
        allLinks.forEach((a) => {
          const href = a.href;
          if (!href || !href.startsWith("http") || href === window.location.href) return;

          // Check if there is an image inside the link or parent or siblings
          const imgEl = a.querySelector("img") || 
                        (a.parentElement ? a.parentElement.querySelector("img") : null) ||
                        (a.parentElement && a.parentElement.parentElement ? a.parentElement.parentElement.querySelector("img") : null);
          if (!imgEl) return;

          const posterUrl = imgEl.getAttribute("data-src") || 
                            imgEl.getAttribute("data-lazy-src") || 
                            imgEl.getAttribute("data-original") || 
                            imgEl.getAttribute("lazy-src") || 
                            imgEl.src;

          if (!posterUrl || !posterUrl.startsWith("http")) return;

          const altText = imgEl.getAttribute("alt") || "";
          const linkText = a.innerText || "";
          const parentText = a.parentElement ? a.parentElement.innerText : "";
          const combinedText = `${altText} ${linkText} ${parentText}`.replace(/\s+/g, " ").trim();

          const isMovieOrSerie = combinedText.includes("فيلم") || 
                                 combinedText.includes("مسلسل") || 
                                 combinedText.includes("حلقة") || 
                                 combinedText.includes("مترجم") ||
                                 combinedText.includes("عرض");

          if (isMovieOrSerie && combinedText.length > 5) {
            if (!items.some(item => item.link === href)) {
              items.push({
                rawTitle: combinedText,
                poster: posterUrl,
                link: href
              });
            }
          }
        });
        return items;
      });

      console.log(`Extracted items count: ${extracted.length}`);
      if (extracted.length > 0) {
        console.log("Sample items (first 3):");
        console.log(JSON.stringify(extracted.slice(0, 3), null, 2));
      }
    } catch (err) {
      console.log(`Error testing ${target.name}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

runScraperTest();
