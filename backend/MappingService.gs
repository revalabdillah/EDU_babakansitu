/**
 * ============================================================
 *  MappingService.gs — Logika Pemetaan Guru - Mapel - Kelas
 * ============================================================
 */

function apiGetMappingMengajar(token) {
  return apiWrapper_(function() {
    requireSession_(token);
    
    const mappings = sheetToObjects_('mapping_mengajar');
    const gurus = sheetToObjects_('master_users');
    const mapels = sheetToObjects_('master_mapel');
    const kelases = sheetToObjects_('master_kelas');
    const tahuns = sheetToObjects_('master_tahun_ajaran');

    // Gabungkan data (Join)
    return mappings.map(m => {
      const guru = gurus.find(g => g.user_id === m.guru_id);
      const mapel = mapels.find(mp => mp.mapel_id === m.mapel_id);
      const kelas = kelases.find(k => k.kelas_id === m.kelas_id);
      const tahun = tahuns.find(t => t.tahun_ajaran_id === m.tahun_ajaran_id);

      return {
        mapping_id: m.mapping_id,
        guru_id: m.guru_id,
        guru_nama: guru ? guru.nama_lengkap : '-',
        mapel_id: m.mapel_id,
        mapel_nama: mapel ? mapel.nama_mapel : '-',
        kelas_id: m.kelas_id,
        kelas_nama: kelas ? kelas.nama_kelas : '-',
        tahun_ajaran_id: m.tahun_ajaran_id,
        tahun_ajaran_nama: tahun ? tahun.nama_tahun_ajaran : '-'
      };
    });
  })();
}

function apiCreateMapping(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    return withLock_(function() {
      const activeTAId = getActiveTahunAjaranId_();
      if (activeTAId === 'UNKNOWN') throw new Error('Tidak ada Tahun Ajaran yang aktif. Harap aktifkan di menu Tahun Ajaran.');

      // Cek duplikat (Guru + Mapel + Kelas + Tahun Ajaran Aktif sama)
      const existing = sheetToObjects_('mapping_mengajar');
      const isDup = existing.some(m => 
        m.guru_id === payload.guru_id && 
        m.mapel_id === payload.mapel_id && 
        m.kelas_id === payload.kelas_id &&
        m.tahun_ajaran_id === activeTAId
      );
      if (isDup) throw new Error('Data pemetaan ini sudah ada di tahun ajaran aktif.');

      payload.mapping_id = generateId_('mapping_mengajar', 'mapping_id', 'MAP');
      payload.tahun_ajaran_id = activeTAId; // Otomatis
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('mapping_mengajar');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      sheet.appendRow(headers.map(h => payload[h] || ''));
      CacheService.getScriptCache().remove('sheet_data_mapping_mengajar');
      
      return { message: 'Pemetaan berhasil ditambahkan' };
    });
  })();
}