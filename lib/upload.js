// Upload gambar tanpa Firebase Storage (kompatibel Spark Plan).
// Default: gambar dikompres di browser lalu disimpan sebagai data URL di Firestore.
// Opsional: jika NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME & NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET diisi,
// gambar diunggah ke Cloudinary (unsigned preset).
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getDb } from './firebase';

const MAX_SIZE = 320;
export const RECEIPT_PREFIX = 'receipt:';
// Bukti transfer donasi: disimpan di koleksi `bukti_donasi` yang hanya bisa dibaca admin (nota kas di `receipts` terbuka per-ID).
// Catatan: bila Cloudinary aktif, berkas tetap berupa URL publik (tidak bisa dibuat privat dengan unsigned preset).
export const PRIVAT_PREFIX = 'private:';

function compressToDataUrl(file, maxSize = MAX_SIZE, quality = 0.8, flatten = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (flatten) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        let out = canvas.toDataURL('image/webp', quality);
        if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', quality); // Safari lama
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// file boleh File atau data URL (string); keduanya diterima Cloudinary.
async function uploadToCloudinary(file, folder) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', preset);
  fd.append('folder', folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Upload Cloudinary gagal');
  return data.secure_url;
}

const useCloudinary = () =>
  !!(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

// opts.maxSize/opts.quality: untuk foto berita & galeri yang perlu lebih besar dari logo.
export async function uploadImage(file, folder = 'uploads', opts = {}) {
  const { maxSize = MAX_SIZE, quality = 0.8 } = opts;
  if (useCloudinary()) {
    // Foto besar (berita, galeri, latar) diperkecil dulu di HP agar unggahan cepat & hemat kuota data.
    // Logo (ukuran bawaan) diunggah apa adanya supaya transparansinya terjaga.
    if (maxSize !== MAX_SIZE) return uploadToCloudinary(await compressToDataUrl(file, Math.max(maxSize, 1600), 0.82, true), folder);
    return uploadToCloudinary(file, folder);
  }
  if (maxSize === MAX_SIZE) return compressToDataUrl(file, maxSize, quality);
  const steps = [[maxSize, quality], [Math.round(maxSize * 0.8), quality - 0.1], [Math.round(maxSize * 0.6), quality - 0.2]];
  for (const [size, q] of steps) {
    const url = await compressToDataUrl(file, size, q, true);
    if (url.length < 900000) return url; // batas dokumen Firestore ±1 MiB
  }
  throw new Error('Gambar terlalu besar, gunakan foto yang lebih kecil.');
}

// Bukti transaksi: resolusi lebih besar agar nota terbaca. Tanpa Cloudinary, gambar disimpan
// di koleksi terpisah "receipts" (bukan di dokumen transaksi) supaya beranda tetap ringan.
// Mengembalikan string untuk disimpan di field `bukti` pada transaksi.
export async function uploadBukti(file, { privat = false } = {}) {
  if (useCloudinary()) return uploadToCloudinary(file, privat ? 'bukti-donasi' : 'bukti');
  const steps = [[1000, 0.72], [900, 0.6], [800, 0.5], [640, 0.45]];
  for (const [size, q] of steps) {
    const url = await compressToDataUrl(file, size, q, true);
    if (url.length < 900000) { // batas dokumen Firestore ±1 MiB
      const ref = await addDoc(collection(getDb(), privat ? 'bukti_donasi' : 'receipts'), { data: url, createdAt: serverTimestamp() });
      return (privat ? PRIVAT_PREFIX : RECEIPT_PREFIX) + ref.id;
    }
  }
  throw new Error('Gambar terlalu besar, gunakan foto yang lebih kecil.');
}

export async function deleteBukti(value) {
  if (typeof value !== 'string') return;
  try {
    if (value.startsWith(RECEIPT_PREFIX)) await deleteDoc(doc(getDb(), 'receipts', value.slice(RECEIPT_PREFIX.length)));
    else if (value.startsWith(PRIVAT_PREFIX)) await deleteDoc(doc(getDb(), 'bukti_donasi', value.slice(PRIVAT_PREFIX.length)));
  } catch (e) { /* abaikan */ }
}
