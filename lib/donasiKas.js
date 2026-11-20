// Penyambung otomatis: sumbangan UMUM yayasan (tanpa kegiatan) → kas yayasan (koleksi `transactions`).
// Sebelumnya admin harus mengetik ulang donasi umum di tab Kas. Kini satu kali input di tab Donatur:
//   1. transaksi `masuk` dibuat dengan ID tetap `d_<idDonasi>` (aman dari dobel catat, mudah dihapus bersama donasinya),
//   2. jejak ditulis ke `audit_log` (sama seperti Admin → Kas),
//   3. dokumen `settings/ringkasanKas` ikut dinaikkan/diturunkan secara inkremental (tanpa membaca semua transaksi).
// Tidak perlu mengubah firestore.rules.
import { addDoc, collection, deleteDoc, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDb } from './firebase';
import { normBidang } from './bidang';
import { clearCache } from './hemat';

export const idKasDonasi = (donasiId) => `d_${donasiId}`;

const bulanDari = (tgl) => (/^\d{4}-\d{2}/.test(String(tgl || '')) ? String(tgl).slice(0, 7) : 'tanpa-tanggal');

// Transaksi kas tampil PUBLIK di beranda, jadi nama donatur hanya ditulis bila admin memilihnya (bawaan: Hamba Allah).
// Nomor WhatsApp tidak pernah ikut.
export const keteranganKas = ({ jenis = 'Infaq', nama = '', tampilNama = false }) => `${jenis} umum · ${tampilNama && nama ? nama : 'Hamba Allah'}`;

// Bentuk dokumen sama dengan field di TRX_FIELDS (app/admin/page.js) supaya Riwayat Kas terbaca seragam.
const bentukLog = (t) => ({
  tanggal: t.tanggal ?? null, tipe: t.tipe ?? null, kategoriUnit: t.kategoriUnit ?? null, unitId: t.unitId ?? null,
  jumlah: t.jumlah ?? null, keterangan: t.keterangan ?? null, bukti: t.bukti ?? null,
});

async function tulisLog(aksi, docId, sebelum, sesudah, oleh) {
  try {
    await addDoc(collection(getDb(), 'audit_log'), {
      koleksi: 'transactions', aksi, docId, sebelum: sebelum ? bentukLog(sebelum) : null, sesudah: sesudah ? bentukLog(sesudah) : null,
      oleh, waktu: serverTimestamp(), sumber: 'donatur',
    });
    return true;
  } catch (e) { console.error('Gagal mencatat riwayat:', e); return false; }
}

// arah: +1 (tambah pemasukan) atau -1 (cabut pemasukan). Bila ringkasan belum pernah dibangun, tidak dibuat di sini
// (beranda memang membaca seluruh transaksi sampai admin menekan "Bangun ulang ringkasan"); jangan buat ringkasan parsial.
async function sesuaikanRingkasan({ bidang, tanggal, jumlah, arah }) {
  try {
    const ref = doc(getDb(), 'settings', 'ringkasanKas');
    const s = await getDoc(ref);
    if (!s.exists()) return true;
    const b = normBidang(bidang);
    const bln = bulanDari(tanggal);
    const v = arah * jumlah;
    await updateDoc(ref, {
      [`total.${b}.masuk`]: increment(v), [`total.${b}.keluar`]: increment(0),
      [`bulan.${bln}.${b}.masuk`]: increment(v), [`bulan.${bln}.${b}.keluar`]: increment(0),
      jumlah: increment(arah), updatedAt: serverTimestamp(),
    });
    return true;
  } catch (e) { console.error('Gagal memperbarui ringkasan:', e); return false; }
}

// Catat donasi umum sebagai pemasukan kas. Melempar galat bila transaksinya sendiri gagal ditulis.
// Mengembalikan { ringkasanOk, logOk } untuk pesan ke admin.
export async function catatDonasiUmum({ donasiId, nama, jenis, jumlah, tanggal, bidang, unitId = '', tampilNama = false, oleh = '' }) {
  const id = idKasDonasi(donasiId);
  const trx = {
    tanggal, tipe: 'masuk', kategoriUnit: normBidang(bidang), unitId: unitId || '', jumlah,
    keterangan: keteranganKas({ jenis, nama, tampilNama }), bukti: '', donasiId,
    createdAt: serverTimestamp(), createdBy: oleh, updatedAt: serverTimestamp(), updatedBy: oleh,
  };
  await setDoc(doc(getDb(), 'transactions', id), trx);
  const logOk = await tulisLog('tambah', id, null, trx, oleh);
  const ringkasanOk = await sesuaikanRingkasan({ bidang, tanggal, jumlah, arah: 1 });
  clearCache();
  return { kasId: id, logOk, ringkasanOk };
}

// Cabut pemasukan kas milik sebuah donasi (dipakai saat donasi dihapus). Tidak melempar bila transaksinya sudah tidak ada
// (mis. sudah dihapus manual dari tab Kas).
export async function cabutDonasiUmum({ donasiId, oleh = '' }) {
  const id = idKasDonasi(donasiId);
  const ref = doc(getDb(), 'transactions', id);
  const s = await getDoc(ref);
  if (!s.exists()) return { ada: false, logOk: true, ringkasanOk: true };
  const lama = s.data();
  await deleteDoc(ref);
  const logOk = await tulisLog('hapus', id, lama, null, oleh);
  const ringkasanOk = await sesuaikanRingkasan({ bidang: lama.kategoriUnit, tanggal: lama.tanggal, jumlah: Number(lama.jumlah) || 0, arah: -1 });
  clearCache();
  return { ada: true, logOk, ringkasanOk };
}
