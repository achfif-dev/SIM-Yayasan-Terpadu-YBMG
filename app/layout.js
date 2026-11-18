import './globals.css';
import { THEME_BOOT_SCRIPT } from '../lib/tampilan';

export const metadata = {
  title: 'Sistem Informasi Yayasan Terpadu',
  description: 'Sistem informasi manajemen yayasan: Masjid, Pendidikan, dan Sosial.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Terapkan tema tersimpan sebelum halaman tampil, agar tidak berkedip */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
