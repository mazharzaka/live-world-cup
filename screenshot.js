const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function takeScreenshots() {
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

  const urls = {
    wecima: "https://wecima.click",
    wecimacx: "https://wecima.cx",
    arabseed: "https://m.asd.ink",
    egybest: "https://egybest.mx"
  };

  for (const [name, url] of Object.entries(urls)) {
    const page = await browser.newPage();
    try {
      console.log(`Taking screenshot for ${name} (${url})...`);
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await new Promise(r => setTimeout(r, 5000));
      await page.screenshot({ path: `screenshot_${name}.png` });
      console.log(`Saved screenshot_${name}.png`);
    } catch (err) {
      console.log(`Failed ${name}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

takeScreenshots();
