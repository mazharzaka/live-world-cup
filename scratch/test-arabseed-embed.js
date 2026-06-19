const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function runTest() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  const watchUrl = "https://m.asd.ink/%d9%81%d9%8a%d9%84%d9%85-%d8%a7%d9%84%d8%b3%d8%aa-2025/watch/";
  console.log(`1. Navigating to: ${watchUrl}`);

  let caughtStream = null;
  page.on("request", (r) => {
    const reqUrl = r.url();
    if (reqUrl.includes(".m3u8") || reqUrl.includes(".mp4")) {
      console.log("Captured Stream URL:", reqUrl);
      caughtStream = reqUrl;
    }
  });

  try {
    await page.goto(watchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    console.log("Watch page loaded. Searching for iframe...");

    const embedUrl = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll("iframe"));
      for (let iframe of iframes) {
        if (iframe.src && (iframe.src.includes("embed") || iframe.src.includes("player") || iframe.src.includes("asd") || iframe.src.includes("trade"))) {
          return iframe.src;
        }
      }
      return null;
    });

    console.log("Embed iframe URL found:", embedUrl);

    if (embedUrl) {
      console.log(`2. Navigating to embed URL: ${embedUrl}`);
      
      // Let's enable request interception on the embed page to watch closely
      await page.goto(embedUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
      
      console.log("Embed page loaded. Inspecting HTML and sources...");
      
      const htmlDump = await page.evaluate(() => {
        // Find all script tags or buttons or video elements
        const scripts = Array.from(document.querySelectorAll("script")).map(s => s.src || s.innerText.substring(0, 100));
        const video = document.querySelector("video");
        const source = video ? video.querySelector("source")?.src || video.src : null;
        return {
          scripts,
          videoSource: source,
          bodyHTML: document.body.innerHTML.substring(0, 500)
        };
      });
      console.log("Embed HTML info:", htmlDump);
      
      console.log("Waiting 8 seconds to capture any media network requests (m3u8/mp4)...");
      await new Promise((r) => setTimeout(r, 8000));
      
      // If we still didn't catch anything, try clicking any play button or iframe elements
      if (!caughtStream) {
        console.log("No stream caught yet. Trying to click any play elements...");
        await page.evaluate(() => {
          const playButtons = document.querySelectorAll("button, .play, .play-btn, .vjs-play-control, #player");
          playButtons.forEach(btn => {
            if (btn.click) btn.click();
          });
        });
        console.log("Waiting another 5 seconds after click...");
        await new Promise((r) => setTimeout(r, 5000));
      }
    } else {
      console.log("No embed iframe found on watch page.");
    }

  } catch (err) {
    console.error("Error:", err.message);
  }

  await browser.close();
  console.log("Final caught stream URL:", caughtStream);
}

runTest();
