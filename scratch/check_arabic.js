const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function check() {
  console.log("Launching browser...");
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
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  
  const target = "https://vid.mycima.cc/categories-cimawbas.php?cat=5-cimawbas-aflam-3arby";
  console.log("Going to " + target);
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 4000));
  
  // Scroll down a bit to trigger lazy load
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      window.scrollBy(0, 600);
      await new Promise((r) => setTimeout(r, 400));
    }
  });

  const extracted = await page.evaluate(() => {
    const items = [];
    const cards = document.querySelectorAll('.Small--Box, [class*="movie"], [class*="card"]');
    
    cards.forEach((card) => {
      let href = card.href || card.querySelector("a")?.href;
      if (!href || !href.startsWith("http")) return;
      if (href.includes("/category/") || href.includes("/actor/") || href.includes("/genre/")) return;

      let posterUrl = "";
      const imgEl = card.tagName === "IMG" ? card : card.querySelector("img");
      if (imgEl) {
        posterUrl = imgEl.getAttribute("data-src") || imgEl.getAttribute("data-lazy-src") || imgEl.getAttribute("data-lazy-style") || imgEl.src;
      }
      
      // bg image check
      if (!posterUrl || posterUrl.includes("melody-lzld")) {
        const bgSpan = card.querySelector('[data-lazy-style], [style*="background-image"]');
        if (bgSpan) {
          const styleStr = bgSpan.getAttribute("data-lazy-style") || bgSpan.getAttribute("style");
          const match = styleStr.match(/url\(['"]?(.*?)['"]?\)/);
          if (match && match[1]) {
            posterUrl = match[1];
          }
        }
      }

      // Check all elements inside card for backgrounds or data-src
      if (!posterUrl || posterUrl.includes("melody-lzld")) {
        const allLazy = card.querySelectorAll('[data-lazy-src], [data-src]');
        for(let el of allLazy) {
          const src = el.getAttribute("data-lazy-src") || el.getAttribute("data-src");
          if (src && !src.includes("melody-lzld")) {
            posterUrl = src;
            break;
          }
        }
      }
      
      const titleEl = card.querySelector("h3") || card.querySelector(".title") || card.querySelector("p") || card.querySelector('.title-box') || card.querySelector('.Title');
      const titleText = titleEl ? titleEl.innerText.trim() : (imgEl ? imgEl.getAttribute("alt") : "");

      if (titleText && posterUrl) {
        items.push({
          title: titleText,
          poster: posterUrl,
          link: href
        });
      }
    });
    return items;
  });
  
  console.log(`Found ${extracted.length} valid items with posters.`);
  console.log(JSON.stringify(extracted.slice(0, 10), null, 2));
  
  await browser.close();
}

check().catch(console.error);
