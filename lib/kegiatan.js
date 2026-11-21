// Fungsi murni untuk kepanitiaan kegiatan, kas kegiatan, laporan pertanggungjawaban, dan ucapan terima kasih.
// Tanpa Firebase/React supaya mudah diuji.
export const num = (v) => Number(v) || 0;
export const rupiah = (n) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num(n))}`;
export const newId = () => Math.random().toString(36).slice(2, 10);

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
// '2026-11-20' → '20 November 2026'
export const tglPanjang = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : (s || '');
};
export const tglHariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const rentangTanggal = (a, b) => {
  if (!a) return '';
  if (!b || b === a) return tglPanjang(a);
  return `${tglPanjang(a)} s.d. ${tglPanjang(b)}`;
};

export const JENIS_KEGIATAN = [
  'Maulid Nabi Muhammad SAW', "Isra' Mi'raj", "Nuzulul Qur'an", 'Tahun Baru Islam (1 Muharram)', 'Ramadhan',
  'Idul Fitri', 'Idul Adha / Qurban', 'Haul', 'Pengajian Akbar', 'Lainnya',
];
export const STATUS_KEGIATAN = ['Persiapan', 'Berlangsung', 'Selesai'];
export const KATEGORI_KELUAR = [
  'Konsumsi', 'Perlengkapan & Dekorasi', 'Sound System & Panggung', 'Publikasi & Dokumentasi',
  'Honor & Transport Penceramah', 'Santunan & Bingkisan', 'Kebersihan & Keamanan', 'Sewa', 'Lain-lain',
];
export const JENIS_MASUK = ['Infaq', 'Shodaqoh', 'Sponsor', 'Iuran Panitia', 'Kas Yayasan', 'Lain-lain'];
export const JENIS_DONASI = ['Infaq', 'Shodaqoh', 'Infaq & Shodaqoh', 'Zakat', 'Wakaf', 'Donasi'];
export const DISPOSISI_SISA = ['Disetorkan ke kas yayasan', 'Disimpan untuk kegiatan berikutnya', 'Disalurkan untuk santunan', 'Dikembalikan kepada penyumbang'];

// Struktur bawaan: [seksi, jabatan]. Nama diisi admin; baris boleh ditambah/dihapus.
const BAWAAN = [
  ['Pelindung & Penasihat', 'Pelindung'], ['Pelindung & Penasihat', 'Penasihat'],
  ['Pengurus Inti', 'Ketua Panitia'], ['Pengurus Inti', 'Wakil Ketua'], ['Pengurus Inti', 'Sekretaris'], ['Pengurus Inti', 'Bendahara'],
  ['Seksi Acara', 'Koordinator'], ['Seksi Acara', 'Anggota'],
  ['Seksi Konsumsi', 'Koordinator'], ['Seksi Konsumsi', 'Anggota'],
  ['Seksi Perlengkapan & Dekorasi', 'Koordinator'], ['Seksi Perlengkapan & Dekorasi', 'Anggota'],
  ['Seksi Humas & Publikasi', 'Koordinator'], ['Seksi Dokumentasi', 'Koordinator'],
  ['Seksi Keamanan & Parkir', 'Koordinator'], ['Seksi Dana', 'Koordinator'],
];
export const strukturBaru = () => BAWAAN.map(([seksi, jabatan]) => ({ id: newId(), seksi, jabatan, nama: '' }));

// Kelompokkan baris per seksi menurut urutan kemunculan. soloTerisi = hanya yang sudah ada namanya.
export function kelompokSeksi(struktur = [], soloTerisi = false) {
  const peta = new Map();
  struktur.forEach((r) => {
    if (soloTerisi && !String(r.nama || '').trim()) return;
    const k = String(r.seksi || 'Lainnya').trim() || 'Lainnya';
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k).push(r);
  });
  return [...peta].map(([seksi, anggota]) => ({ seksi, anggota }));
}
export const namaJabatan = (struktur, re) => (struktur || []).find((r) => re.test(String(r.jabatan || '')) && String(r.nama || '').trim())?.nama?.trim() || '';

const tglUrut = (a, b) => String(a.tanggal || '9999').localeCompare(String(b.tanggal || '9999')) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
const jumlahDari = (list) => list.reduce((s, x) => s + num(x.jumlah), 0);

// Rekap kas satu kegiatan. rab = [{kategori, jumlah}]
export function hitung(kas = [], rab = []) {
  const urut = [...kas].sort(tglUrut);
  const masukRows = urut.filter((x) => x.tipe === 'masuk');
  const keluarRows = urut.filter((x) => x.tipe === 'keluar');
  const masuk = jumlahDari(masukRows);
  const keluar = jumlahDari(keluarRows);
  const rabMap = new Map();
  (rab || []).forEach((r) => { const k = String(r.kategori || '').trim(); if (k) rabMap.set(k, (rabMap.get(k) || 0) + num(r.jumlah)); });
  const urutan = [...KATEGORI_KELUAR];
  [...keluarRows.map((x) => x.kategori || 'Lain-lain'), ...rabMap.keys()].forEach((k) => { if (!urutan.includes(k)) urutan.push(k); });
  const perKategori = urutan.map((kategori) => {
    const rows = keluarRows.filter((x) => (x.kategori || 'Lain-lain') === kategori);
    const total = jumlahDari(rows);
    const anggaran = rabMap.get(kategori) || 0;
    return { kategori, rows, total, anggaran, selisih: anggaran - total };
  }).filter((x) => x.rows.length || x.anggaran);
  const jenisMasuk = [...new Set(masukRows.map((x) => x.jenis || 'Lain-lain'))].map((jenis) => {
    const rows = masukRows.filter((x) => (x.jenis || 'Lain-lain') === jenis);
    return { jenis, total: jumlahDari(rows), n: rows.length };
  });
  const rabTotal = [...rabMap.values()].reduce((a, b) => a + b, 0);
  return { masuk, keluar, saldo: masuk - keluar, masukRows, keluarRows, perKategori, jenisMasuk, rabTotal };
}

// ---------- Terbilang (untuk kwitansi / ucapan) ----------
const SAT = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function tb(n) {
  if (n < 12) return SAT[n];
  if (n < 20) return `${tb(n - 10)} belas`;
  if (n < 100) return `${tb(Math.floor(n / 10))} puluh${n % 10 ? ` ${tb(n % 10)}` : ''}`;
  if (n < 200) return `seratus${n - 100 ? ` ${tb(n - 100)}` : ''}`;
  if (n < 1000) return `${tb(Math.floor(n / 100))} ratus${n % 100 ? ` ${tb(n % 100)}` : ''}`;
  if (n < 2000) return `seribu${n - 1000 ? ` ${tb(n - 1000)}` : ''}`;
  const unit = [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1e3, 'ribu']];
  for (const [b, nm] of unit) {
    if (n >= b) { const q = Math.floor(n / b); const r = n % b; return `${tb(q)} ${nm}${r ? ` ${tb(r)}` : ''}`; }
  }
  return '';
}
export const terbilang = (n) => {
  const x = Math.floor(num(n));
  if (x <= 0) return 'Nol rupiah';
  const t = tb(x);
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} rupiah`;
};

// Frasa tujuan di ucapan: kegiatan bila ada, kalau sumbangan umum → program yayasan secara keseluruhan.
export const tujuanUcapan = (tujuan = '', yayasan = '') => (tujuan ? ` untuk ${tujuan}` : ` untuk mendukung program dan kegiatan ${yayasan || 'yayasan'}`);

// ---------- Teks untuk WhatsApp ----------
export function teksTerimaKasih({ nama, jenis = 'Infaq', jumlah, tanggal, tujuan = '', pesan = '', yayasan = '', statusHukum = '', telepon = '', ttd = '', gaya = 'lengkap' }) {
  const j = String(jenis || 'infaq').toLowerCase();
  const untuk = tujuanUcapan(tujuan, yayasan);
  const penutup = [`Hormat kami,`, `*${yayasan}*`, statusHukum, ttd, telepon].filter(Boolean).join('\n');
  if (gaya === 'singkat') {
    return [
      `Assalamu'alaikum Wr. Wb.`,
      `Yth. Bapak/Ibu *${nama}*,`,
      `Jazakumullahu khairan katsiran atas ${j} sebesar *${rupiah(jumlah)}*${untuk} (${tglPanjang(tanggal)}). Semoga Allah SWT menerima amal Bapak/Ibu dan membalasnya dengan pahala berlipat ganda. Aamiin.`,
      pesan,
      penutup,
    ].filter(Boolean).join('\n\n');
  }
  return [
    `Assalamu'alaikum Wr. Wb.`,
    `Yth. Bapak/Ibu *${nama}*`,
    `Jazakumullahu khairan katsiran. Kami mengucapkan terima kasih atas ${j} Bapak/Ibu sebesar *${rupiah(jumlah)}* yang kami terima pada ${tglPanjang(tanggal)}${untuk}.`,
    `Semoga Allah SWT menerima amal kebaikan Bapak/Ibu, membalasnya dengan pahala yang berlipat ganda, melapangkan rezeki, serta memberkahi keluarga Bapak/Ibu. Aamiin.`,
    pesan,
    `Wassalamu'alaikum Wr. Wb.`,
    penutup,
  ].filter(Boolean).join('\n\n');
}

export function teksStruktur({ k, yayasan = '', statusHukum = '' }) {
  const out = [`*SUSUNAN PANITIA*`, `*${String(k.nama || '').toUpperCase()}*`, yayasan];
  if (statusHukum) out.push(statusHukum);
  const info = [rentangTanggal(k.tanggal, k.tanggalSelesai), k.lokasi].filter(Boolean).join(' · ');
  if (info) out.push(info);
  kelompokSeksi(k.struktur, true).forEach((g) => {
    out.push('', `*${g.seksi}*`);
    g.anggota.forEach((r) => out.push(`• ${r.jabatan}: ${r.nama}`));
  });
  return out.join('\n');
}

export function teksLPJ({ k, h, yayasan = '', statusHukum = '', link = '' }) {
  const out = [`*LAPORAN KEUANGAN*`, `*${String(k.nama || '').toUpperCase()}*`, yayasan];
  if (statusHukum) out.push(statusHukum);
  const info = [rentangTanggal(k.tanggal, k.tanggalSelesai), k.lokasi].filter(Boolean).join(' · ');
  if (info) out.push(info);
  out.push('', `Pemasukan: *${rupiah(h.masuk)}*`, `Pengeluaran: *${rupiah(h.keluar)}*`, `Sisa dana: *${rupiah(h.saldo)}*`);
  if (h.jenisMasuk.length) {
    out.push('', '*Pemasukan*');
    h.jenisMasuk.forEach((x) => out.push(`• ${x.jenis}: ${rupiah(x.total)}${x.n > 1 ? ` (${x.n}x)` : ''}`));
  }
  const kel = h.perKategori.filter((x) => x.rows.length);
  if (kel.length) {
    out.push('', '*Pengeluaran*');
    kel.forEach((x) => out.push(`• ${x.kategori}: ${rupiah(x.total)}`));
  }
  if (h.saldo !== 0 && k.sisaDisposisi) out.push('', `Sisa dana: ${k.sisaDisposisi}.`);
  if (link) out.push('', `Rincian lengkap (nota & daftar belanja):`, link);
  out.push('', `Jazakumullahu khairan atas dukungan Bapak/Ibu sekalian. 🙏`);
  return out.join('\n');
}

// Nomor WhatsApp → format internasional tanpa tanda + (mis. 081234 → 6281234)
export function normHp(hp) {
  let d = String(hp || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (d.startsWith('8')) d = `62${d}`;
  return d;
}
