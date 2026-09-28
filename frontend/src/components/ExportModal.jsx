import { useRef, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * ExportModal — Render menfes ke canvas dengan template background Harkat Nekatt
 *
 * Template layout (background.jpg):
 *   - Background hitam tekstur kertas robek
 *   - Area kertas putih di tengah-bawah (~30%–75% tinggi, ~8%–92% lebar)
 *   - Teks menfes ditulis di dalam area kertas putih tersebut
 *   - "DARI: ___" di pojok kanan bawah
 */
export default function ExportModal({ menfes, onClose }) {
  const canvasRef = useRef(null);
  const [ratio, setRatio] = useState('1:1');
  const [fontSize, setFontSize] = useState(36);
  const [downloading, setDownloading] = useState(false);
  const [bgStatus, setBgStatus] = useState('loading'); // loading | ok | error

  const CANVAS_SIZE = {
    '1:1': { w: 1080, h: 1080 },
    '4:5': { w: 1080, h: 1350 },
  };

  useEffect(() => {
    renderCanvas();
  }, [ratio, fontSize, menfes]);

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

  /**
   * Render dengan template background asli
   * Area kertas putih pada template 1:1 (1080x1080):
   *   - X: ~8% → ~92%  (86px → 993px)
   *   - Y: ~30% → ~75%  (324px → 810px)
   * Untuk 4:5, area digeser sedikit lebih ke tengah karena canvas lebih tinggi
   */
  function drawWithBackground(ctx, w, h, bgImg) {
    // ── 1. Draw background cover ────────────────────────────────────────
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

    // ── 2. Tentukan area kertas putih ────────────────────────────────────
    // Koordinat relatif sesuai posisi di template aslinya
    const paperX = w * 0.085;
    const paperY = h * 0.31;
    const paperW = w * 0.83;
    const paperH = h * 0.44;

    // ── 3. Tulis teks menfes di dalam area kertas ─────────────────────────
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

    // Vertically center teks di dalam area kertas
    const totalTextH = lines.length * lineHeight;
    const textStartY = paperY + (paperH - totalTextH) / 2 + textPaddingY * 0.3;
    const textStartX = paperX + textPaddingX;

    lines.forEach((line, i) => {
      ctx.fillText(line, textStartX, textStartY + i * lineHeight);
    });
    ctx.restore();

    // ── 4. Teks "DARI: ___" di pojok kanan bawah ────────────────────────
    // (Sudah ada di template, tapi tambahkan nilai "Anonim" jika diperlukan)
    ctx.save();
    ctx.font = `bold ${fontSize * 0.45}px 'Courier New', Courier, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('ANONIM', w * 0.89, h * 0.905);
    ctx.restore();
  }

  /**
   * Fallback render jika background.jpg tidak ditemukan
   */
  function drawFallback(ctx, w, h) {
    // Background hitam
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${w * 0.055}px 'Courier New', Courier, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('MENFESS HARKAT NEKATT', w / 2, h * 0.12);

    ctx.font = `${w * 0.025}px 'Courier New', Courier, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('The pen is mightier than the sword.', w / 2, h * 0.17);

    // Kotak kertas putih (simulasi)
    const paperX = w * 0.085;
    const paperY = h * 0.28;
    const paperW = w * 0.83;
    const paperH = h * 0.46;

    ctx.fillStyle = '#f0ebe3';
    ctx.beginPath();
    ctx.roundRect(paperX, paperY, paperW, paperH, 8);
    ctx.fill();

    // Teks menfes
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

    // DARI: ANONIM
    ctx.font = `bold ${fontSize * 0.45}px 'Courier New', Courier, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText('DARI: ANONIM', w * 0.89, h * 0.89);
  }

  /**
   * Word wrap — potong teks jadi baris-baris yang muat dalam maxWidth
   */
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

    // Maks 7 baris supaya muat di kertas
    return allLines.slice(0, 7);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      // Re-render dulu dengan resolusi penuh sebelum download
      renderCanvas();
      // Tunggu sebentar agar canvas selesai render
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
  const previewW = 340;
  const previewH = Math.round((h / w) * previewW);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-bold text-lg text-white font-mono tracking-wide">📸 EXPORT KE IG</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status background */}
          {bgStatus === 'error' && (
            <div className="bg-amber-900/40 border border-amber-700 rounded-xl p-3 text-xs text-amber-400 font-mono">
              ⚠️ Background template tidak ditemukan — menggunakan fallback.
            </div>
          )}
          {bgStatus === 'ok' && (
            <div className="bg-emerald-900/40 border border-emerald-700 rounded-xl p-3 text-xs text-emerald-400 font-mono">
              ✅ Template background Harkat Nekatt dimuat.
            </div>
          )}

          {/* Preview canvas */}
          <div className="flex justify-center bg-zinc-800 rounded-xl p-3">
            <canvas
              ref={canvasRef}
              style={{
                width: previewW,
                height: previewH,
                borderRadius: 8,
                boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
              }}
            />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-4">
            {/* Rasio */}
            <div>
              <label className="block text-xs font-mono font-semibold text-zinc-400 mb-1.5 tracking-wider">RASIO IG</label>
              <div className="flex gap-2">
                {['1:1', '4:5'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRatio(r)}
                    className={`flex-1 py-2 text-sm font-mono font-semibold rounded-xl border transition-all ${
                      ratio === r
                        ? 'bg-brand-700 text-white border-brand-700'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-600 mt-1 font-mono">
                {ratio === '1:1' ? '1080 × 1080 px' : '1080 × 1350 px'}
              </p>
            </div>

            {/* Font size */}
            <div>
              <label className="block text-xs font-mono font-semibold text-zinc-400 mb-1.5 tracking-wider">
                UKURAN TEKS: {fontSize}px
              </label>
              <input
                type="range"
                min={22}
                max={54}
                step={2}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-zinc-600 mt-0.5 font-mono">
                <span>KECIL</span>
                <span>BESAR</span>
              </div>
            </div>
          </div>

          {/* Pesan preview */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3">
            <p className="text-xs font-mono font-semibold text-zinc-500 mb-1">ISI PESAN:</p>
            <p className="text-sm text-zinc-300 line-clamp-3 font-mono">{menfes.message}</p>
          </div>

          {/* Catatan */}
          <p className="text-xs text-zinc-600 text-center font-mono">
            Teks akan muncul di area kertas putih pada template.
          </p>

          {/* Aksi */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 font-mono">
              BATAL
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-primary flex-1 font-mono"
            >
              {downloading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  DOWNLOADING...
                </span>
              ) : '⬇️ DOWNLOAD JPG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
