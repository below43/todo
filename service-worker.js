// Version with timestamp to ensure updates on each deploy
const CACHE_VERSION = '2025-11-26T22:20:00.000Z';
const CACHE_NAME = `todo-board-v${CACHE_VERSION}`;
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/db.js',
    '/logo.png',
    '/favicon.ico',
    '/manifest.json',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap'
];

// Google Fonts domains that should be cached
const GOOGLE_FONTS_DOMAINS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

// Install service worker and cache files
self.addEventListener('install', (event) => {
    // Skip waiting to activate immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.log('Cache addAll error:', error);
            })
    );
});

// Fetch from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Check if this is a Google Fonts request
    const isGoogleFonts = GOOGLE_FONTS_DOMAINS.some(domain => url.hostname === domain);
    
    if (isGoogleFonts) {
        // For Google Fonts, use cache-first strategy with network fallback
        event.respondWith(
            caches.open(CACHE_NAME)
                .then((cache) => {
                    return cache.match(event.request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            
                            // Not in cache, fetch from network
                            return fetch(event.request)
                                .then((networkResponse) => {
                                    // Cache the response for future use
                                    if (networkResponse && networkResponse.ok) {
                                        cache.put(event.request, networkResponse.clone());
                                    }
                                    return networkResponse;
                                })
                                .catch(() => {
                                    // Network failed and not in cache - return empty response
                                    return new Response('', { status: 503, statusText: 'Service Unavailable' });
                                });
                        });
                })
                .catch(() => {
                    // Cache failed, try network directly
                    return fetch(event.request);
                })
        );
        return;
    }
    
    // For local resources, use cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Clone the request
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then((response) => {
                    // Check if valid response
                    if (!response || !response.ok || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
    );
});

// Activate service worker and remove old caches
self.addEventListener('activate', (event) => {
    // Claim clients immediately
    event.waitUntil(
        clients.claim().then(() => {
            // Clean up old caches
            return caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            });
        })
    );
});
