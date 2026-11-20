// Service worker SIM Yayasan Terpadu YBMG.
// Ubah VERSI setiap kali ingin memaksa cache lama dibuang.
const VERSI = 'v1';
const CACHE_STATIS = `ybmg-statis-${VERSI}`;
const CACHE_HALAMAN = `ybmg-halaman-${VERSI}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

// Halaman yang TIDAK boleh disimpan (data sensitif / berubah terus)
const LEWATI = [/^\/admin/, /^\/login/, /^\/api\//];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_STATIS).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ybmg-') && !k.endsWith(`-${VERSI}`)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firestore, Auth, Cloudinary, Google Fonts, dll. (lintas origin) ditangani browser/SDK sendiri
  if (url.origin !== self.location.origin) return;
  if (LEWATI.some((r) => r.test(url.pathname))) return;

  // Berkas Next.js ber-hash: aman cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(cacheFirst(req, CACHE_STATIS));
    return;
  }
  // Ikon & gambar statis: stale-while-revalidate
  if (url.pathname.startsWith('/icons/') || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req, CACHE_STATIS));
    return;
  }
  // Navigasi halaman: utamakan jaringan (data selalu segar), cadangan cache lalu halaman offline
  if (req.mode === 'navigate') {
    e.respondWith(networkFirstHalaman(req));
  }
});

async function cacheFirst(req, nama) {
  const cache = await caches.open(nama);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, nama) {
  const cache = await caches.open(nama);
  const hit = await cache.match(req);
  const baru = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await baru) || Response.error();
}

async function networkFirstHalaman(req) {
  const cache = await caches.open(CACHE_HALAMAN);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
