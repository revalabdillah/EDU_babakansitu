# PLAYBOOK PROYEK GAS (Google Apps Script)

## FASE 0: Setup Awal
1. Install Node.js & clasp (`npm install -g @google/clasp`).
2. `clasp login` dan `clasp clone-script <ID>`.
3. Setup `.claspignore` (wajib whitelist .gs, .html, .js).
4. `clasp push --force` (selalu gunakan --force jika ada error "up to date").

## FASE 1: Database (Google Sheets)
1. Buat fungsi `setupDatabase()` di backend untuk generate sheet otomatis.
2. Selalu gunakan `LockService.getScriptLock()` saat membuat/mengubah data.
3. Selalu bersihkan format Tanggal (`Date`) sebelum mengirim data ke frontend.

## FASE 2: Backend Router (Sangat Krusial)
1. Gunakan 1 pintu masuk (`apiCallRouter`) untuk semua API.
2. **JANGAN** gunakan `google.script.run.namaFungsi()` secara dinamis. 
3. Kirim parameter ke router dalam bentuk 1 objek: `apiCallRouter({ action: 'namaFungsi', args: [param1, param2] })`.
4. Selalu bungkus response dengan `sanitizeForClient_` untuk mencegah error `null` akibat objek Date/Array kompleks.

## FASE 3: Frontend UI/UX & GAS Sandbox
1. Layout terbagi: `layout.html`, `layout-sidebar.html`, `layout-topbar.html`, `app.html` (JS helpers).
2. Variabel template wajib di-parse aman: `<?!= JSON.stringify(data) ?>` (pakai `!`).
3. **NAVIGASI:** Jangan gunakan `window.location.href` biasa di dalam iframe GAS. Wajib gunakan Form Submit rahasia dengan `target="_top"` untuk pindah halaman/dashboard.
4. Loading state: Gunakan `App.showSkeleton()` atau toast.

## FASE 4: Fitur Lanjutan
1. Conflict Detection: Cek irisan waktu `(MulaiBaru < SelesaiLama) && (SelesaiBaru > MulaiLama)`.
2. Validasi Role: Fungsi `requireRole_` wajib dipanggil di setiap API backend.
3. Game HTML: Wajib gunakan `<iframe sandbox="allow-scripts allow-same-origin">`.