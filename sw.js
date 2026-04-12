const VERSION = "2.5"; // change this number whenever you need to force an update
const CACHE_NAME = 'nexora-v' + VERSION;
const IMG_CACHE_NAME = 'nexora-images-v1';

// Static assets to precache on install
const PRECACHE_URLS = [
  '/css/_tokens.css',
  '/css/sidebar.css',
  '/css/home.css',
  '/css/auth.css',
  '/css/nexora-notify.css',
  '/css/first-time-modal.css',
  '/css/theme-tokens.css',
  '/config.js',
  '/js/nexora-boot.js',
  '/js/auth.js',
  '/js/views.js',
  '/js/app.js',
  '/js/mouse-tracking.js',
  '/js/nexora-notify.js',
  '/js/first-time-visitor.js',
  '/js/lag-detector.js',
  '/home.html',
  '/games.html',
  '/game-info.json'
];

// Extensions that should use cache-first strategy
const CACHEABLE_EXTENSIONS = /\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)(\?.*)?$/i;

if (navigator.userAgent.includes("Firefox")) {
	Object.defineProperty(globalThis, "crossOriginIsolated", {
		value: true,
		writable: false,
	});
}

importScripts("/scram/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
let scramjetConfigPromise = null;

console.log('Scramjet service worker loaded');

// Stale-while-revalidate for static assets
async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	
	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (err) {
		// If offline and not cached, return a basic error
		return new Response('Offline', { status: 503 });
	}
}

// Cache-first for cross-origin images (TMDB posters, CDN assets)
async function cacheFirstImages(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	
	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			const cache = await caches.open(IMG_CACHE_NAME);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (err) {
		return new Response('', { status: 503 });
	}
}

// Network-first for HTML views (SPA pages)
async function networkFirst(request) {
	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (err) {
		const cached = await caches.match(request);
		if (cached) return cached;
		return new Response('Offline', { status: 503 });
	}
}

async function handleRequest(event) {
	const url = new URL(event.request.url);
	
	// Check if this is a scramjet URL
	if (url.pathname.startsWith('/scramjet/')) {
		try {
			// Decode the proxied URL
			const encodedUrl = url.pathname.substring('/scramjet/'.length);
			const decodedUrl = decodeURIComponent(encodedUrl);
			
			// Block non-HTTP(S) schemes (app schemes like snssdk://, intent://, etc.)
			if (decodedUrl.match(/^[a-z0-9]+:\/\//) && 
			    !decodedUrl.startsWith('http://') && 
			    !decodedUrl.startsWith('https://')) {
				console.log('Blocked invalid URL scheme:', decodedUrl.substring(0, 30) + '...');
				return new Response('Blocked: Invalid URL scheme', { 
					status: 400,
					headers: { 'Content-Type': 'text/plain' }
				});
			}
		} catch (e) {
			console.error('Error validating URL:', e);
		}
	}
	
	if (!scramjetConfigPromise) {
		scramjetConfigPromise = scramjet.loadConfig().catch((err) => {
			scramjetConfigPromise = null;
			throw err;
		});
	}
	await scramjetConfigPromise;

	// Skip Scramjet for vidplus proxy requests (API Gateway + VPS)
	if (url.hostname.endsWith('.execute-api.us-east-2.amazonaws.com') ||
	    url.hostname === '69.10.53.183') {
		return fetch(event.request);
	}

	if (scramjet.route(event)) {
		try {
			return await scramjet.fetch(event);
		} catch (err) {
			console.error('[SW] Scramjet fetch failed:', err.message);
			return new Response('Proxy error: ' + err.message, { status: 502 });
		}
	}

	// Only cache same-origin requests
	if (url.origin === self.location.origin) {
		// Cache-first for static assets (CSS, JS, images, fonts)
		if (CACHEABLE_EXTENSIONS.test(url.pathname)) {
			return cacheFirst(event.request);
		}
		
		// Network-first for HTML views (for SPA view loading)
		if (url.pathname.endsWith('.html') || url.pathname.endsWith('.json')) {
			return networkFirst(event.request);
		}

		// SPA navigation fallback — serve index.html for clean URL routes
		if (event.request.mode === 'navigate' && !url.pathname.includes('.')) {
			return networkFirst(new Request('/index.html'));
		}
	}

	// Cache TMDB images and CDN assets (cross-origin, cache-first)
	if (url.hostname === 'image.tmdb.org' ||
	    url.hostname === 'cdn.jsdelivr.net' ||
	    url.hostname === 'cdnjs.cloudflare.com' ||
	    url.hostname === 'fonts.gstatic.com') {
		return cacheFirstImages(event.request);
	}

	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

self.addEventListener("install", (event) => {
	console.log('Service worker installing');
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => {
			return cache.addAll(PRECACHE_URLS).catch(err => {
				console.warn('Precache partial failure:', err);
			});
		})
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	console.log('Service worker activating');
	// Clean up old caches (keep IMG_CACHE_NAME)
	event.waitUntil(
		caches.keys().then(keys => {
			return Promise.all(
				keys.filter(key => key !== CACHE_NAME && key !== IMG_CACHE_NAME)
				    .map(key => caches.delete(key))
			);
		}).then(() => self.clients.claim())
	);
});
