import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const incomingReferer = searchParams.get('referer');

    if (!url) {
        return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    async function performFetch(targetUrl: string, referer: string | null) {
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive',
        };

        if (referer) {
            headers['Referer'] = referer;
        }

        return await fetch(targetUrl, {
            headers,
            cache: 'no-store',
            redirect: 'follow',
        });
    }

    try {
        console.log('[API] Processing URL:', url);

        // Strategy 1: Use provided or Root Referer
        let response = await performFetch(url, incomingReferer || 'https://allrss.se/');
        console.log(`[API] Strategy 1 (${incomingReferer ? 'incoming' : 'root'}): ${response.status}`);

        // Strategy 2: If 204, try /dramas/ subpath
        if (response.status === 204 && url.includes('allrss.se')) {
            console.log('[API] Strategy 2 (dramas subpath): Trying...');
            response = await performFetch(url, 'https://allrss.se/dramas/');
        }

        // Strategy 3: If still 204, try NO Referer
        if (response.status === 204 && url.includes('allrss.se')) {
            console.log('[API] Strategy 3 (no referer): Trying...');
            response = await performFetch(url, null);
        }

        // Strategy 4: If still 204 and http, try non-secure Referer
        if (response.status === 204 && url.startsWith('http:')) {
            console.log('[API] Strategy 4 (non-secure root): Trying...');
            response = await performFetch(url, 'http://allrss.se/');
        }

        // Strategy 5: vChannel User-Agent
        if (response.status === 204) {
            console.log('[API] Strategy 5 (vChannel UA): Trying...');
            const vChannelHeaders: Record<string, string> = {
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

        // Strategy 6: AllOrigins CORS Proxy (User Suggestion)
        if (response.status === 204 || response.status === 403) {
            console.log('[API] Strategy 6 (AllOrigins Proxy): Trying...');
            try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                const proxyResponse = await fetch(proxyUrl, { cache: 'no-store' });
                // Only use proxy response if it's OK and actually has content
                if (proxyResponse.ok) {
                    const text = await proxyResponse.text();
                    if (text && text.length > 50) { // Minimal validation
                        console.log('[API] Proxy Success! content-length:', text.length);
                        return new NextResponse(text, {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/xml; charset=utf-8',
                                'Access-Control-Allow-Origin': '*',
                                'Cache-Control': 'no-cache',
                            },
                        });
                    }
                }
            } catch (err) {
                console.error('[API] Proxy failed:', err);
            }
        }

        console.log(`[API] Final Result for ${url}: ${response.status}`);

        if (response.status === 204) {
            console.warn('[API] Persistent 204. Returning empty placeholder.');
            return new NextResponse('<rss version="2.0"><channel><title>Empty Content (Blocked)</title></channel></rss>', {
                status: 200,
                headers: { 'Content-Type': 'application/xml' }
            });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        console.log('[API] Success! Body length:', xmlText.length);

        return new NextResponse(xmlText, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error: any) {
        console.error('[API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch RSS feed' },
            { status: 500 }
        );
    }
}
