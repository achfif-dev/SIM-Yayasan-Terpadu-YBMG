// Berbagi lewat WhatsApp / lembar bagikan HP.
import { normHp } from './kegiatan';

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
