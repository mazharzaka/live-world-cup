const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  
  const page1 = await browser.newPage();
  await page1.goto("https://web.topcinemaa.com/?s=batman", { waitUntil: "domcontentloaded" });
  const topcinemaTitles = await page1.evaluate(() => {
    return Array.from(document.querySelectorAll('.Small--Box, [class*="movie"], [class*="card"] h3, .title'))
      .map(el => el.innerText.trim()).filter(Boolean).slice(0, 3);
  });
  console.log("TopCinema Search (batman):", topcinemaTitles);

  const page2 = await browser.newPage();
  await page2.goto("https://vid.mycima.cc/search/باتمان", { waitUntil: "domcontentloaded" });
  const mycimaTitles = await page2.evaluate(() => {
    return Array.from(document.querySelectorAll('.Small--Box, [class*="movie"], [class*="card"] h3, .title'))
      .map(el => el.innerText.trim()).filter(Boolean).slice(0, 3);
  });
  console.log("MyCima Search (باتمان):", mycimaTitles);

  await browser.close();
})();
