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
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  console.log("1. Testing Google search for 'عرب سيد'...");
  try {
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent("عرب سيد")}`,
      { waitUntil: "domcontentloaded" }
    );
    const links = await page.evaluate(() => {
      const searchLinks = document.querySelectorAll("#search a");
      const urls = [];
      for (let a of searchLinks) {
        if (a.href && !a.href.includes("google")) {
          urls.push(a.href);
        }
      }
      return urls;
    });
    console.log("Google search result links:", links.slice(0, 10));
  } catch (err) {
    console.error("Google search error:", err.message);
  }

  console.log("\n2. Testing scraping from fallbackBase: https://m.asd.ink/category/arabic-movies-14/ ...");
  try {
    await page.goto("https://m.asd.ink/category/arabic-movies-14/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log("Page loaded successfully.");
    
    // Check page title
    const title = await page.title();
    console.log("Page title:", title);

    // Let's dump some links or box classes on the page
    const elements = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll("a");
      cards.forEach((c) => {
        if (c.href) {
          results.push({
            href: c.href,
            text: c.innerText.trim(),
            className: c.className,
          });
        }
      });
      return results;
    });
    console.log(`Found ${elements.length} link elements on the page.`);
    console.log("Sample link elements:", elements.filter(el => el.text.length > 5).slice(0, 15));

    // Look for cards with classes containing 'box', 'post', 'card', 'movie'
    const boxElements = await page.evaluate(() => {
      const divs = document.querySelectorAll("div, li, article");
      const classes = [];
      divs.forEach((d) => {
        if (d.className) {
          classes.push(d.className);
        }
      });
      return Array.from(new Set(classes)).slice(0, 30);
    });
    console.log("Sample class names on page:", boxElements);

  } catch (err) {
    console.error("Arabseed load error:", err.message);
  }

  await browser.close();
}

runTest();
