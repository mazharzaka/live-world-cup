const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function launchBrowser() {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-accelerated-2d-canvas',
    '--no-zygote',
    '--disable-extensions',
    "--ignore-certificate-errors",
    "--ignore-ssl-errors=yes"
  ];
  return await puppeteer.launch({
    headless: true,
    args,
  });
}

async function run() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
    
    // Intercept requests
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes(".m3u8") || url.includes(".mp4") || url.includes(".ts")) {
        console.log("🎯 Caught request:", url);
      }
      req.continue().catch(() => {});
    });

    console.log("Navigating to stmruby...");
    await page.goto("https://stmruby.com/embed-yvrljqveztdl.html", { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("Loaded page title:", await page.title());

    // Wait 5 seconds
    await new Promise(r => setTimeout(r, 5000));
    
    // Dump page HTML structure
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("HTML length:", html.length);
    console.log("HTML Preview (first 1000 chars):", html.substring(0, 1000));

    // Look for video or iframe or scripts
    const media = await page.evaluate(() => {
      const v = document.querySelector("video");
      const iframe = document.querySelector("iframe");
      const scripts = Array.from(document.querySelectorAll("script")).map(s => s.src || s.textContent.substring(0, 100));
      return {
        video: v ? { src: v.src, html: v.outerHTML } : null,
        iframe: iframe ? { src: iframe.src } : null,
        scriptsCount: scripts.length
      };
    });
    console.log("Media elements:", media);

  } catch (e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
}

run();
