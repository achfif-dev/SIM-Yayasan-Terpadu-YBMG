// Ringkasan kas (agregat) agar beranda cukup membaca 1 dokumen, bukan seluruh koleksi transactions.
// Disimpan di Firestore: settings/ringkasanKas. Diperbarui otomatis oleh Admin → Kas setiap
// transaksi ditambah / diedit / dihapus (atau lewat tombol "Bangun ulang ringkasan").
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from './firebase';
import { BIDANG, normBidang } from './bidang';

const kosong = () => Object.fromEntries(BIDANG.map((u) => [u, { masuk: 0, keluar: 0 }]));

// Fungsi murni: { total: {unit: {masuk, keluar}}, bulan: {'YYYY-MM' | 'tanpa-tanggal': {unit: {...}}}, jumlah }
export function hitungRingkasan(trx) {
  const total = kosong();
  const bulan = {};
  trx.forEach((t) => {
    const u = normBidang(t.kategoriUnit); // nama kategori lama dipetakan ke bidang sekarang
    if (!total[u]) return;
    const k = /^\d{4}-\d{2}/.test(String(t.tanggal || '')) ? String(t.tanggal).slice(0, 7) : 'tanpa-tanggal';
    if (!bulan[k]) bulan[k] = kosong();
    const f = t.tipe === 'masuk' ? 'masuk' : 'keluar';
    const v = Number(t.jumlah) || 0;
    total[u][f] += v;
    bulan[k][u][f] += v;
  });
  return { total, bulan, jumlah: trx.length };
}

export async function simpanRingkasan(trx) {
  await setDoc(doc(getDb(), 'settings', 'ringkasanKas'), { ...hitungRingkasan(trx), updatedAt: serverTimestamp() });
}
