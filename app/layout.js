import './globals.css';

export const metadata = {
  title: 'Sistem Informasi Yayasan Terpadu',
  description: 'Sistem informasi manajemen yayasan: Masjid, Pendidikan, dan Sosial.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
