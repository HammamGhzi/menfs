const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PYTHON_SCRIPT = path.join(__dirname, '../../scripts/ig_post.py');
const SESSION_FILE = path.join(__dirname, '../../.ig_session.json');
const TEMP_DIR = path.join(__dirname, '../../tmp');

class InstagramBotService {
  constructor() {
    this.isLoggedIn = false;
    this.lastPostTime = null;

    // Pastikan folder tmp ada
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  }

  /**
   * Cek apakah kredensial IG tersedia di environment variables
   */
  isConfigured() {
    return Boolean(process.env.IG_SESSIONID || (process.env.IG_USERNAME && process.env.IG_PASSWORD));
  }

  /**
   * Posting gambar buffer ke feed Instagram via Python instagrapi
   * @param {Object} params
   * @param {Buffer} params.imageBuffer - Buffer gambar JPEG
   * @param {string} params.caption - Caption postingan
   */
  async publishPhoto({ imageBuffer, caption }) {
    if (!Buffer.isBuffer(imageBuffer)) {
      throw new Error('Image harus berupa Buffer.');
    }

    if (!this.isConfigured()) {
      throw new Error('IG_SESSIONID atau IG_USERNAME/IG_PASSWORD belum diatur di file .env');
    }

    // Simpan buffer ke file tmp sementara
    const tmpFile = path.join(TEMP_DIR, `ig_post_${Date.now()}.jpg`);

    try {
      fs.writeFileSync(tmpFile, imageBuffer);

      const result = await this._runPythonScript(
        tmpFile,
        caption || '',
        process.env.IG_USERNAME || 'user',
        process.env.IG_PASSWORD || 'pass',
        SESSION_FILE
      );

      this.isLoggedIn = true;
      this.lastPostTime = new Date();

      console.log('🎉 Postingan berhasil diterbitkan di Instagram!', result.code);
      return result;
    } finally {
      // Hapus file temporary
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }

  /**
   * Jalankan Python script ig_post.py
   */
  _runPythonScript(imagePath, caption, username, password, sessionPath) {
    return new Promise((resolve, reject) => {
      const args = [PYTHON_SCRIPT, imagePath, caption, username, password, sessionPath];

      console.log(`📸 Mengunggah foto ke Instagram via instagrapi...`);

      execFile('python3', args, {
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, IG_SESSIONID: process.env.IG_SESSIONID || '' }
      }, (error, stdout, stderr) => {
        if (stderr) {
          console.warn('⚠️ Python stderr:', stderr);
        }

        let parsed;
        try {
          parsed = JSON.parse(stdout.trim());
        } catch (parseErr) {
          return reject(new Error(
            `Gagal memproses output dari script Python.\nstdout: ${stdout}\nstderr: ${stderr}\nerror: ${error?.message || ''}`
          ));
        }

        if (parsed.success) {
          resolve(parsed);
        } else {
          reject(new Error(parsed.error || 'Gagal posting ke Instagram.'));
        }
      });
    });
  }

  /**
   * Info status bot
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      username: process.env.IG_USERNAME ? `@${process.env.IG_USERNAME}` : null,
      isLoggedIn: this.isLoggedIn,
      lastPostTime: this.lastPostTime,
      method: 'instagrapi (Python)',
    };
  }
}

module.exports = new InstagramBotService();
