import { useRef, useEffect } from 'react';
import { renderMenfessToCanvas, CANVAS_SIZE } from '../utils/drawMenfessCanvas';

export default function TemplatePreview({
  template,
  message,
  senderName,
  isAnon,
  className = '',
}) {
  const canvasRef = useRef(null);
  const ratio = template.defaultRatio || '1:1';
  const { w, h } = CANVAS_SIZE[ratio] || CANVAS_SIZE['1:1'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isMounted = true;

    const render = () => {
      if (!isMounted) return;
      renderMenfessToCanvas(canvas, {
        template,
        ratio,
        message,
        senderName,
        isAnon,
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
  }, [template, ratio, message, senderName, isAnon]);

  // Rasio aspek untuk styling container canvas
  const aspectRatioClass = ratio === '4:5' ? 'aspect-[4/5]' : 'aspect-square';

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Kartu preview fisik */}
      <div className="w-full max-w-[320px] sm:max-w-[360px] bg-ink-900 border border-ink-600/80 rounded-2xl p-3 shadow-2xl space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold text-parchment-200 tracking-wider">
              {template.name}
            </span>
          </div>
          <span className="text-[10px] font-mono text-ink-200 bg-ink-800 border border-ink-600 px-2 py-0.5 rounded-full">
            {ratio === '4:5' ? '4:5 Portrait' : '1:1 Square'}
          </span>
        </div>

        {/* Canvas Display */}
        <div className={`w-full ${aspectRatioClass} rounded-xl overflow-hidden bg-black/60 shadow-inner border border-ink-700/60 flex items-center justify-center relative`}>
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain"
            style={{ display: 'block' }}
          />
        </div>

        <p className="text-[10px] text-center text-ink-200 font-mono">
          Pratinjau langsung sesuai hasil export Instagram
        </p>
      </div>
    </div>
  );
}
