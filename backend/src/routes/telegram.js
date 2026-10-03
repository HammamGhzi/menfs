const express = require('express');
const crypto = require('crypto');
const { getBot, sendMessage } = require('../services/telegramBot');
const prisma = require('../lib/prisma');

const router = express.Router();
const rateLimit = require('express-rate-limit');

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

/**
 * Verifikasi header X-Telegram-Bot-Api-Secret-Token.
 *
 * Tanpa cek ini, siapa pun yang tahu URL webhook bisa mengirim update palsu
 * dan menyuruh bot menyetujui/menolak menfes, atau menulis pesan ke chat
 * Telegram mana pun.
 *
 * Kalau TELEGRAM_WEBHOOK_SECRET belum diisi, endpoint ditutup total
 * (fail-closed) — lebih baik webhook mati daripada terbuka untuk semua orang.
 */
function requireWebhookSecret(req, res, next) {
  if (!WEBHOOK_SECRET) {
    return res.status(503).json({
      error: 'Webhook dinonaktifkan: TELEGRAM_WEBHOOK_SECRET belum diisi.',
    });
  }

  const provided = req.get('X-Telegram-Bot-Api-Secret-Token') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(WEBHOOK_SECRET);

  // Bandingkan dengan panjang tetap agar tahan timing attack
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Secret token tidak valid.' });
  }

  next();
}

// Batasi frekuensi supaya webhook tidak bisa dipakai sebagai amplifier
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Terlalu banyak request ke webhook.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Daftarkan handler callback_query dari inline button Telegram.
 * Dipanggil sekali saat server start dari index.js.
 *
 * Flow:
 *   Admin tekan tombol ✅ Approve / ❌ Reject di Telegram
 *   → bot terima callback_data: "approve_<id>" atau "reject_<id>"
 *   → update status di DB
 *   → bot balas dengan konfirmasi
 */
function registerTelegramCallbacks() {
  const bot = getBot();
  if (!bot) return;

  bot.on('callback_query', async (query) => {
    const { data, message, id: callbackId } = query;

    // Jawab callback supaya loading indicator di Telegram hilang
    await bot.answerCallbackQuery(callbackId).catch(() => {});

    if (!data) return;

    const [action, menfesId] = data.split('_');

    if (!['approve', 'reject'].includes(action) || !menfesId) return;

    // Hanya admin chat yang boleh memicu approve/reject. Bot tidak pernah
    // mengirim notifikasi ke chat lain, jadi callback dari chat mana pun
    // selain ini berarti update palsu.
    if (ADMIN_CHAT_ID && String(message?.chat?.id) !== String(ADMIN_CHAT_ID)) {
      console.warn(
        `⚠️  Callback dari chat tidak dikenal (${message?.chat?.id}), diabaikan.`
      );
      return;
    }

    try {
      // Cek apakah menfes masih PENDING
      const existing = await prisma.menfes.findUnique({
        where: { id: menfesId },
        select: { id: true, status: true, message: true },
      });

      if (!existing) {
        await bot.editMessageText(
          `${message.text}\n\n⚠️ _Menfess tidak ditemukan._`,
          { chat_id: message.chat.id, message_id: message.message_id, parse_mode: 'Markdown' }
        ).catch(() => {});
        return;
      }

      if (existing.status !== 'PENDING') {
        const statusLabel = existing.status === 'APPROVED' ? '✅ sudah diapprove' : '❌ sudah direject';
        await bot.editMessageText(
          `${message.text}\n\n⚠️ _Menfess ini ${statusLabel} sebelumnya._`,
          { chat_id: message.chat.id, message_id: message.message_id, parse_mode: 'Markdown' }
        ).catch(() => {});
        return;
      }

      // Update status di database
      const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
      await prisma.menfes.update({
        where: { id: menfesId },
        data: {
          status: newStatus,
          approvedAt: newStatus === 'APPROVED' ? new Date() : null,
        },
      });

      // Edit pesan asli di Telegram — hapus tombol, tambah status
      const statusText = action === 'approve'
        ? '✅ *Menfess DIAPPROVE* — sudah tampil di web!'
        : '❌ *Menfess DIREJECT* — tidak akan ditampilkan.';

      await bot.editMessageText(
        `${message.text}\n\n${statusText}`,
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [] }, // hapus tombol
        }
      ).catch(() => {});

    } catch (err) {
      console.error('Telegram callback error:', err.message);
      await sendMessage(`⚠️ Error saat ${action} menfess \`${menfesId}\`: ${err.message}`);
    }
  });

  console.log('🤖 Telegram callback handler terdaftar');
}

/**
 * POST /api/telegram/webhook
 * Endpoint opsional — tidak dipakai di polling mode,
 * tapi disiapkan untuk production webhook jika diperlukan.
 *
 * WAJIB menyertakan header X-Telegram-Bot-Api-Secret-Token yang cocok
 * dengan TELEGRAM_WEBHOOK_SECRET (dikirim oleh Telegram, bukan publik).
 */
router.post('/webhook', requireWebhookSecret, webhookLimiter, (req, res) => {
  const bot = getBot();
  if (bot) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

module.exports = { router, registerTelegramCallbacks };
