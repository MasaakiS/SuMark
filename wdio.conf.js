const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Determine platform-specific binary path
const platform = os.platform();
let binaryPath;

if (platform === 'darwin') {
    binaryPath = path.join(__dirname, 'src-tauri/target/release/bundle/macos/SuMark.app/Contents/MacOS/SuMark');
} else if (platform === 'win32') {
    binaryPath = path.join(__dirname, 'src-tauri/target/release/SuMark.exe');
} else {
    binaryPath = path.join(__dirname, 'src-tauri/target/release/sumark');
}

exports.config = {
    runner: 'local',
    
    specs: [
        './test/e2e/**/*.test.js'
    ],
    
    exclude: [],
    
    maxInstances: 1,
    
    capabilities: [{
        maxInstances: 1,
        browserName: 'chrome',
        'goog:chromeOptions': {
            binary: binaryPath,
            args: [
                '--disable-infobars',
                '--disable-extensions',
                '--disable-gpu',
                '--no-sandbox'
            ]
        }
    }],
    
    logLevel: 'info',
    
    bail: 0,
    
    baseUrl: 'http://localhost',
    
    waitforTimeout: 10000,
    
    connectionRetryTimeout: 120000,
    
    connectionRetryCount: 3,
    
    framework: 'mocha',
    
    reporters: ['spec'],
    
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },
    
    // Hooks
    before: function (capabilities, specs) {
        // Give the app time to start
        return new Promise(resolve => setTimeout(resolve, 3000));
    },
    
    afterTest: async function(test, context, { error, result, duration, passed, retries }) {
        if (error) {
            // Take screenshot on failure
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const filename = `test/screenshots/${test.title.replace(/\s+/g, '_')}_${timestamp}.png`;
            await browser.saveScreenshot(filename);
        }
    }
};
