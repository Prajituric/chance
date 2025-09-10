require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

// Global timeout configuration
const TIMEOUT = 60000; // 60 seconds timeout

// Helper function for timeout promises
function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
}

// Load icebreaker messages
const icebreakers = JSON.parse(fs.readFileSync(path.join(__dirname, 'icebreakers.json'), 'utf-8'));

// Human-like typing function
async function humanType(page, selector, text) {
    await page.type(selector, text, { delay: 100 });
}

// Function to handle specific error popup
async function handleSpecificErrorPopup(page) {
    try {
        // Check if the specific error popup is visible
        const errorPopupSelector = '.ReactModal__Content--after-open';
        const errorTitleSelector = '.popup_error_title';
        const errorTextSelector = '.popup_error_text';
        const gotItButtonSelector = '.popup_error_btn';
        
        // Check if the modal is present
        if (await page.isVisible(errorPopupSelector)) {
            // Get the text content of the error title and message
            const errorTitle = await page.textContent(errorTitleSelector).catch(() => '');
            const errorText = await page.textContent(errorTextSelector).catch(() => '');
            
            // Check if this is the specific error we're looking for
            if (errorTitle.includes('Internal server occurred') &&
                errorText.includes('Restriction of sending a personal message. Try when the list becomes active')) {
                
                console.log('Detected specific error popup, clicking "Got it" button');
                
                // Click the "Got it" button
                await page.click(gotItButtonSelector);
                console.log('Clicked "Got it" button, continuing execution');
                
                // Wait a bit for the popup to close
                await page.waitForTimeout(1000);
                
                return true; // Successfully handled the popup
            }
        }
        
        return false; // Popup not found or not the specific one we're looking for
    } catch (error) {
        console.log(`Error while checking for specific error popup: ${error.message}`);
        return false;
    }
}

// Generic Login function for multiple platforms
async function login(page, email, password) {
    console.log('Performing generic login...');
    
    // Check for error popup before proceeding
    await handleSpecificErrorPopup(page);
    
    try {
        // Wait for email and password fields using multiple fallback selectors
        const emailSelectors = [
            'input[type="email"]',
            'input[name="email"]',
            'input#email',
            'input[placeholder*="email" i]',
            'input[type="text"]'
        ];
        
        const passwordSelectors = [
            'input[type="password"]',
            'input[name="password"]',
            'input#password',
            'input[placeholder*="password" i]'
        ];
        
        // Find and fill email field
        let emailFieldFound = false;
        for (const selector of emailSelectors) {
            try {
                if (await page.isVisible(selector)) {
                    console.log(`Filling email with selector: ${selector}`);
                    await humanType(page, selector, email);
                    emailFieldFound = true;
                    break;
                }
            } catch (error) {
                console.log(`Email selector ${selector} not found: ${error.message}`);
            }
        }
        
        if (!emailFieldFound) {
            throw new Error('Email field not found');
        }
        
        // Find and fill password field
        let passwordFieldFound = false;
        for (const selector of passwordSelectors) {
            try {
                if (await page.isVisible(selector)) {
                    console.log(`Filling password with selector: ${selector}`);
                    await humanType(page, selector, password);
                    passwordFieldFound = true;
                    break;
                }
            } catch (error) {
                console.log(`Password selector ${selector} not found: ${error.message}`);
            }
        }
        
        if (!passwordFieldFound) {
            throw new Error('Password field not found');
        }
        
        // Click the login button with multiple fallback selectors
        const loginButtonSelectors = [
            'button[type="submit"]',
            'button:has-text("Login")',
            'button:has-text("Log in")',
            'button:has-text("Sign in")',
            'input[type="submit"]',
            'button'
        ];
        
        let loginButtonClicked = false;
        for (const selector of loginButtonSelectors) {
            try {
                if (await page.isVisible(selector)) {
                    console.log(`Clicking login button with selector: ${selector}`);
                    await page.click(selector);
                    loginButtonClicked = true;
                    break;
                }
            } catch (error) {
                console.log(`Login button selector ${selector} not found: ${error.message}`);
            }
        }
        
        if (!loginButtonClicked) {
            // Try pressing Enter on password field
            console.log('Pressing Enter on password field');
            await page.press('input[type="password"]', 'Enter');
        }
        
        // Wait for page load (networkidle) to ensure login completes
        console.log('Waiting for page to load after login...');
        await page.waitForLoadState('networkidle');
        
        console.log('Generic login completed successfully');
        return true;
    } catch (error) {
        console.error('Generic login failed:', error.message);
        return false;
    }
}

// Specialized Alpha.Date Login function with anti-bot detection handling
async function loginToAlphaDate(browser, email, password) {
    console.log('Performing specialized Alpha.Date login...');
    
    // Create a new browser context with viewport & user agent
    const context = await browser.newContext({
        viewport: { width: 1200, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    // Hide automation flags (navigator.webdriver)
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    const page = await context.newPage();
    console.log('✅ Browser context and page created');
    
    // Check for error popup before proceeding
    await handleSpecificErrorPopup(page);
    
    try {
        // Go to https://alpha.date
        console.log('Navigating to https://alpha.date...');
        await page.goto('https://alpha.date', { waitUntil: 'networkidle', timeout: TIMEOUT });
        console.log('✅ Page loaded successfully');
        
        // Wait for and fill email & password using multiple fallback selectors
        console.log('Filling in login credentials...');
        
        // Email field selectors
        const emailSelectors = [
            'input[type="email"]',
            'input[name="login"]',
            'input#login',
            'input[placeholder*="email" i]',
            'input[type="text"]'
        ];
        
        // Password field selectors
        const passwordSelectors = [
            'input[type="password"]',
            'input[name="password"]',
            'input#password',
            'input[placeholder*="password" i]'
        ];
        
        // Find and fill email field
        let emailFieldFound = false;
        for (const selector of emailSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 10000 });
                if (await page.isVisible(selector)) {
                    console.log(`✅ Filling email with selector: ${selector}`);
                    await humanType(page, selector, email);
                    emailFieldFound = true;
                    break;
                }
            } catch (error) {
                console.log(`Email selector ${selector} not found: ${error.message}`);
            }
        }
        
        if (!emailFieldFound) {
            throw new Error('Email field not found');
        }
        
        // Find and fill password field
        let passwordFieldFound = false;
        for (const selector of passwordSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 10000 });
                if (await page.isVisible(selector)) {
                    console.log(`✅ Filling password with selector: ${selector}`);
                    await humanType(page, selector, password);
                    passwordFieldFound = true;
                    break;
                }
            } catch (error) {
                console.log(`Password selector ${selector} not found: ${error.message}`);
            }
        }
        
        if (!passwordFieldFound) {
            throw new Error('Password field not found');
        }
        
        // Click the login button with multiple fallback selectors
        const loginButtonSelectors = [
            'button[data-testid="submit-btn"]',
            '.LoginPage_wm_main_form_btn__1lNM1',
            'button:has-text("Log in")',
            'button[type="submit"]',
            'button'
        ];
        
        console.log('Clicking login button...');
        let loginButtonClicked = false;
        for (const selector of loginButtonSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 10000 });
                if (await page.isVisible(selector)) {
                    console.log(`✅ Clicking login button with selector: ${selector}`);
                    await page.click(selector);
                    loginButtonClicked = true;
                    break;
                }
            } catch (error) {
                console.log(`Login button selector ${selector} not found: ${error.message}`);
            }
        }
        
        if (!loginButtonClicked) {
            // Try pressing Enter on password field
            console.log('Pressing Enter on password field');
            await page.press('input[type="password"]', 'Enter');
        }
        
        // Wait for page load (networkidle) to ensure login completes
        console.log('Waiting for page to load after login...');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000); // Additional wait time
        
        // Verify login by checking for success indicators
        console.log('Verifying login success...');
        const successIndicators = [
            '[class*="chat"]',
            'textarea[placeholder*="message" i]',
            '[data-testid*="chat"]',
            '.message-input'
        ];
        
        let loginVerified = false;
        for (const selector of successIndicators) {
            try {
                if (await page.isVisible(selector)) {
                    console.log(`✅ Login verified with indicator: ${selector}`);
                    loginVerified = true;
                    break;
                }
            } catch (error) {
                console.log(`Success indicator ${selector} not found: ${error.message}`);
            }
        }
        
        if (!loginVerified) {
            console.log('Could not verify login success, continuing anyway...');
        }
        
        // Click the "Chance" menu item post-login
        console.log('Navigating to Chance section...');
        const chanceSelectors = [
            'div[data-testid="main-menu-item-Chance"] div:has-text("Chance")',
            'div:has-text("Chance")',
            'a:has-text("Chance")',
            '[data-testid*="Chance"]'
        ];
        
        let chanceClicked = false;
        for (const selector of chanceSelectors) {
            try {
                if (await page.isVisible(selector)) {
                    console.log(`Clicking Chance menu item with selector: ${selector}`);
                    await page.click(selector);
                    chanceClicked = true;
                    break;
                }
            } catch (error) {
                console.log(`Chance selector ${selector} not found: ${error.message}`);
            }
        }
        
        if (!chanceClicked) {
            console.log('Could not find Chance menu item');
        }
        
        console.log('✅ Alpha.Date login completed successfully');
        return { context, page };
    } catch (error) {
        console.error('❌ Alpha.Date login failed:', error.message);
        return null;
    }
}

// Login in Main Application
async function loginToPlatform(browser, email, password) {
    console.log('Logging in to platform...');
    
    // Check platform URL (process.env.PLATFORM_URL)
    const platformUrl = process.env.PLATFORM_URL || 'https://alpha.date';
    console.log(`Platform URL: ${platformUrl}`);
    
    // If alpha.date → call loginToAlphaDate()
    if (platformUrl.includes('alpha.date')) {
        console.log('Using specialized Alpha.Date login...');
        return await loginToAlphaDate(browser, email, password);
    }
    // Otherwise → create chat context and call generic login()
    else {
        console.log('Using generic login...');
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 }
        });
        
        const page = await context.newPage();
        await page.goto(platformUrl);
        
        const loginSuccess = await login(page, email, password);
        if (loginSuccess) {
            return { context, page };
        } else {
            return null;
        }
    }
}

// Function to click Load more button
async function clickLoadMore(page) {
    console.log('Looking for Load more button...');
    
    // Check for error popup before proceeding
    await handleSpecificErrorPopup(page);
    
    // Try multiple selectors for Load more button
    const loadMoreSelectors = [
        'div:has(.styles_clmn_2_chat_loadmore_btn__4PifQ) span:has-text("Load more")',
        'button:has-text("Load more")',
        'div:has-text("Load more")',
        'span:has-text("Load more")',
        '[class*="loadmore"]'
    ];
    
    for (const selector of loadMoreSelectors) {
        try {
            console.log(`Trying selector: ${selector}`);
            if (await page.isVisible(selector)) {
                console.log(`Found Load more button with selector: ${selector}`);
                await page.click(selector);
                console.log('Clicked Load more button');
                return true;
            }
        } catch (error) {
            console.log(`Failed to click Load more button with selector ${selector}: ${error.message}`);
        }
    }
    
    console.log('Load more button not found or not clickable');
    return false;
}

// Function to check message limit
async function checkMessageLimit(page) {
    console.log('Checking message limit...');
    
    try {
        // Try multiple selectors for message limit element
        const messageLimitSelectors = [
            '[data-testid="message-limit"]',
            '.styles_chat_typing_right__XJ5E4',
            '.styles_clmn_3_chat_typing__8tvjy [data-testid="message-limit"]'
        ];
        
        for (const selector of messageLimitSelectors) {
            try {
                if (await page.isVisible(selector)) {
                    const messageLimitText = await page.textContent(selector);
                    console.log(`Message limit text: ${messageLimitText}`);
                    
                    // Extract number from text like "5 messages left"
                    const match = messageLimitText.match(/(\d+)\s+messages?\s+left/i);
                    if (match) {
                        const messagesLeft = parseInt(match[1], 10);
                        console.log(`Messages left: ${messagesLeft}`);
                        return messagesLeft;
                    }
                    break;
                }
            } catch (error) {
                console.log(`Failed to find message limit with selector ${selector}: ${error.message}`);
            }
        }
        
        console.log('Could not find message limit element');
        return -1; // Return -1 if we can't determine the limit
    } catch (error) {
        console.log(`Error checking message limit: ${error.message}`);
        return -1; // Return -1 if we can't determine the limit
    }
}

// Function to send random message to a chat
async function sendRandomMessageToChat(page) {
    console.log('Checking message limit before sending message...');
    
    // Check for error popup before proceeding
    await handleSpecificErrorPopup(page);
    
    // Check message limit
    const messagesLeft = await checkMessageLimit(page);
    
    // If messages left <= 0, skip sending message
    if (messagesLeft <= 0) {
        console.log(`No messages left (${messagesLeft}), skipping this chat`);
        return false;
    }
    
    console.log(`Messages left: ${messagesLeft}, proceeding to send message`);
    
    console.log('Looking for chat input...');
    
    // Select a random icebreaker
    const message = icebreakers[Math.floor(Math.random() * icebreakers.length)];
    
    // Try multiple selectors for chat input field
    const inputSelectors = [
        'textarea[placeholder="Type a message..."]',
        'textarea',
        'input[type="text"]'
    ];
    
    for (const selector of inputSelectors) {
        try {
            console.log(`Trying input selector: ${selector}`);
            if (await page.isVisible(selector)) {
                console.log(`Found chat input with selector: ${selector}`);
                await humanType(page, selector, message);
                console.log(`Entered message: ${message}`);
                
                // Try to send the message by pressing Enter
                try {
                    await page.press(selector, 'Enter');
                    console.log('Pressed Enter to send message');
                    
                    // Check if error modal appears
                    await page.waitForTimeout(2000); // Wait a bit for modal to appear
                    const errorModal = await page.$('.ReactModal__Content--after-open .popup_error_btn');
                    if (errorModal) {
                        console.log('Error modal detected, clicking "Got it" button');
                        await errorModal.click();
                        console.log('Clicked "Got it" button');
                    }
                    
                    return true;
                } catch (error) {
                    console.log(`Failed to press Enter: ${error.message}`);
                }
                
                // Try to find and click send button
                const sendButtonSelectors = [
                    'button[type="submit"]:has-text("Send")',
                    'button[type="submit"]',
                    'button:has-text("Send")',
                    'button.send'
                ];
                
                for (const sendSelector of sendButtonSelectors) {
                    try {
                        console.log(`Trying send button selector: ${sendSelector}`);
                        if (await page.isVisible(sendSelector)) {
                            console.log(`Found send button with selector: ${sendSelector}`);
                            await page.click(sendSelector);
                            console.log('Clicked send button');
                            
                            // Check if error modal appears
                            await page.waitForTimeout(2000); // Wait a bit for modal to appear
                            const errorModal = await page.$('.ReactModal__Content--after-open .popup_error_btn');
                            if (errorModal) {
                                console.log('Error modal detected, clicking "Got it" button');
                                await errorModal.click();
                                console.log('Clicked "Got it" button');
                            }
                            
                            return true;
                        }
                    } catch (error) {
                        console.log(`Failed to click send button with selector ${sendSelector}: ${error.message}`);
                    }
                }
                
                console.log('Could not find send button');
                return false;
            }
        } catch (error) {
            console.log(`Failed to use chat input with selector ${selector}: ${error.message}`);
        }
    }
    
    console.log('Could not find chat input field');
    return false;
}

// Function to process all chats and send messages
async function processChatsAndSendMessages(page) {
    console.log('Processing chats and sending messages...');
    
    // Check for error popup before proceeding
    await handleSpecificErrorPopup(page);
    
    // Find the chat list container
    const chatListSelectors = [
        'div[data-testid="chat-list"]',
        '.styles_clmn_2_chat_block_list__dIoGl'
    ];
    
    let chatList = null;
    for (const selector of chatListSelectors) {
        try {
            if (await page.isVisible(selector)) {
                chatList = await page.$(selector);
                console.log(`Found chat list with selector: ${selector}`);
                break;
            }
        } catch (error) {
            console.log(`Failed to find chat list with selector ${selector}: ${error.message}`);
        }
    }
    
    if (!chatList) {
        console.log('Could not find chat list');
        return;
    }
    
    // Get all chat items from the list
    const chatItemSelectors = [
        '.styles_clmn_2_chat_block_item__P6pxX',
        '[data-testid*="chat-block-item"]'
    ];
    
    let chatItems = [];
    for (const selector of chatItemSelectors) {
        try {
            chatItems = await page.$$(selector);
            if (chatItems.length > 0) {
                console.log(`Found ${chatItems.length} chat items with selector: ${selector}`);
                break;
            }
        } catch (error) {
            console.log(`Failed to find chat items with selector ${selector}: ${error.message}`);
        }
    }
    
    if (chatItems.length === 0) {
        console.log('No chat items found');
        return;
    }
    
    console.log(`Processing ${chatItems.length} chats...`);
    
    // Iterate through each chat item
    for (let i = 0; i < chatItems.length; i++) {
        try {
            console.log(`Processing chat ${i + 1} of ${chatItems.length}`);
            
            // Click on the chat item to open it
            console.log('Clicking on chat item...');
            await chatItems[i].click();
            
            // Wait for chat to open
            await page.waitForTimeout(2000);
            
            // Send a random icebreaker message
            console.log('Sending random icebreaker message...');
            const messageSent = await sendRandomMessageToChat(page);
            
            if (messageSent) {
                console.log(`Successfully sent message to chat ${i + 1}`);
            } else {
                console.log(`Failed to send message to chat ${i + 1}`);
            }
            
            // Wait before processing next chat
            await page.waitForTimeout(3000);
        } catch (error) {
            console.log(`Error processing chat ${i + 1}: ${error.message}`);
        }
    }
    
    console.log('Finished processing all chats');
}

// Function to run the main process for one cycle
async function runChatBotCycle() {
    console.log('Starting chat bot cycle...');
    
    let browser;
    try {
        console.log('Attempting to connect to Browserless with correct endpoint...');
        
        // CORECT: Folosim endpoint-ul corect conform documentației
        browser = await chromium.connect({
    wsEndpoint: `wss://production-sfo.browserless.io/chromium/playwright?token=${process.env.BROWSERLESS_TOKEN}`
});

        
        console.log('✅ Successfully connected to Browserless with correct endpoint');
        
        // Test the connection
        const testPage = await browser.newPage();
        await testPage.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await testPage.close();
        console.log('✅ Browser connection test passed');
        
        // Login to the platform
        console.log('Logging in to platform...');
        const result = await withTimeout(
            loginToPlatform(browser, process.env.LOGIN, process.env.PASSWORD),
            TIMEOUT,
            'Login process timed out'
        );
        
        if (!result) {
            console.error('Login failed');
            return false;
        }
        
        const { context, page } = result;
        console.log('✅ Login successful!');
        
        // Wait a bit for page to load after login
        await page.waitForTimeout(5000);
        
        // Click Load more button repeatedly
        console.log('Clicking Load more button...');
        let loadMoreCount = 0;
        const maxLoadMoreAttempts = 10;
        
        for (let i = 0; i < maxLoadMoreAttempts; i++) {
            if (await clickLoadMore(page)) {
                loadMoreCount++;
                console.log(`Clicked Load more button ${loadMoreCount} times`);
                await page.waitForTimeout(3000); // Wait between clicks
            } else {
                console.log('No more Load more button found or clickable');
                break;
            }
        }
        
        console.log(`Finished clicking Load more button ${loadMoreCount} times`);
        
        // Wait for any new content to load
        await page.waitForTimeout(5000);
        
        // Process all chats and send messages
        console.log('Processing chats and sending messages...');
        await processChatsAndSendMessages(page);
        
        // Before closing the browser, check if Load more button exists again
        console.log('Checking for Load more button again before closing browser...');
        if (await clickLoadMore(page)) {
            console.log('Found Load more button, processing additional chats...');
            // Wait for any new content to load
            await page.waitForTimeout(5000);
            
            // Process additional chats
            console.log('Processing additional chats...');
            await processChatsAndSendMessages(page);
        } else {
            console.log('No Load more button found, continuing to close browser...');
        }
        
        console.log('✅ Chat bot cycle finished!');
        return true;
        
    } catch (error) {
        console.error('❌ Browser connection failed:', error.message);
        
        // Fallback to local browser if available (for testing)
        console.log('Attempting fallback to local browser...');
        try {
            // This will only work if Playwright browsers are installed locally
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            console.log('✅ Fallback: Local browser launched successfully');
            
            // Continue with login logic...
            const result = await loginToPlatform(browser, process.env.LOGIN, process.env.PASSWORD);
            if (result) {
                console.log('✅ Login successful with fallback browser');
                return true;
            }
            
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError.message);
        }
        
        return false;
    } finally {
        if (browser) {
            await browser.close().catch(error => {
                console.log('Error closing browser:', error.message);
            });
        }
    }
}

// Main function that runs the chat bot in cycles of 40 minutes
async function main() {
    console.log('Starting chat bot with 40-minute cycles...');
    
    // Run the chat bot in an infinite loop with 40-minute cycles
    while (true) {
        console.log('=== Starting new 40-minute cycle ===');
        
        // Record the start time
        const startTime = Date.now();
        
        // Run one cycle of the chat bot
        try {
            const cycleSuccess = await runChatBotCycle();
            if (!cycleSuccess) {
                console.log('Cycle failed, but continuing to next cycle...');
            }
        } catch (error) {
            console.error('Error in chat bot cycle:', error);
        }
        
        // Calculate elapsed time and remaining time for the 40-minute cycle
        const elapsedTime = Date.now() - startTime;
        const cycleDuration = 40 * 60 * 1000; // 40 minutes in milliseconds
        const remainingTime = Math.max(0, cycleDuration - elapsedTime);
        
        console.log(`Cycle completed in ${Math.round(elapsedTime / 1000)} seconds`);
        console.log(`Waiting ${Math.round(remainingTime / 1000)} seconds until next cycle...`);
        
        // Wait for the remainder of the 40-minute cycle (if any time is left)
        if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        console.log('=== 40-minute cycle completed, restarting ===');
    }
}

// Run the main function
main().catch(console.error);