/**
 * ============================================================
 *  UserService.gs — CRUD User + Generate Password (FASE 2)
 * ============================================================
 */

function apiGetUsers(token, roleFilter) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    let users = sheetToObjects_('master_users');
    if (roleFilter) {
      users = users.filter(u => u.role === roleFilter);
    }

    // Hapus password_hash & salt dari response
    return users.map(u => {
      const clean = Object.assign({}, u);
      delete clean.password_hash;
      delete clean.password_salt;
      return clean;
    });
  })();
}

function apiCreateUser(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    if (!payload.email) throw new Error('VALIDATION: Email wajib diisi');
    if (!payload.nama_lengkap) throw new Error('VALIDATION: Nama lengkap wajib diisi');
    if (!payload.role) throw new Error('VALIDATION: Role wajib diisi');
    if (!['ADMIN', 'GURU', 'KEPALA_SEKOLAH'].includes(payload.role)) {
      throw new Error('VALIDATION: Role tidak valid');
    }

    const existing = sheetToObjects_('master_users');
    if (existing.some(u => String(u.email).toLowerCase() === String(payload.email).toLowerCase())) {
      throw new Error('DUPLICATE: Email sudah terdaftar');
    }
    
    // Auto-generate username
    let uname = String(payload.username || '').trim().toLowerCase();
    if (!uname) uname = String(payload.email).split('@')[0].toLowerCase();
    
    if (existing.some(u => String(u.username).toLowerCase() === uname)) {
       throw new Error('DUPLICATE: Username sudah dipakai, gunakan username lain');
    }

    const tempPassword = generateTempPassword_();
    const salt = generateSalt_();
    const hash = hashPassword_(tempPassword, salt);

    const newUser = {
      user_id: generateId_('master_users', 'user_id', 'USR'),
      nama_lengkap: payload.nama_lengkap,
      nip_nik: payload.nip_nik || '',
      username: uname,
      email: String(payload.email).toLowerCase(),
      password_hash: hash,
      password_salt: salt,
      role: payload.role,
      is_active: 'TRUE',
      created_at: nowWIB()
    };

    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('master_users');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const row = headers.map(h => newUser[h] || '');
      sheet.appendRow(row);

      CacheService.getScriptCache().remove('sheet_data_master_users');

      return {
        user: { user_id: newUser.user_id, nama_lengkap: newUser.nama_lengkap, email: newUser.email, username: newUser.username, role: newUser.role },
        tempPassword: tempPassword,
        message: 'Simpan password sementara ini'
      };
    });
  })();
}

function apiResetPassword(token, userId) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    const rowIdx = findRow_('master_users', 'user_id', userId);
    if (rowIdx === -1) throw new Error(`NOT_FOUND: User ${userId} tidak ada`);

    const newPassword = generateTempPassword_();
    const newSalt = generateSalt_();
    const newHash = hashPassword_(newPassword, newSalt);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('master_users');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    sheet.getRange(rowIdx, headers.indexOf('password_salt') + 1).setValue(newSalt);
    sheet.getRange(rowIdx, headers.indexOf('password_hash') + 1).setValue(newHash);

    CacheService.getScriptCache().remove('sheet_data_master_users');
    return { userId, newPassword };
  })();
}

function apiToggleUserActive(token, userId) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    const rowIdx = findRow_('master_users', 'user_id', userId);
    if (rowIdx === -1) throw new Error(`NOT_FOUND: User ${userId} tidak ada`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('master_users');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const activeIdx = headers.indexOf('is_active') + 1;

    const current = String(sheet.getRange(rowIdx, activeIdx).getValue()).toUpperCase();
    const next = current === 'TRUE' ? 'FALSE' : 'TRUE';
    sheet.getRange(rowIdx, activeIdx).setValue(next);

    CacheService.getScriptCache().remove('sheet_data_master_users');
    return { userId, is_active: next };
  })();
}

function generateTempPassword_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 10; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

// ============================================================
// PENGATURAN API KEY AI
// ============================================================

function apiSaveApiKey(token, apiKey) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    
    return withLock_(function() {
      const rowIdx = findRow_('master_users', 'user_id', session.userId);
      if (rowIdx === -1) throw new Error('User tidak ditemukan');

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('master_users');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      let colIdx = headers.indexOf('api_key_ai');
      if (colIdx === -1) {
        // Jika kolom belum ada, buat otomatis
        sheet.getRange(1, headers.length + 1).setValue('api_key_ai');
        colIdx = headers.length;
      }

      sheet.getRange(rowIdx, colIdx + 1).setValue(apiKey);
      CacheService.getScriptCache().remove('sheet_data_master_users');
      
      return { message: 'API Key berhasil disimpan' };
    });
  })();
}

function apiGetMyApiKeyStatus(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    const users = sheetToObjects_('master_users');
    const user = users.find(u => u.user_id === session.userId);
    
    // Jangan kirim API Key asli ke frontend demi keamanan, kirim status boolean saja
    return { hasApiKey: !!(user && user.api_key_ai && String(user.api_key_ai).trim() !== '') };
  })();
}