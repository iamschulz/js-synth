const ver = "1.1.3";
const cacheName = `js-synth-${ver}`;
const filesToCache = [
	"./",
	"./index.html",
	"./style.css",
	"./script.js",
	"./freqs.js",
	"./keys.js",
];

/* Start the service worker and cache all of the app's content */
self.addEventListener("install", function (e) {
	e.waitUntil(
		caches.open(cacheName).then(function (cache) {
			return cache.addAll(filesToCache);
		})
	);
});

/* Serve cached content when offline */
self.addEventListener("fetch", function (e) {
	e.respondWith(
		caches.open(cacheName).then(function (cache) {
			return cache.match(e.request).then(function (response) {
				return response || fetch(e.request);
			});
		})
	);
});
