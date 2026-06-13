const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function dumpDom() {
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

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

  // 1. Check WeCima (using wecima.cx since the others link here)
  try {
    console.log("=== CHECKING WECIMA ===");
    await page.goto("https://wecima.cx/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 6000));
    
    const cardHtml = await page.evaluate(() => {
      // Find a link that contains movie keywords
      const links = Array.from(document.querySelectorAll("a"));
      const movieLink = links.find(a => a.innerText.includes("فيلم") || a.innerText.includes("مسلسل"));
      if (movieLink) {
        return {
          linkText: movieLink.innerText,
          linkHtml: movieLink.outerHTML,
          parentHtml: movieLink.parentElement ? movieLink.parentElement.outerHTML : null,
          grandParentHtml: (movieLink.parentElement && movieLink.parentElement.parentElement) ? movieLink.parentElement.parentElement.outerHTML : null
        };
      }
      return null;
    });
    console.log("Wecima Card DOM:", JSON.stringify(cardHtml, null, 2));
  } catch (err) {
    console.log("Wecima check failed:", err.message);
  }

  // 2. Check ArabSeed (using m.asd.ink since arabseed.show links there)
  try {
    console.log("=== CHECKING ARABSEED ===");
    await page.goto("https://m.asd.ink/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 6000));
    
    const cardHtml = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const movieLink = links.find(a => a.innerText.includes("فيلم") || a.innerText.includes("مسلسل"));
      if (movieLink) {
        return {
          linkText: movieLink.innerText,
          linkHtml: movieLink.outerHTML,
          parentHtml: movieLink.parentElement ? movieLink.parentElement.outerHTML : null,
          grandParentHtml: (movieLink.parentElement && movieLink.parentElement.parentElement) ? movieLink.parentElement.parentElement.outerHTML : null
        };
      }
      return null;
    });
    console.log("Arabseed Card DOM:", JSON.stringify(cardHtml, null, 2));
  } catch (err) {
    console.log("Arabseed check failed:", err.message);
  }

  await browser.close();
}

dumpDom();
