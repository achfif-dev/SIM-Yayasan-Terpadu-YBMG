// Cadangan & pemulihan data Firestore sebagai berkas JSON (murni; tanpa Firebase supaya mudah diuji).
export const VERSI = 1;

// Koleksi yang dicadangkan. `pulihkan:false` = hanya disimpan sebagai arsip, tidak ditulis ulang saat pemulihan
// (audit_log memang tidak boleh diubah oleh rules; admins tidak boleh dipulihkan dari berkas demi keamanan).
export const KOLEKSI = [
  { id: 'settings', label: 'Pengaturan & identitas', pulihkan: true },
  { id: 'institutions', label: 'Lembaga', pulihkan: true },
  { id: 'board_members', label: 'Pengurus', pulihkan: true },
  { id: 'announcements', label: 'Berita / pengumuman', pulihkan: true },
  { id: 'events', label: 'Kegiatan', pulihkan: true },
  { id: 'routine_events', label: 'Kegiatan rutin', pulihkan: true },
  { id: 'gallery', label: 'Galeri', pulihkan: true },
  { id: 'transactions', label: 'Transaksi kas', pulihkan: true },
  { id: 'receipts', label: 'Bukti nota (bisa besar; termasuk nota kegiatan bila tanpa Cloudinary)', pulihkan: true },
  // `sub` = subkoleksi yang ikut dicadangkan di dalam tiap dokumen (kas kegiatan = panitia/<id>/kas)
  { id: 'panitia', label: 'Kepanitiaan kegiatan + kas kegiatan', pulihkan: true, sub: 'kas' },
  { id: 'donations', label: 'Buku donatur (memuat nomor WhatsApp)', pulihkan: true },
  { id: 'audit_log', label: 'Riwayat perubahan kas (arsip)', pulihkan: false },
  { id: 'admins', label: 'Daftar admin (arsip, hanya pemilik)', pulihkan: false, pemilik: true },
];

const adalahTimestamp = (v) => v && typeof v === 'object' && typeof v.toDate === 'function' && typeof v.seconds === 'number';

// Firestore → JSON biasa (Timestamp menjadi {__ts: ISO})
export function serial(v) {
  if (v === undefined) return null;
  if (adalahTimestamp(v)) return { __ts: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(serial);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serial(x)]));
  return v;
}

// JSON → data Firestore (`bangunTs(ms)` membuat Timestamp, mis. Timestamp.fromMillis)
export function hidupkan(v, bangunTs) {
  if (Array.isArray(v)) return v.map((x) => hidupkan(x, bangunTs));
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === '__ts') { const ms = Date.parse(v.__ts); return Number.isNaN(ms) ? null : bangunTs(ms); }
    return Object.fromEntries(keys.map((k) => [k, hidupkan(v[k], bangunTs)]));
  }
  return v;
}

export const buatBerkas = (koleksi, proyek = '') => ({ versi: VERSI, aplikasi: 'sim-yayasan-terpadu', proyek, dibuat: new Date().toISOString(), koleksi });

// Periksa isi berkas cadangan; kembalikan { ok, galat, ringkasan:[{id,label,jumlah,pulihkan}] }
export function periksaBerkas(obj) {
  if (!obj || typeof obj !== 'object' || obj.aplikasi !== 'sim-yayasan-terpadu') return { ok: false, galat: 'Bukan berkas cadangan SIM Yayasan.' };
  if (obj.versi !== VERSI) return { ok: false, galat: `Versi cadangan ${obj.versi} tidak dikenal (diharapkan ${VERSI}).` };
  if (!obj.koleksi || typeof obj.koleksi !== 'object') return { ok: false, galat: 'Isi cadangan kosong atau rusak.' };
  const ringkasan = [];
  for (const [id, daftar] of Object.entries(obj.koleksi)) {
    const def = KOLEKSI.find((k) => k.id === id);
    if (!def) continue; // koleksi asing diabaikan
    if (!Array.isArray(daftar) || daftar.some((d) => !d || typeof d.id !== 'string' || !d.id || d.id.includes('/') || typeof d.data !== 'object' || d.data === null)) {
      return { ok: false, galat: `Data koleksi "${id}" rusak.` };
    }
    let sub = 0;
    if (def.sub) {
      for (const d of daftar) {
        const anak = d[def.sub];
        if (anak === undefined) continue;
        if (!Array.isArray(anak) || anak.some((x) => !x || typeof x.id !== 'string' || !x.id || x.id.includes('/') || typeof x.data !== 'object' || x.data === null)) {
          return { ok: false, galat: `Data ${def.sub} pada koleksi "${id}" rusak.` };
        }
        sub += anak.length;
      }
    }
    ringkasan.push({ id, label: def.label, jumlah: daftar.length, sub, subNama: def.sub || '', pulihkan: def.pulihkan });
  }
  if (!ringkasan.some((r) => r.pulihkan && r.jumlah > 0)) return { ok: false, galat: 'Tidak ada data yang bisa dipulihkan di berkas ini.' };
  return { ok: true, galat: '', ringkasan };
}

export const namaBerkas = (d = new Date()) => `cadangan-yayasan-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
export const hariSejak = (iso, sekarang = Date.now()) => { const t = Date.parse(iso); return Number.isNaN(t) ? null : Math.floor((sekarang - t) / 86400000); };

// Daftar penulisan untuk pemulihan: [{ path: [koleksi, id, (subkoleksi, id)], data }] — dokumen induk dulu, lalu isinya.
export function susunOperasi(berkas, bangunTs) {
  const ops = [];
  for (const [id, daftar] of Object.entries(berkas.koleksi || {})) {
    const def = KOLEKSI.find((k) => k.id === id);
    if (!def || !def.pulihkan || !Array.isArray(daftar)) continue;
    for (const d of daftar) {
      ops.push({ path: [id, d.id], data: hidupkan(d.data, bangunTs) });
      if (def.sub && Array.isArray(d[def.sub])) d[def.sub].forEach((x) => ops.push({ path: [id, d.id, def.sub, x.id], data: hidupkan(x.data, bangunTs) }));
    }
  }
  return ops;
}
