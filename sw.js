if (navigator.userAgent.includes("Firefox")) {
	Object.defineProperty(globalThis, "crossOriginIsolated", {
		value: true,
		writable: false,
	});
}

importScripts("/scram/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

console.log('Scramjet service worker loaded');

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
	
	await scramjet.loadConfig();

	if (scramjet.route(event)) {
		return scramjet.fetch(event);
	}

	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

self.addEventListener("install", (event) => {
	console.log('Service worker installing');
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	console.log('Service worker activating');
	event.waitUntil(self.clients.claim());
});
