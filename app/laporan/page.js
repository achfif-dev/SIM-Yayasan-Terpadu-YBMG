import LaporanPublik from '../../components/LaporanPublik';

// Laporan kegiatan yang dibagikan lewat tautan: /laporan?id=<ID kegiatan>
// Judul & gambar pratinjau (WhatsApp/Facebook) dibuat di server dari dokumen publik; halamannya sendiri dimuat di browser.
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
async function ambil(path) {
  if (!projectId) return null;
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`, { next: { revalidate: 300 } });
    return r.ok ? ((await r.json()).fields || {}) : null;
  } catch (e) { return null; }
}
const str = (f, k) => (f && f[k] && typeof f[k].stringValue === 'string' ? f[k].stringValue.trim() : '');
const gambar = (url) => {
  if (!/^https:\/\//i.test(url || '')) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !/\/upload\/[^/]*(c_pad|w_\d+)/.test(url)) return url.replace('/upload/', '/upload/c_pad,w_800,h_800,b_white,f_jpg,q_auto/');
  return url;
};

export async function generateMetadata({ searchParams }) {
  const dasar = { title: 'Laporan Kegiatan', robots: { index: false, follow: false } };
  const id = String(searchParams?.id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) return dasar;
  const [kg, pr] = await Promise.all([ambil(`panitia/${id}`), ambil('settings/profile')]);
  if (!kg) return dasar; // belum dibagikan (ditolak aturan) atau tidak ada
  const nama = str(kg, 'nama');
  const yayasan = str(pr, 'namaYayasan');
  const title = `Laporan Keuangan ${nama}`;
  const description = `Laporan pertanggungjawaban ${nama}${yayasan ? ` — ${yayasan}` : ''}`;
  const img = gambar(str(pr, 'logoUrl'));
  const meta = { ...dasar, title, description, openGraph: { title, description, type: 'article', locale: 'id_ID' }, twitter: { card: 'summary', title, description } };
  if (img) { meta.openGraph.images = [{ url: img, width: 800, height: 800, alt: title }]; meta.twitter.images = [img]; }
  return meta;
}

export default function Page() {
  return <LaporanPublik />;
}
