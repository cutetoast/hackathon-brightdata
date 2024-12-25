import puppeteer from 'puppeteer-core';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const URL = "https://www.coingecko.com/";
const BROWSER_WS = "wss://brd-customer-hl_f4f38d7b-zone-scraping_browser1:fd4netlfko0y@brd.superproxy.io:9222";
const REFRESH_INTERVAL = 3 * 60 * 1000; // 3 minutes in milliseconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 10000; // 10 seconds

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run(url, retryCount = 0) {
  let browser = null;
  try {
    console.log(`[${new Date().toISOString()}] Starting data collection...`);
    browser = await puppeteer.connect({
      browserWSEndpoint: BROWSER_WS,
    });

    const page = await browser.newPage();
    
    // Set longer timeouts
    page.setDefaultNavigationTimeout(180000);
    page.setDefaultTimeout(180000);
    
    // Enable request interception to speed up page load
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const blockedResourceTypes = ['image', 'font', 'media', 'stylesheet'];
      if (blockedResourceTypes.includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto(url, { 
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 120000 
    });
    
    // Wait for the table to be present and visible
    await page.waitForSelector('table[data-page="coinsIndex"]', { 
      timeout: 60000,
      visible: true 
    });

    const data = await parse(page);
    
    // Validate data before saving
    if (!data || data.length === 0) {
      throw new Error("No cryptocurrency data found");
    }

    // Add metadata to the saved data
    const enrichedData = {
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      count: data.length,
      data: data
    };

    await saveToFile(enrichedData);
    console.log(`[${new Date().toISOString()}] Successfully collected data for ${data.length} cryptocurrencies`);
    
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`[${new Date().toISOString()}] Retrying in ${RETRY_DELAY/1000} seconds... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await delay(RETRY_DELAY);
      return run(url, retryCount + 1);
    } else {
      console.error(`[${new Date().toISOString()}] Max retries reached. Moving to next interval.`);
      return false;
    }
  } finally {
    if (browser) {
      await browser.close();
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
        const marketCapElement = row.querySelector('td span[data-price-previous]');
        const volumeElement = row.querySelector('td span[data-target="price.price"]');
        
        // Extract numeric values
        const price = priceElement?.textContent?.trim().replace('$', '').replace(',', '');
        const marketCap = marketCapElement?.textContent?.trim().replace('$', '').replace(',', '');
        const volume = volumeElement?.textContent?.trim().replace('$', '').replace(',', '');
        
        return {
          name: nameElement?.querySelector('div.tw-flex-col')?.textContent?.trim(),
          symbol: nameElement?.querySelector('span.tw-hidden')?.textContent?.trim(),
          image: nameElement?.querySelector('img')?.src,
          price: price ? parseFloat(price) : null,
          change1h: change1hElement?.textContent?.trim(),
          marketCap: marketCap ? parseFloat(marketCap) : null,
          volume24h: volume ? parseFloat(volume) : null,
          fetchedAt: new Date().toISOString()
        };
      });
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error parsing data:`, error);
    return [];
  }
}

async function saveToFile(data) {
  const filename = 'coingecko_data.json';
  const filePath = join(__dirname, filename);
  
  try {
    // Read existing file if it exists
    let existingData = {};
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
    }
    
    // Update the data while preserving historical information
    const updatedData = {
      ...existingData,
      lastUpdated: new Date().toISOString(),
      updateCount: (existingData.updateCount || 0) + 1,
      currentData: data
    };
    
    await fs.writeFile(filePath, JSON.stringify(updatedData, null, 2));
    console.log(`[${new Date().toISOString()}] Data updated in ${filename}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error saving file:`, error);
    throw error;
  }
}

// Main loop for continuous data collection
async function startDataCollection() {
  console.log(`[${new Date().toISOString()}] Starting continuous data collection...`);
  console.log(`Refresh interval: ${REFRESH_INTERVAL/1000} seconds`);
  
  while (true) {
    try {
      await run(URL);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Fatal error in data collection:`, error);
    }
    
    console.log(`[${new Date().toISOString()}] Waiting ${REFRESH_INTERVAL/1000} seconds before next update...`);
    await delay(REFRESH_INTERVAL);
  }
}

// Start the continuous data collection
startDataCollection();