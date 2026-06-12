const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--ignore-certificate-errors']
  });
  const page = await browser.newPage();
  
  page.on('response', async (res) => {
    const contentType = res.headers()['content-type'] || '';
    if (contentType.includes('application/json')) {
      console.log('JSON Response URL:', res.url());
    }
  });

  console.log('Testing koray.live...');
  try {
    await page.goto('https://koray.live/today-matches/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Evaluate Next.js data
    const nextData = await page.evaluate(() => {
        const script = document.getElementById('__NEXT_DATA__');
        return script ? script.innerText.substring(0, 500) : null;
    });
    console.log('Next.js Data:', !!nextData);
    
    // Evaluate match cards
    const matches = await page.evaluate(() => {
      const results = [];
      const matchCards = document.querySelectorAll('a[href*="match"], .match-container, .match-card, .matches-item, .item-match, .matchCenter');
      matchCards.forEach((c) => {
         results.push(c.className || c.tagName);
      });
      return results;
    });
    console.log('Match cards found with standard selectors:', matches.length);
    
    // Dump some classes
    const classes = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div, a'));
      return Array.from(new Set(divs.map(d => d.className).filter(c => typeof c === 'string' && c.includes('match')))).slice(0, 10);
    });
    console.log('Classes with "match":', classes);
    
  } catch (err) {
    console.error('Error:', err);
  }

  await browser.close();
}
test().catch(console.error);
