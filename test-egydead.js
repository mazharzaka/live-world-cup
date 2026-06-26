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

async function configurePage(page) {
  await page.setDefaultNavigationTimeout(60000);
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  );
}

async function testSniff(url) {
  console.log(`Sniffing: ${url}`);
  const browser = await launchBrowser();
  let caughtStream = null;
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await configurePage(page);

    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const reqUrl = r.url().toLowerCase();
      const type = r.resourceType();
      
      if (["image", "stylesheet", "font", "ping", "manifest"].includes(type)) {
        r.abort().catch(() => {});
        return;
      }

      if (
        (reqUrl.includes(".m3u8") || reqUrl.includes(".mp4") || reqUrl.includes(".ts")) &&
        !caughtStream
      ) {
        console.log(`🎯 Caught stream URL: ${r.url()}`);
        caughtStream = r.url();
      }
      r.continue().catch(() => {});
    });

    page.on("response", async (response) => {
      const ct = response.headers()["content-type"] || "";
      if (
        (ct.includes("mpegurl") || ct.includes("x-mpegURL") || ct.includes("m3u8")) &&
        !caughtStream
      ) {
        console.log(`🎯 Caught stream via Content-Type: ${response.url()}`);
        caughtStream = response.url();
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("Page loaded. Title:", await page.title());

    // Click Watch Button if exists
    const watchNowSelector = ".watchNow button, button.watchNow, .watchNow input[type='submit']";
    const hasWatchButton = await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (btn) return true;
      const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], a"));
      for (let b of buttons) {
        const txt = b.innerText || b.textContent || "";
        if (txt.includes("المشاهده") || txt.includes("المشاهدة")) return true;
      }
      return false;
    }, watchNowSelector);

    if (hasWatchButton) {
      console.log("Clicking watch button...");
      await page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) { btn.click(); return; }
        const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], a"));
        for (let b of buttons) {
          const txt = b.innerText || b.textContent || "";
          if (txt.includes("المشاهده") || txt.includes("المشاهدة")) { b.click(); return; }
        }
      }, watchNowSelector);
      
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
    }

    // Wait 5 seconds to catch stream
    await new Promise(r => setTimeout(r, 5000));

    if (caughtStream) {
      console.log("SUCCESS:", caughtStream);
      return;
    }

    console.log("Trying DOM extraction...");
    const embedUrl = await page.evaluate(() => {
      const serverElements = document.querySelectorAll(".servers, .serversList li, [class*=\"server\"] li, [class*=\"server\"] a, [class*=\"server\"] button");
      for (let el of serverElements) {
        const src = el.getAttribute("data-url") || el.getAttribute("data-src") || el.getAttribute("data-link") || el.href;
        if (src && src.startsWith("http") && !src.includes("youtube.com") && !src.includes("facebook.com")) {
          return src;
        }
      }

      const iframes = Array.from(document.querySelectorAll("iframe"));
      for (let iframe of iframes) {
        const src = iframe.src || iframe.getAttribute("data-src");
        if (src && src.startsWith("http") && !src.includes("youtube.com") && !src.includes("facebook.com")) {
          return src;
        }
      }
      return null;
    });

    console.log("Extracted Embed URL:", embedUrl);

    if (embedUrl) {
      console.log("Navigating to Embed URL...");
      await page.goto(embedUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(e => console.log("Embed load timeout:", e.message));
      await new Promise(r => setTimeout(r, 5000));
    }

    console.log("FINAL caughtStream:", caughtStream);

  } catch (err) {
    console.error("Error during test:", err);
  } finally {
    await browser.close();
  }
}

testSniff("https://tv9.egydead.live/midsommar-2019-dc-1080p-bluray/").catch(console.error);
