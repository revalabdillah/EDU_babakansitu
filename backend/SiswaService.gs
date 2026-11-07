/**
 * ============================================================
 *  SiswaService.gs — Logika Data Siswa, Import & Mutasi
 * ============================================================
 */

// 1. IMPORT SISWA (Copy-Paste dari Excel)
function apiImportSiswa(token, rawData) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    if (!rawData || rawData.length === 0) throw new Error('VALIDATION: Tidak ada data untuk diimport');

    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('master_siswa');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      let successCount = 0;
      const errors = [];

      rawData.forEach((row, idx) => {
        // Urutan kolom Excel:
        // 0: NISN, 1: Nama, 2: L/P, 3: Kelas ID, 4: Tempat, 5: Tgl Lahir, 6: Ortu, 7: HP, 8: Alamat
        const nisn = String(row[0] || '').trim();
        const nama = String(row[1] || '').trim();
        const jk = String(row[2] || '').trim().toUpperCase();
        const kelasId = String(row[3] || '').trim();
        
        if (!nisn || !nama) {
          errors.push(`Baris ${idx + 1}: NISN/Nama kosong.`);
          return;
        }

        const newSiswa = {
          siswa_id: 'SIS-' + Date.now() + '-' + idx,
          nisn: nisn,
          nama_siswa: nama,
          jenis_kelamin: (jk === 'L' || jk === 'P') ? jk : 'L',
          kelas_id: kelasId,
          status_siswa: 'AKTIF',
          tempat_lahir: row[4] || '',
          tanggal_lahir: row[5] || '',
          nama_orang_tua: row[6] || '',
          no_hp_orang_tua: row[7] || '',
          alamat: row[8] || '',
          tahun_ajaran_id: getActiveTahunAjaranId_() // <-- Otomatis dari sistem
        };

        sheet.appendRow(headers.map(h => newSiswa[h] !== undefined ? newSiswa[h] : ''));
        successCount++;
      });

      CacheService.getScriptCache().remove('sheet_data_master_siswa');
      return { successCount, errors, message: `${successCount} data berhasil diimport.` };
    });
  })();
}

// 2. MUTASI SISWA (Pindah Kelas, Masuk, Keluar)
function apiMutasiSiswa(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetSiswa = ss.getSheetByName('master_siswa');
      const sheetMutasi = ss.getSheetByName('riwayat_mutasi_siswa');
      
      const rowIdx = findRow_('master_siswa', 'siswa_id', payload.siswa_id);
      if (rowIdx === -1) throw new Error('Siswa tidak ditemukan');

      const headersSiswa = sheetSiswa.getRange(1, 1, 1, sheetSiswa.getLastColumn()).getValues()[0];
      const kelasAsal = sheetSiswa.getRange(rowIdx, headersSiswa.indexOf('kelas_id') + 1).getValue();

      // 1. Update status/kelas di master_siswa
      if (payload.jenis_mutasi === 'PINDAH') {
        sheetSiswa.getRange(rowIdx, headersSiswa.indexOf('kelas_id') + 1).setValue(payload.kelas_tujuan);
      } else if (payload.jenis_mutasi === 'KELUAR') {
        sheetSiswa.getRange(rowIdx, headersSiswa.indexOf('status_siswa') + 1).setValue('MUTASI');
      } else if (payload.jenis_mutasi === 'MASUK') {
        sheetSiswa.getRange(rowIdx, headersSiswa.indexOf('status_siswa') + 1).setValue('AKTIF');
        sheetSiswa.getRange(rowIdx, headersSiswa.indexOf('kelas_id') + 1).setValue(payload.kelas_tujuan);
      }

      // 2. Catat ke riwayat_mutasi_siswa
      const newMutasi = {
        mutasi_id: generateId_('riwayat_mutasi_siswa', 'mutasi_id', 'MUT'),
        siswa_id: payload.siswa_id,
        jenis_mutasi: payload.jenis_mutasi,
        tanggal_mutasi: payload.tanggal_mutasi || todayWIB(),
        kelas_asal: kelasAsal,
        kelas_tujuan: payload.kelas_tujuan || '',
        keterangan: payload.keterangan || '',
        tahun_ajaran_id: getActiveTahunAjaranId_() // <-- Otomatis dari sistem
      };
      
      const headersMutasi = sheetMutasi.getRange(1, 1, 1, sheetMutasi.getLastColumn()).getValues()[0];
      sheetMutasi.appendRow(headersMutasi.map(h => newMutasi[h] || ''));

      CacheService.getScriptCache().remove('sheet_data_master_siswa');
      CacheService.getScriptCache().remove('sheet_data_riwayat_mutasi_siswa');

      return { message: 'Mutasi berhasil dicatat' };
    });
  })();
}