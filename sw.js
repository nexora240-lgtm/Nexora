const VERSION = "3.16"; // change this number whenever you need to force an update
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
  '/css/movies.css',
  '/css/games.css',
  '/css/apps.css',
  '/css/chatbot.css',
  '/css/chatroom.css',
  '/css/settings.css',
  '/css/gameloader.css',
  '/css/linkfinder.css',
  '/config.js?v=2',
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
  '/movies.html',
  '/apps.html',
  '/proxy.html',
  '/chatbot.html',
  '/chatroom.html',
  '/settings.html',
  '/linkfinder.html',
  '/apploader.html',
  '/gameloader.html',
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

// ─── Scramjet (proxy) setup ────────────────────────────────────────────────
// Loaded eagerly because importScripts must run at top-level, but config is
// loaded LAZILY — only when a /scramjet/ request actually comes through.
// This means movies, games, and every other non-proxy page never wait on
// scramjet and are completely unaffected if it fails.

// Catch bare-mux async errors so they don't kill the service worker
self.addEventListener('unhandledrejection', (event) => {
	const msg = event.reason?.message || String(event.reason || '');
	if (msg.includes('bare-mux') || msg.includes('MessagePort') || msg.includes('SharedWorker')) {
		event.preventDefault(); // swallow — proxy just won't work until configured
	}
});

let scramjet = null;
let scramjetConfigPromise = null;
let scramjetReady = false;
let _ScramjetSW = null; // deferred — constructor triggers bare-mux infinite retry

// Pre-load WASM bytes into self.WASM so scramjet's rewriter has them immediately.
// Without this, loadConfig() kicks off asyncSetWasm() which races against scram.fetch(),
// causing "rewriter wasm not found" when the first proxied page loads heavy JS.
let wasmPreloadPromise = null;
function preloadWasm() {
	if (wasmPreloadPromise) return wasmPreloadPromise;
	wasmPreloadPromise = fetch('/scram/scramjet.wasm.wasm').then(r => {
		if (!r.ok) throw new Error('WASM fetch ' + r.status);
		return r.arrayBuffer();
	}).then(buf => {
		self.WASM = new Uint8Array(buf);
	}).catch(err => {
		console.warn('[SW] WASM preload failed (rewriter may be slow on first load):', err.message);
	});
	return wasmPreloadPromise;
}

try {
	importScripts("/scram/scramjet.all.js");
	const loaded = $scramjetLoadWorker();
	_ScramjetSW = loaded.ScramjetServiceWorker;
	scramjetReady = true;
	// Start WASM preload immediately after scramjet loads
	preloadWasm();
} catch (e) {
	console.warn('[SW] Scramjet failed to load (proxy will be unavailable):', e.message);
}

// Lazy-instantiate ScramjetServiceWorker only when a /scramjet/ request arrives.
// Creating it eagerly starts a bare-mux SharedWorker port poll that retries
// every second against ALL page clients, flooding the console on non-proxy pages.
function getScramjet() {
	if (!scramjet && _ScramjetSW) {
		scramjet = new _ScramjetSW();
	}
	return scramjet;
}

// Default scramjet config — matches what proxy-browser.js passes to ScramjetController.
// Stored in IndexedDB so that scramjet.loadConfig() can read it, call its internal
// setConfig() (which sets the module-level $W used by url.ts, fetch.ts, etc.),
// and call asyncSetWasm(). We CANNOT just set scramjet.config directly because that
// makes loadConfig() skip its setConfig() call, leaving the internal $W undefined.
const SCRAMJET_DEFAULT_CONFIG = {
	prefix: "/scramjet/",
	globals: {
		wrapfn: "$scramjet$wrap",
		wrappropertybase: "$scramjet__",
		wrappropertyfn: "$scramjet$prop",
		cleanrestfn: "$scramjet$clean",
		importfn: "$scramjet$import",
		rewritefn: "$scramjet$rewrite",
		metafn: "$scramjet$meta",
		setrealmfn: "$scramjet$setrealm",
		pushsourcemapfn: "$scramjet$pushsourcemap",
		trysetfn: "$scramjet$tryset",
		templocid: "$scramjet$temploc",
		tempunusedid: "$scramjet$tempunused"
	},
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js"
	},
	flags: {
		serviceworkers: false,
		syncxhr: false,
		strictRewrites: true,
		rewriterLogs: false,
		captureErrors: true,
		cleanErrors: false,
		scramitize: false,
		sourcemaps: true,
		destructureRewrites: false,
		interceptDownloads: false,
		allowInvalidJs: true,
		allowFailedIntercepts: true
	},
	siteFlags: {},
	codec: {
		encode: "e=>e?encodeURIComponent(e):e",
		decode: "e=>e?decodeURIComponent(e):e"
	}
};

// Ensure scram's IDB has a valid config before loadConfig() reads from it.
// If the proxy page was never visited, IDB would be empty and loadConfig()
// would leave the internal $W undefined — causing "Cannot read 'prefix'".
function ensureScramjetIDB(retries) {
	if (retries === undefined) retries = 0;
	return new Promise((resolve) => {
		if (retries >= 2) { resolve(); return; }
		try {
			const req = indexedDB.open("$scramjet", 1);
			req.onupgradeneeded = (e) => {
				const db = e.target.result;
				for (const name of ["config", "cookies", "redirectTrackers", "referrerPolicies", "publicSuffixList"]) {
					if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
				}
			};
			req.onsuccess = (e) => {
				const db = e.target.result;
				// Verify all required stores exist (handles stale v1 DBs)
				const needed = ["config", "cookies", "redirectTrackers", "referrerPolicies", "publicSuffixList"];
				const missing = needed.filter(n => !db.objectStoreNames.contains(n));
				if (missing.length > 0) {
					db.close();
					const delReq = indexedDB.deleteDatabase("$scramjet");
					delReq.onsuccess = () => ensureScramjetIDB(retries + 1).then(resolve);
					delReq.onerror = () => resolve();
					delReq.onblocked = () => resolve();
					return;
				}
				try {
					const tx = db.transaction("config", "readwrite");
					const store = tx.objectStore("config");
					const getReq = store.get("config");
					getReq.onsuccess = () => {
						if (getReq.result && getReq.result.prefix) {
							// Config already exists in IDB — nothing to do
							db.close();
							resolve();
						} else {
							// Seed the default config so loadConfig() → setConfig() works
							store.put(SCRAMJET_DEFAULT_CONFIG, "config");
							tx.oncomplete = () => { db.close(); resolve(); };
							tx.onerror = () => { db.close(); resolve(); };
						}
					};
					getReq.onerror = () => { db.close(); resolve(); };
				} catch (err) { db.close(); resolve(); }
			};
			req.onerror = () => resolve();
		} catch (err) { resolve(); }
	});
}

console.log('Service worker loaded');

// ─── Caching strategies (used by everything EXCEPT the proxy) ──────────────

// Cache-first for static assets
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

// ─── Scramjet proxy handler (isolated — only called for /scramjet/ paths) ──

async function handleScramjetRequest(event, url) {
	// If scramjet failed to load, return a clear error instead of crashing
	if (!scramjetReady || !_ScramjetSW) {
		return new Response('Proxy not available. Scramjet failed to initialize.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	const scram = getScramjet();

	// Validate the proxied URL
	try {
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

	// Ensure WASM bytes are available before scramjet tries to use the rewriter.
	// loadConfig() calls asyncSetWasm() internally, but it can resolve before the
	// WASM compile finishes. self.WASM gives scramjet the bytes synchronously.
	await preloadWasm();

	// Ensure scramjet's internal config ($W) is set via loadConfig() → setConfig().
	// We seed IDB first (if empty), then clear scramjet.config so loadConfig()
	// doesn't early-return — it MUST run through to call setConfig().
	if (!scramjetConfigPromise) {
		scramjetConfigPromise = (async () => {
			await ensureScramjetIDB();
			scram.config = null; // force loadConfig to run fully (calls setConfig)
			await scram.loadConfig().catch((err) => {
				console.warn('[SW] Scramjet loadConfig error (config may still be usable):', err);
			});
		})();
	}
	await scramjetConfigPromise;

	// If config is still missing after loadConfig, retry once from scratch
	if (!scram.config || !scram.config.prefix) {
		scramjetConfigPromise = (async () => {
			await ensureScramjetIDB();
			scram.config = null;
			await scram.loadConfig().catch((err) => {
				console.warn('[SW] Scramjet loadConfig retry error:', err);
			});
		})();
		await scramjetConfigPromise;
	}

	if (!scram.config || !scram.config.prefix) {
		return new Response('Proxy not initialized. Please visit the proxy page first.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	try {
		if (scram.route(event)) {
			return await scram.fetch(event);
		}
	} catch (err) {
		console.error('[SW] Scramjet fetch failed:', err.message);
		return new Response('Proxy error: ' + err.message, { status: 502 });
	}

	// Shouldn't happen, but fall through to normal fetch
	return fetch(event.request);
}

// ─── Main request handler ──────────────────────────────────────────────────

async function handleRequest(event) {
	const url = new URL(event.request.url);

	// ── 1. Proxy requests — completely isolated, handled by scramjet ───────
	if (url.pathname.startsWith('/scramjet/')) {
		return handleScramjetRequest(event, url);
	}

	// ── 2. External API pass-through (vidplus proxy, AWS APIs) ─────────────
	if (url.hostname.endsWith('.execute-api.us-east-2.amazonaws.com') ||
	    url.hostname.endsWith('.cloudfront.net') ||
	    url.hostname === '69.10.53.183') {
		return fetch(event.request);
	}

	// ── 3. Cross-origin CDN / image caching (TMDB, fonts, etc.) ───────────
	if (url.hostname === 'image.tmdb.org' ||
	    url.hostname === 'cdn.jsdelivr.net' ||
	    url.hostname === 'cdnjs.cloudflare.com' ||
	    url.hostname === 'fonts.gstatic.com') {
		return cacheFirstImages(event.request);
	}

	// ── 4. Same-origin requests — normal caching strategies ───────────────
	if (url.origin === self.location.origin) {
		// Never cache baremux/epoxy worker scripts — stale copies break SharedWorker
		if (url.pathname.startsWith('/baremux/') || url.pathname.startsWith('/epoxy/')) {
			return fetch(event.request);
		}

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

	// ── 5. Everything else — straight to network, no scramjet ─────────────
	try {
		return await fetch(event.request);
	} catch (err) {
		return new Response('Offline', { status: 503 });
	}
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

self.addEventListener("install", (event) => {
	console.log('Service worker installing');
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => {
			// Cache each URL individually so one failure doesn't lose everything.
			// cache.addAll() is atomic — a single 404 or timeout empties the entire cache.
			return Promise.allSettled(
				PRECACHE_URLS.map(url =>
					cache.add(url).catch(err => {
						console.warn('Precache failed for', url, err);
					})
				)
			);
		})
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	console.log('Service worker activating');
	// Clean up old caches (keep IMG_CACHE_NAME)
	// Also purge any stale baremux/epoxy entries from the current cache
	event.waitUntil(
		caches.keys().then(keys => {
			return Promise.all(
				keys.filter(key => key !== CACHE_NAME && key !== IMG_CACHE_NAME)
				    .map(key => caches.delete(key))
			);
		}).then(() => {
			// Remove cached baremux/epoxy scripts — they must always be fetched fresh
			return caches.open(CACHE_NAME).then(cache =>
				cache.keys().then(reqs =>
					Promise.all(
						reqs.filter(r => {
							const p = new URL(r.url).pathname;
							return p.startsWith('/baremux/') || p.startsWith('/epoxy/');
						}).map(r => cache.delete(r))
					)
				)
			);
		}).then(() => self.clients.claim())
		  .then(() => {
			// Tell every open tab that a new version just activated
			return self.clients.matchAll({ type: 'window' }).then(clients => {
				clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: VERSION }));
			});
		  })
	);
});

// Respond to version queries from the page
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'GET_VERSION') {
		event.source.postMessage({ type: 'SW_VERSION', version: VERSION });
	}
});
