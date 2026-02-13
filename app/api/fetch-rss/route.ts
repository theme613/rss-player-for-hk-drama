import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const feedUrl = searchParams.get('url');

    if (!feedUrl) {
        return NextResponse.json({ error: 'Feed URL is required' }, { status: 400 });
    }

    try {
        console.log('Fetching RSS feed:', feedUrl);

        const response = await fetch(feedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        console.log('RSS feed fetched successfully, size:', xmlText.length);

        return new NextResponse(xmlText, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    } catch (error: any) {
        console.error('RSS fetch error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch RSS feed' },
            { status: 500 }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
