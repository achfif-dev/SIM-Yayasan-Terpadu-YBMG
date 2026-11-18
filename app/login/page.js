'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { Lock, Loader2 } from 'lucide-react';
import { getAuthInstance } from '../../lib/firebase';
import { isAdminEmail } from '../../lib/admin';

const ERRORS = {
  'auth/invalid-api-key': 'API key Firebase tidak valid. Periksa Environment Variables di hosting lalu deploy ulang.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'API key Firebase tidak valid. Periksa Environment Variables di hosting lalu deploy ulang.',
  'auth/configuration-not-found': 'Metode login belum diaktifkan di Firebase Console (Authentication → Sign-in method).',
  'auth/operation-not-allowed': 'Metode login ini belum diaktifkan di Firebase Console (Authentication → Sign-in method).',
  'auth/unauthorized-domain': 'Domain situs ini belum ada di Firebase → Authentication → Settings → Authorized domains.',
  'auth/requests-from-referer-blocked': 'API key dibatasi (HTTP referrer). Tambahkan domain situs ini di Google Cloud → Credentials.',
  'auth/invalid-credential': 'Email atau password salah (atau akun belum dibuat di Firebase Authentication).',
  'auth/invalid-login-credentials': 'Email atau password salah (atau akun belum dibuat di Firebase Authentication).',
  'auth/user-not-found': 'Akun tidak ditemukan.',
  'auth/wrong-password': 'Password salah.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
  'auth/network-request-failed': 'Koneksi bermasalah. Periksa internet Anda.',
  'auth/popup-closed-by-user': 'Jendela login Google ditutup sebelum selesai.',
  'auth/popup-blocked': 'Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.',
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fail = (err) => {
    console.error('Login error:', err?.code, err);
    setError(ERRORS[err?.code] || `Login gagal (${err?.code || err?.message || 'unknown'}).`);
  };

  // Tolak akun yang tidak ada di daftar admin
  const finish = async (cred) => {
    if (!isAdminEmail(cred.user.email)) {
      await signOut(getAuthInstance());
      setError('Akun ini tidak terdaftar sebagai admin.');
      return;
    }
    router.push('/admin');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await finish(await signInWithEmailAndPassword(getAuthInstance(), email, password));
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await finish(await signInWithPopup(getAuthInstance(), provider));
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 to-brand-600 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Lock size={22} />
          </div>
          <h1 className="text-xl font-bold">Login Admin</h1>
          <p className="text-sm text-slate-500">Panel pengelola yayasan</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>}
        <input type="email" required placeholder="Email" className="inp" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required placeholder="Password" className="inp" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={loading} className="btn w-full">
          {loading && <Loader2 size={16} className="animate-spin" />} Masuk
        </button>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> atau <span className="h-px flex-1 bg-slate-200" />
        </div>
        <button type="button" onClick={handleGoogle} disabled={loading} className="btn-light w-full justify-center">
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
            <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Masuk dengan Google
        </button>
        <Link href="/" className="block text-center text-sm text-slate-500 hover:text-brand-700">← Kembali ke beranda</Link>
      </form>
    </main>
  );
}
