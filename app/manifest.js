// Manifest PWA. Nama & warna diambil dari Firestore (settings/profile, settings/tampilan) bila ada,
// sehingga mengikuti pengaturan admin; bila gagal dipakai nilai bawaan.
export const revalidate = 300;

const FALLBACK_NAME = 'Sistem Informasi Yayasan Terpadu';
const FALLBACK_SHORT = 'YBMG';
const FALLBACK_COLOR = '#047857';

async function ambil(dokumen) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return {};
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/${dokumen}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return {};
    const f = (await res.json()).fields || {};
    const out = {};
    for (const k of Object.keys(f)) if (typeof f[k].stringValue === 'string') out[k] = f[k].stringValue.trim();
    return out;
  } catch (e) {
    return {};
  }
}

export default async function manifest() {
  const [profil, tampilan] = await Promise.all([ambil('profile'), ambil('tampilan')]);
  const nama = profil.namaYayasan || FALLBACK_NAME;
  const warna = /^#[0-9a-fA-F]{6}$/.test(tampilan.warnaUtama || '') ? tampilan.warnaUtama : FALLBACK_COLOR;
  return {
    id: '/',
    name: nama,
    short_name: nama.length <= 14 ? nama : FALLBACK_SHORT,
    description: profil.tagline || 'Sistem informasi manajemen yayasan: keagamaan, sosial, dan kemanusiaan.',
    lang: 'id',
    dir: 'ltr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: warna,
    categories: ['education', 'social', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
