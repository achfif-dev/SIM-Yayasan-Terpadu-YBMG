// Daftar email admin, dipisah koma. Contoh: NEXT_PUBLIC_ADMIN_EMAILS=achfif@gmail.com,admin2@gmail.com
// Ini hanya penjaga tampilan. Pengaman sebenarnya ada di firestore.rules.
export const isAdminEmail = (email) => {
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
};
