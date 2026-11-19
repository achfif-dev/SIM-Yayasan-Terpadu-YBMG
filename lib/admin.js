import { doc, getDoc } from 'firebase/firestore';
import { getDb } from './firebase';

// PEMILIK = email di NEXT_PUBLIC_ADMIN_EMAILS (dipisah koma) dan di fungsi isOwner() pada firestore.rules.
// Pemilik selalu bisa masuk dan menambah/menghapus admin lain dari panel (tab "Admin"), jadi tidak bisa terkunci.
// Admin tambahan disimpan di koleksi Firestore `admins` (ID dokumen = email huruf kecil) → tidak perlu ubah
// .env / rules / deploy ulang setiap kali menambah admin. Ini hanya penjaga tampilan; pengaman sebenarnya firestore.rules.
const ownerList = () => (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const ownerEmails = () => ownerList();
export const isOwnerEmail = (email) => !!email && ownerList().includes(String(email).toLowerCase());

// Apakah akun ini boleh masuk panel? (pemilik, atau terdaftar di koleksi `admins`)
export async function cekAdmin(user) {
  const email = user?.email?.toLowerCase();
  if (!email) return false;
  if (isOwnerEmail(email)) return true;
  try {
    const s = await getDoc(doc(getDb(), 'admins', email));
    return s.exists();
  } catch (e) {
    return false; // ditolak rules / offline → anggap bukan admin
  }
}
