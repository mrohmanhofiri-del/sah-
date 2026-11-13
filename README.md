# Simple Wedding Planner PWA

HTML + Vanilla JS + Tailwind (dibangun saat deploy) + Supabase, deploy otomatis lewat GitHub Pages & Actions.

## Setup satu kali (±5 menit)

**1. Supabase**
- Buat project baru di supabase.com.
- Authentication → Sign In / Providers: **matikan** *Allow anonymous sign-ins* dan *Allow new users to sign up* (lihat bagian Login).
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

## Login (data hanya untuk akun terdaftar)
Aplikasi meminta email dan kata sandi. Migrasi `20261113000000_budget_categories_auth.sql` membatasi seluruh tabel dan bucket foto bukti bayar hanya untuk akun email (sesi anonim ditolak oleh database).
1. Supabase → Authentication → Sign In / Providers: matikan **Allow anonymous sign-ins** dan **Allow new users to sign up**.
2. Authentication → Users → **Add user** → isi email dan kata sandi, centang *Auto Confirm User*. Buat satu akun per orang yang boleh mengakses (Ade, Rohman, keluarga).
3. Semua akun berbagi data yang sama; pemisahan Ade/Rohman tetap di level aplikasi. Keluar lewat Pengaturan > Akun (snapshot offline di perangkat ikut dihapus).
Selama pendaftaran publik dimatikan, hanya akun buatan Anda yang bisa masuk. Jika diaktifkan lagi, siapa pun bisa mendaftar dan membaca data.

## Fitur tambahan
- **Vendor**: daftar vendor (kategori, kontak, nilai kontrak, catatan) dengan catatan pembayaran DP / cicilan / pelunasan, tenggat bayar, dan status dibayar.
- **Kalender**: tugas dan tenggat pembayaran per tanggal, plus penanda Hari H.
- Migrasi: `supabase/migrations/20261108000000_vendors.sql` (dijalankan otomatis oleh GitHub Actions).

## Mode demo & sinkronisasi
- Ikon pengaturan → **Isi data contoh** / **Hapus semua data**.
- Semua menu memakai satu sumber data: tanda selesai tugas, pembayaran vendor, dan budget langsung memperbarui kalender, tab vendor, dan saldo budget. Data dimuat ulang otomatis saat aplikasi dibuka kembali, saat online, dan lewat realtime antar perangkat.
- Pembayaran vendor yang sudah dibayar otomatis dihitung di "Total terpakai" tab Budget. Jangan mencatatnya lagi sebagai item budget.

## Dua acara: Ade dan Rohman
- Saat aplikasi dibuka muncul pilihan **Ade** atau **Rohman**. Ikon panah di header untuk berpindah kapan saja.
- Menu sama, data terpisah: tugas, budget, vendor, pembayaran, hari H, dan plafon masing-masing punya kolom `profile`.
- Data yang sudah ada sebelumnya otomatis menjadi milik **Ade** (migrasi `20261110000000_profiles.sql`).
- Mode demo hanya memengaruhi acara yang sedang dibuka.
- Pemisahan ini di level aplikasi: siapa pun yang memegang URL dan anon key tetap bisa membaca keduanya lewat API.

## Beranda & template checklist
- **Beranda** (tab pertama, tampil otomatis saat acara dibuka): hitung mundur hari H, tugas terlambat dan jatuh tempo hari ini, tagihan vendor yang terlambat atau jatuh tempo 7 hari ke depan, persentase tugas selesai, dan sisa saldo. Tugas dan tagihan bisa langsung dicentang dari sini. Semua angka dihitung dari data yang sama dengan tab lain, tanpa migrasi database baru.
- **Template checklist**: tombol "Isi dari template checklist" di tab Tasklist (atau dari beranda saat belum ada tugas). Menambahkan 47 tugas standar dari H-12 bulan sampai H-1, tenggat dihitung dari tanggal hari H di Pengaturan. Pratinjau ditampilkan sebelum disimpan.
  - Tugas yang namanya sudah ada dilewati, jadi aman ditekan berulang.
  - Jika hari H kurang dari 12 bulan lagi, tugas yang tenggatnya sudah lewat bisa dijadwalkan ke hari ini atau dilewati.
  - Isi template ada di konstanta `TEMPLATE` di `index.html` dan mudah diubah.
- Kategori tugas bertambah: Dokumentasi, Hiburan, Lainnya.

## Pembaruan: data lebih aman, informatif, dan mudah dipakai

**Migrasi baru** (otomatis lewat workflow deploy, atau `supabase db push`):
- `20261111000000_task_details.sql`: kolom `notes`, `priority`, `assignee` pada tugas.
- `20261112000000_receipts.sql`: kolom `receipt_path`, bucket Storage privat `receipts` (maks. 5 MB per foto) beserta kebijakan aksesnya.

**Ketahanan data**
- *Snapshot offline*: setiap data berhasil dimuat, salinannya disimpan di perangkat. Bila koneksi gagal, data terakhir tampil dengan banner status, dan perubahan ditolak dengan pesan jelas. Tanpa snapshot, muncul pesan "Data belum bisa dimuat", bukan layar kosong.
- *Cadangan*: Pengaturan > Ekspor/Impor cadangan (JSON). Impor hanya menerima cadangan milik acara yang sama dan otomatis dikembalikan bila gagal di tengah jalan. Foto bukti tidak ikut dalam JSON, hanya rujukannya.
- *Zona berbahaya*: "Hapus semua data" dan "Isi data contoh" disembunyikan di bagian Lanjutan dan baru aktif setelah mengetik `HAPUS`.
- *Urungkan*: menghapus tugas, item budget, vendor, atau pembayaran memunculkan tombol "Urungkan" selama 8 detik. Berkas foto baru dihapus dari Storage setelah masa urungkan habis.

**Informasi keuangan**
- Tab Budget: ringkasan sisa saldo (dengan peringatan vendor yang belum terjadwal penuh atau melebihi kontrak) dan *Arus kas bulanan* (pembayaran vendor yang harus keluar per bulan, bisa dibuka per bulan).
- Selisih yang belum terjadwal ikut dihitung pada "Sisa setelah semua tagihan".

**Kemudahan pakai**
- Tugas: catatan, prioritas, penanggung jawab (Mempelai, Orang tua, Keluarga, WO), pencarian, filter, dan pengelompokan per periode (Terlambat, Minggu ini, per bulan). Grup yang seluruhnya selesai terlipat otomatis.
- Vendor: tombol *Kirim WhatsApp* dengan template pengingat pembayaran, konfirmasi jadwal, dan konfirmasi sudah dibayar (pesan bisa diedit; nomor `08xx` otomatis menjadi `62xx`).
- Kalender: *Ekspor .ics* berisi hari H, tugas belum selesai, dan tagihan belum dibayar, lengkap dengan pengingat. UID stabil sehingga impor ulang memperbarui agenda, tidak menggandakan.
- Pembayaran vendor: *foto bukti bayar* (dikompres di perangkat ke sisi terpanjang 1600 px, JPEG), disimpan privat dan dibuka lewat tautan bertanda tangan berlaku 1 jam.

## Build, aset lokal, dan kenyamanan tambahan

**Tanpa CDN saat berjalan.** Tailwind tidak lagi dimuat dari `cdn.tailwindcss.com` (yang meng-compile CSS di browser dan tidak untuk produksi), dan supabase-js tidak lagi dari jsDelivr `@2`.
- `styles.css` dibangun oleh Tailwind CLI **4.3.3** (terkunci di `package-lock.json`) dari kelas yang ada di `index.html` dan `app.js`. Workflow deploy menjalankan `npm ci` lalu `npm run build:css` otomatis. Berkas hasil build ikut disertakan di repo agar bisa dibuka lokal tanpa langkah tambahan.
- Setiap kali menambah kelas Tailwind baru di `index.html`, jalankan `npm install` (sekali) lalu `npm run build:css` untuk melihatnya lokal. Jangan menyusun nama kelas dari potongan string (misalnya `'bg-' + warna`) karena tidak akan terdeteksi saat build.
- `vendor/supabase.js` adalah supabase-js **2.118.0** (build UMD resmi, dirilis 15 Okt 2026). Untuk memperbarui: `npm pack @supabase/supabase-js@<versi>` lalu salin `package/dist/umd/supabase.js` ke `vendor/supabase.js`. Pilih versi yang sudah beberapa minggu dirilis.
- Service worker kini menyimpan semua aset sendiri, jadi aplikasi tampil utuh walau pembukaan pertama di sinyal buruk. `styles.css` diambil network-first agar CSS tidak ketinggalan dari HTML setelah deploy. **Naikkan `CACHE` di `sw.js` setiap rilis** (sekarang `v7`).

**Kenyamanan**
- Aplikasi langsung membuka acara yang terakhir dipakai. Ikon ganti mempelai di header tetap membuka pemilih acara.
- Header satu baris: chip `H-123` di samping nama acara. Ketuk untuk membuka rincian bulan/hari/jam/menit; pilihannya diingat.
- Tanggal hari H bawaan migrasi (sekarang + 6 bulan) dikenali dari detiknya yang tidak bulat, karena tanggal yang disimpan lewat Pengaturan selalu bulat ke menit. Selama masih sementara: chip menjadi kuning "Atur hari H", Beranda menampilkan kartu peringatan, dan tombol *Tambahkan* pada template checklist dinonaktifkan sampai tanggal sebenarnya disimpan.

## Budget per kategori dan status bayar item
- **Item budget** kini punya kategori, status *Sudah dibayar* dan tanggal bayar. "Total terpakai" hanya menghitung item yang sudah dibayar (biaya aktual) ditambah pembayaran vendor yang lunas. Item belum dibayar masuk ke "Sisa setelah semua tagihan". Data lama dengan biaya aktual > 0 otomatis ditandai dibayar oleh migrasi.
- **Budget per kategori**: tombol *Atur alokasi* di tab Budget. Tiap kategori menampilkan komitmen (kontrak vendor + item budget) dibanding alokasi, sisa, jumlah yang sudah dibayar, dan peringatan di 80% dan saat melebihi. Kategori vendor dan item budget memakai daftar yang sama (`BUDGET_CATS` di `index.html`).
- Cadangan JSON ikut menyertakan kategori, tanggal bayar, dan alokasi (cadangan lama tetap bisa diimpor).
- Naikkan `CACHE` di `sw.js` setiap rilis (sekarang `v19`).

## Daftar belanja (seserahan, souvenir, dll.)
- Tab **Vendor** punya dua tampilan: *Vendor* dan *Daftar belanja*. Di tampilan belanja, tombol + membuat daftar baru (misalnya Seserahan), dan tombol *Tambah item* ada di tiap daftar.
- Tiap item: nama, jumlah, estimasi total, toko, catatan, dan centang **sudah dibeli** (harga aktual dan tanggal beli terisi otomatis, bisa diubah).
- Rekap seperti Vendor: item dibeli dari total, total perkiraan, sudah dibeli, sisa, dan bar progres, per daftar maupun keseluruhan.
- Terhubung ke Budget: item yang dibeli masuk \"Total terpakai\", yang belum dibeli masuk \"Sisa setelah semua tagihan\" dan proyeksi, dan semuanya ikut kategori daftar di \"Budget per kategori\". Jangan mencatat barang yang sama lagi sebagai item budget.
- Migrasi: `20261114000000_shopping.sql`. Cadangan JSON ikut menyertakan daftar dan item.

## Mode gelap
- Pengaturan > **Tampilan**: *Sistem* (bawaan, mengikuti pengaturan perangkat), *Terang*, atau *Gelap*. Pilihan diingat di perangkat (`localStorage` kunci `wp-theme`) dan diterapkan sebelum halaman tampil, jadi tidak berkedip.
- Warna mode gelap ada di bagian atas `tailwind.src.css`: satu tabel token (`:root` untuk terang, `html.dark` untuk gelap) yang dibaca kelas seperti `bg-surface`, `text-muted`, `border-line`. Kelas baru yang memakai token otomatis ikut mode gelap; untuk warna baru, tambahkan variable di kedua blok dan satu baris di `@theme inline`, lalu jalankan `npm run build:css`.
- `theme-color` browser ikut berganti (hijau di mode terang, `#151c25` di mode gelap). `CACHE` di `sw.js` sekarang `v25`. Tombol bulan/matahari di header mengganti terang/gelap dengan satu ketukan (otomatis memilih mode eksplisit).

## Alur masuk
Dua langkah dengan penunjuk di atas: **1 Masuk** (email dan kata sandi, tombol mata untuk melihat sandi, status "Memproses...", pesan error jelas) lalu **2 Pilih acara** (Ade atau Rohman; menampilkan akun yang sedang masuk dan tombol *Bukan Anda? Keluar*). Bila acara terakhir sudah tersimpan, langkah 2 dilewati. Layar masuk punya tombol terang/gelap sendiri di pojok kanan atas.

## Aksesibilitas, performa, dan keep-alive
- **Layar masuk / pilih acara**: saat terbuka, header, isi, navigasi, dan tombol + dinonaktifkan (`inert`) sehingga fokus keyboard dan pembaca layar tetap di dalam dialog; fokus kembali ke pemicu saat ditutup. `Esc` menutup pemilih acara bila sudah ada acara aktif.
- **Kalender**: sel `h-14` dengan jarak 8 px, penanda kecil memakai teks 12 px.
- **Kontras**: `slate-500` digelapkan di `tailwind.config.js` (`#566377`) agar teks sekunder lolos 4.5:1 di atas latar bertint. Mode gelap tidak berubah.
- **Performa**: skrip aplikasi dipindah dari `index.html` ke `app.js`; ketiga skrip (`supabase.js`, `config.js`, `app.js`) memakai `defer` sehingga tidak memblokir render. `index.html` turun dari ~188 KB menjadi markup saja, dan `app.js` di-cache service worker (network-first seperti `styles.css`). **Kelas Tailwind kini dipindai dari `index.html` dan `app.js`.**
- **Keep-alive Supabase** (`.github/workflows/keepalive.yml`), sepenuhnya otomatis:
  1. Setiap 2 hari mengirim permintaan ke REST dan Auth Supabase agar project free tier tidak dijeda (jeda terjadi setelah ~7 hari tanpa aktivitas).
  2. Bila project ternyata sudah dijeda (status `INACTIVE`), workflow memanggil **Restore** lewat Management API dan menunggu sampai `ACTIVE_HEALTHY` (maks. 10 menit). Memakai secret yang sudah ada: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`. Restore hanya bisa untuk project yang dijeda < 90 hari dan selama kuota 2 project aktif belum penuh.
  3. Di akhir setiap run, workflow menonaktifkan lalu mengaktifkan dirinya lagi lewat API GitHub untuk menyegarkan jadwal, supaya tidak dimatikan GitHub setelah 60 hari tanpa aktivitas repo.
  - Bila ada langkah yang gagal, GitHub mengirim email notifikasi run gagal. Uji manual: Actions > Supabase keep-alive > Run workflow.

## Sistem gaya (Tailwind v4, token, komponen)
- **Tailwind v4.3.3** dengan konfigurasi CSS-first di `tailwind.src.css` (tanpa `tailwind.config.js`). Build: `npm ci && npm run build:css`. Butuh browser Chrome 111+, Safari 16.4+, Firefox 128+ (v4 memakai `color-mix`, `@property`, dan `@layer`).
- **Token warna berdasarkan peran**, bukan nomor palet: `bg-page`, `bg-surface`, `bg-fill`, `text-ink` s.d. `text-ink-4`, `text-muted`, `border-line`, `border-line-strong`, `bg-brand`, `text-brand-ink-2`, `bg-danger-soft`, `text-warn-ink`, dan seterusnya. Nilai terang dan gelapnya ada di dua blok yang berdampingan (`:root` dan `html.dark`), sehingga aturan `html.dark` tulisan tangan berkurang dari 73 menjadi 10 (hanya latar dialog, kontrol form, ikon tema, dan kartu hero).
- **Komponen** (`@layer components`): `.field-label`, `.input`, `.btn-primary`, `.btn-ghost`, `.btn-danger-ghost`, `.card`, `.empty-box`. Utilitas khusus: `min-h-touch` (44 px), `pt-safe`, `pb-safe`, `mt-safe`, `mb-safe` (safe-area).
- Blok `<style>` inline di `index.html` dipindah ke `tailwind.src.css` sehingga ikut diminify dan di-cache.
- Perubahan kecil yang disengaja: batas `select` dan `textarea` di mode terang kini memakai warna batas kontrol (`#7b8aa0`) seperti `input`; tombol berkas di Pengaturan ikut warna mode gelap.

## Perbaikan audit UI/UX (v26)
- **Pindah tab**: tiap tampilan punya judul `h2` tersembunyi (`#h-home`, `#h-task`, ...). Saat tab diganti, fokus pindah ke judulnya (pembaca layar membacakan nama tab) dan `document.title` ikut berubah.
- **Riwayat & Back**: tab memakai hash polos (`#home`, `#task`, `#calendar`, `#vendor`, `#budget`). Tombol Back kembali ke tab sebelumnya, bukan menutup aplikasi; dialog tetap menangkap Back lebih dulu. Tautan seperti `.../#budget` dibuka langsung ke tab itu setelah masuk dan memilih acara.
- **Kalender**: jarak antarsel `gap-1` di bawah 640 px (sel 44,6 px di layar 360 px), `gap-2` di atasnya.
- **Batas kontrol**: token baru `border-control` (= `--control-border`, kontras >= 3:1) dipakai semua tombol, chip, label radio, dan kolom isian. `border-line-strong` hanya tersisa untuk garis dekoratif (kotak kosong putus-putus).
- **Ukuran teks**: baris status dan nominal (pembayaran vendor, arus kas, kategori budget, pil agenda, label kartu Beranda, catatan hitung ganda) naik dari 12 px ke 14 px. Lencana kecil dan keterangan sumbu tetap 12 px.

## Penyegaran Beranda (v27)
- **Hero**: label "Hari pernikahan", angka H-xx lebih besar, dan masalah yang perlu ditangani kini berupa tombol (`2 tugas terlambat`, `1 tagihan terlambat`, `Anggaran melebihi plafon`) yang langsung membuka tab terkait (tugas terlambat membuka Tugas dengan filter Terlambat).
- **Kartu**: ikon, judul, subjudul, dan ringkasan di kanan yang tidak lagi terpotong ke baris baru (sebelumnya "Rp 35.000.000" terbelah menjadi dua baris di layar sempit). Judul kartu memakai `h3` di bawah judul tampilan "Beranda".
- **Baris tugas dan tagihan**: status berupa lencana berwarna (Terlambat / Jatuh tempo hari ini / Prioritas tinggi) menggantikan pemisah ` | ` yang bisa tertinggal di awal baris. Nominal tagihan sejajar dengan nama vendor.
- **Tile ringkasan**: ikon, angka 24 px, bar 8 px. Format singkat memakai koma desimal ("Rp 123,5 jt", bukan "123.5").
- **Keadaan kosong**: "tidak ada yang terlambat" tampil sebagai kotak konfirmasi hijau, bukan teks abu-abu polos.
- Semua gaya memakai token yang sudah ada; satu-satunya kelas baru adalah gradasi hero (`bg-linear-to-br from-emerald-700 to-emerald-800`). Kelas `bg-emerald-700` dipertahankan karena aturan mode gelap di `tailwind.src.css` bergantung padanya.

## Penyempurnaan Beranda (v28)
- **Tile ringkasan** (Tugas selesai, Sisa saldo): kini punya efek hover, panah di pojok kanan atas sebagai petunjuk bisa diketuk, dan bar progres berperan `progressbar` dengan nilai 0-100 untuk pembaca layar.
- `CACHE` di `sw.js` sekarang `v28`.
- **Baris tugas dan tagihan seragam** (v29): info (kategori, PJ, atau label cicilan) selalu di baris sendiri di bawah judul, lencana status di baris berikutnya, sehingga susunan tiap baris sama walau teksnya panjang.
