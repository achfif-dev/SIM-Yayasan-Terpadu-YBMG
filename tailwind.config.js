/** @type {import('tailwindcss').Config} */
// Warna brand & ukuran layout dikendalikan lewat CSS variable (lihat lib/tampilan.js
// dan Admin → Tampilan). Nilai di bawah adalah cadangan bila konfigurasi belum dimuat.
const brand = (n) => `rgb(var(--brand-${n}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{js,jsx}', './lib/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { brand: { 50: brand(50), 100: brand(100), 600: brand(600), 700: brand(700), 800: brand(800), 900: brand(900) } },
      maxWidth: { content: 'var(--content-max, 72rem)' },
      borderRadius: { card: 'var(--radius-card, 1rem)' },
    },
  },
  plugins: [],
};
