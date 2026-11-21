import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy init: hanya dipanggil di useEffect/event handler agar build di Vercel aman.
// App Check (reCAPTCHA v3) aktif bila NEXT_PUBLIC_RECAPTCHA_SITE_KEY diisi: permintaan Firestore dari skrip luar
// (yang menguras kuota baca/tulis Spark) tidak membawa token sah, sehingga bisa ditolak setelah "Enforce" dinyalakan.
// Pasang SEBELUM enforcement dan pantau dulu di Firebase Console → App Check → Metrics.
const getFirebaseApp = () => {
  if (getApps().length) return getApp();
  const app = initializeApp(firebaseConfig);
  const key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (key && typeof window !== 'undefined') {
    try {
      if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN) self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(key), isTokenAutoRefreshEnabled: true });
    } catch (e) { /* App Check gagal dimulai: aplikasi tetap jalan, hanya tanpa token */ }
  }
  return app;
};

export const getDb = () => getFirestore(getFirebaseApp());
export const getAuthInstance = () => getAuth(getFirebaseApp());
