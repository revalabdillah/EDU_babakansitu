/**
 * ============================================================
 *  PerangkatService.gs — Secure Version (Isolasi Data Guru)
 * ============================================================
 */

/**
 * Helper: Menyimpan teks ke Google Drive secara otomatis.
 * Membuat folder berdasarkan Nama Guru jika belum ada.
 */
function saveTextToDrive_(guruId, fileName, content) {
  try {
    const users = sheetToObjects_('master_users');
    const guru = users.find(u => u.user_id === guruId);
    const namaGuru = guru ? guru.nama_lengkap.replace(/[^a-zA-Z0-9 ]/g, "") : guruId;

    const rootFolderName = 'EduManage_Perangkat_Ajar';
    const rootFolders = DriveApp.getFoldersByName(rootFolderName);
    const rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(rootFolderName);

    const guruFolders = rootFolder.getFoldersByName(namaGuru);
    const guruFolder = guruFolders.hasNext() ? guruFolders.next() : rootFolder.createFolder(namaGuru);

    const files = guruFolder.getFilesByName(fileName);
    let file;
    if (files.hasNext()) {
      file = files.next();
      file.setContent(content);
    } else {
      file = guruFolder.createFile(fileName, content, MimeType.PLAIN_TEXT);
    }

    return file.getId(); 
  } catch (e) {
    console.error('Gagal menyimpan ke Drive:', e.message);
    throw new Error('Gagal menyimpan file ke Drive.');
  }
}

// 1. Ambil Data (HANYA MILIK GURU YANG LOGIN)
function apiGetPerangkat(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    
    // Ambil semua data
    let allPerangkat = sheetToObjects_('perangkat_ajar');
    
    // 👇 FILTER KETAT: Hanya milik user ini & kategori ATP/MODUL 👇
    const filtered = allPerangkat.filter(p => 
      (String(p.kategori) === 'ATP' || String(p.kategori) === 'MODUL') &&
      String(p.guru_id) === session.userId
    );

    const mapels = sheetToObjects_('master_mapel');
    const kelases = sheetToObjects_('master_kelas');

    return filtered.map(p => {
      return {
        perangkat_id: p.perangkat_id,
        judul: p.judul || '-',
        deskripsi: p.deskripsi || '-',
        mapel_id: p.mapel_id,
        nama_mapel: mapels.find(m => m.mapel_id === String(p.mapel_id))?.nama_mapel || '-',
        kelas_id: p.kelas_id,
        nama_kelas: kelases.find(k => k.kelas_id === String(p.kelas_id))?.nama_kelas || '-',
        konten_ai: p.konten_ai || '',
        konten_lkpd: p.konten_lkpd || '',
        konten_game: p.konten_game || '',
        status_akses: p.status_akses || 'PRIVATE'
      };
    }).reverse(); 
  })();
}

// 2. Simpan Data (Update / Create)
function apiSavePerangkat(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['GURU', 'ADMIN']);
    
    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('perangkat_ajar');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      payload.status_akses = payload.status_akses || 'PRIVATE';

      if (payload.perangkat_id) {
        // JIKA EDIT: Cek apakah ini benar-benar miliknya
        const rowIdx = findRow_('perangkat_ajar', 'perangkat_id', payload.perangkat_id);
        if (rowIdx === -1) throw new Error('Data tidak ditemukan');
        
        const ownerId = sheet.getRange(rowIdx, headers.indexOf('guru_id') + 1).getValue();
        if (String(ownerId) !== session.userId && session.role !== 'ADMIN') {
          throw new Error('AKSES DITOLAK: Anda tidak berhak mengubah data ini.');
        }

        sheet.getRange(rowIdx, headers.indexOf('kelas_id') + 1).setValue(payload.kelas_id);
        sheet.getRange(rowIdx, headers.indexOf('mapel_id') + 1).setValue(payload.mapel_id);
        sheet.getRange(rowIdx, headers.indexOf('judul') + 1).setValue(payload.judul);
        sheet.getRange(rowIdx, headers.indexOf('deskripsi') + 1).setValue(payload.deskripsi || '');
        sheet.getRange(rowIdx, headers.indexOf('status_akses') + 1).setValue(payload.status_akses);
      } else {
        // JIKA CREATE
        const newId = generateId_('perangkat_ajar', 'perangkat_id', 'PRA');
        const now = nowWIB();
        const newRow = headers.map(h => {
          if (h === 'perangkat_id') return newId;
          if (h === 'kategori') return payload.kategori || 'ATP';
          if (h === 'guru_id') return session.userId;
          if (h === 'kelas_id') return payload.kelas_id || '';
          if (h === 'mapel_id') return payload.mapel_id || '';
          if (h === 'tahun_ajaran_id') return getActiveTahunAjaranId_();
          if (h === 'judul') return payload.judul || '';
          if (h === 'deskripsi') return payload.deskripsi || '';
          if (h === 'status_dokumen') return 'DRAFT';
          if (h === 'status_akses') return payload.status_akses;
          if (h === 'created_at') return now;
          return '';
        });
        sheet.appendRow(newRow);
      }
      
      CacheService.getScriptCache().remove('sheet_data_perangkat_ajar');
      return { message: 'Berhasil disimpan' };
    });
  })();
}

// 3. Hapus Data (Dengan Proteksi)
function apiDeletePerangkat(token, id) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    return withLock_(function() {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('perangkat_ajar');
      const rowIdx = findRow_('perangkat_ajar', 'perangkat_id', id);
      
      if (rowIdx !== -1) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const ownerId = sheet.getRange(rowIdx, headers.indexOf('guru_id') + 1).getValue();
        
        // 👇 Cek Kepemilikan sebelum menghapus 👇
        if (String(ownerId) !== session.userId && session.role !== 'ADMIN') {
          throw new Error('AKSES DITOLAK: Anda tidak berhak menghapus data ini.');
        }

        sheet.deleteRow(rowIdx);
        CacheService.getScriptCache().remove('sheet_data_perangkat_ajar');
      }
      return { message: 'Dihapus' };
    });
  })();
}

// 4. Generate AI Prompt (Dengan Proteksi)
function apiGetAIPrompt(token, perangkatId, tipe) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    
    const rowIdx = findRow_('perangkat_ajar', 'perangkat_id', perangkatId);
    if (rowIdx === -1) throw new Error('Data tidak ditemukan');
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('perangkat_ajar');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
    
    // 👇 Cek Kepemilikan 👇
    const ownerId = rowData[headers.indexOf('guru_id')];
    if (String(ownerId) !== session.userId && session.role !== 'ADMIN') {
      throw new Error('AKSES DITOLAK: Anda tidak berhak mengakses data ini.');
    }
    
    const judul = rowData[headers.indexOf('judul')] || '-';
    const deskripsi = rowData[headers.indexOf('deskripsi')] || '-';
    const kelasId = rowData[headers.indexOf('kelas_id')];
    const mapelId = rowData[headers.indexOf('mapel_id')];

    const listKelas = sheetToObjects_('master_kelas');
    const listMapel = sheetToObjects_('master_mapel');
    const namaKelas = listKelas.find(k => k.kelas_id === kelasId)?.nama_kelas || '-';
    const namaMapel = listMapel.find(m => m.mapel_id === mapelId)?.nama_mapel || '-';

    let promptText = '';

    if (tipe === 'GAME') {
      promptText = `Kamu adalah programmer game edukasi HTML5. Buatkan GAME EDUKASI interaktif untuk anak SD.
Materi: ${judul}
Tujuan: ${deskripsi}

**ATURAN KETAT:**
1. Tulis kode LENGKAP dalam SATU file HTML (HTML, CSS di <style>, JS di <script>).
2. JANGAN pakai link gambar/CDN eksternal. Gunakan emoji atau CSS shapes.
3. Responsif dan mudah dimainkan di Smartboard.
4. Sertakan skor dan tombol "Main Lagi".
5. JANGAN beri teks penjelasan. LANGSUNG berikan kodenya.`;
    } 
    else if (tipe === 'LKPD') {
      promptText = `Buatkan Lembar Kerja Peserta Didik (LKPD) untuk materi:
Materi: ${judul}
Tujuan Pembelajaran: ${deskripsi}
Kelas: ${namaKelas} | Mapel: ${namaMapel}

**FORMAT:**
Gunakan Markdown yang rapi. Buat struktur: Judul LKPD, Identitas Siswa, Petunjuk, Soal Esai/Tugas, dan Rubrik Penilaian (Tabel).`;
    } 
    else {
      promptText = `Buatkan "Perencanaan Pembelajaran Mendalam" (RPP) untuk materi:
Materi: ${judul}
Tujuan Pembelajaran: ${deskripsi}

**FORMAT:**
Langsung mulai dari "## I. IDENTIFIKASI". Gunakan Heading (##), Sub-heading (###), dan Tabel Markdown untuk "III. PENGALAMAN BELAJAR" (3 kolom: Tahap, Kegiatan, Dimensi Profil).`;
    }

    return { promptText };
  })();
}

// 5. Simpan Hasil AI (Dengan Proteksi)
// 5. Simpan Hasil AI (Dengan Proteksi & Google Drive)
function apiSaveAIResult(token, perangkatId, tipe, generatedText) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    
    const rowIdx = findRow_('perangkat_ajar', 'perangkat_id', perangkatId);
    if (rowIdx === -1) throw new Error('Data tidak ditemukan');
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('perangkat_ajar');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // 👇 Cek Kepemilikan 👇
    const ownerId = sheet.getRange(rowIdx, headers.indexOf('guru_id') + 1).getValue();
    if (String(ownerId) !== session.userId && session.role !== 'ADMIN') {
      throw new Error('AKSES DITOLAK: Anda tidak berhak mengubah data ini.');
    }
    
    let colName = 'konten_ai';
    if (tipe === 'LKPD') colName = 'konten_lkpd';
    if (tipe === 'GAME') colName = 'konten_game';

    const colIdx = headers.indexOf(colName) + 1;
    
    // Ambil judul untuk nama file di Drive
    const judul = sheet.getRange(rowIdx, headers.indexOf('judul') + 1).getValue() || 'Materi';
    const safeJudul = judul.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${tipe}_${safeJudul}.txt`;

    // 👇 SIMPAN KE GOOGLE DRIVE, BUKAN KE SPREADSHEET 👇
    const fileId = saveTextToDrive_(session.userId, fileName, generatedText);

    // Simpan ID File ke Spreadsheet
    if (colIdx > 0) {
      sheet.getRange(rowIdx, colIdx).setValue(fileId);
    }
    
    CacheService.getScriptCache().remove('sheet_data_perangkat_ajar');
    return { message: 'Hasil AI berhasil disimpan ke Google Drive!' };
  })();
}

// 6. Ambil Isi File dari Drive (RPP, LKPD, Game)
function apiGetFileContent(token, fileId) {
  return apiWrapper_(function() {
    requireSession_(token);
    try {
      const file = DriveApp.getFileById(fileId);
      const content = file.getBlob().getDataAsString();
      return { content: content };
    } catch (e) {
      throw new Error('Gagal mengambil file dari Drive: ' + e.message);
    }
  })();
}