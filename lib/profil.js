import { doc, getDoc } from 'firebase/firestore';
import { getDb } from './firebase';

// Identitas yayasan untuk kop surat PDF (settings/profile dibaca publik).
export async function muatProfil() {
  try {
    const s = await getDoc(doc(getDb(), 'settings', 'profile'));
    return { namaYayasan: 'Yayasan', ...(s.exists() ? s.data() : {}) };
  } catch (e) {
    return { namaYayasan: 'Yayasan' };
  }
}
export const linkLaporan = (id) => `${window.location.origin}/laporan?id=${id}`;
