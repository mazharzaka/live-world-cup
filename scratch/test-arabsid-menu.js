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

  console.log("Loading Arabseed homepage...");
  try {
    await page.goto("https://m.asd.ink/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    
    const menuLinks = await page.evaluate(() => {
      const links = document.querySelectorAll("nav a, .menu a, header a, ul li a, .navbar a");
      return Array.from(links).map(a => ({
        href: a.href,
        text: a.innerText.trim(),
        html: a.outerHTML
      })).filter(item => item.text.length > 0 && item.href.startsWith("http"));
    });
    
    console.log("Found menu links:", menuLinks);

  } catch (err) {
    console.error("Error:", err.message);
  }

  await browser.close();
}

runTest();
