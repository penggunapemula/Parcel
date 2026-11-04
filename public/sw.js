/* ==========================================================================
   SERVICE WORKER — membuat Parcelku bisa dipasang seperti aplikasi dan tetap
   menampilkan halaman terakhir saat internet putus.

   Aturan: data (/api/) tidak pernah disimpan, selalu diambil langsung dari server.
   Halaman dan berkas statis memakai "jaringan dulu, cadangan dari cache bila offline",
   jadi pembaruan situs selalu langsung terlihat saat online.
   Naikkan VERSION setiap kali ada rilis besar supaya cache lama dibersihkan.
   ========================================================================== */
const VERSION = "parcelku-v4";
const CORE = ["/offline.html", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return; // selalu langsung ke server

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") return caches.match("/offline.html");
        return Response.error();
      }),
  );
});