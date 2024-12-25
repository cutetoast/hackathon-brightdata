import puppeteer from 'puppeteer-core';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const URL = "https://www.coingecko.com/";
const BROWSER_WS = "wss://brd-customer-hl_f4f38d7b-zone-scraping_browser1:fd4netlfko0y@brd.superproxy.io:9222";

run(URL);

async function run(url) {
  let browser = null;
  try {
    console.log("Connecting to browser...");
    browser = await puppeteer.connect({
      browserWSEndpoint: BROWSER_WS,
    });
    console.log("Connected! Navigate to site...");
    const page = await browser.newPage();
    
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
    console.log("Navigated! Setting up page...");
    
    // Wait for the table to be present
    await page.waitForSelector('table[data-page="coinsIndex"]', { 
      timeout: 60000,
      visible: true 
    });

    // Find and scroll to the row selector button
    const rowSelectorButton = await page.waitForSelector('button.tw-bg-gray-200.dark\\:tw-bg-moon-700');
    await rowSelectorButton.evaluate(button => {
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    
    // Wait a bit for the scroll to complete
    await page.waitForTimeout(1000);
    
    // Click the button to open dropdown
    await rowSelectorButton.click();
    
    // Wait for and click the 100 rows option
    const selector100 = await page.waitForSelector('a[data-value="100"]');
    await selector100.click();
    
    // Wait for the table to update with new rows
    await page.waitForTimeout(2000);
    
    console.log("Selected 100 rows. Parsing data...");
    const data = await parse(page);
    console.log("Cryptocurrency data:");
    console.log(JSON.stringify(data, null, 2));
    
    // Save data to file
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
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `coingecko_data_${timestamp}.json`;
  const filePath = join(__dirname, filename);
  
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filename}`);
    return filename;
  } catch (error) {
    console.error("Error saving file:", error);
    throw error;
  }
}