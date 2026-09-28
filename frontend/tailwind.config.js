/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand utama: merah gelap seperti di logo
        brand: {
          50:  '#fdf2f2',
          100: '#fce8e8',
          200: '#f9c8c8',
          300: '#f49090',
          400: '#ed5050',
          500: '#e02020',
          600: '#c01010',
          700: '#9e0e0e',
          800: '#820e0e',
          900: '#6c1010',
        },
        // Krem/kertas untuk elemen background
        paper: {
          50:  '#fdfaf5',
          100: '#f7f0e3',
          200: '#ede0c8',
          300: '#dfc9a0',
          400: '#cfad72',
          500: '#c09450',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
};
