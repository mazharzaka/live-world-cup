const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function testWecimaHTML() {
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

  try {
    console.log("Navigating to https://wecima.click/ ...");
    await page.goto("https://wecima.click/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 6000));

    const data = await page.evaluate(() => {
      // Find all elements with inline style containing url
      const elementsWithBg = Array.from(document.querySelectorAll("*")).filter(el => {
        const style = el.getAttribute("style") || "";
        return style.includes("url(") || style.includes("background");
      }).map(el => ({
        tagName: el.tagName,
        className: el.className,
        style: el.getAttribute("style"),
        outerHTML: el.outerHTML.substring(0, 300)
      }));

      // Find all image sources or lazy-load attributes anywhere on page
      const allImgs = Array.from(document.querySelectorAll("img")).map(img => ({
        src: img.src,
        attributes: Array.from(img.attributes).map(a => `${a.name}=${a.value}`)
      }));

      // Find any element containing class like "poster" or "thumb" or "img"
      const thumbElements = Array.from(document.querySelectorAll("[class*='poster'], [class*='thumb'], [class*='image'], [class*='img']")).slice(0, 15).map(el => ({
        tagName: el.tagName,
        className: el.className,
        outerHTML: el.outerHTML.substring(0, 400)
      }));

      return {
        elementsWithBg: elementsWithBg.slice(0, 15),
        allImgs,
        thumbElements
      };
    });

    console.log("=== elementsWithBg ===");
    console.log(JSON.stringify(data.elementsWithBg, null, 2));

    console.log("=== allImgs ===");
    console.log(JSON.stringify(data.allImgs, null, 2));

    console.log("=== thumbElements ===");
    console.log(JSON.stringify(data.thumbElements, null, 2));

  } catch (err) {
    console.log("Error:", err.message);
  }

  await browser.close();
}

testWecimaHTML();
