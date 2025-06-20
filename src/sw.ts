const ver = "1.2.0";
const cacheName = `js-synth-${ver}`;
const filesToCache = ["./", "./index.html", "./style.css", "./script.js", "./press-start-2p-latin-400-normal.woff2"];
const msgChannel = new BroadcastChannel("chan");
let updateAvailable = false;

// Start the service worker and cache all of the app's content
self.addEventListener("install", async (e) => {
	// check for updates
	const keys = await caches.keys();
	keys.forEach((key) => {
		if (key !== cacheName) {
			updateAvailable = true;
			caches.delete(key);
		}
	});

	// update notification
	if (updateAvailable) {
		msgChannel.postMessage({
			type: "update",
			version: ver,
		});
	}

	updateAvailable = false;

	// cache assets
	const cache = await caches.open(cacheName);
	await cache.addAll(filesToCache);
});

/* Serve cached content when offline */
self.addEventListener("fetch", function (e) {
	e.request.url = e.request.url + (e.request.url.includes("?") ? "&" : "?") + "v=" + ver;
	e.respondWith(
		caches.open(cacheName).then(function (cache) {
			return cache.match(e.request).then(function (response) {
				return response || fetch(e.request);
			});
		})
	);
});
