import './globals.css';
import { THEME_BOOT_SCRIPT } from '../lib/tampilan';
import Splash from '../components/Splash';
import PwaRegister from '../components/PwaRegister';

const FALLBACK_TITLE = 'Sistem Informasi Yayasan Terpadu';
const FALLBACK_DESC = 'Sistem informasi manajemen yayasan: keagamaan, sosial, dan kemanusiaan.';

const siteUrl = () => {
  const u = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || 'https://ybmg.vercel.app';
  return u.startsWith('http') ? u : `https://${u}`;
};

// Baca settings/profile dari Firestore lewat REST (di server, tanpa SDK).
// Aturan Firestore mengizinkan baca publik untuk koleksi settings. Di-cache 5 menit agar hemat kuota.
async function fetchProfile() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/profile`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const f = (await res.json()).fields || {};
    const str = (k) => (f[k] && typeof f[k].stringValue === 'string' ? f[k].stringValue.trim() : '');
    return { namaYayasan: str('namaYayasan'), statusHukum: str('statusHukum'), tagline: str('tagline'), logoUrl: str('logoUrl') };
  } catch (e) {
    return null;
  }
}

// Pratinjau tautan (WhatsApp/Facebook/Telegram) butuh gambar https berukuran wajar, bukan WebP/AVIF transparan.
// Untuk Cloudinary: kotak 800x800, latar putih, JPG. URL https lain dipakai apa adanya.
function shareImage(url) {
  if (!/^https:\/\//i.test(url || '')) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !/\/upload\/[^/]*(c_pad|w_\d+)/.test(url)) {
    return url.replace('/upload/', '/upload/c_pad,w_800,h_800,b_white,f_jpg,q_auto/');
  }
  return url;
}

export const viewport = {
  themeColor: '#047857',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export async function generateMetadata() {
  const p = await fetchProfile();
  const title = p?.namaYayasan || FALLBACK_TITLE;
  const description = p?.tagline || FALLBACK_DESC;
  const img = shareImage(p?.logoUrl);
  const meta = {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: title, locale: 'id_ID' },
    twitter: { card: 'summary', title, description },
    manifest: '/manifest.webmanifest',
    applicationName: title,
    appleWebApp: { capable: true, title: title.length <= 14 ? title : 'YBMG', statusBarStyle: 'default' },
    formatDetection: { telephone: false },
  };
  // Tanpa logo valid: tidak diisi, sehingga Next memakai app/opengraph-image.png sebagai cadangan
  if (img) {
    meta.openGraph.images = [{ url: img, width: 800, height: 800, alt: title }];
    meta.twitter.images = [img];
  }
  return meta;
}

// Logo untuk layar pembuka: hanya https atau data URL gambar yang wajar ukurannya (data URL = logo tersimpan di Firestore)
const logoAman = (u) => (/^https:\/\//i.test(u || '') || (/^data:image\//i.test(u || '') && u.length < 150000) ? u : '');

export default async function RootLayout({ children }) {
  const p = await fetchProfile(); // fetch yang sama dengan generateMetadata (di-cache Next, tanpa baca tambahan)
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Terapkan tema tersimpan sebelum halaman tampil, agar tidak berkedip */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Splash logo={logoAman(p?.logoUrl)} nama={p?.namaYayasan || ''} status={p?.statusHukum || ''} />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
