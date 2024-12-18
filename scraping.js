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
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
    
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

    // Find the pagination selector container
    const paginationSelector = await page.waitForSelector('.gecko-pagination-selector', {
      timeout: 60000,
      visible: true
    });
    
    // Find and click the dropdown button within the pagination selector
    const dropdownButton = await paginationSelector.$('button[data-view-component="true"]');
    if (!dropdownButton) {
      throw new Error("Could not find the rows dropdown button");
    }
    
    // Scroll to the button
    await dropdownButton.evaluate(button => {
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await delay(1000);
    
    // Click to open the dropdown
    await dropdownButton.click();
    console.log("Opened rows dropdown");
    await delay(1000);
    
    // Use JavaScript click since the dropdown might be in a portal/overlay
    await page.evaluate(() => {
      // Find all elements that contain "100" and are likely to be dropdown options
      const elements = Array.from(document.querySelectorAll('div[x-show="open"] div'));
      const option = elements.find(el => el.textContent.trim() === '100');
      if (option) {
        option.click();
      }
    });
    console.log("Selected 100 rows option");
    
    // Wait for the table to update with new rows
    await delay(3000);
    
    console.log("Parsing data...");
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

run(URL);