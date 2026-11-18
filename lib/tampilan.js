// ============================================================================
// PUSAT KONFIGURASI TAMPILAN
// Semua pengaturan tampilan situs ada di file ini. Disimpan di Firestore:
// settings/tampilan (dibaca publik, ditulis admin).
//
// CARA MENAMBAH OPSI BARU DI MASA DEPAN:
//   1. Tambahkan nilai bawaan di DEFAULT_TAMPILAN.
//   2. Tambahkan 1 baris field di TAMPILAN_GROUPS (otomatis muncul di Admin → Tampilan).
//   3. Pakai nilainya di app/page.js (atau ubah buildThemeVars() bila berupa CSS variable).
// ============================================================================

export const THEME_CACHE_KEY = 'ybmg_theme_v1';

// ---------- Font (Google Fonts) ----------
export const FONTS = {
  sistem: { label: 'Bawaan sistem', family: '', weights: '' },
  inter: { label: 'Inter', family: 'Inter', weights: '400;500;600;700;800' },
  poppins: { label: 'Poppins', family: 'Poppins', weights: '400;500;600;700;800' },
  nunito: { label: 'Nunito', family: 'Nunito', weights: '400;500;600;700;800' },
  jakarta: { label: 'Plus Jakarta Sans', family: 'Plus Jakarta Sans', weights: '400;500;600;700;800' },
  montserrat: { label: 'Montserrat', family: 'Montserrat', weights: '400;500;600;700;800' },
  roboto: { label: 'Roboto', family: 'Roboto', weights: '400;500;700' },
  lora: { label: 'Lora (serif)', family: 'Lora', weights: '400;500;600;700' },
  merriweather: { label: 'Merriweather (serif)', family: 'Merriweather', weights: '400;700' },
  playfair: { label: 'Playfair Display (serif)', family: 'Playfair Display', weights: '400;500;600;700' },
  cairo: { label: 'Cairo (Latin + Arab)', family: 'Cairo', weights: '400;600;700' },
  amiri: { label: 'Amiri (Latin + Arab)', family: 'Amiri', weights: '400;700' },
};
const FONT_OPTIONS = Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label }));
const SYSTEM_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// ---------- Nilai bawaan ----------
export const DEFAULT_TAMPILAN = {
  // Warna
  warnaUtama: '#047857',
  warnaLatar: '#f8fafc',
  // Font
  fontJudul: 'sistem',
  fontIsi: 'sistem',
  ukuranFont: '16',
  // Layout
  lebarKonten: 'normal',
  gayaKartu: 'bulat',
  // Hero / latar belakang
  heroFoto: '',
  heroFotoOpasitas: '60',
  heroFadeTepi: '25',
  heroPosisiFoto: 'center',
  heroOverlay: '35',
  heroTinggi: 'sedang',
  heroRata: 'tengah',
  heroTampilLogo: 'Ya',
  heroTombol1Teks: 'Lihat Lembaga',
  heroTombol2Teks: 'Transparansi Kas',
  // Bagian yang ditampilkan di beranda
  tampilProfil: 'Ya',
  tampilLembaga: 'Ya',
  tampilBerita: 'Ya',
  tampilGaleri: 'Ya',
  tampilPengurus: 'Ya',
  tampilKeuangan: 'Ya',
  // Media sosial (boleh isi URL lengkap atau cukup username)
  sosialInstagram: '',
  sosialFacebook: '',
  sosialYoutube: '',
  sosialTiktok: '',
  sosialX: '',
  sosialTelegram: '',
  sosialWhatsapp: '',
  sosialWebsite: '',
  sosialLainnya: '',
  sosialDiHero: 'Ya',
  // Footer
  footerTeks: '',
};

const YA_TIDAK = ['Ya', 'Tidak'];

// ---------- Skema form admin (dikelompokkan) ----------
// type: color | select | range | image | textarea | text (default)
export const TAMPILAN_GROUPS = [
  {
    id: 'warna', title: 'Warna',
    fields: [
      { name: 'warnaUtama', label: 'Warna utama (tombol, header, footer, latar hero)', type: 'color' },
      { name: 'warnaLatar', label: 'Warna latar halaman', type: 'color' },
    ],
  },
  {
    id: 'font', title: 'Font & ukuran teks',
    fields: [
      { name: 'fontJudul', label: 'Font judul', type: 'select', options: FONT_OPTIONS },
      { name: 'fontIsi', label: 'Font isi', type: 'select', options: FONT_OPTIONS },
      { name: 'ukuranFont', label: 'Ukuran teks dasar', type: 'select', options: [
        { value: '15', label: 'Kecil (15px)' }, { value: '16', label: 'Normal (16px)' },
        { value: '17', label: 'Agak besar (17px)' }, { value: '18', label: 'Besar (18px)' },
      ] },
    ],
  },
  {
    id: 'layout', title: 'Tata letak',
    fields: [
      { name: 'lebarKonten', label: 'Lebar konten beranda', type: 'select', options: [
        { value: 'sempit', label: 'Sempit' }, { value: 'normal', label: 'Normal' }, { value: 'lebar', label: 'Lebar' },
      ] },
      { name: 'gayaKartu', label: 'Sudut kartu', type: 'select', options: [
        { value: 'tajam', label: 'Tajam' }, { value: 'sedang', label: 'Sedikit melengkung' },
        { value: 'bulat', label: 'Melengkung (bawaan)' }, { value: 'sangat-bulat', label: 'Sangat melengkung' },
      ] },
      { name: 'tampilProfil', label: 'Tampilkan bagian Profil', type: 'select', options: YA_TIDAK },
      { name: 'tampilLembaga', label: 'Tampilkan bagian Lembaga', type: 'select', options: YA_TIDAK },
      { name: 'tampilBerita', label: 'Tampilkan bagian Berita & Kegiatan', type: 'select', options: YA_TIDAK },
      { name: 'tampilGaleri', label: 'Tampilkan bagian Galeri', type: 'select', options: YA_TIDAK },
      { name: 'tampilPengurus', label: 'Tampilkan bagian Pengurus', type: 'select', options: YA_TIDAK },
      { name: 'tampilKeuangan', label: 'Tampilkan bagian Keuangan', type: 'select', options: YA_TIDAK },
    ],
  },
  {
    id: 'hero', title: 'Latar belakang beranda (hero)',
    fields: [
      { name: 'heroFoto', label: 'Foto latar (kosongkan = hanya warna utama)', type: 'image', folder: 'latar', maxSize: 1400, quality: 0.62, clearable: true },
      { name: 'heroFotoOpasitas', label: 'Kejelasan foto (%)', type: 'range', min: 10, max: 100, step: 5 },
      { name: 'heroFadeTepi', label: 'Lebar pudar di tepi foto (%) — 0 = tanpa pudar', type: 'range', min: 0, max: 50, step: 5 },
      { name: 'heroOverlay', label: 'Lapisan warna di atas foto (%) — agar teks tetap terbaca', type: 'range', min: 0, max: 90, step: 5 },
      { name: 'heroPosisiFoto', label: 'Posisi fokus foto', type: 'select', options: [
        { value: 'center', label: 'Tengah' }, { value: 'top', label: 'Atas' }, { value: 'bottom', label: 'Bawah' },
        { value: 'left', label: 'Kiri' }, { value: 'right', label: 'Kanan' },
      ] },
      { name: 'heroTinggi', label: 'Tinggi hero', type: 'select', options: [
        { value: 'kecil', label: 'Kecil' }, { value: 'sedang', label: 'Sedang' }, { value: 'besar', label: 'Besar' },
      ] },
      { name: 'heroRata', label: 'Perataan teks hero', type: 'select', options: [
        { value: 'tengah', label: 'Tengah' }, { value: 'kiri', label: 'Kiri' },
      ] },
      { name: 'heroTampilLogo', label: 'Tampilkan logo besar di hero', type: 'select', options: YA_TIDAK },
      { name: 'heroTombol1Teks', label: 'Teks tombol 1 (kosongkan = sembunyikan)' },
      { name: 'heroTombol2Teks', label: 'Teks tombol 2 (kosongkan = sembunyikan)' },
    ],
  },
  {
    id: 'sosial', title: 'Akun media sosial',
    fields: [
      { name: 'sosialInstagram', label: 'Instagram (username atau URL)' },
      { name: 'sosialFacebook', label: 'Facebook (username/URL)' },
      { name: 'sosialYoutube', label: 'YouTube (URL channel)' },
      { name: 'sosialTiktok', label: 'TikTok (username atau URL)' },
      { name: 'sosialX', label: 'X / Twitter (username atau URL)' },
      { name: 'sosialTelegram', label: 'Telegram (username atau URL)' },
      { name: 'sosialWhatsapp', label: 'WhatsApp (nomor, mis. 08123456789)' },
      { name: 'sosialWebsite', label: 'Website lain (URL)' },
      { name: 'sosialLainnya', label: 'Tautan tambahan — satu per baris, format: Nama|URL', type: 'textarea', rows: 3 },
      { name: 'sosialDiHero', label: 'Tampilkan ikon sosial juga di hero', type: 'select', options: YA_TIDAK },
    ],
  },
  {
    id: 'footer', title: 'Footer',
    fields: [
      { name: 'footerTeks', label: 'Teks tambahan footer (opsional)', type: 'textarea', rows: 2 },
    ],
  },
];

export const mergeTampilan = (data) => ({ ...DEFAULT_TAMPILAN, ...(data || {}) });
export const isYa = (v) => v !== 'Tidak';

// ---------- Warna ----------
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const h = m ? m[1] : '047857';
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const mix = (rgb, target, t) => rgb.map((c, i) => clamp(c + (target[i] - c) * t));
const chan = (rgb) => rgb.join(' ');

// Turunkan palet brand (50..900) dari satu warna utama (= level 700)
export function brandPalette(hex) {
  const base = hexToRgb(hex);
  const W = [255, 255, 255];
  const K = [0, 0, 0];
  return {
    50: mix(base, W, 0.92),
    100: mix(base, W, 0.82),
    600: mix(base, W, 0.14),
    700: base,
    800: mix(base, K, 0.22),
    900: mix(base, K, 0.42),
  };
}

const CONTENT_MAX = { sempit: '64rem', normal: '72rem', lebar: '80rem' };
const RADIUS = { tajam: '0.25rem', sedang: '0.75rem', bulat: '1rem', 'sangat-bulat': '1.75rem' };

export function fontHref(cfg) {
  const keys = [...new Set([cfg.fontJudul, cfg.fontIsi])].filter((k) => FONTS[k]?.family);
  if (!keys.length) return '';
  const fam = keys.map((k) => `family=${FONTS[k].family.replace(/ /g, '+')}:wght@${FONTS[k].weights}`).join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

const fontStack = (key) => (FONTS[key]?.family ? `"${FONTS[key].family}", ${SYSTEM_STACK}` : SYSTEM_STACK);

export function buildThemeVars(cfg) {
  const pal = brandPalette(cfg.warnaUtama);
  const vars = {
    '--page-bg': /^#[0-9a-f]{6}$/i.test(cfg.warnaLatar) ? cfg.warnaLatar : DEFAULT_TAMPILAN.warnaLatar,
    '--font-body': fontStack(cfg.fontIsi),
    '--font-heading': fontStack(cfg.fontJudul),
    '--font-size': `${[15, 16, 17, 18].includes(Number(cfg.ukuranFont)) ? Number(cfg.ukuranFont) : 16}px`,
    '--content-max': CONTENT_MAX[cfg.lebarKonten] || CONTENT_MAX.normal,
    '--radius-card': RADIUS[cfg.gayaKartu] || RADIUS.bulat,
  };
  Object.entries(pal).forEach(([k, rgb]) => { vars[`--brand-${k}`] = chan(rgb); });
  return vars;
}

// Terapkan tema ke <html> + muat font + simpan cache (supaya tidak berkedip saat dibuka lagi)
export function applyTheme(cfgRaw, { cache = true } = {}) {
  if (typeof document === 'undefined') return;
  const cfg = mergeTampilan(cfgRaw);
  const vars = buildThemeVars(cfg);
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));

  const href = fontHref(cfg);
  let link = document.getElementById('tema-font');
  if (href) {
    if (!link) {
      link = document.createElement('link');
      link.id = 'tema-font';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  } else if (link) link.remove();

  if (cache) {
    try { localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ vars, fontHref: href })); } catch (e) { /* abaikan */ }
  }
}

// Script kecil yang dijalankan sebelum render (di <head>) memakai cache terakhir
export const THEME_BOOT_SCRIPT = `try{var c=JSON.parse(localStorage.getItem('${THEME_CACHE_KEY}')||'null');if(c){var r=document.documentElement;for(var k in c.vars){r.style.setProperty(k,c.vars[k]);}if(c.fontHref){var l=document.createElement('link');l.id='tema-font';l.rel='stylesheet';l.href=c.fontHref;document.head.appendChild(l);}}}catch(e){}`;

// ---------- Hero ----------
export const HERO_PAD = { kecil: 'py-12 sm:py-14', sedang: 'py-20', besar: 'py-28 sm:py-36' };

// Foto dengan tepi memudar (transparan) ke warna utama di belakangnya
export function heroPhotoStyle(cfg) {
  const fade = Math.max(0, Math.min(50, Number(cfg.heroFadeTepi) || 0));
  const style = {
    backgroundImage: `url("${cfg.heroFoto}")`,
    backgroundSize: 'cover',
    backgroundPosition: cfg.heroPosisiFoto || 'center',
    backgroundRepeat: 'no-repeat',
    opacity: Math.max(0.1, Math.min(1, (Number(cfg.heroFotoOpasitas) || 60) / 100)),
  };
  if (fade > 0) {
    const edge = (dir) => `linear-gradient(${dir}, transparent 0%, #000 ${fade}%, #000 ${100 - fade}%, transparent 100%)`;
    const mask = `${edge('to right')}, ${edge('to bottom')}`;
    style.WebkitMaskImage = mask;
    style.maskImage = mask;
    style.WebkitMaskComposite = 'source-in';
    style.maskComposite = 'intersect';
  }
  return style;
}

// ---------- Media sosial ----------
const SAFE_URL = /^https?:\/\//i;
const strip = (v) => String(v || '').trim().replace(/^@/, '');

export function socialUrl(kind, raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (SAFE_URL.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return ''; // tolak skema lain (javascript:, data:, dll.)
  const u = strip(v);
  switch (kind) {
    case 'instagram': return `https://instagram.com/${u}`;
    case 'facebook': return `https://facebook.com/${u}`;
    case 'youtube': return `https://youtube.com/${v.startsWith('@') ? v : '@' + u}`;
    case 'tiktok': return `https://tiktok.com/@${u}`;
    case 'x': return `https://x.com/${u}`;
    case 'telegram': return `https://t.me/${u}`;
    case 'whatsapp': {
      let d = v.replace(/\D/g, '');
      if (d.startsWith('0')) d = '62' + d.slice(1);
      return d ? `https://wa.me/${d}` : '';
    }
    case 'website': return `https://${v}`;
    default: return '';
  }
}

const SOCIAL_KINDS = [
  ['instagram', 'Instagram', 'sosialInstagram'],
  ['facebook', 'Facebook', 'sosialFacebook'],
  ['youtube', 'YouTube', 'sosialYoutube'],
  ['tiktok', 'TikTok', 'sosialTiktok'],
  ['x', 'X', 'sosialX'],
  ['telegram', 'Telegram', 'sosialTelegram'],
  ['whatsapp', 'WhatsApp', 'sosialWhatsapp'],
  ['website', 'Website', 'sosialWebsite'],
];

// -> [{ kind, label, url }]
export function socialLinks(cfg) {
  const out = [];
  SOCIAL_KINDS.forEach(([kind, label, key]) => {
    const url = socialUrl(kind, cfg[key]);
    if (url) out.push({ kind, label, url });
  });
  String(cfg.sosialLainnya || '').split('\n').forEach((line) => {
    const [name, ...rest] = line.split('|');
    const url = SAFE_URL.test(rest.join('|').trim()) ? rest.join('|').trim() : '';
    if (name?.trim() && url) out.push({ kind: 'lainnya', label: name.trim(), url });
  });
  return out;
}
