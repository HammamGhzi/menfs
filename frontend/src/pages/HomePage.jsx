import { useState } from 'react';
import toast from 'react-hot-toast';
import { menfesAPI } from '../api';

const MAX_CHARS = 500;
const MAX_NAME = 30;

export default function HomePage() {
  const [message, setMessage] = useState('');
  const [isAnon, setIsAnon] = useState(true);
  const [senderName, setSenderName] = useState('');
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
    if (!isAnon && senderName.trim().length === 0) {
      toast.error('Tulis nama kamu dulu!');
      return;
    }

    setSubmitting(true);
    try {
      await menfesAPI.submit({
        message: trimmed,
        senderName: isAnon ? null : senderName.trim(),
      });
      setSubmitted(true);
      setMessage('');
      setSenderName('');
      toast.success('Menfess terkirim! Menunggu persetujuan admin.');
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
    setSenderName('');
    setIsAnon(true);
  }

  return (
    <div className="min-h-screen bg-ink-800">
      {/* Header */}
      <header className="bg-ink-900/95 backdrop-blur-sm border-b border-ink-600 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight leading-none">
              <span className="text-parchment-200">HARKAT</span>{' '}
              <span className="text-brand-600 relative">
                NEKATT
                <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-brand-700 rounded-full" />
              </span>
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2 sm:space-y-3 py-2 sm:py-4">
          <p className="text-parchment-500 font-mono text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.25em] uppercase">
            The pen is mightier than the sword.
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            <span className="text-parchment-100">Kirim </span>
            <span className="text-brand-600">Menfess</span>
          </h2>
        </div>

        {/* Form */}
        {!submitted ? (
          <div className="card border-ink-600 p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Pesan */}
              <div>
                <label
                  htmlFor="message"
                  className="block text-xs font-semibold text-parchment-400 mb-2 font-mono uppercase tracking-widest"
                >
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
                  style={{ fontSize: '16px' /* cegah zoom iOS */ }}
                />
                <div className={`text-right text-xs mt-1 font-mono ${remaining < 50 ? 'text-brand-500' : 'text-ink-500'}`}>
                  {remaining} karakter tersisa
                </div>
              </div>

              {/* Pilihan pengirim */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-parchment-400 font-mono uppercase tracking-widest">
                  Tampil sebagai
                </p>

                {/* Toggle anonim / nama sendiri */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAnon(true)}
                    className={`py-3 sm:py-2.5 px-3 rounded-xl border text-xs font-mono font-semibold transition-all ${
                      isAnon
                        ? 'bg-brand-700 border-brand-600 text-parchment-100'
                        : 'bg-ink-800 border-ink-600 text-ink-400 hover:text-parchment-300 hover:border-ink-500'
                    }`}
                  >
                    Dari Seseorang
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnon(false)}
                    className={`py-3 sm:py-2.5 px-3 rounded-xl border text-xs font-mono font-semibold transition-all ${
                      !isAnon
                        ? 'bg-brand-700 border-brand-600 text-parchment-100'
                        : 'bg-ink-800 border-ink-600 text-ink-400 hover:text-parchment-300 hover:border-ink-500'
                    }`}
                  >
                    Tulis Nama
                  </button>
                </div>

                {/* Input nama */}
                {!isAnon && (
                  <div>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Nama kamu..."
                      maxLength={MAX_NAME}
                      className="input-field font-mono text-sm"
                      disabled={submitting}
                      aria-label="Nama pengirim"
                      autoFocus
                      style={{ fontSize: '16px' /* cegah zoom iOS */ }}
                    />
                    <div className="text-right text-xs mt-1 font-mono text-ink-500">
                      {MAX_NAME - senderName.length} karakter tersisa
                    </div>
                  </div>
                )}

              </div>

              {/* Info */}
              <div className="bg-ink-800 border border-ink-600 rounded-xl p-3">
                <p className="text-xs text-ink-300 flex gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Identitasmu <strong className="text-parchment-200">100% anonim</strong></span>
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || message.trim().length < 5 || (!isAnon && !senderName.trim())}
                className="btn-primary w-full text-center font-mono tracking-widest py-3.5 sm:py-3"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    MENGIRIM...
                  </span>
                ) : 'KIRIM MENFESS'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card text-center space-y-4 border-brand-800/40 p-6 sm:p-8">
            <svg className="w-12 h-12 text-brand-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-bold text-parchment-200">Menfess Terkirim!</h3>
            <p className="text-ink-300 text-sm">
              Sedang menunggu persetujuan admin. Sabar ya!
            </p>
            <button onClick={handleReset} className="btn-primary font-mono py-3.5 sm:py-3 w-full sm:w-auto px-8">
              KIRIM LAGI
            </button>
          </div>
        )}

      </main>

      <footer className="text-center py-6 sm:py-8 border-t border-ink-700">
        <div className="w-16 h-0.5 bg-brand-700 mx-auto mb-4 rounded-full" />
        <p className="text-xs text-ink-500 font-mono tracking-widest">
          © 2026 HARKAT NEKATT · EST. 2026
        </p>
      </footer>
    </div>
  );
}
