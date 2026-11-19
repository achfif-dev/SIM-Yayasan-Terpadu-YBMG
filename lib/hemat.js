// Penghemat kuota Firestore (Spark): cache di browser + muat data hanya saat bagiannya mendekati layar.
import { useEffect, useState } from 'react';

const PREFIX = 'ybmg_cache_';
export const CACHE_TTL = 10 * 60 * 1000; // 10 menit
const MAX_CACHE_CHARS = 2000000; // localStorage ±5 juta karakter untuk semua kunci; lewati data yang terlalu besar

// Ambil dari cache bila masih segar, kalau tidak jalankan fetcher lalu simpan.
// shouldCache(v) -> false untuk melewati penyimpanan (mis. hasil sebagian karena error).
export async function cached(key, ttl, fetcher, shouldCache = () => true) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) {
      const { t, v } = JSON.parse(raw);
      if (Date.now() - t < ttl) return v;
    }
  } catch (e) { /* abaikan */ }
  const v = await fetcher();
  if (shouldCache(v)) {
    try {
      const s = JSON.stringify({ t: Date.now(), v });
      if (s.length <= MAX_CACHE_CHARS) localStorage.setItem(PREFIX + key, s);
    } catch (e) { /* penyimpanan penuh: lewati */ }
  }
  return v;
}

// Panggil setelah admin menyimpan/menghapus data agar perubahan langsung terlihat di perangkat ini.
export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* abaikan */ }
}

// true (dan tetap true) setelah elemen ref mendekati layar.
export function useInView(ref, enabled = true, margin = '600px') {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!enabled || seen) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, enabled, seen, margin]);
  return seen;
}
