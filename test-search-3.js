const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled", "--ignore-certificate-errors", "--window-size=1366,768"],
  });

  const query = "ظرف طارق";
  const myCimaUrl = `https://vid.mycima.cc/search.php?keywords=${encodeURIComponent(query)}&video-id=`;

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(30000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  
  try {
    await page.goto(myCimaUrl, { waitUntil: "domcontentloaded" });
    
    const elements = await page.evaluate(() => {
      // Dump all links that have images
      const items = Array.from(document.querySelectorAll('a')).filter(a => a.querySelector('img') || a.querySelector('[style*="background"]'));
      return items.map(a => a.outerHTML.substring(0, 150));
    });
    console.log("Found links with images:", elements.length);
    console.log(elements.slice(0, 5));

    const specificCards = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.Small--Box, [class*="movie"], [class*="card"]')).map(el => el.className);
    });
    console.log("Specific card classes found:", specificCards);
  } catch (err) {
    console.error("Error: ", err.message);
  }

  await browser.close();
})();
