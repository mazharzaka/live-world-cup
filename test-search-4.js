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
      const a = document.querySelector('a[href*="watch.php"]');
      return a ? a.parentElement.outerHTML : "No links found";
    });
    console.log(elements);
  } catch (err) {
    console.error("Error: ", err.message);
  }

  await browser.close();
})();
