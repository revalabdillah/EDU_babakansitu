/**
 * ============================================================
 *  JurnalService.gs — Manajemen Jurnal & Presensi (FASE 5)
 * ============================================================
 */

function apiGetJadwalHariIni(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['GURU', 'ADMIN']);

    const today = todayWIB();
    
    // 1. Ambil Reservasi Hari Ini untuk Guru ini (atau semua jika Admin)
    let reservations = sheetToObjects_('reservasi_smartboard').filter(r => 
      normalizeDate_(r.tanggal_pinjam) === today && 
      r.status_reservasi !== 'CANCELLED' &&
      (session.role === 'ADMIN' || r.guru_id === session.userId)
    );

    if (reservations.length === 0) return { jadwal: [], games: {} };

    // 2. Ambil data master untuk join (Kelas, Papan, Game)
    const kelasMap = {};
    sheetToObjects_('master_kelas').forEach(k => kelasMap[k.kelas_id] = k.nama_kelas);

    const papanMap = {};
    sheetToObjects_('master_papan_interaktif').forEach(p => papanMap[p.papan_id] = p.nama_perangkat);

    const gamesMap = {};
    const allGames = sheetToObjects_('pustaka_game_html');
    
    // 3. Format data untuk frontend
    const jadwal = reservations.map(r => {
      let htmlCode = '';
      if (r.game_id) {
        const game = allGames.find(g => g.game_id === r.game_id);
        if (game) htmlCode = game.html_embed_code;
      }

      // Cek apakah jurnal sudah diisi
      const jurnalExisting = sheetToObjects_('jurnal_harian_kbm').find(j => j.reservasi_id === r.reservasi_id);

      return {
        reservasi_id: r.reservasi_id,
        kelas_id: r.kelas_id,
        nama_kelas: kelasMap[r.kelas_id] || r.kelas_id,
        nama_ruangan: papanMap[r.papan_id] || r.papan_id,
        jam_mulai: r.jam_mulai,
        jam_selesai: r.jam_selesai,
        tp_id: r.tp_id,
        game_id: r.game_id,
        game_html: htmlCode,
        jurnal_id: jurnalExisting ? jurnalExisting.jurnal_id : null,
        materi: jurnalExisting ? jurnalExisting.materi_pembahasan : '',
        catatan: jurnalExisting ? jurnalExisting.catatan_hambatan : ''
      };
    });

    // Urutkan berdasarkan jam mulai
    jadwal.sort((a, b) => timeToMinutes_(a.jam_mulai) - timeToMinutes_(b.jam_mulai));

    return { jadwal };
  })();
}

function apiGetSiswaByKelas(token, kelasId) {
  return apiWrapper_(function() {
    requireSession_(token);
    const allSiswa = sheetToObjects_('master_siswa');
    return allSiswa.filter(s => s.kelas_id === kelasId && s.status_siswa === 'AKTIF');
  })();
}

function apiSaveJurnal(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['GURU', 'ADMIN']);

    const { reservasi_id, kelas_id, materi, catatan, presensi } = payload;

    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // 1. Simpan / Update Jurnal
      const sheetJurnal = ss.getSheetByName('jurnal_harian_kbm');
      let jurnalId = '';
      let rowIdx = -1;

      if (reservasi_id) {
        rowIdx = findRow_('jurnal_harian_kbm', 'reservasi_id', reservasi_id);
      }

      if (rowIdx !== -1) {
        // Update jurnal yang sudah ada
        const headers = sheetJurnal.getRange(1, 1, 1, sheetJurnal.getLastColumn()).getValues()[0];
        const jurnalData = sheetJurnal.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
        jurnalId = jurnalData[headers.indexOf('jurnal_id')];
        
        sheetJurnal.getRange(rowIdx, headers.indexOf('materi_pembahasan') + 1).setValue(materi);
        sheetJurnal.getRange(rowIdx, headers.indexOf('catatan_hambatan') + 1).setValue(catatan);
      } else {
        // Buat jurnal baru
        jurnalId = generateId_('jurnal_harian_kbm', 'jurnal_id', 'JRN');
        const newJurnal = [
          jurnalId,
          reservasi_id || '',
          session.userId,
          kelas_id,
          todayWIB(),
          materi,
          catatan
        ];
        sheetJurnal.appendRow(newJurnal);
      }

      // 2. Simpan Presensi (jika ada)
      if (presensi && Array.isArray(presensi) && presensi.length > 0) {
        const sheetPresensi = ss.getSheetByName('presensi_siswa');
        
        // Hapus presensi lama untuk jurnal ini (jika update)
        if (rowIdx !== -1) {
          const presData = sheetPresensi.getDataRange().getValues();
          for (let i = presData.length - 1; i >= 1; i--) {
            if (presData[i][1] === jurnalId) sheetPresensi.deleteRow(i + 1);
          }
        }

        // Insert presensi baru
        const newPresensiRows = presensi.map(p => [
          generateId_('presensi_siswa', 'presensi_id', 'ATT'), // Generate ID unik
          jurnalId,
          p.siswa_id,
          p.status_kehadiran,
          p.keterangan || ''
        ]);
        
        if (newPresensiRows.length > 0) {
          sheetPresensi.getRange(sheetPresensi.getLastRow() + 1, 1, newPresensiRows.length, 5).setValues(newPresensiRows);
        }
      }

      // 3. Update status reservasi jadi COMPLETED
      if (reservasi_id) {
        const rowRes = findRow_('reservasi_smartboard', 'reservasi_id', reservasi_id);
        if (rowRes !== -1) {
          const headersRes = ss.getSheetByName('reservasi_smartboard').getRange(1, 1, 1, ss.getSheetByName('reservasi_smartboard').getLastColumn()).getValues()[0];
          ss.getSheetByName('reservasi_smartboard').getRange(rowRes, headersRes.indexOf('status_reservasi') + 1).setValue('COMPLETED');
        }
      }

      return { jurnal_id: jurnalId, message: 'Jurnal berhasil disimpan' };
    });
  })();
}