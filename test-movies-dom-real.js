const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const TARGETS = [
  "https://wecima.cx",
  "https://m.asd.ink"
];

async function examineRealCards() {
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

  for (const url of TARGETS) {
    try {
      console.log(`\n=== Loading: ${url} ===`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 6000));
      
      const cards = await page.evaluate(() => {
        // Find links that are likely actual movies/series cards (text length > 15 and contains keywords)
        const links = Array.from(document.querySelectorAll("a"));
        const movieLinks = links.filter(a => {
          const txt = a.innerText || "";
          return (txt.includes("فيلم") || txt.includes("مسلسل") || txt.includes("حلقة")) && txt.trim().length > 15;
        });

        return movieLinks.slice(0, 3).map(a => {
          // Find images inside the link or parent or siblings
          const imgInLink = a.querySelector("img");
          const imgInParent = a.parentElement ? a.parentElement.querySelector("img") : null;
          const imgInGrandParent = (a.parentElement && a.parentElement.parentElement) ? a.parentElement.parentElement.querySelector("img") : null;

          return {
            linkHref: a.href,
            linkText: a.innerText.trim(),
            linkOuterHTML: a.outerHTML.substring(0, 300),
            imgInLink: imgInLink ? { src: imgInLink.src, html: imgInLink.outerHTML.substring(0, 300) } : null,
            imgInParent: imgInParent ? { src: imgInParent.src, html: imgInParent.outerHTML.substring(0, 300) } : null,
            imgInGrandParent: imgInGrandParent ? { src: imgInGrandParent.src, html: imgInGrandParent.outerHTML.substring(0, 300) } : null,
            parentOuterHTML: a.parentElement ? a.parentElement.outerHTML.substring(0, 500) : null
          };
        });
      });

      console.log(`Found ${cards.length} sample cards:`);
      console.log(JSON.stringify(cards, null, 2));

    } catch (err) {
      console.log(`Failed loading ${url}: ${err.message}`);
    }
  }

  await browser.close();
}

examineRealCards();
