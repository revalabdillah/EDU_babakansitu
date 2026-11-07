/**
 * ============================================================
 *  TahunAjaranService.gs — Logika Khusus Master Tahun Ajaran
 * ============================================================
 */

function apiSaveTahunAjaran(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('master_tahun_ajaran');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const data = sheet.getDataRange().getValues();

      const isSetAktif = String(payload.is_aktif).toUpperCase() === 'TRUE';

      // 1. Jika set aktif = TRUE, matikan semua yang lain dulu
      if (isSetAktif) {
        const colIsAktif = headers.indexOf('is_aktif') + 1;
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][colIsAktif - 1]).toUpperCase() === 'TRUE') {
            sheet.getRange(i + 1, colIsAktif).setValue('FALSE');
          }
        }
      }

      // 2. Simpan Data (Create / Update)
      if (payload.tahun_ajaran_id) {
        // Update
        const rowIdx = findRow_('master_tahun_ajaran', 'tahun_ajaran_id', payload.tahun_ajaran_id);
        if (rowIdx === -1) throw new Error('Tahun Ajaran tidak ditemukan');
        
        headers.forEach((h, i) => {
          if (payload[h] !== undefined && h !== 'tahun_ajaran_id') {
            sheet.getRange(rowIdx, i + 1).setValue(payload[h]);
          }
        });
      } else {
        // Create
        payload.tahun_ajaran_id = 'TA-' + Date.now();
        payload.is_aktif = isSetAktif ? 'TRUE' : 'FALSE';
        const newRow = headers.map(h => payload[h] !== undefined ? payload[h] : '');
        sheet.appendRow(newRow);
      }

      CacheService.getScriptCache().remove('sheet_data_master_tahun_ajaran');
      return { message: 'Tahun Ajaran berhasil disimpan' };
    });
  })();
}

function apiGetActiveTahunAjaran(token) {
  return apiWrapper_(function() {
    requireSession_(token);
    const allTA = sheetToObjects_('master_tahun_ajaran');
    const active = allTA.find(t => String(t.is_aktif).toUpperCase() === 'TRUE');
    return active || null;
  })();
}

function apiDeleteTahunAjaran(token, id) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    return withLock_(function() {
      const rowIdx = findRow_('master_tahun_ajaran', 'tahun_ajaran_id', id);
      if (rowIdx === -1) throw new Error('Tahun Ajaran tidak ditemukan');
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master_tahun_ajaran');
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const colIsAktif = headers.indexOf('is_aktif');
      
      // Cek apakah yang mau dihapus sedang aktif
      if (String(data[rowIdx - 1][colIsAktif]).toUpperCase() === 'TRUE') {
        throw new Error('Tidak bisa menghapus Tahun Ajaran yang sedang aktif.');
      }

      sheet.deleteRow(rowIdx);
      CacheService.getScriptCache().remove('sheet_data_master_tahun_ajaran');
      return { message: 'Tahun Ajaran dihapus' };
    });
  })();
}