// Berbagi lewat WhatsApp / lembar bagikan HP.
import { normHp } from './kegiatan';
import { optimizeUrl } from './cdn';

export const linkWA = (teks, hp = '') => `https://wa.me/${normHp(hp)}?text=${encodeURIComponent(teks)}`;
export const bukaWA = (teks, hp = '') => { window.open(linkWA(teks, hp), '_blank', 'noopener'); };

export async function salinTeks(teks) {
  try { await navigator.clipboard.writeText(teks); return true; } catch (e) {
    try {
      const t = document.createElement('textarea');
      t.value = teks; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch (err) { return false; }
  }
}

export function unduhBlob(blob, nama) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const bisaBagikanFile = (blob, nama) => {
  try {
    const f = new File([blob], nama, { type: 'application/pdf' });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch (e) { return false; }
};

// Mengembalikan 'dibagikan' | 'batal' | 'diunduh'
export async function bagikanPdf(blob, nama, teks = '') {
  const f = new File([blob], nama, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try {
      await navigator.share({ files: [f], title: nama, text: teks });
      return 'dibagikan';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'batal';
    }
  }
  unduhBlob(blob, nama);
  return 'diunduh';
}

export const namaBerkas = (s) => String(s || 'dokumen').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'dokumen';


// ---- Foto galeri: bagikan ke Instagram/Facebook/WhatsApp dll. lewat lembar bagikan HP ----
// Tidak ada posting otomatis (butuh token server); admin memilih aplikasinya dan menekan kirim sendiri.
const BULAN_FOTO = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tglFoto = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? `${+m[3]} ${BULAN_FOTO[+m[2] - 1]} ${m[1]}` : ''; };
const adaAbort = (e) => !!e && e.name === 'AbortError';

export const urlHttps = (u) => (/^https:\/\//i.test(u || '') ? u : ''); // data URL tidak bisa dibagikan sebagai tautan
export const tautanGaleri = () => (typeof window === 'undefined' ? '' : `${window.location.origin}/#galeri`);

// Keterangan siap tempel: keterangan foto, tanggal · lembaga, nama yayasan, tautan situs
export function teksFoto(foto, { namaYayasan = '', statusHukum = '' } = {}) {
  const info = [tglFoto(foto?.tanggal), foto?.lembaga].filter(Boolean).join(' · ');
  const kepala = [foto?.keterangan || 'Dokumentasi kegiatan', info].filter(Boolean).join('\n');
  const kaki = [namaYayasan, statusHukum, tautanGaleri()].filter(Boolean).join('\n');
  return [kepala, kaki].filter(Boolean).join('\n\n');
}

// Cloudinary: minta JPG 1600px (Instagram/WhatsApp tidak selalu menerima WebP/AVIF). URL lain apa adanya.
const urlUnggah = (url) => {
  if (typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/') && !/\/upload\/[^/]*(f_|q_|w_\d+)/.test(url)) {
    return url.replace('/upload/', '/upload/f_jpg,q_auto,w_1600/');
  }
  return url;
};
const ekstensiFoto = (t) => (/png/.test(t) ? 'png' : /webp/.test(t) ? 'webp' : /gif/.test(t) ? 'gif' : 'jpg');

async function ambilBerkasFoto(foto) {
  const res = await fetch(urlUnggah(foto.gambarUrl));
  if (!res.ok) throw new Error('Gagal mengambil foto');
  const blob = await res.blob();
  const tipe = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return new File([blob], `${namaBerkas(foto.keterangan || 'foto')}.${ekstensiFoto(tipe)}`, { type: tipe });
}

export const bisaLembarBagikan = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

// Mengembalikan 'dibagikan' | 'batal' | 'gagal'. Utamakan berkas foto; bila tidak didukung, bagikan teks + tautan.
export async function bagikanFoto(foto, opsi = {}) {
  const teks = teksFoto(foto, opsi);
  try {
    const f = await ambilBerkasFoto(foto);
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], text: teks }); return 'dibagikan'; } catch (e) { if (adaAbort(e)) return 'batal'; }
    }
  } catch (e) { /* lanjut ke bagikan teks */ }
  if (bisaLembarBagikan()) {
    try { await navigator.share({ text: teks, url: urlHttps(foto.gambarUrl) || tautanGaleri() }); return 'dibagikan'; } catch (e) { if (adaAbort(e)) return 'batal'; }
  }
  return 'gagal';
}

export async function unduhFoto(foto) {
  try { const f = await ambilBerkasFoto(foto); unduhBlob(f, f.name); return true; } catch (e) {
    const u = urlHttps(foto.gambarUrl);
    if (u) { window.open(u, '_blank', 'noopener'); return true; }
    return false;
  }
}

export const bukaWAFoto = (foto, opsi = {}) => {
  const u = urlHttps(foto.gambarUrl);
  window.open(`https://wa.me/?text=${encodeURIComponent([teksFoto(foto, opsi), u].filter(Boolean).join('\n\n'))}`, '_blank', 'noopener');
};
// Facebook hanya menerima tautan https (bukan data URL): pakai foto bila berupa URL, kalau tidak tautan galeri situs
export const bukaFacebookFoto = (foto) => {
  const u = urlHttps(foto.gambarUrl) || tautanGaleri();
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`, '_blank', 'noopener');
};
