const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load dev server or production build
    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        // In production, load the index.html from the 'out' directory
        mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

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

// IPC Handler for RSS Fetching (Mirroring the API strategies)
ipcMain.handle('fetch-rss', async (event, url, incomingReferer) => {
    console.log('[Electron] Fetching RSS:', url);

    async function performFetch(targetUrl, referer) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased to 30s timeout

            // Use Electron's net module or simple Fetch API (available in newer Node/Electron)
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            };
            if (referer) headers['Referer'] = referer;

            const response = await fetch(targetUrl, {
                headers,
                cache: 'no-store',
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            console.error('[Electron] Fetch Error:', error.message);
            // Return a mock response object to signify failure, but don't crash
            return {
                ok: false,
                status: 500,
                statusText: error.message,
                text: async () => ''
            };
        }
    }

    // Strategy 1: Default/Incoming Referer
    let response = await performFetch(url, incomingReferer || 'https://allrss.se/');
    console.log(`[Electron] Strategy 1: ${response.status}`);

    // Strategy 2: Dramas Path
    if (response.status === 204 && url.includes('allrss.se')) {
        console.log('[Electron] Strategy 2: Trying dramas path...');
        response = await performFetch(url, 'https://allrss.se/dramas/');
    }

    // Strategy 3: No Referer
    if (response.status === 204 && url.includes('allrss.se')) {
        console.log('[Electron] Strategy 3: Trying no referer...');
        response = await performFetch(url, null);
    }

    // Strategy 4: Non-Secure
    if (response.status === 204 && url.startsWith('http:')) {
        console.log('[Electron] Strategy 4: Trying non-secure...');
        response = await performFetch(url, 'http://allrss.se/');
    }

    // Strategy 5: vChannel UA
    if (response.status === 204) {
        console.log('[Electron] Strategy 5: Trying vChannel UA...');
        const vChannelHeaders = {
            'User-Agent': 'vChannel/2.4 (iPhone; iOS 15.0; Scale/3.00)',
            'Accept': '*/*, application/xml',
            'Connection': 'keep-alive'
        };
        if (incomingReferer) vChannelHeaders['Referer'] = incomingReferer;

        response = await fetch(url, {
            headers: vChannelHeaders,
            cache: 'no-store',
            redirect: 'follow',
        });
    }

    // Strategy 6: AllOrigins Proxy
    if (response.status === 204 || response.status === 403) {
        console.log('[Electron] Strategy 6: Trying AllOrigins Proxy...');
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const proxyResponse = await fetch(proxyUrl, { cache: 'no-store' });
        if (proxyResponse.ok) {
            const text = await proxyResponse.text();
            if (text && text.length > 50) return text;
        }
    }

    if (response.ok) {
        return await response.text();
    } else if (response.status === 204) {
        return '<rss version="2.0"><channel><title>Empty Content (Blocked)</title></channel></rss>';
    } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
});
