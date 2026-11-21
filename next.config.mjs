/** @type {import('next').NextConfig} */
const headers = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Login Google memakai popup: same-origin-allow-popups agar window.opener tidak diputus
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // CSP dalam mode REPORT-ONLY: hanya melaporkan pelanggaran di Console browser, TIDAK memblokir apa pun.
  // Pakai dulu beberapa hari (buka beranda, login, admin, unggah foto, bagikan PDF), perbaiki sumber yang terlaporkan,
  // lalu ganti nama header menjadi Content-Security-Policy. 'unsafe-inline' diperlukan skrip tema & gaya Next/Tailwind.
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://lh3.googleusercontent.com",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.cloudinary.com https://res.cloudinary.com",
      "frame-src https://*.firebaseapp.com https://accounts.google.com https://www.google.com",
      "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};
export default nextConfig;
