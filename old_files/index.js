import express from 'express';
import puppeteer from 'puppeteer-core';
import { promises as fs } from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants from environment variables
const URL = "https://www.coingecko.com/";
const BROWSER_WS = process.env.BROWSER_WS || "wss://brd-customer-hl_f4f38d7b-zone-scraping_browser1:fd4netlfko0y@brd.superproxy.io:9222";
const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || "180000"); // 3 minutes default
const MAX_RETRIES = 3;
const RETRY_DELAY = 10000; // 10 seconds
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || 'coingecko_data.json';

// In-memory cache for the latest data
let latestData = null;

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Setup Express server
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', lastUpdate: latestData?.lastUpdated || null });
});

// Endpoint to get cryptocurrency data
app.get('/api/crypto', (req, res) => {
    if (latestData) {
        res.json(latestData);
    } else {
        res.status(503).json({ error: 'Data not yet available' });
    }
});

// Scraping function
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
        
        await page.waitForSelector('table[data-page="coinsIndex"]', { 
            timeout: 60000,
            visible: true 
        });

        const data = await parse(page);
        
        if (!data || data.length === 0) {
            throw new Error("No cryptocurrency data found");
        }

        const enrichedData = {
            timestamp: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            count: data.length,
            data: data
        };

        // Update in-memory cache
        latestData = enrichedData;
        
        // Try to save to file system (if available)
        try {
            await saveToFile(enrichedData);
        } catch (error) {
            console.warn('Could not save to file system:', error.message);
        }

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

// Parse the page data
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

// Save data to file (if file system is available)
async function saveToFile(data) {
    const filePath = path.join(__dirname, DATA_FILE);
    
    try {
        let existingData = {};
        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            existingData = JSON.parse(fileContent);
        } catch (error) {
            // File doesn't exist or is invalid, start fresh
        }
        
        const updatedData = {
            ...existingData,
            lastUpdated: new Date().toISOString(),
            updateCount: (existingData.updateCount || 0) + 1,
            currentData: data
        };
        
        await fs.writeFile(filePath, JSON.stringify(updatedData, null, 2));
        console.log(`[${new Date().toISOString()}] Data updated in ${DATA_FILE}`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error saving file:`, error);
        throw error;
    }
}

// Start the server and scraping process
async function startServer() {
    // Start the Express server
    app.listen(PORT, () => {
        console.log(`[${new Date().toISOString()}] Server running at http://localhost:${PORT}`);
    });

    // Start the continuous data collection
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

// Start everything
startServer();
