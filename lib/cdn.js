// Helper Cloudinary yang murni (tanpa Firebase), aman dipakai di server & client.
export const isCloudinaryOn = () =>
  !!(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

// Minta Cloudinary mengirim versi yang lebih kecil & format modern (WebP/AVIF) saat ditampilkan.
// URL non-Cloudinary (data URL, /file.jpg, dll.) dikembalikan apa adanya.
export function optimizeUrl(url, width) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(url)) return url; // sudah punya transformasi
  return url.replace('/upload/', `/upload/f_auto,q_auto${width ? `,w_${width}` : ''}/`);
}
