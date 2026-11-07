/**
 * ============================================================
 *  Utils.gs — Helper Functions (FASE 2)
 * ============================================================
 *  Fungsi generik yang dipakai semua service:
 *  ID generator, time, response, role guard, lock wrapper.
 * ============================================================
 */

// ============================================================
// RESPONSE FORMAT — Standar konsisten semua API
// ============================================================
function ok_(data, message) {
  return { success: true, data: data === undefined ? null : data, message: message || 'OK' };
}

function fail_(code, message, details) {
  return { success: false, error: code || 'ERROR', message: message || 'Terjadi kesalahan', details: details || null };
}

// ============================================================
// ID GENERATOR — Format: <PREFIX>-<YYYYMMDD>-<NNN>
// ============================================================
/**
 * Generate ID unik per sheet berdasarkan prefix & tanggal.
 * Contoh: RSV-20261102-001
 */
function generateId_(sheetName, idColumn, prefix) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" tidak ditemukan`);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    const today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd');
    return `${prefix}-${today}-001`;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIdx = headers.indexOf(idColumn);
  if (idIdx === -1) throw new Error(`Kolom "${idColumn}" tidak ditemukan di "${sheetName}"`);

  const today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd');
  const allIds = sheet.getRange(2, idIdx + 1, lastRow - 1, 1).getValues().flat();
  const prefixToday = `${prefix}-${today}-`;
  const todayIds = allIds.filter(id => String(id).startsWith(prefixToday));

  let maxSeq = 0;
  todayIds.forEach(id => {
    const seq = parseInt(String(id).split('-').pop(), 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  });

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefixToday}${nextSeq}`;
}

// ============================================================
// TIME HELPERS
// ============================================================
function nowWIB() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}

function todayWIB() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}

/** Convert "HH:mm" → total menit sejak 00:00 */
function timeToMinutes_(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
}

/** Normalize date → "yyyy-MM-dd" (terima Date object atau string) */
function normalizeDate_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  return String(val).substring(0, 10);
}

/** Normalize time → "HH:mm" */
/** Normalize time → "HH:mm" (Mengatasi format Date 1899 dari Sheets) */
function normalizeTime_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Jakarta', 'HH:mm');
  }
  const str = String(val);
  // Jika string mengandung spasi (misal: "1899-12-30 08:00:00"), ambil bagian jamnya
  if (str.includes(' ')) {
    const timePart = str.split(' ')[1]; // Ambil "08:00:00"
    return timePart.substring(0, 5);    // Ambil "08:00"
  }
  // Jika sudah "08:00", langsung kembalikan
  return str.substring(0, 5);
}

// ============================================================
// SHEET HELPERS
// ============================================================
/**
 * Ambil semua baris sheet sebagai array of objects (DENGAN CACHE)
 */
function sheetToObjects_(sheetName) {
  const cacheKey = 'sheet_data_' + sheetName;
  const cached = CacheService.getScriptCache().get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" tidak ditemukan`);

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const result = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 600);
  } catch (e) {
    console.warn('Cache terlalu besar, dilewati:', sheetName);
  }

  return result;
}


/**
 * Cari baris index (1-based) berdasarkan nilai di kolom tertentu.
 * @returns {number} row index, atau -1 jika tidak ditemukan
 */
function findRow_(sheetName, columnName, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" tidak ditemukan`);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIdx = headers.indexOf(columnName);
  if (colIdx === -1) throw new Error(`Kolom "${columnName}" tidak ditemukan di "${sheetName}"`);

  const values = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(value)) return i + 2; // +2: skip header, 1-based
  }
  return -1;
}

// ============================================================
// LOCK WRAPPER — Untuk operasi mutasi (create/update/delete)
// ============================================================
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(10000); // 10 detik
  if (!acquired) {
    throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// CACHE HELPERS — Untuk session & cache aggregasi
// ============================================================
const CACHE_ = {
  get: function(key) {
    const raw = CacheService.getScriptCache().get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  },
  put: function(key, value, seconds) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    CacheService.getScriptCache().put(key, raw, seconds || 21600); // default 6 jam
  },
  remove: function(key) {
    CacheService.getScriptCache().remove(key);
  }
};

// ============================================================
// SESSION GUARD — Untuk fungsi yang butuh login
// ============================================================
/**
 * Verifikasi token session. Throw error jika tidak valid.
 */
function requireSession_(token) {
  if (!token) throw new Error('TOKEN_MISSING');
  const session = CACHE_.get('sess_' + token);
  if (!session) throw new Error('SESSION_EXPIRED');
  return session;
}

/**
 * Verifikasi role. Throw error jika tidak sesuai.
 */
function requireRole_(session, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return;
  if (!allowedRoles.includes(session.role)) {
    throw new Error(`FORBIDDEN: Akses ditolak. Dibutuhkan role: ${allowedRoles.join('/')}, Anda: ${session.role}`);
  }
}

// ============================================================
// WRAPPER — Standar API endpoint dengan error handling
// ============================================================
function apiWrapper_(fn) {
  return function() {
    const args = Array.prototype.slice.call(arguments);
    try {
      const result = fn.apply(null, args);
      if (result && typeof result === 'object' && 'success' in result) return result;
      return ok_(result);
    } catch (err) {
      console.error('API Error:', err.message, err.stack);
      return fail_(err.message.split(':')[0], err.message);
    }
  };
}

/**
 * Membersihkan objek dari tipe data Date sebelum dikirim ke Frontend.
 */
function sanitizeForClient_(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (obj instanceof Date) {
    return Utilities.formatDate(obj, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForClient_);
  }
  
  if (typeof obj === 'object') {
    const clean = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clean[key] = sanitizeForClient_(obj[key]);
      }
    }
    return clean;
  }
  
  return obj;
}

// ============================================================
// SECURITY HELPERS — Hashing Password & Salt
// ============================================================

/**
 * Generate salt acak 32 karakter untuk keamanan password
 */
function generateSalt_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 32);
}

/**
 * Mengubah password menjadi hash SHA-256 yang tidak bisa dibaca (enkripsi satu arah)
 */
function hashPassword_(password, salt) {
  const combined = salt + password;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined, Utilities.Charset.UTF_8);
  return digest.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Mengambil ID Tahun Ajaran yang sedang aktif.
 * Jika tidak ada yang aktif, return 'UNKNOWN'.
 */
function getActiveTahunAjaranId_() {
  try {
    const allTA = sheetToObjects_('master_tahun_ajaran');
    const active = allTA.find(t => String(t.is_aktif).toUpperCase() === 'TRUE');
    return active ? active.tahun_ajaran_id : 'UNKNOWN';
  } catch (e) {
    return 'UNKNOWN';
  }
}