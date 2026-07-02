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
    headless: "shell",
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args,
  });
}

async function configurePage(page) {
  await page.setDefaultNavigationTimeout(60000);
}

async function testSniffArabseed() {
  console.log("Searching for Goodfellas on Arabseed...");
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

    // Go to search
    await page.goto("https://arabseed.show/?s=goodfellas", { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("Search page loaded. Title:", await page.title());

    // Extract first movie result URL
    const movieUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      for (let a of links) {
        const href = a.href || "";
        const text = (a.innerText || a.textContent || "").toLowerCase();
        if (href.includes("movie") && text.includes("goodfellas")) {
          return href;
        }
        if (href.includes("goodfellas") && !href.includes("?s=")) {
          return href;
        }
      }
      return null;
    });

    console.log("Movie URL on Arabseed:", movieUrl);

    if (movieUrl) {
      await page.goto(movieUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      console.log("Movie Page Loaded. Title:", await page.title());
      
      // Wait 8 seconds to catch stream
      await new Promise(r => setTimeout(r, 8000));
      
      const watchNowSelector = "a[href*='watch'], button.watch, .watch-btn, a[class*='watch']";
      const hasWatch = await page.evaluate((sel) => {
        return !!document.querySelector(sel) || Array.from(document.querySelectorAll("a, button")).some(x => x.innerText.includes("مشاهدة") || x.innerText.includes("المشاهدة"));
      }, watchNowSelector);

      if (hasWatch) {
        console.log("Found watch button, clicking...");
        await page.evaluate((sel) => {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return; }
          const links = Array.from(document.querySelectorAll("a, button"));
          for (let l of links) {
            if (l.innerText.includes("مشاهدة") || l.innerText.includes("المشاهدة")) {
              l.click();
              return;
            }
          }
        }, watchNowSelector);
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
      }

      await new Promise(r => setTimeout(r, 8000));

      if (caughtStream) {
        console.log("SUCCESS Caught Stream:", caughtStream);
        return;
      }

      // Try iframe extraction
      const iframeSrc = await page.evaluate(() => {
        const frames = Array.from(document.querySelectorAll("iframe"));
        for (let f of frames) {
          const src = f.src || f.getAttribute("data-src");
          if (src && src.startsWith("http") && !src.includes("youtube") && !src.includes("facebook")) {
            return src;
          }
        }
        return null;
      });

      console.log("Iframe Source:", iframeSrc);
      if (iframeSrc) {
        await page.goto(iframeSrc, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 8000));
      }

      console.log("FINAL Stream:", caughtStream);
    } else {
      console.log("Could not find movie page link on Arabseed search results.");
    }

  } catch (err) {
    console.error("Error during test:", err.message);
  } finally {
    await browser.close();
  }
}

testSniffArabseed().catch(console.error);
