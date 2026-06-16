const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function testIntercept() {
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
  await page.setViewport({ width: 1280, height: 800 });

  // Enable request interception
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    const isNavigation = req.isNavigationRequest() && req.frame() === page.mainFrame();
    
    if (isNavigation && !url.includes("wecima") && url !== "about:blank") {
      console.log(`[INTERCEPT] Aborting main frame redirect to: ${url}`);
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    const targetUrl = "https://wecima.click/";
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    
    console.log("Waiting 6 seconds for rendering and potential redirect...");
    await new Promise(r => setTimeout(r, 6000));

    console.log(`Current URL: ${page.url()}`);
    console.log(`Title: "${await page.title()}"`);

    const extracted = await page.evaluate(() => {
      const items = [];
      const allLinks = document.querySelectorAll("a");
      allLinks.forEach(a => {
        const txt = a.innerText || "";
        if ((txt.includes("فيلم") || txt.includes("مسلسل") || txt.includes("حلقة")) && txt.trim().length > 10) {
          items.push({ href: a.href, text: txt.trim() });
        }
      });
      return items;
    });

    console.log("Extracted items:", extracted.slice(0, 10));

  } catch (err) {
    console.log("Error:", err.message);
  }

  await browser.close();
}

testIntercept();
