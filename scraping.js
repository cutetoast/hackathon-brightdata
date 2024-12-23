import puppeteer from 'puppeteer-core';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const URL = "https://www.coingecko.com/";
const BROWSER_WS = "wss://brd-customer-hl_f4f38d7b-zone-scraping_browser1:fd4netlfko0y@brd.superproxy.io:9222";

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run(url) {
  let browser = null;
  try {
    console.log("Connecting to browser...");
    browser = await puppeteer.connect({
      browserWSEndpoint: BROWSER_WS,
    });

    console.log("Connected! Creating new page...");
    const page = await browser.newPage();

    // Set longer timeouts
    page.setDefaultNavigationTimeout(180000);
    page.setDefaultTimeout(180000);

    // Enable request interception to speed up page load
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Block images, fonts, and other non-essential resources
      const blockedResourceTypes = [
        'image',
        'font',
        'media',
        'stylesheet'
      ];
      if (blockedResourceTypes.includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log("Navigate to site...");
    await page.goto(url, { 
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 120000 
    });

    console.log("Setting up page...");
    
    // Wait for the table to be present
    await page.waitForSelector('table[data-page="coinsIndex"]', { 
      timeout: 60000,
      visible: true 
    });

    console.log("Parsing data...");
    const data = await parse(page);
    console.log("Cryptocurrency data:");
    console.log(JSON.stringify(data, null, 2));

    // Save data to file (update same file)
    await saveToFile(data);

  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed");
    }
  }
}

async function parse(page) {
  try {
    return await page.evaluate(() => {
      const rows = document.querySelectorAll('table[data-page="coinsIndex"] tbody tr');
      return Array.from(rows).map(row => {
        const nameElement = row.querySelector('td a.tw-flex');
        const priceElement = row.querySelector('td[data-sort] span');
        const change1hElement = row.querySelector('td span.gecko-down, td span.gecko-up');
        
        return {
          name: nameElement?.querySelector('div.tw-flex-col')?.textContent?.trim(),
          symbol: nameElement?.querySelector('span.tw-hidden')?.textContent?.trim(),
          image: nameElement?.querySelector('img')?.src,
          price: priceElement?.textContent?.trim(),
          change1h: change1hElement?.textContent?.trim(),
          marketCap: row.querySelector('td span[data-price-previous]')?.textContent?.trim(),
          volume24h: row.querySelector('td span[data-target="price.price"]')?.textContent?.trim(),
          timestamp: new Date().toISOString()
        };
      });
    });
  } catch (error) {
    console.error("Error in parse function:", error);
    return [];
  }
}

async function saveToFile(data) {
  const filename = `coingecko_data.json`; // Use a fixed filename
  const filePath = join(__dirname, filename);

  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Data updated in ${filename}`);
    return filename;
  } catch (error) {
    console.error("Error saving file:", error);
    throw error;
  }
}

// Refresh script every 5 seconds
(async function refresh() {
  while (true) {
    console.log("Running script...");
    await run(URL);
    console.log("Waiting 5 seconds before next refresh...");
    await delay(5000);
  }
})();