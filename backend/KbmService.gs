/**
 * ============================================================
 *  KbmService.gs — Logika Pelaksanaan KBM
 * ============================================================
 */

// 1. Ambil Jadwal Reservasi Hari Ini Milik Guru
// 1. Ambil Jadwal Reservasi Berdasarkan Tanggal
// 1. Ambil Jadwal Reservasi Berdasarkan Tanggal
function apiGetJadwalKbm(token, targetDate) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    
    // Jika frontend tidak mengirim tanggal, gunakan hari ini
    const filterDate = targetDate || todayWIB();
    
    // Bypass cache dengan membaca langsung dari sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('reservasi_smartboard');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idxTanggal = headers.indexOf('tanggal_pinjam');
    const idxGuru = headers.indexOf('guru_id');
    const idxStatus = headers.indexOf('status_reservasi');
    
    let result = [];
    
    for(let i=1; i<data.length; i++) {
      // Normalisasi tanggal dari Spreadsheet ke format YYYY-MM-DD
      const rawDate = data[i][idxTanggal];
      let rowDate = '';
      
      if (rawDate instanceof Date) {
        rowDate = Utilities.formatDate(rawDate, 'Asia/Jakarta', 'yyyy-MM-dd');
      } else {
        rowDate = String(rawDate).substring(0, 10);
      }
        
      // Filter: Tanggal cocok, Guru cocok, dan tidak dibatalkan
      if (rowDate === filterDate && String(data[i][idxGuru]) === session.userId && data[i][idxStatus] !== 'CANCELLED') {
        let obj = {};
        headers.forEach((h, idx) => obj[h] = data[i][idx]);
        result.push(obj);
      }
    }

    const users = sheetToObjects_('master_users');
    const kelases = sheetToObjects_('master_kelas');
    const papans = sheetToObjects_('master_papan_interaktif');
    const perangkats = sheetToObjects_('perangkat_ajar');

    return result.map(r => {
      const kelas = kelases.find(k => k.kelas_id === r.kelas_id);
      const papan = papans.find(p => p.papan_id === r.papan_id);
      const perangkat = perangkats.find(p => p.perangkat_id === r.perangkat_id);

      return {
        ...r,
        jam_mulai: normalizeTime_(r.jam_mulai),
        jam_selesai: normalizeTime_(r.jam_selesai),
        nama_kelas: kelas ? kelas.nama_kelas : '-',
        nama_papan: papan ? papan.nama_perangkat : '-',
        judul_materi: perangkat ? perangkat.judul : null,
        is_ready: !!r.perangkat_id && r.perangkat_id.trim() !== ''
      };
    }).sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
  })();
}

// 2. Ambil List Perangkat Ajar untuk Dropdown
function apiGetPerangkatForKbm(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const activeTA = getActiveTahunAjaranId_();
    
    // Hanya ambil perangkat ajar milik guru ini
    const list = sheetToObjects_('perangkat_ajar').filter(p => 
      p.guru_id === session.userId && 
      p.tahun_ajaran_id === activeTA
    );

    const mapels = sheetToObjects_('master_mapel');
    const kelases = sheetToObjects_('master_kelas');

    return list.map(p => {
      return {
        perangkat_id: p.perangkat_id,
        judul: p.judul,
        nama_mapel: mapels.find(m => m.mapel_id === p.mapel_id)?.nama_mapel || '-',
        nama_kelas: kelases.find(k => k.kelas_id === p.kelas_id)?.nama_kelas || '-',
        has_game: (p.konten_game && p.konten_game.trim() !== '')
      };
    }).reverse();
  })();
}

// 3. Simpan Perangkat Ajar ke Reservasi
function apiSetMateriReservasi(token, reservasiId, perangkatId) {
  return apiWrapper_(function() {
    requireSession_(token);
    
    const rowIdx = findRow_('reservasi_smartboard', 'reservasi_id', reservasiId);
    if (rowIdx === -1) throw new Error('Reservasi tidak ditemukan');
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('reservasi_smartboard');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIdx = headers.indexOf('perangkat_id') + 1;
    
    if (colIdx === 0) throw new Error('Kolom perangkat_id belum ada di database.');
    
    sheet.getRange(rowIdx, colIdx).setValue(perangkatId);
    
    CacheService.getScriptCache().remove('sheet_data_reservasi_smartboard');
    return { message: 'Materi berhasil dicocokkan' };
  })();
}

// 4. Ambil Detail KBM untuk Layar Smartboard
function apiGetDetailKbm(token, reservasiId) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    
    // Ambil Reservasi
    const resList = sheetToObjects_('reservasi_smartboard');
    const reservasi = resList.find(r => r.reservasi_id === reservasiId);
    if (!reservasi) throw new Error('Data reservasi tidak ditemukan');

    // Ambil Perangkat Ajar yang sudah dicocokkan
    const perangkat = sheetToObjects_('perangkat_ajar').find(p => p.perangkat_id === reservasi.perangkat_id);
    if (!perangkat) throw new Error('Materi belum dicocokkan');

    // Ambil Konten Game dari Drive (jika ada)
    let gameHtml = '';
    if (perangkat.konten_game && perangkat.konten_game.trim() !== '') {
      try {
        const file = DriveApp.getFileById(perangkat.konten_game);
        gameHtml = file.getBlob().getDataAsString();
      } catch (e) { console.warn('Gagal load game:', e); }
    }

    // Ambil Konten RPP dari Drive (jika ada)
    let rppText = '';
    if (perangkat.konten_ai && perangkat.konten_ai.trim() !== '') {
      try {
        const file = DriveApp.getFileById(perangkat.konten_ai);
        rppText = file.getBlob().getDataAsString();
      } catch (e) { console.warn('Gagal load RPP:', e); }
    }

    // Cek apakah Jurnal sudah pernah dibuat
    const jurnalExisting = sheetToObjects_('jurnal_harian_kbm').find(j => j.reservasi_id === reservasiId);

    // Ambil info Kelas & Papan
    const kelas = sheetToObjects_('master_kelas').find(k => k.kelas_id === reservasi.kelas_id);
    const papan = sheetToObjects_('master_papan_interaktif').find(p => p.papan_id === reservasi.papan_id);

    return {
      reservasi_id: reservasi.reservasi_id,
      nama_kelas: kelas ? kelas.nama_kelas : '-',
      nama_papan: papan ? papan.nama_perangkat : '-',
      jam_mulai: normalizeTime_(reservasi.jam_mulai),
      jam_selesai: normalizeTime_(reservasi.jam_selesai),
      judul_materi: perangkat.judul,
      game_html: gameHtml,
      rpp_text: rppText,
      jurnal_id: jurnalExisting ? jurnalExisting.jurnal_id : null,
      materi_pembahasan: jurnalExisting ? jurnalExisting.materi_pembahasan : '',
      catatan_hambatan: jurnalExisting ? jurnalExisting.catatan_hambatan : ''
    };
  })();
}

// 5. Simpan Jurnal & Selesaikan Reservasi
function apiSaveJurnalKbm(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    
    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetJurnal = ss.getSheetByName('jurnal_harian_kbm');
      const sheetReservasi = ss.getSheetByName('reservasi_smartboard');
      
      const now = nowWIB();
      const today = todayWIB();
      
      let jurnalId = payload.jurnal_id;
      
      // 1. Simpan atau Update Jurnal
      if (jurnalId) {
        // Update
        const rowIdx = findRow_('jurnal_harian_kbm', 'jurnal_id', jurnalId);
        const headersJurnal = sheetJurnal.getRange(1, 1, 1, sheetJurnal.getLastColumn()).getValues()[0];
        sheetJurnal.getRange(rowIdx, headersJurnal.indexOf('materi_pembahasan') + 1).setValue(payload.materi_pembahasan);
        sheetJurnal.getRange(rowIdx, headersJurnal.indexOf('catatan_hambatan') + 1).setValue(payload.catatan_hambatan);
      } else {
        // Create
        jurnalId = generateId_('jurnal_harian_kbm', 'jurnal_id', 'JRN');
        const headersJurnal = sheetJurnal.getRange(1, 1, 1, sheetJurnal.getLastColumn()).getValues()[0];
        
        const newRow = headersJurnal.map(h => {
          if (h === 'jurnal_id') return jurnalId;
          if (h === 'reservasi_id') return payload.reservasi_id;
          if (h === 'guru_id') return session.userId;
          if (h === 'kelas_id') return payload.kelas_id || '';
          if (h === 'tanggal') return today;
          if (h === 'materi_pembahasan') return payload.materi_pembahasan;
          if (h === 'catatan_hambatan') return payload.catatan_hambatan;
          return '';
        });
        sheetJurnal.appendRow(newRow);
      }

      // 2. Ubah status reservasi menjadi COMPLETED
      const rowRes = findRow_('reservasi_smartboard', 'reservasi_id', payload.reservasi_id);
      if (rowRes !== -1) {
        const headersRes = sheetReservasi.getRange(1, 1, 1, sheetReservasi.getLastColumn()).getValues()[0];
        sheetReservasi.getRange(rowRes, headersRes.indexOf('status_reservasi') + 1).setValue('COMPLETED');
      }

      CacheService.getScriptCache().remove('sheet_data_jurnal_harian_kbm');
      CacheService.getScriptCache().remove('sheet_data_reservasi_smartboard');
      
      return { message: 'Sesi KBM berhasil diakhiri.', jurnal_id: jurnalId };
    });
  })();
}