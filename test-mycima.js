const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("https://vid.mycima.cc/categories-cimawbas.php?cat=5-cimawbas-aflam-3arby", { waitUntil: "domcontentloaded" });
  
  const htmls = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.Small--Box, [class*="movie"], [class*="card"]')).slice(0, 3);
    return cards.map(c => c.innerHTML);
  });
  
  console.log(JSON.stringify(htmls, null, 2));
  await browser.close();
})();
