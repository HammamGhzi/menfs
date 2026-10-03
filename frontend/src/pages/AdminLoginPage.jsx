import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) navigate('/4613a76adb4fb2dc', { replace: true });
  }, [isLoggedIn, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      toast.success('Login berhasil!');
      navigate('/4613a76adb4fb2dc', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Login gagal. Periksa kredensial kamu.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-800 flex items-center justify-center px-4 py-8">
      {/* Background dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, #E8DCC8 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
        aria-hidden="true"
      />

      {/* Glow redup */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-28 sm:h-32 bg-brand-800/20 blur-3xl rounded-full pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none">
            <span className="text-parchment-200">HARKAT</span>
          </h1>
          <div className="mt-1 inline-block bg-brand-700 px-3 sm:px-4 py-1 rounded">
            <span className="text-2xl sm:text-3xl font-extrabold text-parchment-100 tracking-widest">
              NEKATT
            </span>
          </div>
          <p className="text-ink-400 font-mono text-xs mt-3 tracking-[0.3em] uppercase">
            Panel Admin
          </p>
          <div className="flex items-center gap-3 mt-4 sm:mt-5">
            <div className="flex-1 h-px bg-ink-600" />
            <div className="w-1.5 h-1.5 rounded-full bg-brand-700" />
            <div className="flex-1 h-px bg-ink-600" />
          </div>
        </div>

        {/* Form card */}
        <div className="card border-ink-600 p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-mono font-semibold text-parchment-500 mb-2 uppercase tracking-widest"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="input-field font-mono"
                autoComplete="username"
                disabled={loading}
                autoFocus
                /* Cegah auto-zoom iOS pada input kecil */
                style={{ fontSize: '16px' }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono font-semibold text-parchment-500 mb-2 uppercase tracking-widest"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="input-field pr-12 font-mono"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ fontSize: '16px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-parchment-300 transition-colors p-1 -mr-1"
                  aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPass ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 font-mono tracking-widest py-3.5 sm:py-3"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  MASUK...
                </span>
              ) : (
                'MASUK'
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 sm:mt-6">
          <a
            href="/"
            className="text-ink-200 hover:text-parchment-300 transition-colors font-mono text-xs tracking-wider py-2 inline-block"
          >
            ← KEMBALI KE BERANDA
          </a>
        </p>
      </div>
    </div>
  );
}
