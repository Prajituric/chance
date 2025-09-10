const { chromium } = require('playwright-core');

async function testConnection() {
    console.log('Testing Browserless connection...');
    
    try {
        const browser = await chromium.connect({
            wsEndpoint: `wss://production-sfo.browserless.io/chromium/playwright?token=2T1jt38Xu2rdX62ba585a3666cd30919c5fef6c4355e13bd8`
        });
        
        console.log('✅ Successfully connected to Browserless!');
        
        const page = await browser.newPage();
        await page.goto('https://example.com');
        console.log('✅ Successfully loaded example.com');
        
        await browser.close();
        console.log('✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testConnection();