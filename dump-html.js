const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
puppeteer.use(StealthPlugin());

async function configurePage(page) {
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "sec-ch-ua":
      '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
  });
}

async function dump() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await configurePage(page);
  
  await page.goto("https://tv9.egydead.live/?s=transporter", { waitUntil: "domcontentloaded", timeout: 45000 });
  const html = await page.content();
  fs.writeFileSync("egydead-search.html", html);
  console.log("HTML written to egydead-search.html. Length:", html.length);
  await browser.close();
}

dump().catch(console.error);
