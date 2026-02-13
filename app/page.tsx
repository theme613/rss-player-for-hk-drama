'use client';

import { useState, useEffect } from 'react';
import { parseRSS, Item } from '@/lib/parser';

interface NavLevel {
    url: string;
    title: string;
    items: Item[];
    xml: string;
}

export default function Home() {
    const [navStack, setNavStack] = useState<NavLevel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial load
    useEffect(() => {
        loadFeed('https://rss.app/feeds/8O3ywpMHwZGfCIYy.xml', 'Asian Channel', true);
    }, []);

    async function loadFeed(feedUrl: string, title: string, isReset = false) {
        setLoading(true);
        setError(null);
        try {
            console.log(`[Step 2] Navigating to: ${title} | ${feedUrl}`);
            const parentUrl = navStack[navStack.length - 1]?.url || '';

            let xml = '';

            // Electron Mode (IPC)
            if ((window as any).electron) {
                console.log('[Mode] Electron IPC detected');
                xml = await (window as any).electron.fetchRSS(feedUrl, parentUrl);
            }
            // Web Mode (Next.js API Proxy)
            else {
                console.log('[Mode] Web API Proxy');
                const apiUrl = `/api/rss?url=${encodeURIComponent(feedUrl)}${parentUrl ? `&referer=${encodeURIComponent(parentUrl)}` : ''}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                xml = await response.text();
            }

            const parsedItems = await parseRSS(xml);

            const newLevel = { url: feedUrl, title, items: parsedItems, xml };

            if (isReset) {
                setNavStack([newLevel]);
            } else {
                setNavStack(prev => [...prev, newLevel]);
            }
        } catch (err: any) {
            console.error('[Step 2] Navigation error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function handleBack() {
        if (navStack.length <= 1) return;
        setNavStack(prev => prev.slice(0, -1));
    }

    const currentLevel = navStack[navStack.length - 1];

    return (
        <main className="min-h-screen bg-black text-white p-6 font-mono">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex justify-between items-center border-b border-zinc-900 pb-4">
                    <div>
                        <h1 className="text-xl font-bold text-green-500 uppercase tracking-widest">Step 3: Electron Player</h1>
                        <p className="text-[10px] text-zinc-500 mt-1">Tech Stack: Electron + Next.js | Hybrid IPC Mode</p>
                    </div>
                    <button
                        onClick={() => loadFeed('https://rss.app/feeds/8O3ywpMHwZGfCIYy.xml', 'Asian Channel', true)}
                        className="text-[10px] bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded border border-zinc-800 transition uppercase"
                    >
                        Reset to Start
                    </button>
                </header>

                {/* Breadcrumbs / Back */}
                <div className="flex items-center gap-4">
                    {navStack.length > 1 && (
                        <button
                            onClick={handleBack}
                            className="bg-zinc-900 border border-zinc-800 px-3 py-1 text-[10px] uppercase font-bold hover:bg-zinc-800 transition text-green-500"
                        >
                            ← Back
                        </button>
                    )}
                    <nav className="flex items-center gap-2 overflow-x-auto py-1 text-[10px] uppercase text-zinc-500">
                        {navStack.map((level, idx) => (
                            <div key={idx} className="flex items-center gap-2 shrink-0">
                                {idx > 0 && <span className="text-zinc-800">&gt;</span>}
                                <button
                                    onClick={() => setNavStack(navStack.slice(0, idx + 1))}
                                    className={`hover:text-green-500 transition ${idx === navStack.length - 1 ? 'text-green-500' : ''}`}
                                >
                                    {level.title}
                                </button>
                            </div>
                        ))}
                    </nav>
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded text-sm italic">
                        ⚠️ ERROR: {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left: Navigator List */}
                    <div className="space-y-2">
                        <div className="bg-zinc-900/50 p-2 border border-zinc-800 flex justify-between items-center">
                            <span className="text-[10px] uppercase text-zinc-400">Navigation List</span>
                            <span className="text-[10px] text-zinc-600">{currentLevel?.items.length || 0} ITEMS</span>
                        </div>

                        <div className="bg-zinc-900/20 border border-zinc-800 min-h-[600px] overflow-y-auto max-h-[75vh]">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-green-500/50 text-[10px] uppercase">
                                    <div className="w-4 h-4 border border-green-500 border-t-transparent animate-spin mb-4"></div>
                                    Loading Level Content...
                                </div>
                            ) : currentLevel?.items.length === 0 ? (
                                <div className="text-center py-20 text-zinc-600 italic text-[10px] uppercase">Folder is empty.</div>
                            ) : (
                                <div className="divide-y divide-zinc-950">
                                    {currentLevel?.items.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (item.isFolder) loadFeed(item.url, item.title);
                                                else console.log('Final item clicked:', item.title);
                                            }}
                                            className="w-full flex items-center gap-3 p-4 hover:bg-zinc-900 transition text-left group"
                                        >
                                            <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
                                                {item.isFolder ? '📁' : '▶️'}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-zinc-300 truncate group-hover:text-white uppercase tracking-tight">
                                                    {item.title}
                                                </div>
                                                <div className="text-[9px] text-zinc-600 truncate mt-1 group-hover:text-zinc-400">{item.url}</div>
                                            </div>
                                            <div className="text-zinc-800 group-hover:text-green-500 transition-colors">
                                                [SELECT]
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: XML Source Code (Auto-follows navigation) */}
                    <div className="space-y-2">
                        <div className="bg-zinc-900/50 p-2 border border-zinc-800 flex justify-between items-center">
                            <span className="text-[10px] uppercase text-zinc-400">
                                Source Code Reader
                            </span>
                            <span className="text-[9px] text-green-600/60 font-bold uppercase">Active Path</span>
                        </div>

                        <div className="bg-black border border-zinc-800 min-h-[600px] max-h-[75vh] flex flex-col">
                            <div className="bg-zinc-900/30 p-2 text-[9px] text-zinc-600 border-b border-zinc-950 font-mono flex justify-between italic">
                                <span className="truncate max-w-[80%]">URL: {currentLevel?.url}</span>
                                <span>UTF-8</span>
                            </div>

                            {currentLevel && (
                                <pre className="flex-1 p-4 overflow-auto text-[10px] font-mono text-green-500/80 leading-normal whitespace-pre-wrap selection:bg-green-500/20">
                                    {currentLevel.xml}
                                </pre>
                            )}

                            {/* Manual Open Fallback */}
                            {currentLevel && (
                                <div className="bg-zinc-900 border-t border-zinc-800 p-3">
                                    <div className="text-[10px] text-zinc-500 mb-2 italic">
                                        Note: If the folder appears empty, the RSS provider might be blocking automated access.
                                        Click below to open the feed directly in your browser.
                                    </div>
                                    <a
                                        href={currentLevel.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block w-full text-center bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-800/50 py-2 rounded text-xs uppercase font-bold transition"
                                    >
                                        Open Feed in New Tab ↗
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
