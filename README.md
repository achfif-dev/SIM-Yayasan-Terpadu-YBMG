# SIM Yayasan Terpadu (Next.js 14 + Firebase Spark Plan)

1. Buat project Firebase: aktifkan Firestore dan Authentication (Email/Password). Storage TIDAK diperlukan.
2. Tambahkan user admin di Firebase Console → Authentication → Users. **Email admin harus terverifikasi** (rules menolak tulis bila belum): login Google otomatis terverifikasi; untuk Email/Password, saat login pertama aplikasi mengirim tautan verifikasi — klik tautannya lalu masuk lagi.
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

## Ringkasan kas & hemat kuota baca
- Beranda membaca **1 dokumen** `settings/ringkasanKas` (total masuk/keluar per unit dan per bulan) untuk kartu saldo. Rincian transaksi baru dimuat saat pengunjung menekan **Tampilkan laporan rinci**.
- Ringkasan diperbarui otomatis setiap transaksi disimpan/dihapus di **Admin → Kas**. Setelah memasang pembaruan ini, klik **Bangun ulang ringkasan** sekali. Sebelum ringkasan ada, beranda tetap berfungsi (membaca semua transaksi seperti dulu).
- Jika data keuangan gagal dimuat, beranda menampilkan pesan galat (bukan Rp 0).

## Aturan Firestore
- `firestore.rules` kini per koleksi: baca publik untuk koleksi beranda, tulis hanya admin terverifikasi; koleksi tak dikenal ditolak. Transaksi harus bertipe masuk/keluar dengan jumlah > 0. Bukti nota (`receipts`) hanya bisa dibuka per-ID (`get`), tidak bisa didaftar publik.
- Tempel ulang isi `firestore.rules` ke Firestore → Rules, lalu Publish.
- Disarankan juga mengaktifkan **App Check** (reCAPTCHA) di Firebase Console untuk menekan penyalahgunaan kuota.

## Berita & kegiatan
- **Admin → Berita / Kegiatan / Galeri**: kelola pengumuman (koleksi `announcements`), jadwal kegiatan (`events`), dan foto galeri (`gallery`). Setiap item bisa dikaitkan ke satu lembaga (dipilih dari daftar Lembaga) atau dikosongkan untuk "Umum".
- **Beranda**: bagian *Berita & Kegiatan* (pengumuman, dengan opsi sematkan "Penting", plus jadwal kegiatan mendatang dan arsip yang sudah lewat) dan *Galeri Kegiatan* (grid foto dengan lightbox). Satu filter lembaga berlaku untuk keduanya.
- Beranda hanya memuat 12 pengumuman terbaru, kegiatan mulai 30 hari terakhir, dan 24 foto terbaru. Tanpa Cloudinary foto disimpan di Firestore (±800–900 px); untuk galeri yang besar sebaiknya aktifkan Cloudinary.
- Rules Firestore tidak perlu diubah (baca publik, tulis hanya admin).

## Konfigurasi tampilan (Admin → Tampilan)
- Warna utama, warna latar, font judul/isi (Google Fonts), ukuran teks, lebar konten, sudut kartu, dan bagian beranda yang ditampilkan.
- **Foto latar hero**: ganti latar hijau dengan foto; tepinya memudar (transparan) ke warna utama. Atur kejelasan foto, lebar pudar, lapisan warna, dan posisi fokus.
- **Media sosial**: Instagram, Facebook, YouTube, TikTok, X, Telegram, WhatsApp, website, plus tautan tambahan (`Nama|URL`). Tampil di footer dan (opsional) di hero.
- Disimpan di Firestore `settings/tampilan` (rules tidak perlu diubah).
- Menambah opsi baru: lihat komentar di atas `lib/tampilan.js` (default → skema field → pakai di `app/page.js`).

## Hemat kuota Firestore (Spark) & Cloudinary
- Isi `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` dan `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (unsigned preset) di Vercel → **Redeploy** (variabel `NEXT_PUBLIC_*` ikut dibangun saat build). Setelah itu semua foto baru (latar, galeri, berita, pengurus) masuk ke Cloudinary, bukan Firestore.
- Foto Cloudinary ditampilkan otomatis dalam ukuran/format ringan (`f_auto,q_auto,w_…`). Foto besar diperkecil dulu di HP sebelum diunggah.
- Data beranda di-cache 10 menit di browser pengunjung. Transaksi, berita, kegiatan, dan galeri baru dibaca saat bagiannya mendekati layar.
- Foto lama yang sudah tersimpan di Firestore tetap di sana sampai diunggah ulang. Foto latar juga bisa berupa URL atau file di folder `public/` (mis. `/latar.jpg`).
