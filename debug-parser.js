const { parseStringPromise } = require('xml2js');

// Duplicate of helper functions from lib/rss-parser.ts
function getAttr(obj, attrName) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (obj.$) return String(obj.$[attrName] || '');
    if (obj[attrName]) return String(obj[attrName]);
    return '';
}

function getText(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj[0] || '';
    if (obj._) return obj._;
    return String(obj);
}

function safeToLowerCase(str) {
    if (!str) return '';
    return String(str).toLowerCase();
}

async function debugParser() {
    const fs = require('fs');
    const xmlText = fs.readFileSync('debug_feed.xml', 'utf8');

    try {
        const result = await parseStringPromise(xmlText, {
            explicitArray: false,
            mergeAttrs: false,
            xmlns: true,
            tagNameProcessors: [],
        });

        console.log('Parsed RSS structure keys:', Object.keys(result));

        const channel = result.rss?.channel || result.feed;
        if (!channel) {
            throw new Error('Invalid RSS feed: No channel found');
        }

        let items = channel.item;
        if (!items) {
            console.warn('No items found in feed');
            return;
        }
        if (!Array.isArray(items)) {
            items = [items];
        }

        console.log(`Found ${items.length} items in feed`);

        for (let i = 0; i < Math.min(items.length, 3); i++) {
            const item = items[i];
            console.log(`\nItem ${i}:`);
            console.log('Title:', getText(item.title));

            let enclosure = item.enclosure;
            if (Array.isArray(enclosure)) enclosure = enclosure[0];

            if (enclosure) {
                console.log('Enclosure Raw:', JSON.stringify(enclosure));
                const urlAttr = getAttr(enclosure, 'url');
                console.log('getAttr(url):', urlAttr, typeof urlAttr);
                console.log('Is [object Object]?', urlAttr === '[object Object]');
            } else {
                console.log('No enclosure. Link tag:', item.link);
                const linkText = getText(item.link);
                console.log('getText(link):', linkText, typeof linkText);
                console.log('Is [object Object]?', linkText === '[object Object]');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

debugParser();
