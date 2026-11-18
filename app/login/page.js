'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Lock, Loader2 } from 'lucide-react';
import { getAuthInstance } from '../../lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(getAuthInstance(), email, password);
      router.push('/admin');
    } catch (err) {
      setError('Login gagal. Periksa email dan password Anda.');
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
        <Link href="/" className="block text-center text-sm text-slate-500 hover:text-brand-700">← Kembali ke beranda</Link>
      </form>
    </main>
  );
}
