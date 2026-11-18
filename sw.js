// Service worker: makes the site installable and usable offline. Everything it caches is still encrypted.
const V = "aa6a630da8369e5cba0b";                 // changes on every publish, so phones pick up the new version
const SHELL = "hub-shell-" + V;        // index.html, manifest, icons, current data blob
const FILES = "hub-files";             // encrypted PDFs/previews: ids never change, so keep across versions
const LIBS = "hub-libs";               // fonts and libraries from CDNs

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(["./", "manifest.webmanifest", "icon-192.png", "icon-512.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("hub-shell-") && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const networkFirst = async (req, cacheName) => {
  const c = await caches.open(cacheName);
  try {
    const r = await fetch(req, {cache: "no-cache"});
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch {
    return (await c.match(req, {ignoreSearch: true})) || Response.error();
  }
};
const cacheFirst = async (req, cacheName) => {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === "opaque") c.put(req, r.clone());
  return r;
};

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.includes("/f/")) return e.respondWith(cacheFirst(req, FILES));
    return e.respondWith(networkFirst(req, SHELL)); // index.html, data blob, manifest
  }
  if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.host)) return e.respondWith(cacheFirst(req, LIBS));
  // map tiles and everything else: straight to the network
});
