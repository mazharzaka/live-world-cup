const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const urls = [
  "https://xyzkoora-llive-mov.panel001.com/?m=30623&lang=ar",
  "https://egykoora.com/matches/%d8%a7%d9%84%d9%83%d9%88%d9%83%d8%a8-%d8%a7%d9%84%d9%85%d8%b1%d8%a7%d9%83%d8%b4%d9%8a-%d9%88-%d8%a7%d8%aa%d8%ad%d8%a7%d8%af-%d8%b7%d9%86%d8%ac%d8%a9/",
  "https://www.freekora.com/matches/%d8%a5%d9%86%d8%ac%d9%84%d8%aa%d8%b1%d8%a7-%d9%83%d8%b1%d9%88%d8%a7%d8%aa%d9%8a%d8%a7/",
  "https://a12.kooora-sia.com/bein-1/"
];

async function testAll() {
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

  for (const url of urls) {
    console.log(`\n==================================================`);
    console.log(`Testing URL: ${url}`);
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    let caught = [];
    page.on("request", (r) => {
      const u = r.url();
      if (u.includes(".m3u8")) {
        console.log(`  [FOUND .m3u8]: ${u}`);
        caught.push(u);
      }
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      console.log("  Main page loaded. Waiting 5 seconds...");
      await new Promise(r => setTimeout(r, 5000));
      
      const frameUrls = page.frames().map(f => f.url());
      console.log(`  Total frames: ${frameUrls.length}`);
      console.log(`  Frames:`, frameUrls.slice(0, 5));
    } catch (err) {
      console.log(`  Error or timeout: ${err.message}`);
    } finally {
      console.log(`  Caught m3u8 count: ${caught.length}`);
      await page.close();
    }
  }

  await browser.close();
}

testAll().catch(console.error);
