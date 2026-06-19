const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.goto("https://vid.mycima.cc/categories-cimawbas.php?cat=5-cimawbas-aflam-3arby", { waitUntil: "domcontentloaded" });
  
  await page.evaluate(async () => {
    window.scrollBy(0, 3000);
    await new Promise(r => setTimeout(r, 2000));
  });

  const html = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.Small--Box, [class*="movie"], [class*="card"]'));
    return cards.map(c => c.innerHTML).join('\n\n<hr/>\n\n');
  });

  fs.writeFileSync('mycima-dump.html', html);
  console.log("Dumped to mycima-dump.html");
  await browser.close();
})();
