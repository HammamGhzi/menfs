# Menfes Harkat Nekatt 📢

Web menfes kampus anonim dengan fitur export ke Instagram feed.

## Stack
- **Frontend**: React + Vite + TailwindCSS → deploy ke **Vercel**
- **Backend**: Express.js + Prisma (PostgreSQL) → deploy ke **Koyeb**
- **Database**: PostgreSQL via **Supabase**
- **Auth**: JWT + bcrypt

---

## Setup Lokal

### 1. Backend

```bash
cd backend
npm install
# Copy env dan isi nilainya
cp .env.example .env

# Jalankan migrasi DB
npx prisma migrate dev --name init

# Seed admin awal
node prisma/seed.js

npm run dev
```

Backend berjalan di: `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
npm install
# Copy env dan isi VITE_API_URL (kosongkan untuk dev, pakai proxy Vite)
cp .env.example .env

npm run dev
```

Frontend berjalan di: `http://localhost:5173`

---

## Deploy ke Production

Stack: **Vercel (FE) + Koyeb (BE) + Supabase (DB)**

---

### Langkah 1 — Setup Supabase (Database)

1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Pilih region terdekat (misal: **Southeast Asia**)
3. Setelah project siap, buka **Project Settings → Database**
4. Scroll ke **Connection String** → pilih tab **URI**
5. Salin dua URL berikut:
   - **Transaction mode** (port `6543`) → untuk `DATABASE_URL`
   - **Session mode** (port `5432`) → untuk `DIRECT_URL`

---

### Langkah 2 — Jalankan Migrasi ke Supabase

Di lokal, isi `.env` backend dengan kedua URL Supabase, lalu:

```bash
cd backend
npx prisma migrate deploy
node prisma/seed.js
```

---

### Langkah 3 — Deploy Backend ke Koyeb

1. Buka [koyeb.com](https://koyeb.com) → **Create App**
2. Pilih **GitHub** → pilih repo kamu
3. Set konfigurasi:

   | Setting | Value |
   |---|---|
   | **Root directory** | `backend` |
   | **Build command** | `npm install` |
   | **Run command** | `npx prisma migrate deploy && node src/index.js` |
   | **Port** | `3001` |

4. Tambah **Environment Variables**:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(Transaction URL Supabase port 6543)* |
   | `DIRECT_URL` | *(Session URL Supabase port 5432)* |
   | `JWT_SECRET` | *(random string panjang — generate di bawah)* |
   | `JWT_EXPIRES_IN` | `24h` |
   | `FRONTEND_URL` | *(isi setelah deploy Vercel — bisa diupdate nanti)* |

   Generate JWT_SECRET:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

5. Klik **Deploy** → tunggu sampai status **Healthy**
6. Salin URL Koyeb kamu (contoh: `https://menfes-xxx.koyeb.app`)

---

### Langkah 4 — Deploy Frontend ke Vercel

1. Buka [vercel.com](https://vercel.com) → **New Project**
2. Import repo GitHub kamu
3. Set konfigurasi:

   | Setting | Value |
   |---|---|
   | **Root directory** | `frontend` |
   | **Framework** | Vite |
   | **Build command** | `npm run build` |
   | **Output dir** | `dist` |

4. Tambah **Environment Variables**:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | *(URL Koyeb dari langkah 3, tanpa trailing slash)* |

5. Klik **Deploy** → tunggu sampai selesai
6. Salin URL Vercel kamu (contoh: `https://menfes-xxx.vercel.app`)

---

### Langkah 5 — Update CORS di Koyeb

Setelah dapat URL Vercel, update env var `FRONTEND_URL` di Koyeb:

```
FRONTEND_URL=https://menfes-xxx.vercel.app
```

Koyeb akan auto-redeploy.

---

## Template Background Menfess

Folder `frontend/public/template/` menyediakan 3 pilihan template:
- **Classic Dark**: `frontend/public/template/background.jpg` (Vintage Ripped Paper 1:1 / 4:5)
- **Template 1**: `frontend/public/template/template 1.png` (Blue Sky Glassmorphism 4:5)
- **Template 2**: `frontend/public/template/template 2.png` (White Minimalist 4:5)

Pengirim dapat memilih template yang diinginkan di halaman utama, dan admin dapat mengekspor atau mengganti template secara instan di dashboard.

---

## Kredensial Default Admin

```
Username: admin
Password: admin123
```

⚠️ **Segera ganti password setelah login pertama!**

---

## Fitur

### Halaman Publik (`/`)
- Form kirim menfes anonim
- Feed menfes yang sudah disetujui

### Admin (`/admin`)
- Login dengan JWT (aman)
- Dashboard: lihat semua menfes + info pengirim
- Approve / Reject / Hapus menfes
- **Export ke IG** — render ke Canvas dengan background template, pilih rasio 1:1 atau 4:5, atur ukuran teks, download JPG siap upload

### Keamanan
- Password di-hash dengan bcrypt (cost factor 12)
- JWT dengan expiry 24 jam
- Rate limiting: 5x login per 15 menit, 5x submit menfes per 15 menit
- Helmet.js untuk HTTP security headers
- IP pengirim di-hash (tidak disimpan mentah)
- Info pengirim hanya bisa dilihat admin

---

## API Endpoints

### Public
```
GET  /api/menfes          — Ambil menfes approved (pagination)
POST /api/menfes          — Submit menfes baru
```

### Auth
```
POST /api/auth/login           — Login admin
GET  /api/auth/me              — Cek status login [JWT]
POST /api/auth/change-password — Ganti password [JWT]
```

### Admin (semua butuh JWT)
```
GET    /api/admin/stats              — Statistik
GET    /api/admin/menfes             — Semua menfes + filter status
PATCH  /api/admin/menfes/:id/approve — Approve
PATCH  /api/admin/menfes/:id/reject  — Reject
DELETE /api/admin/menfes/:id         — Hapus
```

### Health Check
```
GET /api/health — Status server
```
