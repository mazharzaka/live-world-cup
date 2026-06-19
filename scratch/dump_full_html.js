const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs");

async function dumpFullHtml() {
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
  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    
    const html = await page.content();
    fs.writeFileSync("scratch/mycima_full.html", html);
    console.log("Saved full HTML to scratch/mycima_full.html");
  } catch (err) {
    console.error("Error during navigation or dump:", err);
  }
  await browser.close();
}

dumpFullHtml();
