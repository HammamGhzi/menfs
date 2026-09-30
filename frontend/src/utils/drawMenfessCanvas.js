import { TEMPLATES } from '../config/templates';

export const CANVAS_SIZE = {
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
};

export function wrapText(ctx, text, maxWidth, maxLines = 10) {
  if (!text) return [];
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

  return allLines.slice(0, maxLines);
}

/**
 * Render template menfess ke HTML5 canvas dengan background gambar asli
 */
export function renderMenfessToCanvas(canvas, {
  template,
  ratio = null,
  message = '',
  senderName = '',
  isAnon = true,
  fontSize = null,
  fontSizeName = null,
  posX = null,
  posY = null,
  rotate = null,
  onStatusChange = null,
}) {
  if (!canvas || !template) return;

  const actualRatio = ratio || template.defaultRatio || '1:1';
  const { w, h } = CANVAS_SIZE[actualRatio] || CANVAS_SIZE['1:1'];
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  const actualFontSize = fontSize || template.defaultFontSize || 36;
  const actualFontSizeName = fontSizeName || template.defaultFontSizeName || 28;
  const actualPosX = posX !== null && posX !== undefined ? posX : template.defaultSender.posX;
  const actualPosY = posY !== null && posY !== undefined ? posY : template.defaultSender.posY;
  const actualRotate = rotate !== null && rotate !== undefined ? rotate : template.defaultSender.rotate;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = template.src;

  img.onload = async () => {
    if (onStatusChange) onStatusChange('ok');

    // Pastikan Google Fonts (Poppins, Plus Jakarta Sans, dll) sudah selesai termuat di browser
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // fallback jika browser tidak support font loading API
      }
    }

    // 1. Gambar background gambar asli dengan aspect-fill crop
    const imgAspect = img.width / img.height;
    const canvasAspect = w / h;
    let sx, sy, sw, sh;
    if (imgAspect > canvasAspect) {
      sh = img.height;
      sw = img.height * canvasAspect;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = img.width / canvasAspect;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

    // 2. Area teks pesan
    const bounds = template.bounds[actualRatio] || template.bounds['1:1'];
    const paperX = w * bounds.x;
    const paperY = h * bounds.y;
    const paperW = w * bounds.w;
    const paperH = h * bounds.h;

    const padX = paperW * (bounds.padX || 0.06);
    const padY = paperH * (bounds.padY || 0.06);
    const maxTextW = paperW - padX * 2;

    const displayMsg = message && message.trim()
      ? message.trim()
      : 'Tulis pesan menfess kamu di sini...';

    // 3. Tulis Pesan
    ctx.save();
    ctx.font = `${template.fontWeight || '600'} ${actualFontSize}px ${template.fontFamily}`;
    ctx.fillStyle = template.textColor || '#1a1a1a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    if (template.textShadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
    }

    const lineHeight = actualFontSize * (template.lineHeightMultiplier || 1.55);
    const lines = wrapText(ctx, displayMsg, maxTextW, template.maxLines || 10);

    const totalTextH = lines.length * lineHeight;
    const textStartY = paperY + Math.max(0, (paperH - totalTextH) / 2) - padY * 0.4;
    const textStartX = paperX + padX;

    lines.forEach((line, i) => {
      ctx.fillText(line, textStartX, textStartY + i * lineHeight);
    });
    ctx.restore();

    // 4. Nama Pengirim
    const hasCustomName = !isAnon && Boolean(senderName && senderName.trim());
    const rawName = hasCustomName ? senderName.trim() : 'Seseorang';
    const displayName = template.uppercaseSender ? rawName.toUpperCase() : rawName;
    const senderCfg = template.defaultSender;

    // Jika template memiliki teks anon bawaan dan ada nama kustom, tutupi dengan background yang cocok
    if (hasCustomName && template.hasBakedAnon && template.bakedCover) {
      ctx.save();
      const cov = template.bakedCover;
      ctx.fillStyle = cov.fill;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(w * cov.x, h * cov.y, w * cov.w, h * cov.h, 6);
        ctx.fill();
      } else {
        ctx.fillRect(w * cov.x, h * cov.y, w * cov.w, h * cov.h);
      }
      ctx.restore();
    }

    // Gambar nama jika bukan teks anon bawaan atau ada nama custom
    if (hasCustomName || !template.hasBakedAnon) {
      ctx.save();
      const tx = w * (actualPosX / 100);
      const ty = h * (actualPosY / 100);
      ctx.translate(tx, ty);
      ctx.rotate((actualRotate * Math.PI) / 180);
      ctx.font = `${senderCfg.fontWeight || 'bold'} ${actualFontSizeName}px ${senderCfg.fontFamily || template.fontFamily}`;
      ctx.fillStyle = senderCfg.color || '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      if (template.textShadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 1;
      }

      const prefix = hasCustomName ? (senderCfg.prefix || '') : '';
      ctx.fillText(`${prefix}${displayName}`, 0, 0);
      ctx.restore();
    }
  };

  img.onerror = () => {
    if (template.fallbackSrc && img.src !== template.fallbackSrc) {
      img.src = template.fallbackSrc;
      return;
    }
    if (onStatusChange) onStatusChange('error');
    drawFallback(ctx, w, h, template, message, senderName, isAnon, actualFontSize, actualFontSizeName);
  };
}

function drawFallback(ctx, w, h, template, message, senderName, isAnon, fontSize, fontSizeName) {
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${w * 0.05}px 'Courier New', Courier, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('MENFESS HARKAT NEKATT', w / 2, h * 0.12);

  ctx.font = `${w * 0.025}px 'Courier New', Courier, monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(template.name.toUpperCase(), w / 2, h * 0.16);

  const paperX = w * 0.085;
  const paperY = h * 0.24;
  const paperW = w * 0.83;
  const paperH = h * 0.54;

  ctx.fillStyle = template.id === 'template1' ? '#1e3a8a' : '#f0ebe3';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(paperX, paperY, paperW, paperH, 12);
  } else {
    ctx.rect(paperX, paperY, paperW, paperH);
  }
  ctx.fill();

  const textPaddingX = paperW * 0.08;
  const maxTextW = paperW - textPaddingX * 2;
  ctx.save();
  ctx.font = `600 ${fontSize}px ${template.fontFamily}`;
  ctx.fillStyle = template.id === 'template1' ? '#ffffff' : '#1a1a1a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const lineHeight = fontSize * 1.55;
  const lines = wrapText(ctx, message || 'Tulis pesan menfess kamu...', maxTextW, 8);
  const totalTextH = lines.length * lineHeight;
  const textStartY = paperY + (paperH - totalTextH) / 2;
  const textStartX = paperX + textPaddingX;

  lines.forEach((line, i) => {
    ctx.fillText(line, textStartX, textStartY + i * lineHeight);
  });
  ctx.restore();

  const displayName = !isAnon && senderName?.trim() ? senderName.trim() : 'Seseorang';
  ctx.font = `bold ${fontSizeName}px ${template.fontFamily}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(displayName, w * 0.89, h * 0.89);
}
