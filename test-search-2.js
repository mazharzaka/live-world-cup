const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
      "--window-size=1366,768",
    ],
  });

  const query = "ظرف طارق";
  const myCimaUrl = `https://vid.mycima.cc/search.php?keywords=${encodeURIComponent(query)}&video-id=`;

  console.log("Fetching: ", myCimaUrl);
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(30000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  
  try {
    await page.goto(myCimaUrl, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    console.log("Page Title: ", title);
    
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log("HTML Start: ", html);
  } catch (err) {
    console.error("Error: ", err.message);
  }

  await browser.close();
})();
