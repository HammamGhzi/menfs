import { useRef, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { TEMPLATES, getTemplateById, parseTemplateFromMenfes } from '../config/templates';
import { renderMenfessToCanvas, CANVAS_SIZE } from '../utils/drawMenfessCanvas';

export default function ExportModal({ menfes, onClose }) {
  const canvasRef = useRef(null);

  // Deteksi template awal dari data menfess
  const initialTemplateId = parseTemplateFromMenfes(menfes);
  const initialTemplate = getTemplateById(initialTemplateId);

  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId);
  const currentTemplate = getTemplateById(selectedTemplateId);

  const [ratio, setRatio] = useState(currentTemplate.defaultRatio || '1:1');
  const [fontSize, setFontSize] = useState(currentTemplate.defaultFontSize || 36);
  const [fontSizeName, setFontSizeName] = useState(currentTemplate.defaultFontSizeName || 28);
  const [downloading, setDownloading] = useState(false);
  const [bgStatus, setBgStatus] = useState('loading');
  const [posX, setPosX] = useState(currentTemplate.defaultSender.posX);
  const [posY, setPosY] = useState(currentTemplate.defaultSender.posY);
  const [rotate, setRotate] = useState(currentTemplate.defaultSender.rotate);

  // Switch template dan terapkan preset default template tersebut
  function handleSelectTemplate(tmplId) {
    const tmpl = getTemplateById(tmplId);
    setSelectedTemplateId(tmplId);
    setRatio(tmpl.defaultRatio || '1:1');
    setFontSize(tmpl.defaultFontSize);
    setFontSizeName(tmpl.defaultFontSizeName);
    setPosX(tmpl.defaultSender.posX);
    setPosY(tmpl.defaultSender.posY);
    setRotate(tmpl.defaultSender.rotate);
  }

  // Reset koordinat slider ke default template saat ini
  function handleResetPositions() {
    setPosX(currentTemplate.defaultSender.posX);
    setPosY(currentTemplate.defaultSender.posY);
    setRotate(currentTemplate.defaultSender.rotate);
    setFontSize(currentTemplate.defaultFontSize);
    setFontSizeName(currentTemplate.defaultFontSizeName);
    toast.success('Posisi direset ke default template.');
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isMounted = true;

    const render = () => {
      if (!isMounted) return;
      renderMenfessToCanvas(canvas, {
        template: currentTemplate,
        ratio,
        message: menfes?.message || '',
        senderName: menfes?.senderName || '',
        isAnon: !menfes?.senderName,
        fontSize,
        fontSizeName,
        posX,
        posY,
        rotate,
        onStatusChange: setBgStatus,
      });
    };

    render();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (isMounted) render();
      });
    }

    return () => {
      isMounted = false;
    };
  }, [selectedTemplateId, ratio, fontSize, fontSizeName, menfes, posX, posY, rotate]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const canvas = canvasRef.current;
      renderMenfessToCanvas(canvas, {
        template: currentTemplate,
        ratio,
        message: menfes?.message || '',
        senderName: menfes?.senderName || '',
        isAnon: !menfes?.senderName,
        fontSize,
        fontSizeName,
        posX,
        posY,
        rotate,
      });
      await new Promise((r) => setTimeout(r, 300));

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menfes-${currentTemplate.id}-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Gambar template ${currentTemplate.name} didownload! 🎉`);
    } catch (err) {
      toast.error('Gagal download gambar.');
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  const { w, h } = CANVAS_SIZE[ratio] || CANVAS_SIZE['1:1'];
  const previewW = typeof window !== 'undefined' && window.innerWidth < 400 ? 260 : 320;
  const previewH = Math.round((h / w) * previewW);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-ink-700 border border-ink-600 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[95vh] overflow-y-auto overscroll-contain">
        {/* Handle bar mobile */}
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
          {/* Pemilih Template */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono font-semibold text-parchment-300 tracking-wider uppercase flex items-center gap-1.5">
                <span>🎨</span> Pilih Template Background:
              </label>
              <span className="text-[11px] font-mono text-brand-400 bg-brand-950/60 border border-brand-800/60 px-2 py-0.5 rounded-md">
                {currentTemplate.name}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((tmpl) => {
                const isActive = tmpl.id === selectedTemplateId;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`relative p-2 rounded-xl border text-left transition-all duration-200 flex flex-col items-center gap-1.5 ${
                      isActive
                        ? 'bg-ink-800 border-brand-500 shadow-md ring-2 ring-brand-500/40'
                        : 'bg-ink-800/60 border-ink-600 hover:border-ink-500 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Thumbnail preview */}
                    <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-black/60 border border-ink-600 flex items-center justify-center">
                      <img
                        src={tmpl.thumbnail}
                        alt={tmpl.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          if (tmpl.fallbackSrc) e.target.src = tmpl.fallbackSrc;
                        }}
                      />
                    </div>
                    <div className="text-center w-full">
                      <p className={`text-xs font-mono font-bold truncate ${isActive ? 'text-parchment-100' : 'text-parchment-300'}`}>
                        {tmpl.badge}
                      </p>
                      <p className="text-[10px] text-parchment-400 font-mono truncate">{tmpl.tag}</p>
                    </div>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-brand-600 text-white rounded-full flex items-center justify-center text-[10px]">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status template background */}
          {bgStatus === 'error' && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3 text-xs text-amber-400 font-mono">
              ⚠️ File template tidak ditemukan — beralih ke fallback render.
            </div>
          )}

          {/* Preview canvas */}
          <div className="flex justify-center bg-ink-800 border border-ink-600 rounded-xl p-3">
            <canvas
              ref={canvasRef}
              style={{
                width: previewW,
                height: previewH,
                borderRadius: 8,
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                maxWidth: '100%',
              }}
            />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Rasio */}
            <div>
              <label className="block text-xs font-mono font-semibold text-parchment-400 mb-2 tracking-widest uppercase">
                Rasio IG
              </label>
              <div className="flex gap-2">
                {['1:1', '4:5'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className={`flex-1 py-2 text-sm font-mono font-semibold rounded-lg border transition-all touch-manipulation ${
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
                {ratio === '1:1' ? '1080 × 1080 (Square)' : '1080 × 1350 (Portrait)'}
              </p>
            </div>

            {/* Font size pesan */}
            <div>
              <label className="block text-xs font-mono font-semibold text-parchment-400 mb-2 tracking-widest uppercase">
                Teks Pesan: {fontSize}px
              </label>
              <input
                type="range"
                min={20}
                max={56}
                step={2}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-brand-600 mt-1 h-5"
              />
              <div className="flex justify-between text-xs text-ink-500 mt-0.5 font-mono">
                <span>Kecil</span>
                <span>Besar</span>
              </div>
            </div>
          </div>

          {/* Font size nama */}
          <div>
            <label className="block text-xs font-mono font-semibold text-parchment-400 mb-2 tracking-widest uppercase">
              Ukuran Nama Pengirim: {fontSizeName}px
            </label>
            <input
              type="range"
              min={14}
              max={44}
              step={2}
              value={fontSizeName}
              onChange={(e) => setFontSizeName(Number(e.target.value))}
              className="w-full accent-brand-600 h-5"
            />
            <div className="flex justify-between text-xs text-ink-500 mt-0.5 font-mono">
              <span>Kecil</span>
              <span>Besar</span>
            </div>
          </div>

          {/* Posisi Nama Pengirim */}
          <div className="bg-ink-800 border border-ink-600 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono font-bold text-parchment-400 tracking-widest uppercase">
                Posisi Pengirim ({menfes.senderName?.trim() || 'Anonim'})
              </p>
              <button
                type="button"
                onClick={handleResetPositions}
                className="text-[10px] text-brand-400 hover:text-brand-300 font-mono underline"
              >
                ↺ Reset Default
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-ink-400 mb-1">
                <span>Kiri ← X → Kanan</span>
                <span className="text-parchment-400">{posX}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={95}
                step={0.5}
                value={posX}
                onChange={(e) => setPosX(Number(e.target.value))}
                className="w-full accent-brand-600 h-5"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-ink-400 mb-1">
                <span>Atas ↑ Y ↓ Bawah</span>
                <span className="text-parchment-400">{posY}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={95}
                step={0.5}
                value={posY}
                onChange={(e) => setPosY(Number(e.target.value))}
                className="w-full accent-brand-600 h-5"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-ink-400 mb-1">
                <span>Rotasi Teks ↺</span>
                <span className="text-parchment-400">{rotate}°</span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                step={0.5}
                value={rotate}
                onChange={(e) => setRotate(Number(e.target.value))}
                className="w-full accent-brand-600 h-5"
              />
            </div>
          </div>

          {/* Pesan preview */}
          <div className="bg-ink-800 border border-ink-600 rounded-xl p-3">
            <p className="text-[10px] font-mono font-bold text-ink-500 mb-1.5 tracking-widest uppercase">Isi Pesan</p>
            <p className="text-sm text-parchment-300 line-clamp-3 font-mono leading-relaxed break-words">
              <span className="text-brand-600">"</span>{menfes.message}<span className="text-brand-600">"</span>
            </p>
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
