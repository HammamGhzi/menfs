/**
 * Konfigurasi Template Menfess Harkat Nekatt
 * Mendukung template background.jpg (Classic), template 1 (Blue Sky), dan template 2 (White Minimalist)
 */

// Cache busting parameter agar browser selalu memuat file gambar terbaru saat diganti
const CACHE_KEY = Date.now();

export const TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic Dark',
    badge: 'Classic',
    tag: 'Hitam / Vintage',
    description: 'Nuansa vintage kertas sobek & stempel tinta',
    src: `/template/background.jpg?v=${CACHE_KEY}`,
    fallbackSrc: '/template/background.jpg',
    thumbnail: `/template/background.jpg?v=${CACHE_KEY}`,
    defaultRatio: '1:1',
    themeColor: '#d97706', // amber
    accentColor: '#f59e0b',
    textColor: '#1a1a1a',
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: '600',
    defaultFontSize: 36,
    defaultFontSizeName: 28,
    lineHeightMultiplier: 1.55,
    maxLines: 8,
    bounds: {
      '1:1': { x: 0.085, y: 0.31, w: 0.83, h: 0.44, padX: 0.08, padY: 0.12 },
      '4:5': { x: 0.085, y: 0.28, w: 0.83, h: 0.44, padX: 0.08, padY: 0.12 },
    },
    defaultSender: {
      posX: 75,
      posY: 84,
      rotate: -8,
      color: 'rgba(255,255,255,0.95)',
      fontFamily: "'Courier New', Courier, monospace",
      fontWeight: 'bold',
      prefix: '',
      hasBakedAnon: false,
    },
  },
  {
    id: 'template1',
    name: 'Template 1',
    badge: 'Template 1',
    tag: 'Blue Sky Glass',
    description: 'Awan biru cerah & kartu glassmorphism',
    src: `/template/template 1.png?v=${CACHE_KEY}`,
    fallbackSrc: `/template/template-1.png?v=${CACHE_KEY}`,
    thumbnail: `/template/template 1.png?v=${CACHE_KEY}`,
    defaultRatio: '4:5',
    themeColor: '#0284c7', // sky
    accentColor: '#38bdf8',
    textColor: '#ffffff',
    textShadow: '0 2px 10px rgba(0,0,0,0.3)',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: '600',
    defaultFontSize: 38,
    defaultFontSizeName: 25,
    lineHeightMultiplier: 1.5,
    maxLines: 10,
    bounds: {
      '4:5': { x: 0.13, y: 0.28, w: 0.74, h: 0.48, padX: 0.04, padY: 0.04 },
      '1:1': { x: 0.13, y: 0.25, w: 0.74, h: 0.50, padX: 0.04, padY: 0.04 },
    },
    defaultSender: {
      posX: 27.8,
      posY: 82.2,
      rotate: 0,
      color: '#ffffff',
      fontFamily: "'Poppins', sans-serif",
      fontWeight: '600',
      prefix: '',
      hasBakedAnon: false,
    },
  },
  {
    id: 'template2',
    name: 'Template 2',
    badge: 'Template 2',
    tag: 'White Minimalist',
    description: 'Kertas putih bersih, modern & rapi',
    src: `/template/template 2.png?v=${CACHE_KEY}`,
    fallbackSrc: `/template/template-2.png?v=${CACHE_KEY}`,
    thumbnail: `/template/template 2.png?v=${CACHE_KEY}`,
    defaultRatio: '4:5',
    themeColor: '#475569', // slate
    accentColor: '#94a3b8',
    textColor: '#0f172a',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, 'DM Sans', sans-serif",
    fontWeight: '600',
    defaultFontSize: 36,
    defaultFontSizeName: 26, // Ukuran pas 26px agar cap height persis 19px sama seperti 'DIKIRIIM OLEH'
    uppercaseSender: true, // Huruf kapital selaras dengan 'DIKIRIIM OLEH'
    lineHeightMultiplier: 1.5,
    maxLines: 12,
    bounds: {
      '4:5': { x: 0.22, y: 0.24, w: 0.56, h: 0.56, padX: 0.04, padY: 0.04 },
      '1:1': { x: 0.22, y: 0.20, w: 0.56, h: 0.58, padX: 0.04, padY: 0.04 },
    },
    defaultSender: {
      posX: 38.8,
      posY: 84.6,
      rotate: 0,
      color: '#0f172a',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, 'DM Sans', sans-serif",
      fontWeight: '700',
      prefix: '',
      hasBakedAnon: false,
    },
  },
];

export function getTemplateById(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

export function parseTemplateFromMenfes(menfes) {
  if (!menfes) return TEMPLATES[0].id;

  const info = (menfes.senderInfo || '').toLowerCase();
  if (info.includes('template 1') || info.includes('template1') || info.includes('blue sky')) {
    return 'template1';
  }
  if (info.includes('template 2') || info.includes('template2') || info.includes('white')) {
    return 'template2';
  }
  if (info.includes('classic') || info.includes('vintage') || info.includes('hitam')) {
    return 'classic';
  }

  return TEMPLATES[0].id;
}
