// Kegiatan rutin (berulang): harian, mingguan, 2 pekanan, bulanan, tahunan.
// Disimpan sebagai SATU aturan per dokumen di koleksi `routine_events` (bukan satu dokumen per kemunculan),
// lalu tanggal kemunculan dihitung di browser. Fungsi di sini murni (tanpa Firebase) sehingga mudah diuji.
//
// Skema dokumen:
//   judul, lokasi, deskripsi, lembaga, jamMulai, jamSelesai, aktif ('Ya' | 'Tidak')
//   frekuensi : 'harian' | 'mingguan' | 'dua_pekan' | 'bulanan_tanggal' | 'bulanan_pekan' | 'tahunan'
//   mulai     : 'YYYY-MM-DD' tanggal mulai berlaku (juga patokan untuk 'dua_pekan')
//   sampai    : 'YYYY-MM-DD' opsional, batas akhir
//   hari      : [0..6] (0 = Minggu) untuk 'mingguan'
//   pekanKe   : 1..4 atau 5 (= terakhir) dan hariPekan : 0..6 untuk 'bulanan_pekan'
//   tanggal   : 1..31 untuk 'bulanan_tanggal' & 'tahunan' (tanggal 31 / 29-30 Feb dipakai "hari terakhir bulan")
//   bulan     : 1..12 untuk 'tahunan'
//   Hijriah   : 'hijriah_bulanan' (tanggalDaftar: "13,14,15") dan 'hijriah_tahunan' (tanggal + bulanH 1..12)
//   geserHijri: '0' | '-1' | '1' koreksi hari Hijriah (Umm al-Qura; Kemenag RI sering 1 hari lebih lambat = '-1')
//   pengecualian : teks, dipisah koma/baris. Tiap butir 'YYYY-MM-DD' atau rentang 'YYYY-MM-DD..YYYY-MM-DD'
//   liburRamadan : 'Ya' | 'Tidak' → ditiadakan sepanjang bulan Ramadan

export const HARI_NAMA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const BULAN_NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const FREKUENSI = [
  { value: 'harian', label: 'Setiap hari' },
  { value: 'mingguan', label: 'Setiap pekan (pilih hari)' },
  { value: 'dua_pekan', label: 'Dua pekan sekali' },
  { value: 'bulanan_tanggal', label: 'Setiap bulan (tanggal tertentu)' },
  { value: 'bulanan_pekan', label: 'Setiap bulan (pekan & hari tertentu)' },
  { value: 'tahunan', label: 'Setiap tahun (kalender Masehi)' },
  { value: 'hijriah_bulanan', label: 'Setiap bulan Hijriah (tanggal Hijriah tertentu)' },
  { value: 'hijriah_tahunan', label: 'Setiap tahun Hijriah (mis. 10 Muharram)' },
];
export const KELOMPOK = [
  { id: 'harian', label: 'Harian', anggota: ['harian'] },
  { id: 'pekanan', label: 'Pekanan', anggota: ['mingguan', 'dua_pekan'] },
  { id: 'bulanan', label: 'Bulanan', anggota: ['bulanan_tanggal', 'bulanan_pekan'] },
  { id: 'tahunan', label: 'Tahunan', anggota: ['tahunan'] },
  { id: 'hijriah', label: 'Hijriah', anggota: ['hijriah_bulanan', 'hijriah_tahunan'] },
];
export const BULAN_HIJRI = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Syaban', 'Ramadan', 'Syawal', 'Zulkaidah', 'Zulhijah'];
export const RAMADAN = 9;

const pad = (n) => String(n).padStart(2, '0');
export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseTgl = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const y = +m[1]; const mo = +m[2]; const d = +m[3];
  const dt = new Date(y, mo - 1, d, 12); // jam 12 menghindari geser tanggal karena zona waktu
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
};
const hariKe = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
const hariDalamBulan = (y, m) => new Date(y, m, 0).getDate(); // m = 1..12
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

// ---- Kalender Hijriah (Intl, Umm al-Qura) ----
let hijriFmt;
const hijriCache = new Map();
// Kembalikan { d, m, y, akhir } (akhir = hari terakhir bulan Hijriah) atau null bila browser tak mendukung.
export function hijri(d, geser = 0) {
  const g = Number(geser) || 0;
  const k = `${toStr(d)}|${g}`;
  if (hijriCache.has(k)) return hijriCache.get(k);
  let out = null;
  try {
    if (!hijriFmt) hijriFmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const baca = (x) => {
      const o = {};
      hijriFmt.formatToParts(x).forEach((p) => { if (p.type !== 'literal') o[p.type] = Number(p.value); });
      return o;
    };
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate() + g, 12);
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate() + g + 1, 12);
    const x = baca(a); const y = baca(b);
    if (x.day && x.month && x.year) out = { d: x.day, m: x.month, y: x.year, akhir: y.month !== x.month };
  } catch (e) { out = null; }
  hijriCache.set(k, out);
  return out;
}
export const tglHijriTeks = (str, geser = 0) => {
  const d = parseTgl(str); const h = d && hijri(d, geser);
  return h ? `${h.d} ${BULAN_HIJRI[h.m - 1]} ${h.y} H` : '';
};
const daftarAngka = (v) => [...new Set(String(v ?? '').split(/[\s,;]+/).filter(Boolean).map(Number))].filter((x) => Number.isInteger(x));

// ---- Pengecualian: "2026-12-25, 2026-12-28..2027-01-02" ----
export function bacaPengecualian(teks) {
  const rentang = []; const salah = [];
  String(teks || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).forEach((t) => {
    const m = /^(\d{4}-\d{2}-\d{2})(?:\s*(?:\.\.|s\/d|-->|–)\s*(\d{4}-\d{2}-\d{2}))?$/.exec(t);
    const a = m && parseTgl(m[1]); const b = m && (m[2] ? parseTgl(m[2]) : a);
    if (!a || !b || b < a) salah.push(t); else rentang.push([toStr(a), toStr(b)]);
  });
  return { rentang, salah };
}
const dikecualikan = (r, d) => {
  const s = toStr(d);
  if (r.pengecualian && bacaPengecualian(r.pengecualian).rentang.some(([a, b]) => s >= a && s <= b)) return true;
  if (r.liburRamadan === 'Ya') { const h = hijri(d, r.geserHijri); if (h && h.m === RAMADAN) return true; }
  return false;
};

// Apakah tanggal `d` (Date) adalah kemunculan aturan `r`?
export function cocok(r, d) {
  const mulai = parseTgl(r.mulai);
  if (!mulai || d < mulai) return false;
  const sampai = parseTgl(r.sampai);
  if (sampai && d > sampai) return false;
  if (dikecualikan(r, d)) return false;
  const dow = d.getDay();
  const tgl = d.getDate();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const akhir = hariDalamBulan(y, m);
  switch (r.frekuensi) {
    case 'harian': return true;
    case 'mingguan': return (Array.isArray(r.hari) ? r.hari : []).map(Number).includes(dow);
    case 'dua_pekan': return (hariKe(d) - hariKe(mulai)) % 14 === 0;
    case 'bulanan_tanggal': { const t = num(r.tanggal); return t >= 1 && tgl === Math.min(t, akhir); }
    case 'bulanan_pekan': {
      if (dow !== num(r.hariPekan)) return false;
      const n = num(r.pekanKe);
      return n === 5 ? tgl + 7 > akhir : Math.ceil(tgl / 7) === n;
    }
    case 'tahunan': { const t = num(r.tanggal); return m === num(r.bulan) && t >= 1 && tgl === Math.min(t, akhir); }
    case 'hijriah_bulanan': {
      const h = hijri(d, r.geserHijri);
      return !!h && daftarAngka(r.tanggalDaftar).some((t) => t >= 1 && (h.d === t || (h.akhir && t > h.d)));
    }
    case 'hijriah_tahunan': {
      const h = hijri(d, r.geserHijri); const t = num(r.tanggal);
      return !!h && h.m === num(r.bulanH) && t >= 1 && (h.d === t || (h.akhir && t > h.d));
    }
    default: return false;
  }
}

// Kemunculan pertama pada/setelah `dariStr` ('YYYY-MM-DD'); null bila sudah berakhir / tidak valid.
export function berikutnya(r, dariStr) {
  const mulai = parseTgl(r.mulai);
  let d = parseTgl(dariStr);
  if (!d || !mulai) return null;
  if (d < mulai) d = new Date(mulai);
  for (let i = 0; i < 1500; i += 1) { // 1500 hari > 4 tahun (cukup untuk 29 Februari)
    if (cocok(r, d)) return toStr(d);
    const sampai = parseTgl(r.sampai);
    if (sampai && d > sampai) return null;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
  }
  return null;
}

// Semua kemunculan antara dua tanggal (inklusif), maks `batas` buah.
export function antara(r, dariStr, sampaiStr, batas = 400) {
  const out = [];
  let d = parseTgl(dariStr);
  const akhir = parseTgl(sampaiStr);
  if (!d || !akhir) return out;
  while (d <= akhir && out.length < batas) {
    if (cocok(r, d)) out.push(toStr(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
  }
  return out;
}

const gabung = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} & ${a[a.length - 1]}`);

// Kalimat pola, mis. "Setiap Senin & Kamis", "Setiap Jumat pekan ke-1", "Setiap tahun, 17 Agustus"
export function polaTeks(r) {
  switch (r.frekuensi) {
    case 'harian': return 'Setiap hari';
    case 'mingguan': {
      const h = [...new Set((Array.isArray(r.hari) ? r.hari : []).map(Number))].filter((x) => x >= 0 && x <= 6).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Senin dulu
      if (!h.length) return 'Setiap pekan';
      return h.length === 7 ? 'Setiap hari' : `Setiap ${gabung(h.map((x) => HARI_NAMA[x]))}`;
    }
    case 'dua_pekan': { const m = parseTgl(r.mulai); return m ? `Dua pekan sekali (${HARI_NAMA[m.getDay()]})` : 'Dua pekan sekali'; }
    case 'bulanan_tanggal': { const t = num(r.tanggal); return t >= 29 ? `Setiap akhir bulan (tgl ${t})` : `Setiap tanggal ${t || '?'}`; }
    case 'bulanan_pekan': {
      const n = num(r.pekanKe);
      return `Setiap ${HARI_NAMA[num(r.hariPekan)] || '?'} ${n === 5 ? 'pekan terakhir' : `pekan ke-${n || '?'}`} tiap bulan`;
    }
    case 'tahunan': return `Setiap tahun, ${num(r.tanggal) || '?'} ${BULAN_NAMA[num(r.bulan) - 1] || '?'}`;
    case 'hijriah_bulanan': {
      const t = daftarAngka(r.tanggalDaftar).filter((x) => x >= 1 && x <= 30).sort((a, b) => a - b);
      return t.length ? `Setiap tanggal ${gabung(t.map(String))} Hijriah` : 'Setiap bulan Hijriah';
    }
    case 'hijriah_tahunan': return `Setiap tahun, ${num(r.tanggal) || '?'} ${BULAN_HIJRI[num(r.bulanH) - 1] || '?'} (Hijriah)`;
    default: return '-';
  }
}

// Ringkasan pengecualian untuk ditampilkan ("Ditiadakan selama Ramadan; 3 tanggal libur")
export function pengecualianTeks(r) {
  const n = bacaPengecualian(r.pengecualian).rentang.length;
  return [r.liburRamadan === 'Ya' && 'Ditiadakan selama Ramadan', n > 0 && `${n} pengecualian tanggal`].filter(Boolean).join(' · ');
}
// Kemunculan berikutnya TANPA memperhitungkan pengecualian (untuk info "pekan ini ditiadakan")
export const berikutnyaTanpaLibur = (r, dari) => berikutnya({ ...r, pengecualian: '', liburRamadan: 'Tidak' }, dari);

// Pesan galat bila aturan belum lengkap (dipakai form admin); string kosong = valid.
export function validasiRutin(f) {
  if (f.sampai && f.mulai && f.sampai < f.mulai) return 'Tanggal berakhir tidak boleh sebelum tanggal mulai';
  if (f.jamMulai && f.jamSelesai && f.jamSelesai < f.jamMulai) return 'Jam selesai tidak boleh sebelum jam mulai';
  if (f.frekuensi === 'mingguan' && !(Array.isArray(f.hari) && f.hari.length)) return 'Pilih minimal satu hari';
  if (['bulanan_tanggal', 'tahunan'].includes(f.frekuensi)) {
    const t = num(f.tanggal);
    if (!(t >= 1 && t <= 31)) return 'Tanggal harus antara 1 dan 31';
  }
  if (f.frekuensi === 'tahunan') {
    const t = num(f.tanggal); const b = num(f.bulan);
    if (!(b >= 1 && b <= 12)) return 'Pilih bulan';
    if (t > hariDalamBulan(2024, b)) return `${BULAN_NAMA[b - 1]} tidak punya tanggal ${t}`;
  }
  if (f.frekuensi === 'hijriah_bulanan') {
    const t = daftarAngka(f.tanggalDaftar);
    if (!t.length || t.some((x) => x < 1 || x > 30)) return 'Isi tanggal Hijriah 1–30, pisahkan dengan koma (mis. 13,14,15)';
  }
  if (f.frekuensi === 'hijriah_tahunan') {
    const t = num(f.tanggal); const b = num(f.bulanH);
    if (!(t >= 1 && t <= 30)) return 'Tanggal Hijriah harus antara 1 dan 30';
    if (!(b >= 1 && b <= 12)) return 'Pilih bulan Hijriah';
  }
  if (f.pengecualian) {
    const { salah } = bacaPengecualian(f.pengecualian);
    if (salah.length) return `Format pengecualian salah: "${salah[0]}". Pakai YYYY-MM-DD atau rentang YYYY-MM-DD..YYYY-MM-DD`;
  }
  return '';
}
