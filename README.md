# Simple Wedding Planner PWA

HTML + Vanilla JS + Tailwind (CDN) + Supabase, deploy otomatis lewat GitHub Pages & Actions.

## Setup satu kali (±5 menit)

**1. Supabase**
- Buat project baru di supabase.com.
- Authentication → Sign In / Providers → aktifkan **Allow anonymous sign-ins**.
- Catat: Project URL, anon public key (Settings → API), Project ID (Settings → General), Database password, dan buat Access Token di supabase.com/dashboard/account/tokens.

**2. GitHub**
- Buat repository, push seluruh isi folder ini ke branch `main`.
- Settings → Pages → Source: **GitHub Actions**.
- Settings → Secrets and variables → Actions → tambahkan 5 secret:

| Secret | Isi |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Access token akun Supabase |
| `SUPABASE_DB_PASSWORD` | Password database project |
| `SUPABASE_PROJECT_ID` | Project ID (ref) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon public key |

**3. Selesai.** Setiap push ke `main` akan menjalankan migrasi SQL baru lalu mendeploy situs. Buka `https://<username>.github.io/<repo>/`, lalu "Add to Home Screen".

## Mengubah database
Tambahkan file `.sql` baru di `supabase/migrations/` (format nama `YYYYMMDDHHMMSS_deskripsi.sql`), commit, push.

## Catatan keamanan
Aplikasi memakai Anonymous Auth dengan satu set data bersama (sesuai skema PRD, tanpa `user_id`). Siapa pun yang memiliki URL dan anon key dapat masuk anonim dan membaca/mengubah data. Cocok untuk penggunaan pribadi; jika URL disebarkan luas, tambahkan kolom `user_id` atau login email.

## Fitur tambahan
- **Vendor**: daftar vendor (kategori, kontak, nilai kontrak, catatan) dengan catatan pembayaran DP / cicilan / pelunasan, tenggat bayar, dan status dibayar.
- **Kalender**: tugas dan tenggat pembayaran per tanggal, plus penanda Hari H.
- Migrasi: `supabase/migrations/20261108000000_vendors.sql` (dijalankan otomatis oleh GitHub Actions).

## Mode demo & sinkronisasi
- Ikon pengaturan → **Isi data contoh** / **Hapus semua data**.
- Semua menu memakai satu sumber data: tanda selesai tugas, pembayaran vendor, dan budget langsung memperbarui kalender, tab vendor, dan saldo budget. Data dimuat ulang otomatis saat aplikasi dibuka kembali, saat online, dan lewat realtime antar perangkat.
- Pembayaran vendor yang sudah dibayar otomatis dihitung di "Total terpakai" tab Budget. Jangan mencatatnya lagi sebagai item budget.
