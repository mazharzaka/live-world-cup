const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker").default;
const fs = require("fs");
const path = require("path");

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

// Get path to local ffmpeg executable if available (mostly for development environment)
function getFfmpegPath() {
  const userProfile = process.env.USERPROFILE || "C:\\Users\\mazharm";
  const wingetPath = path.join(
    userProfile,
    "AppData",
    "Local",
    "Microsoft",
    "WinGet",
    "Packages",
    "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build",
    "bin",
    "ffmpeg.exe",
  );
  if (fs.existsSync(wingetPath)) {
    return wingetPath;
  }
  return "ffmpeg";
}

// Helper: Launch Puppeteer optimized for low-RAM servers (e.g. Render free tier)
async function launchBrowser() {
  const args = [
    // Security (required for containerized / sandbox-free envs)
    "--no-sandbox",
    "--disable-setuid-sandbox",

    // RAM & CPU savings
    '--disable-dev-shm-usage',        // use /tmp instead of /dev/shm (critical on Render)
    '--disable-gpu',                   // no GPU needed in headless
    '--disable-accelerated-2d-canvas', // remove canvas GPU layer
    '--no-zygote',                     // skip zygote process (saves ~30 MB)
    '--disable-extensions',            // no extensions
    '--disable-background-networking', // no background HTTP calls
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees,ImprovedCookieControls,LazyFrameLoading',
    '--disable-ipc-flooding-protection',
    '--disable-notifications',
    '--disable-sync',
    '--no-first-run',
    '--metrics-recording-only',
    '--mute-audio',

    // Network / SSL
    "--ignore-certificate-errors",
    "--ignore-ssl-errors=yes",

    // Media: disable images globally at blink level
    "--blink-settings=imagesEnabled=false",
    
    // CF Bypass
    "--disable-blink-features=AutomationControlled"
  ];

  const proxyServer = process.env.PROXY_SERVER; // e.g. http://p.webshare.io:80
  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
    console.log(`📡 [Proxy] Launching browser with proxy: ${proxyServer}`);
  }

  const options = {
    headless: true,
    args,
  };

  // Use local Windows Google Chrome if available for better anti-detection
  if (process.platform === "win32") {
    options.executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }

  const browser = await puppeteer.launch(options);
  return browser;
}

// Helper: Configure page with Cloudflare-bypass headers + timeout
async function configurePage(page) {
  // Longer timeout to tolerate slow Render cold starts & CF challenges
  await page.setDefaultNavigationTimeout(60000);

  // Full real-browser User-Agent (matches Chrome 126 on Windows)
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  );

  // Cloudflare-bypass extra headers — makes the request look like a real browser
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "sec-ch-ua":
      '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
  });

  // Proxy authentication (if configured)
  const proxyUser = process.env.PROXY_USERNAME;
  const proxyPass = process.env.PROXY_PASSWORD;
  if (proxyUser && proxyPass) {
    console.log(
      `📡 [Proxy] Authenticating proxy for page with user: ${proxyUser}`,
    );
    await page.authenticate({ username: proxyUser, password: proxyPass });
  }
}

// Helper: Block heavy resources (images/CSS/fonts/media) to save RAM & speed
async function blockPageResources(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    // Block everything that isn't needed for DOM extraction
    if (
      [
        "image",
        "stylesheet",
        "font",
        "media",
        "ping",
        "manifest",
        "other",
      ].includes(type)
    ) {
      req.abort().catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });
}

module.exports = {
  getFfmpegPath,
  launchBrowser,
  configurePage,
  blockPageResources,
};
