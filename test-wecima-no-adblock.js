const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());
// No AdblockerPlugin!

async function testNoAdblock() {
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

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    const isNavigation = req.isNavigationRequest() && req.frame() === page.mainFrame();
    if (isNavigation && !url.includes("wecima") && url !== "about:blank") {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log("Navigating to wecima.click without adblocker...");
    await page.goto("https://wecima.click/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(r => setTimeout(r, 6000));

    const data = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img")).map(img => ({
        src: img.src,
        dataSrc: img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original") || img.getAttribute("lazy-src"),
        alt: img.getAttribute("alt")
      }));
      
      const links = Array.from(document.querySelectorAll("a")).map(a => ({
        href: a.href,
        text: a.innerText.trim(),
        hasImg: !!a.querySelector("img")
      }));

      return { imgs, links: links.slice(0, 50) };
    });

    console.log(`Total images: ${data.imgs.length}`);
    console.log("Sample images (first 15):", JSON.stringify(data.imgs.slice(0, 15), null, 2));
    
    const movieLinks = data.links.filter(l => (l.text.includes("فيلم") || l.text.includes("مسلسل")) && l.text.length > 10);
    console.log("Movie links found:", movieLinks.length);
    console.log("Sample movie links:", movieLinks.slice(0, 5));

  } catch (err) {
    console.log("Error:", err.message);
  }

  await browser.close();
}

testNoAdblock();
