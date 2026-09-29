const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getBot, sendMessage } = require('../services/telegramBot');

const router = express.Router();
const prisma = new PrismaClient();

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
 */
router.post('/webhook', (req, res) => {
  const bot = getBot();
  if (bot) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

module.exports = { router, registerTelegramCallbacks };
