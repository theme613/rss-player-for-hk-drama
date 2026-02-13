const { app, BrowserWindow, ipcMain, session, protocol } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');

// Disable Chromium security features (User Suggestion)
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
app.commandLine.appendSwitch('ignore-certificate-errors');

// Register custom protocol to handle HTTP if needed (User suggestion)
// Must be called BEFORE app is ready
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'http',
        privileges: {
            secure: false,
            supportFetchAPI: true,
            bypassCSP: true,
            corsEnabled: true
        }
    }
]);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: '#000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true
        },
    });

    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: false });
    });

    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: details.requestHeaders });
    });

    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', () => {
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.handle('fetch-rss', async (event, url, incomingReferer) => {
    console.log('[Electron] Fetching RSS:', url);

    // Native Node.js HTTP/HTTPS Fetcher (Hybrid)
    function performFetch(targetUrl, referer) {
        return new Promise((resolve) => {
            try {
                const isHttp = targetUrl.startsWith('http:');
                const client = isHttp ? http : https;

                const options = {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                };
                if (referer) options.headers['Referer'] = referer;

                console.log(`[Electron] Using native ${isHttp ? 'HTTP' : 'HTTPS'} for: ${targetUrl}`);

                const req = client.get(targetUrl, options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        resolve({
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            text: async () => data
                        });
                    });
                });

                req.on('error', (e) => {
                    console.error(`[Electron] ${isHttp ? 'HTTP' : 'HTTPS'} Error:`, e);
                    resolve({ ok: false, status: 500, statusText: e.message, text: async () => '' });
                });

                req.end();
            } catch (err) {
                console.error('[Electron] Request Failed:', err);
                resolve({ ok: false, status: 500, statusText: err.message, text: async () => '' });
            }
        });
    }

    // Strategy 1: Default/Incoming Referer
    let response = await performFetch(url, incomingReferer || 'https://allrss.se/');
    console.log(`[Electron] Strategy 1: ${response.status}`);

    if (response.status === 204 && url.includes('allrss.se')) {
        console.log('[Electron] Strategy 2: Trying dramas path...');
        response = await performFetch(url, 'https://allrss.se/dramas/');
    }

    if (response.status === 204 && url.includes('allrss.se')) {
        console.log('[Electron] Strategy 3: Trying no referer...');
        response = await performFetch(url, null);
    }

    // ... (Strategy 4 & 5 moved to https logic if needed, or keep fetch for simple ones?)
    // Actually, let's just stick to performFetch for 1-4.

    // Strategy 6: AllOrigins (Use native fetch for this public API as it's easier, or https?)
    // Let's use fetch for proxy as it has no complex headers needed.
    if (response.status === 204 || response.status === 403 || response.status === 500) {
        console.log(`[Electron] Strategy 6: Trying AllOrigins Proxy (prev status: ${response.status})...`);
        try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            const proxyResponse = await fetch(proxyUrl, { cache: 'no-store' }); // Native fetch is fine here
            if (proxyResponse.ok) {
                const text = await proxyResponse.text();
                if (text && text.length > 50) return text;
            }
        } catch (err) { console.error('Proxy failed', err); }
    }

    if (response.ok) {
        return await response.text();
    } else if (response.status === 204) {
        return '<rss version="2.0"><channel><title>Empty Content (Blocked)</title></channel></rss>';
    } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
});
