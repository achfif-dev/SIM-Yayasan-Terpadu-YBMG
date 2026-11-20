// Statistik pengunjung tanpa layanan luar: 1 dokumen per hari di Firestore (stats_harian/YYYY-MM-DD)
// berisi hitungan saja (tidak ada data pribadi, IP, atau ID pengunjung).
//  - kunjungan : +1 per sesi browser (tab baru / buka lagi setelah ditutup)
//  - unik      : +1 per browser per hari
//  - hp/desktop, src_<sumber> : sebaran perangkat dan asal pengunjung
import { doc, increment, setDoc } from 'firebase/firestore';
import { getAuthInstance, getDb } from './firebase';
import { toStr } from './rutin';

export const SUMBER = [
  ['langsung', 'Langsung / tautan dari chat'],
  ['google', 'Google'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['whatsapp', 'WhatsApp'],
  ['telegram', 'Telegram'],
  ['lain', 'Situs lain'],
];
const ID_SUMBER = SUMBER.map(([id]) => id);
const ALIAS = { wa: 'whatsapp', fb: 'facebook', ig: 'instagram', tg: 'telegram' };

// Asal pengunjung: parameter ?src=wa|fb|ig|tg|google (untuk tautan yang Anda bagikan sendiri), lalu referrer.
function deteksiSumber() {
  try {
    const p = (new URLSearchParams(window.location.search).get('src') || '').toLowerCase();
    const s = ALIAS[p] || p;
    if (ID_SUMBER.includes(s) && s !== 'lain') return s;
    if (!document.referrer) return 'langsung';
    const h = new URL(document.referrer).hostname.toLowerCase();
    if (h === window.location.hostname) return 'langsung';
    if (/(^|\.)google\./.test(h)) return 'google';
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(h)) return 'facebook';
    if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
    if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(h)) return 'whatsapp';
    if (/(^|\.)(t\.me|telegram\.org)$/.test(h)) return 'telegram';
    return 'lain';
  } catch (e) {
    return 'langsung';
  }
}

const FLAG = 'ybmg_no_stat';
export const browserDikecualikan = () => { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } };
export const kecualikanBrowser = (ya) => {
  try { if (ya) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch (e) { /* abaikan */ }
};

// Admin yang sedang login (di browser ini) tidak dihitung, tanpa perlu membuka halaman admin dulu.
async function adminSedangMasuk() {
  try {
    const auth = getAuthInstance();
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    return !!auth.currentUser;
  } catch (e) {
    return false;
  }
}

export async function catatKunjungan() {
  try {
    if (typeof window === 'undefined') return;
    // Tautan ...?stat=off dibuka di sebuah browser = browser itu tidak dihitung (?stat=on = dihitung lagi)
    const sp = new URLSearchParams(window.location.search).get('stat');
    if (sp === 'off') kecualikanBrowser(true);
    if (sp === 'on') kecualikanBrowser(false);
    if (browserDikecualikan()) return;
    if (navigator.webdriver || /bot|crawl|spider|headless|lighthouse/i.test(navigator.userAgent)) return;
    if (sessionStorage.getItem('ybmg_sesi')) return; // sekali per sesi
    sessionStorage.setItem('ybmg_sesi', '1');
    if (await adminSedangMasuk()) return;
    const tgl = toStr(new Date());
    const unik = localStorage.getItem('ybmg_unik') !== tgl;
    try { localStorage.setItem('ybmg_unik', tgl); } catch (e) { /* abaikan */ }
    const hp = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const data = { tanggal: tgl, kunjungan: increment(1), [hp ? 'hp' : 'desktop']: increment(1), [`src_${deteksiSumber()}`]: increment(1) };
    if (unik) data.unik = increment(1);
    await setDoc(doc(getDb(), 'stats_harian', tgl), data, { merge: true });
  } catch (e) { /* statistik tidak boleh mengganggu halaman */ }
}
