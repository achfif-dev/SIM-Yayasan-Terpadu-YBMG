# SIM Yayasan Terpadu (Next.js 14 + Firebase Spark Plan)

1. Buat project Firebase: aktifkan Firestore dan Authentication (Email/Password). Storage TIDAK diperlukan.
2. Tambahkan user admin di Firebase Console → Authentication → Users.
3. Salin `.env.example` menjadi `.env.local`, isi nilainya dari Project Settings → Web App.
4. Tempel isi `firestore.rules` ke Firestore → Rules, lalu Publish.
5. `npm install && npm run dev`
6. Deploy: push ke GitHub → Import di Vercel → isi Environment Variables yang sama → Deploy.
7. Di Firebase → Authentication → Settings → Authorized domains, tambahkan domain Vercel Anda.

Gambar (logo/foto) otomatis dikompres ke maks. 320px dan disimpan di Firestore.

## Fitur laporan kas
- **Beranda → Transparansi Keuangan → Laporan Kas**: filter unit/tahun/bulan, ringkasan saldo awal–akhir, grafik per bulan (atau per tahun) dan per unit, tabel rincian, serta tombol ekspor **Excel (.xls)** dan **PDF** (membuka dialog cetak → pilih "Simpan sebagai PDF").
- **Admin → Kas**: laporan yang sama tampil di bawah daftar transaksi dan ikut ter-update setelah tambah/edit/hapus.
- **Bukti transaksi**: unggah foto nota/kwitansi di form transaksi (maks. ±1000 px). Tanpa Cloudinary, gambar disimpan di koleksi Firestore `receipts` (bukan di dokumen transaksi) dan dimuat hanya saat tombol "Lihat" diklik. Bukti ditampilkan publik, jadi jangan unggah nota yang memuat data pribadi.
