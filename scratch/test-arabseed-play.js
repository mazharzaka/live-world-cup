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

  const targetUrl = "https://m.asd.ink/%d9%81%d9%8a%d9%84%d9%85-%d8%a7%d9%84%d8%b3%d8%aa-2025/";
  console.log(`Navigating to Arabseed movie page: ${targetUrl}`);

  let caughtStream = null;
  page.on("request", (r) => {
    const reqUrl = r.url();
    if (reqUrl.includes(".m3u8") || reqUrl.includes(".mp4")) {
      console.log("Captured media URL:", reqUrl);
      caughtStream = reqUrl;
    }
  });

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("Page loaded. Searching for iframes...");

    const iframesInfo = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll("iframe"));
      return iframes.map((iframe) => ({
        src: iframe.src,
        id: iframe.id,
        className: iframe.className,
      }));
    });
    console.log("Iframes found on page:", iframesInfo);

    // Look for links or buttons that might represent a play button or watch sub-page
    const watchLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      return links
        .map((a) => ({
          href: a.href,
          text: a.innerText.trim(),
        }))
        .filter((l) => l.href.includes("watch") || l.text.includes("مشاهدة") || l.text.includes("تشغيل"));
    });
    console.log("Watch/Play links found on page:", watchLinks);

    // If there's an embed or iframe, let's navigate to it
    const embedIframe = iframesInfo.find(
      (iframe) =>
        iframe.src &&
        (iframe.src.includes("embed") || iframe.src.includes("player") || iframe.src.includes("vidtube") || iframe.src.includes("asd"))
    );

    if (embedIframe) {
      console.log(`Navigating to embed iframe src: ${embedIframe.src}`);
      await page.goto(embedIframe.src, { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise((r) => setTimeout(r, 5000));
    } else if (watchLinks.length > 0) {
      // Let's navigate to the first watch link
      const firstWatchLink = watchLinks[0].href;
      console.log(`No iframe found, navigating to first watch link instead: ${firstWatchLink}`);
      await page.goto(firstWatchLink, { waitUntil: "domcontentloaded", timeout: 20000 });
      
      const subIframes = await page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll("iframe"));
        return iframes.map((iframe) => iframe.src);
      });
      console.log("Iframes on watch sub-page:", subIframes);
      
      const subEmbed = subIframes.find(src => src && (src.includes("embed") || src.includes("player") || src.includes("asd")));
      if (subEmbed) {
        console.log(`Navigating to sub-embed: ${subEmbed}`);
        await page.goto(subEmbed, { waitUntil: "domcontentloaded", timeout: 20000 });
        await new Promise((r) => setTimeout(r, 5000));
      }
    } else {
      console.log("No watch link or iframe found on main page.");
    }

  } catch (err) {
    console.error("Error during puppeteer run:", err.message);
  }

  await browser.close();
  console.log("Final caught stream URL:", caughtStream);
}

runTest();
