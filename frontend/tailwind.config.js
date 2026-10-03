/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Crimson — brushstroke "NEKATT" di logo ──────────────────
        brand: {
          50:  '#fdf0f0',
          100: '#fad9d9',
          200: '#f4aeae',
          300: '#eb7575',
          400: '#df4040',
          500: '#c42020',
          600: '#a61818',
          700: '#7C1A1A',   // ← warna persis brushstroke logo
          800: '#5e1414',
          900: '#420e0e',
          950: '#280808',
        },
        // ── Near-black — background & teks bold logo ─────────────────
        ink: {
          50:  '#f2f2f2',
          100: '#d9d9d9',
          200: '#a6a6a6',
          300: '#737373',
          400: '#404040',
          500: '#1f1f1f',
          600: '#171717',
          700: '#111111',
          800: '#0d0d0d',   // ← near-black utama
          900: '#080808',
          950: '#030303',
        },
        // ── Parchment — kertas robek di logo ─────────────────────────
        parchment: {
          50:  '#fdfcf9',
          100: '#f7f3ea',
          200: '#ede3cc',   // ← terang / highlight
          300: '#e0ceaa',
          400: '#d0b580',
          500: '#b8955a',
          600: '#9a7840',
          700: '#7a5e2e',
          800: '#5c451f',
          900: '#3d2e12',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Courier New"', 'Courier', 'monospace'],
        serif: ['Georgia', 'serif'],
      },
      backgroundImage: {
        // Noise texture ringan buat efek kertas
        'noise': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        },
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top, 0px)',
        },
        '.touch-manipulation': {
          touchAction: 'manipulation',
        },
      });
    },
  ],
};
