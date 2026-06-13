const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const ALTS = [
  "https://wecima.cash",
  "https://wecima.club",
  "https://wecima.click",
  "https://wecima.watch",
  "https://mycima.cafe",
  "https://mycima.online"
];

async function testAlts() {
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

  for (const url of ALTS) {
    const page = await browser.newPage();
    try {
      console.log(`Trying: ${url}`);
      await page.setDefaultNavigationTimeout(20000);
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const title = await page.title();
      const textLen = await page.evaluate(() => document.body ? document.body.innerText.length : 0);
      const diagnostics = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a")).map(a => ({ href: a.href, text: a.innerText.trim() }));
        const imgs = Array.from(document.querySelectorAll("img")).map(img => ({ src: img.src, dataSrc: img.getAttribute("data-src") }));
        const bodyText = document.body ? document.body.innerText.substring(0, 1000) : "";
        return { links: links.slice(0, 20), imgs, bodyText };
      });
      console.log(`-> Success! Title: "${title}", Text Length: ${textLen}`);
      console.log(`Body text snippet:`, diagnostics.bodyText);
      console.log(`Links:`, JSON.stringify(diagnostics.links, null, 2));
      console.log(`Imgs:`, JSON.stringify(diagnostics.imgs, null, 2));
    } catch (err) {
      console.log(`-> Failed: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

testAlts();
