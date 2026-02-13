import { parseStringPromise } from 'xml2js';

export interface Item {
    id: string;
    title: string;
    url: string;
    thumbnail: string;
    isFolder: boolean;
    description?: string;
    type: string; // Show the actual type for debugging
}

function safeGetAttribute(obj: any, attrName: string): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    // With mergeAttrs: true, attributes are directly on the object
    // but they might be arrays if explicitArray is true (which it's not here)
    const val = obj[attrName];
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return String(val[0] || '');
    return String(val);
}

function safeGetText(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj[0] || '';
    if (obj._) return obj._;
    return String(obj);
}

export async function parseRSS(xmlText: string): Promise<Item[]> {
    try {
        console.log('[Parser] Parsing XML, length:', xmlText.length);

        const result = await parseStringPromise(xmlText, {
            explicitArray: false,
            mergeAttrs: true, // Put attributes directly on the item
            trim: true
        });

        // Handle both RSS 2.0 and Atom, and potentially namespaced versions
        const channel = result.rss?.channel || result.feed || result.channel || result;
        if (!channel) {
            console.error('[Parser] No channel found in:', result);
            return [];
        }

        let items = channel.item || channel.entry || result.item || result.entry;
        if (!items) {
            // Last resort: search recursively for an 'item' or 'entry' key
            console.warn('[Parser] Trying deep item search...');
            if (channel.items) items = channel.items;
            else if (result.items) items = result.items;
        }

        if (!items) {
            console.warn('[Parser] No items/entries found');
            return [];
        }

        if (!Array.isArray(items)) {
            items = [items];
        }

        const parsedItems: Item[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            let enclosure = item.enclosure;
            if (Array.isArray(enclosure)) {
                enclosure = enclosure[0];
            }

            let url = '';
            let type = '';

            if (enclosure) {
                url = safeGetAttribute(enclosure, 'url');
                type = safeGetAttribute(enclosure, 'type');
            }

            // Fallback to <link> if no enclosure
            if (!url) {
                const linkVal = item.link;
                if (typeof linkVal === 'string') {
                    url = linkVal;
                } else if (linkVal && typeof linkVal === 'object') {
                    // Link might be an object with href (Atom style) or just an object
                    url = safeGetAttribute(linkVal, 'href') || safeGetText(linkVal);
                }
            }

            if (!url) continue;

            const title = safeGetText(item.title) || 'Untitled';

            let thumbnail = '';
            if (item['media:thumbnail']) {
                thumbnail = safeGetAttribute(item['media:thumbnail'], 'url');
            } else if (item['itunes:image']) {
                thumbnail = safeGetAttribute(item['itunes:image'], 'href');
            }

            const description = safeGetText(item.description || item.summary || '');

            const typeLower = type.toLowerCase();
            const urlLower = url.toLowerCase();

            // Refined Folder Detection
            const isFolder =
                typeLower.includes('xml') ||
                typeLower.includes('rss') ||
                urlLower.includes('.xml') ||
                urlLower.includes('/rss') ||
                urlLower.includes('?channel=') ||
                urlLower.includes('?subchannel=') ||
                urlLower.includes('?film=') ||
                urlLower.includes('?show=') ||
                urlLower.includes('?ep=') ||
                urlLower.includes('?mirror=') ||
                urlLower.includes('?xml=');

            parsedItems.push({
                id: `item-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: title,
                url: url,
                thumbnail: thumbnail,
                isFolder: isFolder,
                description: description,
                type: type, // Keep original type for debugging
            });

            console.log(`[Parser] Item ${i}: "${title}" | Type: ${type} | ${isFolder ? '📁 FOLDER' : '▶️ VIDEO'}`);
        }

        console.log(`[Parser] Successfully parsed ${parsedItems.length} items`);
        return parsedItems;

    } catch (error: any) {
        console.error('[Parser] Parse error:', error);
        return [];
    }
}
