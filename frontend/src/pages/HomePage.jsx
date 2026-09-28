import { useState } from 'react';
import toast from 'react-hot-toast';
import { menfesAPI } from '../api';
import MenfesCard from '../components/MenfesCard';

const MAX_CHARS = 500;

export default function HomePage() {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const remaining = MAX_CHARS - message.length;

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      toast.error('Pesan minimal 5 karakter ya!');
      return;
    }

    setSubmitting(true);
    try {
      await menfesAPI.submit({ message: trimmed });
      setSubmitted(true);
      setMessage('');
      toast.success('Menfes terkirim! Menunggu persetujuan admin 🎉');
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal mengirim menfes. Coba lagi.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSubmitted(false);
    setMessage('');
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight leading-none">
              HARKAT <span className="text-brand-600">NEKATT</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">MENFESS KAMPUS · ANONIM</p>
          </div>
          <a
            href="/admin/login"
            className="text-xs text-zinc-500 hover:text-white transition-colors font-mono"
          >
            ADMIN ↗
          </a>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2 py-4">
          <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase">
            The pen is mightier than the sword.
          </p>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Kirim <span className="text-brand-600">Menfess</span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Ungkapkan apapun secara anonim. Pesan akan tampil setelah disetujui admin.
          </p>
        </div>

        {/* Form */}
        {!submitted ? (
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-zinc-300 mb-2 font-mono uppercase tracking-wide">
                  Pesan Menfess
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tulis pesan menfess kamu di sini..."
                  rows={5}
                  maxLength={MAX_CHARS}
                  className="input-field resize-none font-mono text-sm"
                  disabled={submitting}
                  aria-label="Isi pesan menfess"
                />
                <div className={`text-right text-xs mt-1 font-mono ${remaining < 50 ? 'text-red-400' : 'text-zinc-600'}`}>
                  {remaining} karakter tersisa
                </div>
              </div>

              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3">
                <p className="text-xs text-zinc-400 flex gap-2">
                  <span>🔒</span>
                  <span>Identitasmu <strong className="text-white">100% anonim</strong> untuk publik. Hanya admin yang bisa melihat info pengirim.</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || message.trim().length < 5}
                className="btn-primary w-full text-center font-mono tracking-wider"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    MENGIRIM...
                  </span>
                ) : 'KIRIM MENFESS'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card text-center space-y-4">
            <div className="text-5xl">📨</div>
            <h3 className="text-xl font-bold text-white">Menfess Terkirim!</h3>
            <p className="text-zinc-400 text-sm">
              Sedang menunggu persetujuan admin. Sabar ya!
            </p>
            <button onClick={handleReset} className="btn-primary font-mono">
              KIRIM LAGI
            </button>
          </div>
        )}

        {/* Feed */}
        <MenfesCard />
      </main>

      <footer className="text-center py-8 border-t border-zinc-900">
        <p className="text-xs text-zinc-600 font-mono tracking-widest">
          © 2026 HARKAT NEKATT · EST. 2026
        </p>
      </footer>
    </div>
  );
}
