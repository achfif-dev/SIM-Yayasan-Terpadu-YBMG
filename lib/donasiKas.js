// Penyambung otomatis: sumbangan UMUM yayasan (tanpa kegiatan) → kas yayasan (koleksi `transactions`).
// Satu kali input di tab Donatur:
//   1. transaksi `masuk` dibuat dengan ID tetap `d_<idDonasi>`,
//   2. jejak ditulis ke `audit_log`,
//   3. dokumen `settings/ringkasanKas` dinaikkan/diturunkan secara inkremental,
//   4. dokumen donasi diberi `kasId` + `bidang`.
// Keempatnya ditulis dalam SATU writeBatch (atomik: semua berhasil atau tidak ada yang tertulis), dan pemanggilan
// ulang untuk donasi yang sama tidak menaikkan ringkasan lagi (idempoten). Tidak perlu mengubah firestore.rules selain aturan audit_log.
import { doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getDb } from './firebase';
import { danaDariJenis, normBidang } from './bidang';
import { clearCache } from './hemat';
import { emailSaya, isiLog, refLog } from './audit';

export const idKasDonasi = (donasiId) => `d_${donasiId}`;

const bulanDari = (tgl) => (/^\d{4}-\d{2}/.test(String(tgl || '')) ? String(tgl).slice(0, 7) : 'tanpa-tanggal');

// Transaksi kas tampil PUBLIK di beranda, jadi nama donatur hanya ditulis bila admin memilihnya (bawaan: Hamba Allah).
// Nomor WhatsApp tidak pernah ikut.
export const keteranganKas = ({ jenis = 'Infaq', nama = '', tampilNama = false }) => `${jenis} umum · ${tampilNama && nama ? nama : 'Hamba Allah'}`;

// Bentuk dokumen sama dengan field di TRX_FIELDS (app/admin/page.js) supaya Riwayat Kas terbaca seragam.
export const bentukLog = (t) => ({
  tanggal: t.tanggal ?? null, tipe: t.tipe ?? null, kategoriUnit: t.kategoriUnit ?? null, unitId: t.unitId ?? null,
  dana: t.dana ?? null, jumlah: t.jumlah ?? null, keterangan: t.keterangan ?? null, bukti: t.bukti ?? null,
});

// Perubahan inkremental untuk settings/ringkasanKas. arah: +1 (tambah pemasukan) atau -1 (cabut pemasukan).
export function deltaRingkasan({ bidang, tanggal, jumlah, arah }) {
  const b = normBidang(bidang);
  const bln = bulanDari(tanggal);
  const v = arah * jumlah;
  return {
    [`total.${b}.masuk`]: increment(v), [`total.${b}.keluar`]: increment(0),
    [`bulan.${bln}.${b}.masuk`]: increment(v), [`bulan.${bln}.${b}.keluar`]: increment(0),
    jumlah: increment(arah), updatedAt: serverTimestamp(),
  };
}

// Catat donasi umum sebagai pemasukan kas (atomik + idempoten). Melempar galat bila batch gagal; dalam kasus itu
// TIDAK ADA yang tertulis, jadi admin boleh mengulang dari tombol yang sama tanpa risiko dobel.
// Bila transaksi `d_<id>` ternyata sudah ada (mis. percobaan sebelumnya terputus setelah tertulis), donasi hanya
// disambungkan kembali ke transaksi itu tanpa menyentuh ringkasan.
export async function catatDonasiUmum({ donasiId, nama, jenis, jumlah, tanggal, bidang, unitId = '', lembagaId = '', tampilNama = false }) {
  const db = getDb();
  const id = idKasDonasi(donasiId);
  const trxRef = doc(db, 'transactions', id);
  const donasiRef = doc(db, 'donations', donasiId);
  const ringRef = doc(db, 'settings', 'ringkasanKas');
  const [ada, ring] = await Promise.all([getDoc(trxRef), getDoc(ringRef)]);
  const batch = writeBatch(db);
  if (ada.exists()) {
    batch.update(donasiRef, { kasId: id, bidang: normBidang(ada.data().kategoriUnit) });
    await batch.commit();
    clearCache();
    return { kasId: id, logOk: true, ringkasanOk: true, sudahAda: true };
  }
  const trx = {
    tanggal, tipe: 'masuk', kategoriUnit: normBidang(bidang), unitId: unitId || '', lembagaId: lembagaId || '',
    dana: danaDariJenis(jenis), jumlah, keterangan: keteranganKas({ jenis, nama, tampilNama }), bukti: '', donasiId,
    createdAt: serverTimestamp(), createdBy: emailSaya(), updatedAt: serverTimestamp(), updatedBy: emailSaya(),
  };
  batch.set(trxRef, trx);
  batch.set(refLog(), isiLog({ koleksi: 'transactions', aksi: 'tambah', docId: id, sesudah: bentukLog(trx), sumber: 'donatur' }));
  // Bila ringkasan belum pernah dibangun, tidak dibuat di sini (beranda membaca seluruh transaksi sampai admin
  // menekan "Bangun ulang ringkasan"); jangan buat ringkasan parsial.
  if (ring.exists()) batch.update(ringRef, deltaRingkasan({ bidang, tanggal, jumlah, arah: 1 }));
  batch.update(donasiRef, { kasId: id, bidang: normBidang(bidang) });
  await batch.commit();
  clearCache();
  return { kasId: id, logOk: true, ringkasanOk: true, sudahAda: false };
}

// Cabut pemasukan kas milik sebuah donasi dan (opsional) hapus donasinya, semuanya dalam satu batch.
// Tidak melempar bila transaksinya sudah tidak ada (mis. sudah dihapus manual dari tab Kas).
// `donasi` = data donasi untuk jejak audit (tanpa nama/HP: hanya tanggal, jenis, jumlah, tujuan).
export async function cabutDonasiUmum({ donasiId, hapusDonasi = false, donasi = null }) {
  const db = getDb();
  const id = idKasDonasi(donasiId);
  const ref = doc(db, 'transactions', id);
  const ringRef = doc(db, 'settings', 'ringkasanKas');
  const s = await getDoc(ref);
  const ring = s.exists() ? await getDoc(ringRef) : null;
  const batch = writeBatch(db);
  if (s.exists()) {
    const lama = s.data();
    batch.delete(ref);
    batch.set(refLog(), isiLog({ koleksi: 'transactions', aksi: 'hapus', docId: id, sebelum: bentukLog(lama), sumber: 'donatur' }));
    if (ring?.exists()) batch.update(ringRef, deltaRingkasan({ bidang: lama.kategoriUnit, tanggal: lama.tanggal, jumlah: Number(lama.jumlah) || 0, arah: -1 }));
  }
  if (hapusDonasi) {
    batch.delete(doc(db, 'donations', donasiId));
    batch.set(refLog(), isiLog({
      koleksi: 'donations', aksi: 'hapus', docId: donasiId, sumber: 'donatur',
      sebelum: donasi ? { tanggal: donasi.tanggal ?? null, jenis: donasi.jenis ?? null, jumlah: donasi.jumlah ?? null, tujuan: donasi.tujuan ?? null } : null,
    }));
  }
  await batch.commit();
  clearCache();
  return { ada: s.exists(), logOk: true, ringkasanOk: true };
}
