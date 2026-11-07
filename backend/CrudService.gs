/**
 * ============================================================
 *  CrudService.gs — Generic CRUD untuk semua sheet (FASE 2)
 * ============================================================
 *  Setiap sheet punya 1 "id" column sebagai identifier.
 *  Semua fungsi wajib token session valid + role check.
 * ============================================================
 */

// Mapping sheet → info meta
const CRUD_META = {
  master_users:            { id: 'user_id',       prefix: 'USR', roles: ['ADMIN'] },
  master_kelas:            { id: 'kelas_id',      prefix: 'KLS', roles: ['ADMIN'] },
  master_siswa:            { id: 'siswa_id',      prefix: 'SIS', roles: ['ADMIN'] },
  master_mapel:            { id: 'mapel_id',      prefix: 'MPL', roles: ['ADMIN'] },
  master_tp:               { id: 'tp_id',         prefix: 'TP',  roles: ['ADMIN', 'GURU'] },
  master_papan_interaktif: { id: 'papan_id',      prefix: 'IFP', roles: ['ADMIN'] },
  pustaka_game_html:       { id: 'game_id',       prefix: 'GME', roles: ['ADMIN', 'GURU'] },
  perangkat_ajar:          { id: 'perangkat_id',  prefix: 'PRA', roles: ['ADMIN', 'GURU'] },
  reservasi_smartboard:    { id: 'reservasi_id',  prefix: 'RSV', roles: ['ADMIN', 'GURU'] },
  jurnal_harian_kbm:       { id: 'jurnal_id',     prefix: 'JRN', roles: ['ADMIN', 'GURU'] },
  presensi_siswa:          { id: 'presensi_id',   prefix: 'ATT', roles: ['ADMIN', 'GURU'] },
  penilaian_formatif_sumatif: { id: 'nilai_id',   prefix: 'NLE', roles: ['ADMIN', 'GURU'] },
  log_supervisi:           { id: 'log_id',        prefix: 'SUP', roles: ['KEPALA_SEKOLAH'], },
    mapping_mengajar:        { id: 'mapping_id',    prefix: 'MAP', roles: ['ADMIN'] },
    master_tahun_ajaran:     { id: 'tahun_ajaran_id', prefix: 'TA', roles: ['ADMIN'] }
};

/**
 * READ ALL — Ambil semua baris. Opsional filter.
 * @param {string} token
 * @param {string} sheetName
 * @param {Object} [filter] - { columnName: expectedValue, ... }
 */
function apiReadAll(token, sheetName, filter) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const meta = CRUD_META[sheetName];
    if (!meta) throw new Error(`INVALID_SHEET: Sheet "${sheetName}" tidak terdaftar`);

    // HAPUS pengecekan role di sini. Siapapun yang sudah login boleh membaca data master.
    // Pembatasan role tetap berlaku untuk Create/Update/Delete (fungsi lainnya).

    let rows = sheetToObjects_(sheetName);

    if (filter && typeof filter === 'object') {
      rows = rows.filter(row =>
        Object.keys(filter).every(k => String(row[k]) === String(filter[k]))
      );
    }

    return rows;
  })();
}

/**
 * READ BY ID
 */
function apiReadById(token, sheetName, idValue) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const meta = CRUD_META[sheetName];
    if (!meta) throw new Error(`INVALID_SHEET`);

    const rows = sheetToObjects_(sheetName);
    const found = rows.find(r => String(r[meta.id]) === String(idValue));
    if (!found) throw new Error(`NOT_FOUND: ${sheetName} dengan ID ${idValue} tidak ditemukan`);
    return found;
  })();
}

/**
 * CREATE — Tambah 1 baris baru.
 * ID di-generate otomatis (jika belum ada di payload).
 */
function apiCreate(token, sheetName, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const meta = CRUD_META[sheetName];
    if (!meta) throw new Error(`INVALID_SHEET`);
    requireRole_(session, meta.roles);

    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Generate ID jika belum ada
      const data = Object.assign({}, payload);
      if (!data[meta.id]) {
        data[meta.id] = generateId_(sheetName, meta.id, meta.prefix);
      } else if (findRow_(sheetName, meta.id, data[meta.id]) !== -1) {
        throw new Error(`DUPLICATE: ${meta.id} = ${data[meta.id]} sudah ada`);
      }

      // Auto-fill created_at jika kolomnya ada
      if (headers.includes('created_at') && !data.created_at) {
        data.created_at = nowWIB();
      }

      // Build row sesuai urutan header
      const row = headers.map(h => data[h] !== undefined ? data[h] : '');

      sheet.appendRow(row);
      CacheService.getScriptCache().remove('sheet_data_' + sheetName);
      return data;
    });
  })();
}

/**
 * UPDATE — Update baris berdasarkan ID.
 */
function apiUpdate(token, sheetName, idValue, updates) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const meta = CRUD_META[sheetName];
    if (!meta) throw new Error(`INVALID_SHEET`);
    requireRole_(session, meta.roles);

    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      const rowIdx = findRow_(sheetName, meta.id, idValue);
      if (rowIdx === -1) throw new Error(`NOT_FOUND: ${meta.id} = ${idValue} tidak ditemukan`);

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Update hanya field yang ada di `updates`
      Object.keys(updates).forEach(key => {
        const colIdx = headers.indexOf(key);
        if (colIdx === -1) {
          console.warn(`Skip unknown field: ${key}`);
          return;
        }
        if (key === meta.id) return; // tidak boleh update ID
        sheet.getRange(rowIdx, colIdx + 1).setValue(updates[key]);
      });
      CacheService.getScriptCache().remove('sheet_data_' + sheetName);
      return { updated: true, idValue };
    });
  })();
}

/**
 * DELETE — Hapus baris berdasarkan ID.
 */
function apiDelete(token, sheetName, idValue) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const meta = CRUD_META[sheetName];
    if (!meta) throw new Error(`INVALID_SHEET`);
    requireRole_(session, meta.roles);

    return withLock_(function() {
      const rowIdx = findRow_(sheetName, meta.id, idValue);
      if (rowIdx === -1) throw new Error(`NOT_FOUND: ${meta.id} = ${idValue} tidak ditemukan`);

      SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(sheetName)
        .deleteRow(rowIdx);
      CacheService.getScriptCache().remove('sheet_data_' + sheetName);
      return { deleted: true, idValue };
    });
  })();
}

// ============================================================
// TEST FUNCTION
// ============================================================
function testCrud() {
  logInfo_('🧪 Testing CRUD...');

  const email = Session.getActiveUser().getEmail();
  const login = apiLogin(email, 'admin123');
  if (!login.success) { logError_('Login gagal: ' + login.message); return; }
  const token = login.data.token;

  // CREATE kelas
  const r1 = apiCreate(token, 'master_kelas', {
    nama_kelas: 'Kelas 1-A',
    tingkat: 1,
    tahun_ajaran: '2026/2027',
    wali_guru_id: 'USR-A001'
  });
  logInfo_('Create kelas: ' + (r1.success ? `✅ ${r1.data.kelas_id}` : `❌ ${r1.message}`));

  if (r1.success) {
    // READ
    const r2 = apiReadById(token, 'master_kelas', r1.data.kelas_id);
    logInfo_('ReadById: ' + (r2.success ? `✅ ${r2.data.nama_kelas}` : `❌ ${r2.message}`));

    // UPDATE
    const r3 = apiUpdate(token, 'master_kelas', r1.data.kelas_id, { nama_kelas: 'Kelas 1-A (Updated)' });
    logInfo_('Update: ' + (r3.success ? '✅' : `❌ ${r3.message}`));

    // DELETE (cleanup)
    const r4 = apiDelete(token, 'master_kelas', r1.data.kelas_id);
    logInfo_('Delete: ' + (r4.success ? '✅ (cleanup)' : `❌ ${r4.message}`));
  }
}