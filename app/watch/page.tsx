'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';
import Hls from 'hls.js';

function VideoPlayer() {
    const searchParams = useSearchParams();
    const videoUrl = searchParams.get('url');
    const videoTitle = searchParams.get('title');
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !videoUrl) return;

        setLoading(true);
        setError('');
        console.log('[Player] Loading video:', videoUrl);

        const isHLS = videoUrl.includes('.m3u8');

        if (isHLS && Hls.isSupported()) {
            console.log('[Player] Using HLS.js for M3U8 stream');

            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
            });

            hlsRef.current = hls;
            hls.loadSource(videoUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[Player] HLS manifest parsed');
                setLoading(false);
                video.play().catch(err => console.log('Autoplay blocked:', err));
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('[Player] HLS error:', data);
                if (data.fatal) {
                    setError('Failed to load video stream');
                    setLoading(false);
                }
            });

            return () => {
                if (hlsRef.current) {
                    hlsRef.current.destroy();
                }
            };
        } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
            console.log('[Player] Using native HLS support (Safari)');
            video.src = videoUrl;
            video.addEventListener('loadedmetadata', () => setLoading(false));
            video.addEventListener('error', () => {
                setError('Failed to load video');
                setLoading(false);
            });
        } else {
            console.log('[Player] Using direct video URL');
            video.src = videoUrl;
            video.addEventListener('loadedmetadata', () => setLoading(false));
            video.addEventListener('error', () => {
                setError('Failed to load video');
                setLoading(false);
            });
        }
    }, [videoUrl]);

    if (!videoUrl) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p>No video URL provided</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-6xl mx-auto">
                {/* Video Title */}
                {videoTitle && (
                    <div className="p-4 bg-gray-900">
                        <h1 className="text-xl font-bold">{videoTitle}</h1>
                    </div>
                )}

                {/* Video Player */}
                <div className="relative aspect-video bg-black">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
                                <p>Loading video...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black">
                            <div className="text-center text-red-500">
                                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="font-semibold">{error}</p>
                            </div>
                        </div>
                    )}

                    <video
                        ref={videoRef}
                        className="w-full h-full"
                        controls
                        playsInline
                        preload="metadata"
                    />
                </div>

                {/* Info */}
                <div className="p-4 bg-gray-900">
                    <p className="text-sm text-gray-400">
                        Video URL: <span className="text-teal-400 break-all">{videoUrl}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function WatchPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
            <VideoPlayer />
        </Suspense>
    );
}
