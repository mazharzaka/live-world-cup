const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function testNoJS() {
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

  const urls = [
    "https://wecima.click/",
    "https://wecima.cx/",
    "https://wecima.cash/"
  ];

  for (const url of urls) {
    const page = await browser.newPage();
    try {
      console.log(`\n--- Loading with JS DISABLED: ${url} ---`);
      await page.setJavaScriptEnabled(false);
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      const title = await page.title();
      console.log(`Title: "${title}"`);
      console.log(`Current URL: ${page.url()}`);

      const data = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a")).map(a => ({
          href: a.href,
          text: a.innerText.trim()
        }));
        const imgs = Array.from(document.querySelectorAll("img")).map(img => ({
          src: img.src,
          dataSrc: img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("lazy-src"),
          alt: img.getAttribute("alt")
        }));
        return { links: links.slice(0, 30), imgs: imgs.slice(0, 15) };
      });

      console.log(`Links count: ${data.links.length}, Imgs count: ${data.imgs.length}`);
      console.log("Sample links:", JSON.stringify(data.links.slice(0, 10), null, 2));
      console.log("Sample imgs:", JSON.stringify(data.imgs.slice(0, 10), null, 2));

    } catch (err) {
      console.log(`Error: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

testNoJS();
