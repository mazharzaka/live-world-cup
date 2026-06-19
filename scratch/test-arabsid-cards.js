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

  console.log("Loading Arabseed arabic-movies page...");
  try {
    await page.goto("https://m.asd.ink/category/arabic-movies-14/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    
    const cardsInfo = await page.evaluate(() => {
      // Find all divs or links that represent movie cards.
      // Usually, there are cards with class like `catr__item`, or divs that have links and images.
      const results = [];
      
      // Let's search for all elements with class containing 'item', 'box', 'post', 'card'
      const selectors = ['.catr__item', '[class*="item"]', '[class*="box"]', '[class*="post"]', 'article'];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results.push({
            selector,
            count: elements.length,
            sampleHTML: Array.from(elements).slice(0, 3).map(el => el.outerHTML.substring(0, 400))
          });
        }
      });
      
      // Also, let's find all images inside links and see their parents
      const imgLinks = [];
      const links = document.querySelectorAll("a");
      links.forEach(link => {
        const img = link.querySelector("img");
        if (img) {
          imgLinks.push({
            linkHref: link.href,
            linkText: link.innerText.trim(),
            imgSrc: img.src,
            imgDataSrc: img.getAttribute("data-src") || img.getAttribute("data-lazy-src"),
            imgAlt: img.alt,
            parentClass: link.parentElement?.className,
            grandParentClass: link.parentElement?.parentElement?.className,
          });
        }
      });
      
      return { results, imgLinks: imgLinks.slice(0, 10) };
    });
    
    console.log("Selectors counts:");
    cardsInfo.results.forEach(r => {
      console.log(`Selector: ${r.selector}, Count: ${r.count}`);
      console.log("Sample HTML:", r.sampleHTML);
      console.log("------------------------");
    });
    
    console.log("\nImage links found:", cardsInfo.imgLinks);

  } catch (err) {
    console.error("Error:", err.message);
  }

  await browser.close();
}

runTest();
