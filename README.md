# Menfes Harkat Nekat 📢

Web menfes kampus anonim dengan fitur export ke Instagram feed.

## Stack
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Express.js + Prisma (SQLite)
- **Auth**: JWT + bcrypt

---

## Setup & Jalankan

### 1. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

Backend berjalan di: `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di: `http://localhost:5173`

---

## Template Background

Taruh file JPG background kamu di:
```
frontend/public/template/background.jpg
```

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
