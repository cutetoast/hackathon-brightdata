import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const BROWSER_WS = process.env.BROWSER_WS || "wss://brd-customer-hl_f4f38d7b-zone-scraping_browser1:fd4netlfko0y@brd.superproxy.io:9222";
const URL = "https://www.coingecko.com/";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for write access
const supabase = createClient(supabaseUrl, supabaseKey);

async function saveToSupabase(data) {
    try {
        const { error } = await supabase
            .from('crypto_data')
            .insert({
                data: data.data,
                count: data.count,
                last_updated: new Date().toISOString()
            });

        if (error) throw error;
        console.log('Data saved to Supabase');
    } catch (error) {
        console.error('Supabase Error:', error);
        throw error;
    }
}

async function scrape() {
    let browser = null;
    try {
        console.log('Starting scrape...');
        browser = await puppeteer.connect({
            browserWSEndpoint: BROWSER_WS,
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();
        
        // Set longer timeouts
        await page.setDefaultNavigationTimeout(60000); // 60 seconds
        await page.setDefaultTimeout(60000);

        // Block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        console.log('Navigating to CoinGecko...');
        await page.goto(URL, { 
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 60000 
        });

        console.log('Waiting for table to load...');
        await page.waitForSelector('table[data-page="coinsIndex"]', { 
            timeout: 60000,
            visible: true 
        });

        // Add a small delay to ensure dynamic content is loaded
        await page.waitForTimeout(2000);

        console.log('Extracting data...');
        const data = await page.evaluate(() => {
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
                };
            });
        });

        if (!data || data.length === 0) {
            throw new Error('No cryptocurrency data found');
        }

        console.log(`Successfully scraped ${data.length} cryptocurrencies`);
        
        await saveToSupabase({
            data,
            count: data.length,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Scraping error:', error);
        // Take a screenshot if there's an error
        if (browser) {
            try {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    await pages[0].screenshot({ path: 'error-screenshot.png' });
                    console.log('Error screenshot saved as error-screenshot.png');
                }
            } catch (screenshotError) {
                console.error('Failed to take error screenshot:', screenshotError);
            }
        }
        throw error;
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }
    }
}

// Run scraper every 3 minutes
async function startScraping() {
    console.log('Starting scraper with configuration:', {
        supabaseUrl,
        hasSupabaseKey: !!supabaseKey,
        hasBrowserWs: !!BROWSER_WS
    });

    while (true) {
        try {
            await scrape();
            console.log('Waiting 3 minutes before next scrape...');
            await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
        } catch (error) {
            console.error('Error in scraping loop:', error);
            // Wait 1 minute before retrying on error
            console.log('Waiting 1 minute before retrying...');
            await new Promise(resolve => setTimeout(resolve, 60 * 1000));
        }
    }
}

startScraping();
