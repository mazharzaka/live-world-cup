const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function testImages() {
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
    await page.goto("https://wecima.click/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(r => setTimeout(r, 6000));

    const imageAnalysis = await page.evaluate(() => {
      // Find all img elements
      const imgs = Array.from(document.querySelectorAll("img")).map(img => ({
        src: img.src,
        dataSrc: img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original") || img.getAttribute("lazy-src"),
        alt: img.getAttribute("alt"),
        parentClass: img.parentElement ? img.parentElement.className : ""
      }));

      // Find any element with background-image style
      const bgStyleElements = Array.from(document.querySelectorAll("*"))
        .filter(el => {
          const style = el.getAttribute("style") || "";
          return style.includes("background-image") || style.includes("background");
        })
        .map(el => ({
          tagName: el.tagName,
          className: el.className,
          style: el.getAttribute("style")
        }));

      // Find movie containers and show their HTML
      const movieDivs = Array.from(document.querySelectorAll("[class*='Thumb'], [class*='thumb'], [class*='card'], [class*='item'], [class*='block']"))
        .slice(0, 5)
        .map(el => ({
          className: el.className,
          html: el.outerHTML.substring(0, 500)
        }));

      return { imgs, bgStyleElements: bgStyleElements.slice(0, 10), movieDivs };
    });

    console.log("=== WE CIMA IMAGES ANALYSIS ===");
    console.log(`Total img tags found: ${imageAnalysis.imgs.length}`);
    console.log("Sample img tags:", JSON.stringify(imageAnalysis.imgs.slice(0, 15), null, 2));
    console.log("Sample elements with background styles:", JSON.stringify(imageAnalysis.bgStyleElements, null, 2));
    console.log("Sample movie containers HTML:", JSON.stringify(imageAnalysis.movieDivs, null, 2));

  } catch (err) {
    console.log("Error:", err.message);
  }

  await browser.close();
}

testImages();
