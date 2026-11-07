# 🎓 EduManage - Sistem Manajemen Pembelajaran & Administrasi Guru
**SDN Babakansitu**

EduManage adalah platform *Learning Management System* (LMS) terpadu berbasis Web App (Google Apps Script) yang dirancang khusus untuk memudahkan guru, admin, dan kepala sekolah. Aplikasi ini mengintegrasikan **Kecerdasan Buatan (AI)** untuk pembuatan perangkat ajar, penyimpanan **Google Drive** untuk media berukuran besar, dan sistem **Reservasi & Pelaksanaan KBM (Smartboard)** secara *real-time*.

---

## ✨ Fitur Utama
1. **Manajemen Master Data:** Kelola data Guru, Siswa, Kelas, Mapel, dan Tahun Ajaran.
2. **Perangkat Ajar & Integrasi AI:**
   - Generate *Prompt* AI otomatis untuk membuat RPP, LKPD, dan Game HTML.
   - Penyimpanan file hasil AI secara otomatis ke dalam folder Google Drive per-guru (mencegah *database bloat*).
   - Isolasi data (guru tidak dapat melihat perangkat ajar guru lain).
3. **Reservasi Smartboard:**
   - Tampilan *Timeline* harian (per jam per ruangan).
   - Sistem anti-bentrok (*LockService*) yang mencegah *double-booking*.
   - Menampilkan materi yang telah diajarkan pada sesi yang sudah selesai.
4. **Pelaksanaan KBM (Smartboard Mode):**
   - Tampilan *Split-Screen* (Layar gelap) yang ramah sentuh.
   - Kiri: Game Interaktif (HTML). Kanan: Form Jurnal Harian.
   - Otomatis menyimpan jurnal dan mengubah status reservasi saat sesi diakhiri.
5. **Presensi & Penilaian:** Pencatatan kehadiran (H/I/S/A) dan rekapitulasi nilai formatif/sumatif.
6. **Supervisi (Non-Blocking):** Kepala sekolah dapat memberikan catatan umpan balik tanpa menghambat operasional guru.

---

## 🛠️ Teknologi yang Digunakan
- **Backend:** Google Apps Script (GAS)
- **Frontend:** HTML, Tailwind CSS, Vanilla JavaScript
- **Database:** Google Sheets
- **Storage:** Google Drive
- **AI Eksternal:** ChatGPT / Gemini / DeepSeek (via *Copy-Paste Prompt*)

---

## ⚙️ Prasyarat Sistem
Sebelum menginstal, pastikan komputer/server Anda memiliki:
1. Akun Google (Gmail).
2. **Node.js** (v18 atau lebih baru) terinstal.
3. **Google Apps Script CLI (`clasp`)** terinstal secara global (`npm install -g @google/clasp`).
4. Editor kode seperti **Visual Studio Code**.
5. Git (untuk *version control*).

---

## 🚀 Panduan Instalasi (Installation Guide)

### Langkah 1: Setup Database (Google Sheets)
Aplikasi ini membutuhkan struktur Spreadsheet yang tepat.
1. Buat Spreadsheet baru di Google Drive.
2. Buka Spreadsheet tersebut, klik menu **Extensions > Apps Script**.
3. Di halaman editor Apps Script, klik ikon **⚙️ Project Settings**.
4. Copy **Script ID** (simpan untuk Langkah 3).

### Langkah 2: Clone Repositori
Buka terminal/CMD, lalu jalankan:
```bash
git clone https://github.com/revalabdillah/edumanage.git
cd edumanage

### Langkah 3: Hubungkan Code dengan Apps Script

1. **Login menggunakan akun Google Anda:**
   ```bash
   clasp login
   ```

2. **Buka file `.clasp.json` di VS Code**, lalu ganti bagian `scriptId` dengan Script ID dari Langkah 1:
   ```json
   {
     "scriptId": "MASUKKAN_SCRIPT_ID_ANDA_DI_SINI",
     "rootDir": "."
   }
   ```

3. **Kirim semua kode ke server Google:**
   ```bash
   clasp push --force
   ```

---

### Langkah 4: Inisialisasi Database & Izin

1. Buka editor Apps Script di browser.
2. Pastikan file `appsscript.json` sudah memuat izin OAuth berikut:
   ```json
   "oauthScopes": [
     "https://www.googleapis.com/auth/spreadsheets",
     "https://www.googleapis.com/auth/drive",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/userinfo.email"
   ]
   ```
3. Jalankan fungsi `setupDatabase()` dari dropdown fungsi di editor Apps Script, lalu klik **Run**. Izinkan pop-up izin akses (*Advanced* > *Go to project (unsafe)* > *Allow*).
4. *(Opsional)* Jalankan fungsi `seedMasterDataForTesting()` jika Anda ingin mengunduh data *dummy* (guru/siswa/kelas) untuk keperluan uji coba.

---

### Langkah 5: Deploy Web App

1. Di editor Apps Script, klik tombol **Deploy** di pojok kanan atas > **New deployment**.
2. Pilih tipe **Web app** (klik ikon gerigi).
3. Atur konfigurasi deployment sebagai berikut:
   - **Description:** Rilis v1.0
   - **Execute as:** Me (`email-anda@gmail.com`)
   - **Who has access:** Anyone
4. Klik **Deploy** dan salin URL Web App yang dihasilkan (URL berakhiran `/exec`).

---

### 🔐 Akses Default

Buka URL Web App di browser Anda:
- **Email/Username:** `admin` (atau email Google Anda yang terdaftar)
- **Password:** `admin123`

> 💡 *Sangat disarankan untuk segera mengganti password default melalui menu profil di pojok kanan atas setelah login pertama kali.*

---

### 📝 Konfigurasi Awal (Setelah Login Admin)

1. **Atur Tahun Ajaran:** Masuk ke menu *Tahun Ajaran*, pastikan ada satu tahun ajaran yang berstatus **AKTIF**.
2. **Input Master Data:** Tambahkan Data Guru, Data Siswa, dan Data Kelas.
3. **Pemetaan Mengajar:** Buka menu *Pemetaan Mengajar*, hubungkan Guru ke Kelas dan Mata Pelajaran yang diampu.
4. **API Key AI (Khusus Guru):**
   - Setiap guru dapat melakukan login dengan akunnya masing-masing.
   - Buka menu **Pengaturan AI**.
   - Masukkan **Gemini API Key** (bisa didapatkan secara gratis melalui Google AI Studio).
   - *Catatan:* Setiap guru disarankan menggunakan API Key-nya masing-masing agar tidak terkena pembatasan kuota (*rate limit*) server.

---

### 🤝 Kontribusi

Proyek ini dikembangkan secara eksklusif untuk lingkungan **SDN Babakansitu**. Jika Anda ingin berkontribusi atau melaporkan masalah (*bug*), silakan buat **Issue** atau **Pull Request** pada repositori ini.


