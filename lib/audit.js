// Pembantu jejak audit. Dokumen log ditulis dalam writeBatch yang SAMA dengan perubahan datanya, jadi tidak ada
// perubahan tanpa jejak (dan sebaliknya). firestore.rules mewajibkan `oleh` = email akun yang sedang login dan
// `waktu` = waktu server, sehingga log tidak bisa dipalsukan dari klien.
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { getAuthInstance, getDb } from './firebase';

export const emailSaya = () => String(getAuthInstance().currentUser?.email || '').toLowerCase();
export const refLog = () => doc(collection(getDb(), 'audit_log'));
export const isiLog = ({ koleksi, aksi, docId, sebelum = null, sesudah = null, sumber = '' }) => ({
  koleksi, aksi, docId, sebelum, sesudah, oleh: emailSaya(), waktu: serverTimestamp(), ...(sumber ? { sumber } : {}),
});
