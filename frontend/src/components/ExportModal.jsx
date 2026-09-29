import { useRef, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function ExportModal({ menfes, onClose }) {
  const canvasRef = useRef(null);
  const [ratio, setRatio] = useState('1:1');
  const [fontSize, setFontSize] = useState(36);
  const [fontSizeName, setFontSizeName] = useState(28);
  const [downloading, setDownloading] = useState(false);
  const [bgStatus, setBgStatus] = useState('loading');
  const [posX, setPosX] = useState(75);
  const [posY, setPosY] = useState(84);
  const [rotate, setRotate] = useState(-8);

  const CANVAS_SIZE = {
    '1:1': { w: 1080, h: 1080 },
    '4:5': { w: 1080, h: 1350 },
  };

  useEffect(() => {
    renderCanvas();
  }, [ratio, fontSize, fontSizeName, menfes, posX, posY, rotate]);

  function renderCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { w, h } = CANVAS_SIZE[ratio];
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/template/background.jpg';

    img.onload = () => {
      setBgStatus('ok');
      drawWithBackground(ctx, w, h, img);
    };

    img.onerror = () => {
      setBgStatus('error');
      drawFallback(ctx, w, h);
    };
  }

  function drawWithBackground(ctx, w, h, bgImg) {
    const imgAspect = bgImg.width / bgImg.height;
    const canvasAspect = w / h;
    let sx, sy, sw, sh;
    if (imgAspect > canvasAspect) {
      sh = bgImg.height;
      sw = bgImg.height * canvasAspect;
      sx = (bgImg.width - sw) / 2;
      sy = 0;
    } else {
      sw = bgImg.width;
      sh = bgImg.width / canvasAspect;
      sx = 0;
      sy = (bgImg.height - sh) / 2;
    }
    ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, w, h);

    const paperX = w * 0.085;
    const paperY = h * 0.31;
    const paperW = w * 0.83;
    const paperH = h * 0.44;

    const textPaddingX = paperW * 0.08;
    const textPaddingY = paperH * 0.12;
    const maxTextW = paperW - textPaddingX * 2;

    ctx.save();
    ctx.font = `600 ${fontSize}px 'Courier New', Courier, monospace`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lineHeight = fontSize * 1.55;
    const lines = wrapText(ctx, menfes.message, maxTextW);

    const totalTextH = lines.length * lineHeight;
    const textStartY = paperY + (paperH - totalTextH) / 2 - textPaddingY * 1.4;
    const textStartX = paperX + textPaddingX;

    lines.forEach((line, i) => {
      ctx.fillText(line, textStartX, textStartY + i * lineHeight);
    });
    ctx.restore();

    const displayName = menfes.senderName?.trim() || 'Seseorang';
    ctx.save();
    const tx = w * (posX / 100);
    const ty = h * (posY / 100);
    ctx.translate(tx, ty);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.font = `bold ${fontSizeName}px 'Courier New', Courier, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(displayName, 0, 0);
    ctx.restore();
  }

  function drawFallback(ctx, w, h) {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${w * 0.055}px 'Courier New', Courier, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('MENFESS HARKAT NEKATT', w / 2, h * 0.12);

    ctx.font = `${w * 0.025}px 'Courier New', Courier, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('The pen is mightier than the sword.', w / 2, h * 0.17);

    const paperX = w * 0.085;
    const paperY = h * 0.28;
    const paperW = w * 0.83;
    const paperH = h * 0.46;

    ctx.fillStyle = '#f0ebe3';
    ctx.beginPath();
    ctx.roundRect(paperX, paperY, paperW, paperH, 8);
    ctx.fill();

    const textPaddingX = paperW * 0.08;
    const maxTextW = paperW - textPaddingX * 2;
    ctx.save();
    ctx.font = `600 ${fontSize}px 'Courier New', Courier, monospace`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lineHeight = fontSize * 1.55;
    const lines = wrapText(ctx, menfes.message, maxTextW);
    const totalTextH = lines.length * lineHeight;
    const textStartY = paperY + (paperH - totalTextH) / 2;
    const textStartX = paperX + textPaddingX;

    lines.forEach((line, i) => {
      ctx.fillText(line, textStartX, textStartY + i * lineHeight);
    });
    ctx.restore();

    const displayName = menfes.senderName?.trim() || 'Seseorang';
    ctx.font = `bold ${fontSize * 0.45}px 'Courier New', Courier, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText(displayName, w * 0.89, h * 0.89);
  }

  function wrapText(ctx, text, maxWidth) {
    const paragraphs = text.split('\n');
    const allLines = [];

    for (const para of paragraphs) {
      const words = para.split(' ');
      let current = '';

      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
          allLines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) allLines.push(current);
    }

    return allLines.slice(0, 7);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      renderCanvas();
      await new Promise((r) => setTimeout(r, 300));

      const canvas = canvasRef.current;
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menfes-harkatnekatt-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Gambar berhasil didownload! 🎉');
    } catch (err) {
      toast.error('Gagal download gambar.');
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  const { w, h } = CANVAS_SIZE[ratio];

  // Preview width responsif: lebih kecil di HP
  const previewW = typeof window !== 'undefined' && window.innerWidth < 400 ? 260 : 320;
  const previewH = Math.round((h / w) * previewW);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Sheet dari bawah di mobile, dialog tengah di tablet/desktop */}
      <div className="bg-ink-700 border border-ink-600 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] sm:max-h-[95vh] overflow-y-auto overscroll-contain">
        {/* Handle bar — mobile drag hint */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="w-10 h-1 bg-ink-500 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-ink-600">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="font-bold text-sm text-parchment-200 font-mono tracking-widest uppercase">Export ke IG</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-parchment-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ink-600 transition-colors touch-manipulation"
            aria-label="Tutup"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Status background */}
          {bgStatus === 'error' && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3 text-xs text-amber-400 font-mono">
              ⚠️ Background template tidak ditemukan — menggunakan fallback.
            </div>
          )}
          {bgStatus === 'ok' && (
            <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-3 text-xs text-emerald-400 font-mono">
              ✅ Template background dimuat.
            </div>
          )}

          {/* Preview canvas */}
          <div className="flex justify-center bg-ink-800 border border-ink-600 rounded-xl p-3">
            <canvas
              ref={canvasRef}
              style={{
                width: previewW,
                height: previewH,
                borderRadius: 6,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                maxWidth: '100%',
              }}
            />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Rasio */}
            <div>
              <label className="block text-xs font-mono font-semibold text-ink-400 mb-2 tracking-widest uppercase">Rasio IG</label>
              <div className="flex gap-2">
                {['1:1', '4:5'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRatio(r)}
                    className={`flex-1 py-2.5 sm:py-2 text-sm font-mono font-semibold rounded-lg border transition-all touch-manipulation ${
                      ratio === r
                        ? 'bg-brand-700 text-parchment-100 border-brand-700'
                        : 'bg-ink-800 text-ink-400 border-ink-600 hover:border-ink-500 hover:text-parchment-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-500 mt-1 font-mono">
                {ratio === '1:1' ? '1080 × 1080' : '1080 × 1350'}
              </p>
            </div>

            {/* Font size pesan */}
            <div>
              <label className="block text-xs font-mono font-semibold text-ink-400 mb-2 tracking-widest uppercase">
                Teks: {fontSize}px
              </label>
              <input
                type="range" min={18} max={54} step={2} value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-brand-600 mt-1 h-5"
              />
              <div className="flex justify-between text-xs text-ink-600 mt-0.5 font-mono">
                <span>Kecil</span>
                <span>Besar</span>
              </div>
            </div>
          </div>

          {/* Font size nama */}
          <div>
            <label className="block text-xs font-mono font-semibold text-ink-400 mb-2 tracking-widest uppercase">
              Nama / Seseorang: {fontSizeName}px
            </label>
            <input
              type="range" min={14} max={44} step={2} value={fontSizeName}
              onChange={(e) => setFontSizeName(Number(e.target.value))}
              className="w-full accent-brand-600 h-5"
            />
            <div className="flex justify-between text-xs text-ink-600 mt-0.5 font-mono">
              <span>Kecil</span>
              <span>Besar</span>
            </div>
          </div>

          {/* Pesan preview */}
          <div className="bg-ink-800 border border-ink-600 rounded-xl p-3">
            <p className="text-[10px] font-mono font-bold text-ink-500 mb-1.5 tracking-widest uppercase">Isi Pesan</p>
            <p className="text-sm text-parchment-300 line-clamp-3 font-mono leading-relaxed break-words">
              <span className="text-brand-600">"</span>{menfes.message}<span className="text-brand-600">"</span>
            </p>
          </div>

          {/* Slider posisi */}
          <div className="bg-ink-800 border border-ink-600 rounded-xl p-3 space-y-3">
            <p className="text-[10px] font-mono font-bold text-ink-500 tracking-widest uppercase">Posisi "Seseorang"</p>
            <div>
              <div className="flex justify-between text-xs font-mono text-ink-400 mb-1">
                <span>Kiri ← X → Kanan</span>
                <span className="text-parchment-400">{posX}%</span>
              </div>
              <input type="range" min={50} max={95} step={0.5} value={posX}
                onChange={(e) => setPosX(Number(e.target.value))}
                className="w-full accent-brand-600 h-5" />
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono text-ink-400 mb-1">
                <span>Atas ↑ Y ↓ Bawah</span>
                <span className="text-parchment-400">{posY}%</span>
              </div>
              <input type="range" min={70} max={95} step={0.5} value={posY}
                onChange={(e) => setPosY(Number(e.target.value))}
                className="w-full accent-brand-600 h-5" />
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono text-ink-400 mb-1">
                <span>Rotasi ↺</span>
                <span className="text-parchment-400">{rotate}°</span>
              </div>
              <input type="range" min={-20} max={0} step={0.5} value={rotate}
                onChange={(e) => setRotate(Number(e.target.value))}
                className="w-full accent-brand-600 h-5" />
            </div>
            <p className="text-[10px] text-ink-600 font-mono">Geser X, Y, dan rotasi sampai pas di atas garis.</p>
          </div>

          {/* Aksi */}
          <div className="flex gap-3 pt-1 pb-safe">
            <button
              onClick={onClose}
              className="btn-secondary flex-1 font-mono text-sm py-3.5 sm:py-3 touch-manipulation"
            >
              Batal
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-primary flex-1 font-mono text-sm flex items-center justify-center gap-2 py-3.5 sm:py-3 touch-manipulation"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download JPG
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
