import { spawn } from 'child_process';

const env = {
    ...process.env,
    SUPABASE_URL: 'https://dikmhnogmguyerprktxf.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpa21obm9nbWd1eWVycHJrdHhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxMDQxMDQwOCwiZXhwIjoyMDI1OTg2NDA4fQ.jMDQe8rfsDEbI3gFw4ORSweRa4GYHjxuJodHoP8nswM',
    BROWSER_WS: 'wss://brd-customer-hl_f4f38d7b-zone-scraping_browser1:fd4netlfko0y@brd.superproxy.io:9222'
};

const scraper = spawn('node', ['scraper.js'], { env });

scraper.stdout.on('data', (data) => {
    console.log(data.toString());
});

scraper.stderr.on('data', (data) => {
    console.error(data.toString());
});

scraper.on('close', (code) => {
    console.log(`Scraper process exited with code ${code}`);
});
