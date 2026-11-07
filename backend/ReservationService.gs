/**
 * ============================================================
 *  ReservationService.gs — Booking Smartboard (FASE 2)
 * ============================================================
 *  Fitur paling kritikal: conflict detection dengan LockService.
 *  Formula: (newStart < oldEnd) AND (newEnd > oldStart)
 * ============================================================
 */

/**
 * Cek ketersediaan slot SEBELUM booking (read-only, tanpa lock).
 * @returns {Object} { available: bool, conflicts: [...] }
 */
function apiCheckAvailability(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN', 'GURU']);

    const { papan_id, tanggal_pinjam, jam_mulai, jam_selesai, exclude_reservasi_id } = payload || {};
    if (!papan_id || !tanggal_pinjam || !jam_mulai || !jam_selesai) {
      throw new Error('VALIDATION: papan_id, tanggal_pinjam, jam_mulai, jam_selesai wajib diisi');
    }

    const newStart = timeToMinutes_(jam_mulai);
    const newEnd = timeToMinutes_(jam_selesai);
    if (newStart >= newEnd) throw new Error('VALIDATION: jam_selesai harus > jam_mulai');

    const targetDate = normalizeDate_(tanggal_pinjam);

    const all = sheetToObjects_('reservasi_smartboard');
    const conflicts = all.filter(r => {
      if (String(r.status_reservasi) === 'CANCELLED') return false;
      if (String(r.papan_id) !== String(papan_id)) return false;
      if (normalizeDate_(r.tanggal_pinjam) !== targetDate) return false;
      if (exclude_reservasi_id && String(r.reservasi_id) === String(exclude_reservasi_id)) return false;

      const oldStart = timeToMinutes_(normalizeTime_(r.jam_mulai));
      const oldEnd = timeToMinutes_(normalizeTime_(r.jam_selesai));
      return (newStart < oldEnd) && (newEnd > oldStart);
    });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map(c => ({
        reservasi_id: c.reservasi_id,
        guru_id: c.guru_id,
        jam_mulai: c.jam_mulai,
        jam_selesai: c.jam_selesai,
        status: c.status_reservasi
      }))
    };
  })();
}

/**
 * Buat reservasi baru — DENGAN LockService (anti race condition).
 * Re-check konflik di dalam lock sebelum insert.
 */
function apiCreateReservation(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN', 'GURU']);

    const {
      papan_id, kelas_id, tp_id, game_id,
      tanggal_pinjam, jam_mulai, jam_selesai
    } = payload || {};

    // Validasi field wajib
    const required = { papan_id, kelas_id, tanggal_pinjam, jam_mulai, jam_selesai };
    Object.keys(required).forEach(k => {
      if (!required[k]) throw new Error(`VALIDATION: ${k} wajib diisi`);
    });

    // Validasi jam
    const newStart = timeToMinutes_(jam_mulai);
    const newEnd = timeToMinutes_(jam_selesai);
    if (newStart >= newEnd) throw new Error('VALIDATION: jam_selesai harus > jam_mulai');

    return withLock_(function() {
      // ⚠️ RE-CHECK KONFLIK DI DALAM LOCK (kritikal!)
      const availability = apiCheckAvailability(token, payload);
      if (!availability.success) throw new Error(availability.message);
      if (!availability.data.available) {
        const conflict = availability.data.conflicts[0];
        const startTime = normalizeTime_(conflict.jam_mulai);
        const endTime = normalizeTime_(conflict.jam_selesai);
        
        throw new Error(`CONFLICT: Slot bentrok dengan reservasi ${conflict.reservasi_id} (${startTime}–${endTime})`);
      }

      // Insert reservasi
      const newReservation = {
        reservasi_id: generateId_('reservasi_smartboard', 'reservasi_id', 'RSV'),
        papan_id: papan_id,
        guru_id: session.userId,
        kelas_id: kelas_id,
        tp_id: tp_id || '',
        game_id: game_id || '',
        tanggal_pinjam: normalizeDate_(tanggal_pinjam),
        jam_mulai: normalizeTime_(jam_mulai),
        jam_selesai: normalizeTime_(jam_selesai),
        status_reservasi: 'CONFIRMED',
        created_at: nowWIB()
      };

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('reservasi_smartboard');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      sheet.appendRow(headers.map(h => newReservation[h] !== undefined ? newReservation[h] : ''));

      console.log(`✅ Reservasi: ${newReservation.reservasi_id} @ ${tanggal_pinjam} ${jam_mulai}-${jam_selesai}`);
      return newReservation;
    });
  })();
}

/**
 * Batalkan reservasi (hanya pemilik atau admin).
 */
function apiCancelReservation(token, reservasiId, reason) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN', 'GURU']);

    return withLock_(function() {
      const rowIdx = findRow_('reservasi_smartboard', 'reservasi_id', reservasiId);
      if (rowIdx === -1) throw new Error(`NOT_FOUND: Reservasi ${reservasiId} tidak ada`);

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('reservasi_smartboard');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const guruIdx = headers.indexOf('guru_id') + 1;
      const statusIdx = headers.indexOf('status_reservasi') + 1;

      const ownerId = String(sheet.getRange(rowIdx, guruIdx).getValue());
      if (session.role !== 'ADMIN' && ownerId !== session.userId) {
        throw new Error('FORBIDDEN: Hanya pemilik reservasi atau Admin yang bisa membatalkan');
      }

      sheet.getRange(rowIdx, statusIdx).setValue('CANCELLED');
      console.log(`🗑️  Reservasi ${reservasiId} dibatalkan: ${reason || '-'}`);
      return { reservasi_id: reservasiId, status_reservasi: 'CANCELLED' };
    });
  })();
}

/**
 * Tandai reservasi selesai (COMPLETED) — setelah KBM berjalan.
 */
function apiCompleteReservation(token, reservasiId) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN', 'GURU']);

    return withLock_(function() {
      const rowIdx = findRow_('reservasi_smartboard', 'reservasi_id', reservasiId);
      if (rowIdx === -1) throw new Error(`NOT_FOUND: Reservasi ${reservasiId} tidak ada`);

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('reservasi_smartboard');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const statusIdx = headers.indexOf('status_reservasi') + 1;

      sheet.getRange(rowIdx, statusIdx).setValue('COMPLETED');
      return { reservasi_id: reservasiId, status_reservasi: 'COMPLETED' };
    });
  })();
}

/**
 * Ambil data kalender untuk minggu tertentu.
 */
function apiGetCalendarData(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const { start_date, end_date } = payload || {};

    // 👇 KITA BACA LANGSUNG DARI SPREADSHEET (Bypass Cache) 👇
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('reservasi_smartboard');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    let all = [];
    for(let i=1; i<data.length; i++) {
      let obj = {};
      headers.forEach((h, idx) => obj[h] = data[i][idx]);
      all.push(obj);
    }

    // Saring yang dibatalkan
    all = all.filter(r => String(r.status_reservasi) !== 'CANCELLED');
    
    const start = String(start_date).substring(0, 10);
    const end = String(end_date).substring(0, 10);
    
    if (start && end) {
      all = all.filter(r => {
        let rowDate = '';
        const rawDate = r.tanggal_pinjam;
        
        // Paksa format jadi YYYY-MM-DD
        if (rawDate instanceof Date) {
          rowDate = Utilities.formatDate(rawDate, 'Asia/Jakarta', 'yyyy-MM-dd');
        } else {
          rowDate = String(rawDate).substring(0, 10);
        }
        
        return rowDate >= start && rowDate <= end;
      });
    }

    const users = sheetToObjects_('master_users');
    const kelases = sheetToObjects_('master_kelas');
    const papans = sheetToObjects_('master_papan_interaktif');

    return all.map(r => {
      const guru = users.find(u => u.user_id === r.guru_id);
      const kelas = kelases.find(k => k.kelas_id === r.kelas_id);
      const papan = papans.find(p => p.papan_id === r.papan_id);

      return {
        ...r,
        // Pastikan jam dalam format string pendek
        jam_mulai: normalizeTime_(r.jam_mulai),
        jam_selesai: normalizeTime_(r.jam_selesai),
        guru_nama: guru ? guru.nama_lengkap : 'Guru',
        kelas_nama: kelas ? kelas.nama_kelas : 'Kelas',
        papan_nama: papan ? papan.nama_perangkat : 'Smartboard'
      };
    });
  })();
}
// ============================================================
// TEST — Termasuk stress test anti-bentrok
// ============================================================
function testReservation() {
  logInfo_('🧪 Testing Reservation (incl. stress test)...');

  const email = Session.getActiveUser().getEmail();
  const login = apiLogin(email, 'admin123');
  if (!login.success) { logError_('Login gagal'); return; }
  const token = login.data.token;

  // Buat papan & kelas test
  const papan = apiCreate(token, 'master_papan_interaktif', {
    nama_perangkat: 'Test Board ' + Date.now(),
    lokasi_ruangan: 'Lab Test',
    spesifikasi: 'Test',
    status_kondisi: 'BAIK'
  });
  const kelas = apiCreate(token, 'master_kelas', {
    nama_kelas: 'Test Class', tingkat: 1, tahun_ajaran: '2026/2027'
  });
  if (!papan.success || !kelas.success) { logError_('Setup test gagal'); return; }

  const papanId = papan.data.papan_id;
  const kelasId = kelas.data.kelas_id;
  const tanggal = '2026-11-05';

  // 1. Booking pertama (sukses)
  const b1 = apiCreateReservation(token, {
    papan_id: papanId, kelas_id: kelasId,
    tanggal_pinjam: tanggal, jam_mulai: '08:00', jam_selesai: '09:30'
  });
  logInfo_('Booking #1: ' + (b1.success ? `✅ ${b1.data.reservasi_id}` : `❌ ${b1.message}`));

  // 2. Booking bentrok (harus gagal)
  const b2 = apiCreateReservation(token, {
    papan_id: papanId, kelas_id: kelasId,
    tanggal_pinjam: tanggal, jam_mulai: '09:00', jam_selesai: '10:30'
  });
  logInfo_('Booking #2 (bentrok): ' + (!b2.success ? `✅ ditolak (${b2.error})` : `❌ ANEH — berhasil!`));

  // 3. Booking non-bentrok (harus sukses)
  const b3 = apiCreateReservation(token, {
    papan_id: papanId, kelas_id: kelasId,
    tanggal_pinjam: tanggal, jam_mulai: '10:00', jam_selesai: '11:30'
  });
  logInfo_('Booking #3 (non-bentrok): ' + (b3.success ? `✅ ${b3.data.reservasi_id}` : `❌ ${b3.message}`));

  // 4. Cek ketersediaan untuk slot yang bentrok
  const chk = apiCheckAvailability(token, {
    papan_id: papanId, tanggal_pinjam: tanggal, jam_mulai: '08:30', jam_selesai: '09:00'
  });
  logInfo_('Availability cek (should conflict): ' +
    (chk.success && !chk.data.available ? '✅ conflict terdeteksi' : `❌ aneh`));

  // Cleanup
  [b1, b3].forEach(r => { if (r.success) apiCancelReservation(token, r.data.reservasi_id, 'test cleanup'); });
  apiDelete(token, 'master_papan_interaktif', papanId);
  apiDelete(token, 'master_kelas', kelasId);
  logInfo_('✅ Cleanup selesai');
}