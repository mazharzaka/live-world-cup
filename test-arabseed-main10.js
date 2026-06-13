const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function testMainPage() {
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

  try {
    const url = "https://m.asd.ink/main10/";
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(r => setTimeout(r, 6000));

    const pageTitle = await page.title();
    console.log(`Title: "${pageTitle}"`);
    console.log(`Current URL: ${page.url()}`);

    const data = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a")).map(a => ({
        href: a.href,
        text: a.innerText.trim(),
        hasImg: !!a.querySelector("img")
      }));
      const imgs = Array.from(document.querySelectorAll("img")).map(img => ({
        src: img.src,
        dataSrc: img.getAttribute("data-src"),
        alt: img.getAttribute("alt")
      }));
      return { links: links.slice(0, 40), imgs: imgs.slice(0, 20) };
    });

    console.log("Links count:", data.links.length);
    console.log("Sample links:", JSON.stringify(data.links, null, 2));
    console.log("Sample imgs:", JSON.stringify(data.imgs, null, 2));

    await page.screenshot({ path: "screenshot_arabseed_main10.png" });
    console.log("Saved screenshot_arabseed_main10.png");

  } catch (err) {
    console.log("Error:", err.message);
  }

  await browser.close();
}

testMainPage();
