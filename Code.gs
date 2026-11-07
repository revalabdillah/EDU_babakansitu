/**
 * ============================================================
 *  Code.gs — Main Router (FASE 3 Update)
 * ============================================================
 */

const APP_CONFIG = {
  APP_NAME: 'EduManage',
  APP_VERSION: '1.0.0',
  SCHOOL_NAME: 'SDN Babakansitu',
  TIMEZONE: 'Asia/Jakarta'
};

const PUBLIC_PAGES = ['login'];

const ROLE_MENU = {
  ADMIN: [
    { page: 'dashboard',         icon: 'dashboard',      label: 'Dashboard' },
    { page: 'pelaksanaan-kbm',   icon: 'co_present',      label: 'Pelaksanaan KBM' },
    { page: 'master-guru',       icon: 'group',          label: 'Data Guru' },
    { page: 'master-siswa',      icon: 'school',         label: 'Data Siswa' },
    { page: 'master-kelas',      icon: 'class',          label: 'Kelas' },
    { page: 'master-mapel',      icon: 'book',           label: 'Mata Pelajaran' },
    { page: 'mapping-mengajar',  icon: 'device_hub',     label: 'Pemetaan Mengajar' },
    { page: 'papan-interaktif',  icon: 'tv_gen',         label: 'Papan Interaktif' },
    { page: 'reservasi',         icon: 'cast_for_education', label: 'Reservasi Smartboard' }
  ],
  GURU: [
    { page: 'dashboard',         icon: 'dashboard',      label: 'Dashboard' },
    { page: 'master-siswa',      icon: 'school',         label: 'Data Siswa' }, 
    { page: 'perangkat-ajar',    icon: 'menu_book',      label: 'Perangkat Ajar' },
    { page: 'reservasi',         icon: 'cast_for_education', label: 'Reservasi Smartboard' },
    { page: 'pelaksanaan-kbm',   icon: 'co_present',      label: 'Pelaksanaan KBM' },
    { page: 'presensi',          icon: 'how_to_reg',     label: 'Presensi Siswa' },
    { page: 'penilaian',         icon: 'grade',          label: 'Penilaian' },
    { page: 'pengaturan-ai',     icon: 'smart_toy',      label: 'Pengaturan AI' },
    { page: 'catatan-supervisi', icon: 'assignment_turned_in', label: 'Catatan Supervisi' }
  ],
  KEPALA_SEKOLAH: [
    { page: 'dashboard',         icon: 'dashboard',      label: 'Dashboard Supervisi' },
    { page: 'monitoring-guru',   icon: 'visibility',     label: 'Monitoring Perangkat Ajar' },
    { page: 'analitik-smartboard', icon: 'analytics',    label: 'Analitik Smartboard' },
    { page: 'log-supervisi',     icon: 'comment',        label: 'Log Supervisi' },
    { page: 'laporan',           icon: 'summarize',      label: 'Laporan' }
  ]
};

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const page = params.page || 'login';
    const token = params.token || '';

    let user = null;
    if (!PUBLIC_PAGES.includes(page)) {
      const sessResult = apiGetSession(token);
      if (!sessResult.success) {
        const loginUrl = ScriptApp.getService().getUrl() + '?page=login';
        const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Redirecting...</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F8FAFC;color:#0F172A}
.box{text-align:center;padding:32px;background:#fff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.06);max-width:400px}
.spin{width:32px;height:32px;border:3px solid #E2E8F0;border-top-color:#2563EB;border-radius:50%;animation:s 0.8s linear infinite;margin:0 auto 16px}
@keyframes s{to{transform:rotate(360deg)}}
a{color:#2563EB;font-weight:600}</style>
</head><body><div class="box">
<div class="spin"></div>
<p>Mengalihkan ke halaman login...</p>
<p style="font-size:12px;color:#64748B;margin-top:16px">Jika tidak redirect otomatis, <a href="${loginUrl}">klik di sini</a>.</p>
</div>
<script>setTimeout(function(){ window.top.location.href='${loginUrl}'; }, 500);</script>
</body></html>`;
        return HtmlService.createHtmlOutput(html);
      }
      user = sessResult.data;
    }

    return servePage(page, { user, token });

  } catch (err) {
    console.error('doGet:', err);
    return serveError(500, err.message);
  }
}

function servePage(page, context) {
  // Whitelist halaman
  const allPages = [
    'login', 'dashboard', 'master-guru', 'master-siswa', 'master-kelas',
    'papan-interaktif', 'log-aktivitas', 'perangkat-ajar', 'reservasi', 'jurnal-kbm',
    'presensi', 'penilaian', 'pustaka-game', 'catatan-supervisi', 'monitoring-guru',
    'analitik-smartboard', 'log-supervisi', 'laporan', 'master-mapel', 'master-tp',
    'master-tahun-ajaran', 'mapping-mengajar','master-siswa','presensi','pengaturan-ai',
    'perangkat_ajar','pelaksanaan-kbm'
  ];

  if (!allPages.includes(page)) {
    return serveError(404, 'Halaman "' + page + '" tidak ditemukan');
  }

  const template = HtmlService.createTemplateFromFile('ui/layout');
  template.appConfig = APP_CONFIG;
  template.pageName = page;
  template.pageTitle = capitalize_(page);
  template.user = context.user;
  template.token = context.token || '';
  template.roleMenu = context.user ? (ROLE_MENU[context.user.role] || []) : [];
  template.webAppUrl = ScriptApp.getService().getUrl(); // Penting untuk navigasi Form Submit

  return template.evaluate()
    .setTitle(APP_CONFIG.APP_NAME + ' — ' + capitalize_(page))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function serveError(code, message) {
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error ${code}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a}
.c{text-align:center;padding:48px;background:#fff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.06);max-width:480px}
.n{font-size:72px;font-weight:800;color:#2563eb;line-height:1;margin-bottom:16px}
.m{color:#64748b;margin-bottom:24px}
.b{display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600}</style>
</head><body><div class="c"><div class="n">${code}</div><p class="m">${message}</p>
<a href="${ScriptApp.getService().getUrl()}?page=login" class="b">Kembali</a></div></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('Error ' + code);
}

function include(filename, data) {
  try {
    const template = HtmlService.createTemplateFromFile(filename + '.html');
    // Teruskan variabel jika ada
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(function(k) {
        template[k] = data[k];
      });
    }
    return template.evaluate().getContent();
  } catch (err) {
    console.error('include error: ' + filename + ' — ' + err.message);
    return '<!-- include failed: ' + filename + ' -->';
  }
}

function capitalize_(s) {
  return String(s).split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('🚀 EduManage')
      .addItem('Buka Web App', 'openWebAppFromMenu')
      .addItem('Test Koneksi', 'testConnection')
      .addSeparator()
      .addItem('Backup Database', 'backupDatabase')
      .addToUi();
  } catch (e) { /* ignore */ }
}

function openWebAppFromMenu() {
  const url = getScriptUrl();
  const html = HtmlService.createHtmlOutput(`<p><a href="${url}" target="_blank">${url}</a></p>`)
    .setWidth(500).setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, 'Buka Web App');
}

function backupDatabase() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const folderName = 'LMS-Backups';
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    const stamp = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HHmm');
    DriveApp.getFileById(ss.getId()).makeCopy(`${ss.getName()} — ${stamp}`, folder);
    SpreadsheetApp.getUi().alert('✅ Backup di folder Drive: ' + folderName);
  } catch (err) {
    SpreadsheetApp.getUi().alert('❌ Backup gagal: ' + err.message);
  }
}

/**
 * Router eksplisit untuk memanggil API dari frontend.
 */
function apiCallRouter(payload) {
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch(e) {}
  }

  const action = payload ? payload.action : 'UNDEFINED';
  const argsArray = (payload && payload.args) ? payload.args : [];

  console.log('🚀 ROUTER MASUK:', action, '| Args:', JSON.stringify(argsArray));

  try {
     const apis = {
      'apiLogin': apiLogin,
      'apiLogout': apiLogout,
      'apiGetSession': apiGetSession,
      'apiChangePassword': apiChangePassword,
      'apiReadAll': apiReadAll,
      'apiReadById': apiReadById,
      'apiCreate': apiCreate,
      'apiUpdate': apiUpdate,
      'apiDelete': apiDelete,
      'apiCheckAvailability': apiCheckAvailability,
      'apiCreateReservation': apiCreateReservation,
      'apiCancelReservation': apiCancelReservation,
      'apiCompleteReservation': apiCompleteReservation,
      'apiGetCalendarData': apiGetCalendarData,
      'apiGetUsers': apiGetUsers,
      'apiCreateUser': apiCreateUser,
      'apiResetPassword': apiResetPassword,
      'apiToggleUserActive': apiToggleUserActive,
      'apiGetAdminDashboard': apiGetAdminDashboard,
      'apiGetJadwalHariIni': apiGetJadwalHariIni,
      'apiGetSiswaByKelas': apiGetSiswaByKelas,
      'apiSaveJurnal': apiSaveJurnal,
      'apiGetGames': apiGetGames,
      'apiSaveGame': apiSaveGame,
      'apiGetSupervisi': apiGetSupervisi,
      'apiAddSupervisi': apiAddSupervisi,
      'apiGetKepsekDashboard': apiGetKepsekDashboard,
      'apiGetMonitoringGuru': apiGetMonitoringGuru,
      'apiGetActiveTahunAjaran': apiGetActiveTahunAjaran,
      'apiSaveTahunAjaran': apiSaveTahunAjaran,
      'apiDeleteTahunAjaran': apiDeleteTahunAjaran,
      'apiGetMappingMengajar': apiGetMappingMengajar,
      'apiCreateMapping': apiCreateMapping,
      'apiImportSiswa': apiImportSiswa,
      'apiMutasiSiswa': apiMutasiSiswa,
      'apiGetMyStudents': apiGetMyStudents,
      'apiGetSiswaUntukPresensi': apiGetSiswaUntukPresensi,
      'apiSavePresensi': apiSavePresensi,
      'apiGetRekapPresensi': apiGetRekapPresensi,
      'apiGetGuruClasses': apiGetGuruClasses,
      'apiSaveApiKey': apiSaveApiKey,
      'apiGetMyApiKeyStatus': apiGetMyApiKeyStatus,
      'apiGetPerangkat': apiGetPerangkat,
      'apiSavePerangkat': apiSavePerangkat,
      'apiDeletePerangkat': apiDeletePerangkat,
      //'apiGenerateAI': apiGenerateAI,
      'apiGetAIPrompt': apiGetAIPrompt,
      'apiSaveAIResult': apiSaveAIResult,
      'apiSaveAIResult': apiSaveAIResult,
      'apiGetFileContent': apiGetFileContent,
      'apiGetJadwalKbm': apiGetJadwalKbm, 
      'apiGetPerangkatForKbm': apiGetPerangkatForKbm,
      'apiSetMateriReservasi': apiSetMateriReservasi,
      'apiGetDetailKbm': apiGetDetailKbm,
      'apiSaveJurnalKbm': apiSaveJurnalKbm,
      'apiGetAnalitikSmartboard': apiGetAnalitikSmartboard
    };

    const fn = apis[action];
    if (typeof fn === 'function') {
      const result = fn.apply(null, argsArray);
      // Bersihkan Date sebelum dikembalikan ke Frontend
      return sanitizeForClient_(result); 
    }
    
    return { success: false, error: 'NOT_FOUND', message: 'Fungsi ' + action + ' tidak terdaftar' };
  } catch (e) {
    console.error('ROUTER ERROR:', e.message);
    return { success: false, error: 'ERROR', message: e.message };
  }
}

function testRouterDebug() {
  var res = apiCallRouter('apiGetUsers', JSON.stringify(['dummy_token', 'GURU']));
  console.log('Hasil Test Router:', res);
}

/**
 * Fungsi untuk mengisi data dummy (testing) ke Master Kelas, Papan, dan Siswa.
 */
function seedMasterDataForTesting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Isi Master Kelas (jika kosong)
  const sheetKelas = ss.getSheetByName('master_kelas');
  if (sheetKelas.getLastRow() <= 1) {
    sheetKelas.appendRow(['KLS-01A', 'Kelas 1-A', 1, '2026/2027', 'USR-A001']);
    sheetKelas.appendRow(['KLS-02A', 'Kelas 2-A', 2, '2026/2027', 'USR-A001']);
  }

  // 2. Isi Papan Interaktif (jika kosong)
  const sheetPapan = ss.getSheetByName('master_papan_interaktif');
  if (sheetPapan.getLastRow() <= 1) {
    sheetPapan.appendRow(['IFP-LAB01', 'Smartboard Lab Komputer', 'Gedung B - Lab', '75 Inch 4K', 'BAIK']);
    sheetPapan.appendRow(['IFP-KLS1A', 'Smartboard Kelas 1-A', 'Gedung A - Kelas 1-A', '65 Inch Touch', 'BAIK']);
  }

  // 3. Isi Master Siswa (jika kosong)
  const sheetSiswa = ss.getSheetByName('master_siswa');
  if (sheetSiswa.getLastRow() <= 1) {
    sheetSiswa.appendRow(['SIS-001', '0011223344', 'Ahmad Rizky', 'L', 'KLS-01A', 'AKTIF']);
    sheetSiswa.appendRow(['SIS-002', '0011223345', 'Bunga Sari', 'P', 'KLS-01A', 'AKTIF']);
    sheetSiswa.appendRow(['SIS-003', '0011223346', 'Citra Dewi', 'P', 'KLS-02A', 'AKTIF']);
  }

  console.log('✅ Data testing (Kelas, Papan, Siswa) berhasil ditambahkan ke Spreadsheet!');
}

/**
 * ============================================================
 *  SEEDER: DATA DUMMY (Guru, Kelas, Siswa)
 * ============================================================
 *  Jalankan fungsi ini SEKALI dari Editor Apps Script.
 */
function seedAllDummyData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. DATA GURU
  const sheetUsers = ss.getSheetByName('master_users');
  const headersUsers = sheetUsers.getRange(1, 1, 1, sheetUsers.getLastColumn()).getValues()[0];
  
  const dummyGuru = [
    {
      user_id: 'USR-G001', nama_lengkap: 'Budi Santoso, S.Pd', nip_nik: '198001012005011001', username: 'budisantoso', email: 'budi@sekolah.id', role: 'GURU', is_active: 'TRUE', created_at: nowWIB_()
    },
    {
      user_id: 'USR-G002', nama_lengkap: 'Siti Aminah, S.Pd', nip_nik: '198502022010012002', username: 'sitiaminah', email: 'siti@sekolah.id', role: 'GURU', is_active: 'TRUE', created_at: nowWIB_()
    },
    {
      user_id: 'USR-G003', nama_lengkap: 'Ahmad Fauzi, M.Pd', nip_nik: '199003032015031003', username: 'ahmadfauzi', email: 'ahmad@sekolah.id', role: 'GURU', is_active: 'TRUE', created_at: nowWIB_()
    }
  ];

  // Hash password default "guru123" untuk ketiga guru
  const saltGuru = generateSalt_();
  const hashGuru = hashPassword_('guru123', saltGuru);
  dummyGuru.forEach(g => { g.password_salt = saltGuru; g.password_hash = hashGuru; });

  const rowsUsers = dummyGuru.map(u => headersUsers.map(h => u[h] !== undefined ? u[h] : ''));
  
  // 2. DATA KELAS
  const sheetKelas = ss.getSheetByName('master_kelas');
  const headersKelas = sheetKelas.getRange(1, 1, 1, sheetKelas.getLastColumn()).getValues()[0];
  
  const dummyKelas = [
    { kelas_id: 'KLS-01A', nama_kelas: 'Kelas 1-A', tingkat: '1', tahun_ajaran: '2026/2027', wali_guru_id: 'USR-G001' },
    { kelas_id: 'KLS-02A', nama_kelas: 'Kelas 2-A', tingkat: '2', tahun_ajaran: '2026/2027', wali_guru_id: 'USR-G002' },
    { kelas_id: 'KLS-03A', nama_kelas: 'Kelas 3-A', tingkat: '3', tahun_ajaran: '2026/2027', wali_guru_id: 'USR-G003' }
  ];
  
  const rowsKelas = dummyKelas.map(k => headersKelas.map(h => k[h] !== undefined ? k[h] : ''));

  // 3. DATA SISWA (15 Siswa tersebar di 3 kelas)
  const sheetSiswa = ss.getSheetByName('master_siswa');
  const headersSiswa = sheetSiswa.getRange(1, 1, 1, sheetSiswa.getLastColumn()).getValues()[0];
  
  const dummySiswa = [];
  const namaDepan = ['Ahmad', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Gunawan', 'Hesti', 'Irfan', 'Julia', 'Kiki', 'Lina', 'Miko', 'Nina', 'Oki'];
  const namaBelakang = ['Pratama', 'Sari', 'Lestari', 'Hidayat', 'Wijaya', 'Rahayu', 'Saputra', 'Anggraini', 'Kurniawan', 'Safitri'];
  const kelasIds = ['KLS-01A', 'KLS-02A', 'KLS-03A'];

  for (let i = 0; i < 15; i++) {
    const isL = Math.random() > 0.5;
    const nama = `${namaDepan[i]} ${namaBelakang[Math.floor(Math.random() * namaBelakang.length)]}`;
    const kelas = kelasIds[i % 3]; // Rotasi kelas
    
    dummySiswa.push({
      siswa_id: 'SIS-DUM-' + String(i + 1).padStart(3, '0'),
      nisn: '00123456' + String(i + 10),
      nama_siswa: nama,
      jenis_kelamin: isL ? 'L' : 'P',
      kelas_id: kelas,
      status_siswa: (i === 14) ? 'MUTASI' : 'AKTIF', // Siswa terakhir dibuat mutasi untuk testing
      tempat_lahir: 'Bandung',
      tanggal_lahir: '2018-05-12',
      nama_orang_tua: `Orang Tua ${nama.split(' ')[0]}`,
      no_hp_orang_tua: '08123456789' + (i % 10),
      alamat: 'Jl. Pendidikan No. ' + (i + 1),
      tahun_pelajaran: '2026/2027',
      semester: 'Ganjil'
    });
  }
  
  const rowsSiswa = dummySiswa.map(s => headersSiswa.map(h => s[h] !== undefined ? s[h] : ''));

  // --- EKSEKUSI SIMPAN KE SPREADSHEET ---
  
  const startRowUsers = sheetUsers.getLastRow() + 1;
  if (rowsUsers.length > 0) sheetUsers.getRange(startRowUsers, 1, rowsUsers.length, headersUsers.length).setValues(rowsUsers);
  
  const startRowKelas = sheetKelas.getLastRow() + 1;
  if (rowsKelas.length > 0) sheetKelas.getRange(startRowKelas, 1, rowsKelas.length, headersKelas.length).setValues(rowsKelas);
  
  const startRowSiswa = sheetSiswa.getLastRow() + 1;
  if (rowsSiswa.length > 0) sheetSiswa.getRange(startRowSiswa, 1, rowsSiswa.length, headersSiswa.length).setValues(rowsSiswa);

  // Bersihkan Cache agar Web App langsung menampilkan data terbaru
  const cache = CacheService.getScriptCache();
  cache.remove('sheet_data_master_users');
  cache.remove('sheet_data_master_kelas');
  cache.remove('sheet_data_master_siswa');

  console.log('✅ Berhasil menambahkan Data Dummy:');
  console.log(`- ${dummyGuru.length} Guru (Password: guru123)`);
  console.log(`- ${dummyKelas.length} Kelas`);
  console.log(`- ${dummySiswa.length} Siswa`);
}


function clearAllCache() {
  CacheService.getScriptCache().removeAll(['sheet_data_perangkat_ajar']);
  console.log('✅ Cache perangkat ajar dibersihkan!');
}

function testBuatReservasi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('reservasi_smartboard');
  
  // Ambil ID papan dan kelas pertama untuk dummy
  const papanId = sheetToObjects_('master_papan_interaktif')[0]?.papan_id || 'IFP-01';
  const kelasId = sheetToObjects_('master_kelas')[0]?.kelas_id || 'KLS-01';
  const guruId = sheetToObjects_('master_users')[0]?.user_id || 'USR-A001';

  // Buat data dummy jam 08:00 - 10:00 pada tanggal 6 Nov 2026
  sheet.appendRow([
    'RSV-DUMMY-1', papanId, guruId, kelasId, '', '', 
    '2026-11-06', '08:00', '10:00', 'CONFIRMED', nowWIB_()
  ]);
  
  // Buat data dummy jam 13:00 - 14:30 pada tanggal 6 Nov 2026
  sheet.appendRow([
    'RSV-DUMMY-2', papanId, guruId, kelasId, '', '', 
    '2026-11-06', '13:00', '14:30', 'CONFIRMED', nowWIB_()
  ]);
  
  console.log('✅ Data dummy berhasil ditambahkan pada tanggal 2026-11-06');
}