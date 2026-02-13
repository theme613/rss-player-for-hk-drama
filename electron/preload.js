const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    fetchRSS: (url, referer) => ipcRenderer.invoke('fetch-rss', url, referer)
});
