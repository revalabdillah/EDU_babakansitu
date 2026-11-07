/**
 * ============================================================
 *  PresensiService.gs — Logika Input & Rekap Presensi
 * ============================================================
 */

// 0. Ambil daftar kelas yang HANYA diampu oleh Guru yang sedang login
function apiGetGuruClasses(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['GURU']);
    const activeTAId = getActiveTahunAjaranId_();
    
    const mappings = sheetToObjects_('mapping_mengajar').filter(m => 
      m.guru_id === session.userId && m.tahun_ajaran_id === activeTAId
    );
    
    const myKelasIds = [...new Set(mappings.map(m => m.kelas_id))];
    const allKelas = sheetToObjects_('master_kelas');
    
    return allKelas.filter(k => myKelasIds.includes(k.kelas_id));
  })();
}

// 1. Ambil Siswa berdasarkan Kelas (DENGAN VALIDASI HAK AKSES)
function apiGetSiswaUntukPresensi(token, kelasId) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const activeTAId = getActiveTahunAjaranId_();
    
    // Validasi: Jika role GURU, pastikan dia memang mengampu kelas ini
    if (session.role === 'GURU') {
      const mappings = sheetToObjects_('mapping_mengajar').filter(m => 
        m.guru_id === session.userId && 
        m.kelas_id === kelasId && 
        m.tahun_ajaran_id === activeTAId
      );
      if (mappings.length === 0) {
        throw new Error('AKSES DITOLAK: Anda tidak terdaftar mengajar di kelas ini.');
      }
    }
    
    const students = sheetToObjects_('master_siswa').filter(s => 
      s.kelas_id === kelasId && 
      s.status_siswa === 'AKTIF' &&
      s.tahun_ajaran_id === activeTAId
    );
    return students;
  })();
}

// 2. Simpan / Update Presensi Massal
function apiSavePresensi(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['GURU', 'ADMIN']);

    const { tanggal, kelas_id, data_presensi } = payload;
    if (!tanggal || !kelas_id || !data_presensi || data_presensi.length === 0) {
      throw new Error('Data presensi tidak lengkap');
    }

    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('presensi_siswa');
      const allData = sheet.getDataRange().getValues();
      const headers = allData[0];
      
      const idxTanggal = headers.indexOf('tanggal');
      const idxKelas = headers.indexOf('kelas_id');
      const idxSiswa = headers.indexOf('siswa_id');
      const idxStatus = headers.indexOf('status_kehadiran');
      
      const activeTAId = getActiveTahunAjaranId_();
      let updated = 0;
      let inserted = 0;

      data_presensi.forEach(item => {
        let rowIdx = -1;
        for (let i = 1; i < allData.length; i++) {
          if (String(allData[i][idxSiswa]) === String(item.siswa_id) && 
              String(allData[i][idxTanggal]) === String(tanggal) && 
              String(allData[i][idxKelas]) === String(kelas_id)) {
            rowIdx = i + 1;
            break;
          }
        }

        if (rowIdx !== -1) {
          sheet.getRange(rowIdx, idxStatus + 1).setValue(item.status_kehadiran);
          updated++;
        } else {
          const newRow = headers.map(h => {
            if (h === 'presensi_id') return generateId_('presensi_siswa', 'presensi_id', 'ATT');
            if (h === 'tanggal') return tanggal;
            if (h === 'kelas_id') return kelas_id;
            if (h === 'siswa_id') return item.siswa_id;
            if (h === 'status_kehadiran') return item.status_kehadiran;
            if (h === 'tahun_ajaran_id') return activeTAId;
            return '';
          });
          sheet.appendRow(newRow);
          inserted++;
        }
      });

      CacheService.getScriptCache().remove('sheet_data_presensi_siswa');
      return { message: `Berhasil menyimpan presensi (${inserted} baru, ${updated} diperbarui)` };
    });
  })();
}

// 3. Ambil Data untuk Diagram & Rekap Bulanan
function apiGetRekapPresensi(token, kelasId, bulan, tahun) {
  return apiWrapper_(function() {
    requireSession_(token);
    const activeTAId = getActiveTahunAjaranId_();
    
    const prefixDate = `${tahun}-${String(bulan).padStart(2, '0')}`;
    
    const allPresensi = sheetToObjects_('presensi_siswa').filter(p => 
      p.kelas_id === kelasId && 
      String(p.tanggal).startsWith(prefixDate) &&
      p.tahun_ajaran_id === activeTAId
    );

    const summary = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 };
    const chartData = {};

    allPresensi.forEach(p => {
      if (summary[p.status_kehadiran] !== undefined) summary[p.status_kehadiran]++;
      
      const tgl = String(p.tanggal);
      if (!chartData[tgl]) chartData[tgl] = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 };
      if (chartData[tgl][p.status_kehadiran] !== undefined) chartData[tgl][p.status_kehadiran]++;
    });

    return { summary, chartData, total_data: allPresensi.length };
  })();
}