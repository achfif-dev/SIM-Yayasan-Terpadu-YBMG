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

## Riwayat perubahan kas (audit)
- Setiap transaksi yang ditambah/diubah/dihapus dicatat di koleksi `audit_log` (siapa, kapan, nilai sebelum & sesudah). Log hanya bisa dibaca admin dan **tidak bisa diubah atau dihapus** (lihat `firestore.rules`). Lihat di **Admin → Kas → Lihat riwayat perubahan kas**.
- Dokumen yang disimpan lewat admin kini juga membawa `createdBy`, `updatedAt`, `updatedBy`.
- Bukti nota yang diunggah tetapi tidak jadi disimpan (diganti, dibatalkan, atau pindah tab) otomatis dihapus dari `receipts`.

## Berita, galeri & urutan lembaga
- Berita dan galeri memuat data terbaru dulu (12 item). Bila filter lembaga tidak menemukan apa pun di data itu, tombol **Muat ... lebih lama** mengambil halaman berikutnya (tanpa indeks tambahan).
- Lembaga kini punya **Nomor Urut Tampil** (kosong = 0, lalu urut nama).
- Cache browser melewati data > ±2 juta karakter agar tidak gagal diam-diam; aktifkan Cloudinary bila galeri besar.

## Mengamankan preset Cloudinary (unsigned)
Nama cloud dan preset berada di `NEXT_PUBLIC_*`, jadi siapa pun bisa mengunggah memakai preset itu. Di Cloudinary → Settings → Upload → preset, batasi: folder tetap, format yang diizinkan (jpg/png/webp), ukuran file maksimum, dan aktifkan moderasi/quota. Jangan memakai preset itu untuk hal lain.

## Berita & kegiatan
- **Admin → Berita / Kegiatan / Galeri**: kelola pengumuman (koleksi `announcements`), jadwal kegiatan (`events`), dan foto galeri (`gallery`). Setiap item bisa dikaitkan ke satu lembaga (dipilih dari daftar Lembaga) atau dikosongkan untuk "Umum".
- **Beranda**: bagian *Berita & Kegiatan* (pengumuman, dengan opsi sematkan "Penting", plus jadwal kegiatan mendatang dan arsip yang sudah lewat) dan *Galeri Kegiatan* (grid foto dengan lightbox). Satu filter lembaga berlaku untuk keduanya.
- Beranda hanya memuat 12 pengumuman terbaru, kegiatan mulai 30 hari terakhir, dan 24 foto terbaru. Tanpa Cloudinary foto disimpan di Firestore (±800–900 px); untuk galeri yang besar sebaiknya aktifkan Cloudinary.
- Rules Firestore tidak perlu diubah (baca publik, tulis hanya admin).

## Kegiatan rutin (berulang)
- **Admin → Rutin**: catat kegiatan yang berulang **sekali saja** sebagai aturan (koleksi `routine_events`), bukan satu dokumen per tanggal. Pilihan pengulangan: setiap hari, setiap pekan (boleh beberapa hari, mis. Senin & Kamis), dua pekan sekali, bulanan menurut tanggal (mis. tanggal 1; tanggal 31 = akhir bulan), bulanan menurut pekan & hari (mis. Jumat pekan ke-1 / pekan terakhir), dan tahunan (tanggal + bulan, mis. 17 Agustus).
- **Kalender Hijriah**: *Setiap bulan Hijriah* (satu atau beberapa tanggal, mis. `13,14,15` untuk puasa Ayyamul Bidh) dan *Setiap tahun Hijriah* (mis. 10 Muharram). Tanggal 30 dipakai sebagai hari terakhir bila bulannya hanya 29 hari. Perhitungan memakai kalender Umm al-Qura bawaan browser; karena penetapan Kemenag RI bisa berbeda sehari, ada pilihan **Koreksi kalender Hijriah** (sehari lebih lambat/cepat) per kegiatan. Tanggal Hijriah ikut tampil di kartu beranda.
- **Pengecualian**: kolom *Tanggal ditiadakan* menerima tanggal tunggal dan rentang, dipisah koma/baris (`2026-12-25, 2026-12-28..2027-01-02`), dan sakelar **Ditiadakan selama bulan Ramadan**. Tanggal itu dilewati, dan beranda memberi catatan "Ditiadakan pada …" bila jadwal terdekat sedang libur.
- Opsi: tanggal mulai/berakhir, jam, lokasi, lembaga, dan sakelar **Tampilkan di beranda** (nonaktifkan tanpa menghapus).
- **Beranda → Berita & Kegiatan**: di bawah *Jadwal Kegiatan* muncul blok **Kegiatan Rutin** (dikelompokkan Harian/Pekanan/Bulanan/Tahunan) lengkap dengan pola ("Setiap Jumat pekan ke-1") dan tanggal berikutnya yang dihitung otomatis. Filter lembaga berlaku juga untuk blok ini.
- Logika perhitungan ada di `lib/rutin.js` (fungsi murni, tanpa Firebase).
- **Wajib**: tempel ulang `firestore.rules` ke Firestore → Rules → Publish (ada aturan baru untuk `routine_events`); tanpa ini simpan/baca kegiatan rutin akan ditolak.

## Kalender & WhatsApp
- Tiap kegiatan (sekali jalan maupun rutin) di beranda punya tombol **Google Kalender**, **.ics** (Apple/Outlook/kalender HP) dan **WhatsApp**. Kegiatan rutin sederhana (harian, pekanan, 2 pekan, bulanan, tahunan Masehi) masuk kalender sebagai **acara berulang** (RRULE); yang tidak bisa dinyatakan RRULE (Hijriah, ada pengecualian/libur Ramadan, tanggal 29–30, 29 Februari) diurai menjadi tanggal-tanggal nyata untuk 12 bulan ke depan.
- **Bagikan jadwal 7 hari ke WhatsApp** (di atas daftar Jadwal Kegiatan) membuat teks rapi berisi kegiatan sekali jalan + kemunculan kegiatan rutin pekan ini; **Semua ke kalender (.ics)** mengunduh seluruh kegiatan rutin sekaligus.
- Zona waktu tetap WIB (Asia/Jakarta). Logika ada di `lib/kalender.js`.

## Daftar admin dikelola dari panel
- **Pemilik** = email di `NEXT_PUBLIC_ADMIN_EMAILS` dan di fungsi `isOwner()` pada `firestore.rules` (hanya dua tempat ini, diisi sekali). Pemilik selalu bisa masuk, jadi tidak bisa terkunci.
- **Admin tambahan**: Admin → tab **Admin** (hanya tampil untuk pemilik) → masukkan email. Disimpan di koleksi `admins` (ID = email huruf kecil). Tanpa ubah `.env`/rules/deploy. Admin tambahan punya akses seperti pemilik, kecuali kelola admin. Syarat: punya akun Firebase Authentication dan emailnya terverifikasi.
- **Wajib tempel ulang `firestore.rules`** (ada fungsi `isOwner()`, `isAdmin()` baru, dan aturan koleksi `admins`).

## Cadangan & pemulihan (Admin → Cadangan)
- **Unduh cadangan (.json)** untuk koleksi yang dipilih (pengaturan, lembaga, pengurus, berita, kegiatan, rutin, galeri, kas, bukti nota, riwayat kas; daftar admin khusus pemilik). Tanggal Firestore disimpan sebagai ISO dan dipulihkan lagi sebagai Timestamp. Muncul peringatan bila belum pernah/lebih dari 30 hari sejak cadangan terakhir dari perangkat itu.
- **Pulihkan**: pilih berkas → tampil ringkasan jumlah per koleksi → ketik `PULIHKAN`. Dokumen ber-ID sama ditimpa, dokumen lain tidak dihapus; `audit_log` dan `admins` tidak dipulihkan. Pemulihan dicatat di Riwayat Kas.
- Setiap dokumen yang dibaca = 1 pembacaan Firestore (gratis 50.000/hari). Logika di `lib/cadangan.js`.

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
