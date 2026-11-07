/**
 * ============================================================
 *  AuthService.gs — Login, Logout, Session (FASE 2)
 * ============================================================
 */

const SESSION_TTL_SECONDS = 21600; // 6 jam

/**
 * Login: verifikasi email + password → return token session.
 * @param {string} email
 * @param {string} password (plain)
 * @returns {Object} { success, data: { token, user: {...} } }
 */
function apiLogin(emailOrUsername, password) {
  return apiWrapper_(function() {
    if (!emailOrUsername || !password) throw new Error('VALIDATION: Email/Username dan password wajib diisi');
    const identifier = String(emailOrUsername).trim().toLowerCase();

    const users = sheetToObjects_('master_users');
    
    // 👇 Cari berdasarkan email ATAU username 👇
    const user = users.find(u => {
      const uEmail = String(u.email || '').toLowerCase();
      const uName = String(u.username || '').toLowerCase();
      return uEmail === identifier || (uName !== '' && uName === identifier);
    });

    if (!user) throw new Error('INVALID_CREDENTIALS: Email/Username atau password salah');
    if (String(user.is_active).toUpperCase() !== 'TRUE') {
      throw new Error('INACTIVE: Akun Anda dinonaktifkan. Hubungi Admin.');
    }

    // Verifikasi password
    const expectedHash = hashPassword_(password, user.password_salt);
    if (expectedHash !== user.password_hash) {
      throw new Error('INVALID_CREDENTIALS: Email/Username atau password salah');
    }

    // Generate token & simpan di cache
    const token = Utilities.getUuid();
    const session = {
      userId: user.user_id,
      email: user.email,
      username: user.username || '',
      role: user.role,
      name: user.nama_lengkap,
      loginAt: nowWIB()
    };
    CACHE_.put('sess_' + token, session, SESSION_TTL_SECONDS);

    console.log(`✅ Login: ${user.email} (${user.role})`);

    return {
      token: token,
      user: session,
      expiresIn: SESSION_TTL_SECONDS
    };
  })();
}
/**
 * Logout: hapus session dari cache.
 */
function apiLogout(token) {
  return apiWrapper_(function() {
    if (token) CACHE_.remove('sess_' + token);
    return { loggedOut: true };
  })();
}

/**
 * Cek session aktif (client bisa pakai untuk validasi di awal load).
 */
function apiGetSession(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    return session;
  })();
}

/**
 * Ganti password untuk user sendiri.
 */
function apiChangePassword(token, oldPassword, newPassword) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    if (!oldPassword || !newPassword) throw new Error('VALIDATION: Password lama & baru wajib diisi');
    if (String(newPassword).length < 6) throw new Error('VALIDATION: Password baru minimal 6 karakter');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('master_users');
    const rowIdx = findRow_('master_users', 'user_id', session.userId);
    if (rowIdx === -1) throw new Error('NOT_FOUND: User tidak ditemukan');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const saltIdx = headers.indexOf('password_salt');
    const hashIdx = headers.indexOf('password_hash');

    const oldSalt = sheet.getRange(rowIdx, saltIdx + 1).getValue();
    const oldHash = sheet.getRange(rowIdx, hashIdx + 1).getValue();

    if (hashPassword_(oldPassword, oldSalt) !== oldHash) {
      throw new Error('INVALID_CREDENTIALS: Password lama salah');
    }

    const newSalt = generateSalt_();
    const newHash = hashPassword_(newPassword, newSalt);
    sheet.getRange(rowIdx, saltIdx + 1).setValue(newSalt);
    sheet.getRange(rowIdx, hashIdx + 1).setValue(newHash);

    return { changed: true };
  })();
}

// ============================================================
// TEST FUNCTION — Jalankan dari Apps Script editor
// ============================================================
function testAuth() {
  logInfo_('🧪 Testing Auth...');

  // 1. Login sukses
  const email = Session.getActiveUser().getEmail();
  const r1 = apiLogin(email, 'admin123');
  logInfo_('Login: ' + (r1.success ? `✅ token=${r1.data.token.substring(0,8)}...` : `❌ ${r1.message}`));
  if (!r1.success) return;

  // 2. Cek session
  const r2 = apiGetSession(r1.data.token);
  logInfo_('GetSession: ' + (r2.success ? `✅ user=${r2.data.name} (${r2.data.role})` : `❌ ${r2.message}`));

  // 3. Login salah password
  const r3 = apiLogin(email, 'wrongpassword');
  logInfo_('WrongPass: ' + (!r3.success ? `✅ ditolak (${r3.error})` : `❌ anehnya berhasil`));

  // 4. Logout
  const r4 = apiLogout(r1.data.token);
  logInfo_('Logout: ' + (r4.success ? '✅' : `❌ ${r4.message}`));

  // 5. Cek session setelah logout (harus gagal)
  const r5 = apiGetSession(r1.data.token);
  logInfo_('AfterLogout: ' + (!r5.success ? `✅ session expired (${r5.error})` : `❌ masih aktif`));
}