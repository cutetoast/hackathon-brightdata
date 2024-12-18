import puppeteer from "puppeteer-core";
import { writeFile } from 'fs/promises';
import { join } from 'path';

const BROWSER_WS = "wss://brd-customer-hl_f4f38d7b-zone-scraping_browser1:fd4netlfko0y@brd.superproxy.io:9222";

async function run() {
    try {
        console.log('Connecting to Scraping Browser...');
        const browser = await puppeteer.connect({
            browserWSEndpoint: BROWSER_WS,
        });
        const page = await browser.newPage();
        
        console.log('Navigating to CoinGecko...');
        await page.goto('https://www.coingecko.com', {
            waitUntil: "domcontentloaded"
        });
        
        console.log('Getting page content...');
        const html = await page.content();
        
        // Save HTML to a file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `coingecko_${timestamp}.html`;
        await writeFile(filename, html);
        console.log(`HTML content saved to ${filename}`);
        
        await browser.close();
    } catch (error) {
        console.error('Error occurred:', error);
    }
}

run();
