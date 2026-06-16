const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function testClick() {
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
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log("Navigating to https://m.asd.ink ...");
    await page.goto("https://m.asd.ink", { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(r => setTimeout(r, 4000));

    console.log("Finding and clicking the button...");
    const clicked = await page.evaluate(() => {
      // Find a button containing "تصفح أحدث الأفلام والمسلسلات" or similar
      const buttons = Array.from(document.querySelectorAll("a, button, div"));
      const target = buttons.find(el => {
        const txt = el.innerText || "";
        return txt.includes("تصفح أحدث") || txt.includes("تصفح الموقع");
      });
      if (target) {
        target.click();
        return { success: true, text: target.innerText, tagName: target.tagName, href: target.href };
      }
      return { success: false };
    });

    console.log("Click result:", clicked);
    await new Promise(r => setTimeout(r, 6000));

    const newUrl = page.url();
    const newTitle = await page.title();
    console.log(`New URL: ${newUrl}, New Title: "${newTitle}"`);

    await page.screenshot({ path: "screenshot_arabseed_after_click.png" });
    console.log("Saved screenshot_arabseed_after_click.png");

    // Let's also check if we have any movie links now!
    const links = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll("a").forEach(a => {
        if (a.innerText.trim().length > 15) {
          items.push({ href: a.href, text: a.innerText.trim() });
        }
      });
      return items.slice(0, 10);
    });
    console.log("Movie links after click:", links);

  } catch (err) {
    console.log("Error:", err.message);
  }

  await browser.close();
}

testClick();
