/**
 * ============================================================
 *  DatabaseSetup.gs — Setup Database LMS v2.0 (Final)
 * ============================================================
 *  Jalankan fungsi setupDatabase() SEKALI dari Editor Apps Script.
 * ============================================================
 */

const DB_SCHEMA = {
  '_config': {
    headers: ['key', 'value', 'description'],
    validations: {}, colWidths: [220, 320, 400]
  },
  'master_users': {
    headers: ['user_id', 'nama_lengkap', 'nip_nik', 'username', 'email', 'password_hash', 'password_salt', 'role', 'is_active', 'created_at'],
    validations: { 'role': ['ADMIN', 'GURU', 'KEPALA_SEKOLAH'], 'is_active': ['TRUE', 'FALSE'] },
    colWidths: [120, 220, 180, 150, 240, 200, 100, 160, 100, 170]
  },
  'master_kelas': {
    headers: ['kelas_id', 'nama_kelas', 'tingkat', 'tahun_ajaran', 'wali_guru_id'],
    validations: {}, colWidths: [100, 130, 80, 130, 130]
  },
  'master_siswa': {
    headers: ['siswa_id', 'nisn', 'nama_siswa', 'jenis_kelamin', 'kelas_id', 'status_siswa', 'tempat_lahir', 'tanggal_lahir', 'nama_orang_tua', 'no_hp_orang_tua', 'alamat', 'tahun_pelajaran', 'semester'],
    validations: { 'jenis_kelamin': ['L', 'P'], 'status_siswa': ['AKTIF', 'MUTASI', 'LULUS'], 'semester': ['Ganjil', 'Genap'] },
    colWidths: [120, 130, 220, 110, 100, 120, 150, 130, 200, 150, 300, 130, 100]
  },
  'riwayat_mutasi_siswa': {
    headers: ['mutasi_id', 'siswa_id', 'jenis_mutasi', 'tanggal_mutasi', 'kelas_asal', 'kelas_tujuan', 'keterangan'],
    validations: { 'jenis_mutasi': ['PINDAH', 'KELUAR', 'MASUK'] },
    colWidths: [170, 120, 130, 130, 120, 120, 300]
  },
  'master_mapel': {
    headers: ['mapel_id', 'kode_mapel', 'nama_mapel', 'fase'],
    validations: { 'fase': ['Fase A', 'Fase B', 'Fase C'] },
    colWidths: [100, 120, 220, 120]
  },
  'master_tp': {
    headers: ['tp_id', 'mapel_id', 'fase_tingkat', 'elemen', 'deskripsi_cp', 'kode_tp', 'deskripsi_tp', 'judul_materi', 'sub_materi', 'profil_pancasila'],
    validations: {}, colWidths: [130, 100, 140, 150, 400, 100, 400, 200, 300, 200]
  },
  'master_papan_interaktif': {
    headers: ['papan_id', 'nama_perangkat', 'lokasi_ruangan', 'spesifikasi', 'status_kondisi'],
    validations: { 'status_kondisi': ['BAIK', 'MAINTENANCE', 'RUSAK'] },
    colWidths: [120, 260, 260, 260, 130]
  },
  'pustaka_game_html': {
    headers: ['game_id', 'judul_game', 'deskripsi', 'html_embed_code', 'tp_id', 'created_by'],
    validations: {}, colWidths: [130, 260, 320, 400, 130, 120]
  },
  'perangkat_ajar_promes': {
    headers: ['promes_id', 'guru_id', 'kelas_id', 'tp_id', 'bulan_ke', 'minggu_ke', 'alokasi_jam', 'status_dokumen', 'tanggal_publish', 'catatan_supervisi_terakhir', 'tanggal_supervisi_terakhir'],
    validations: { 'status_dokumen': ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
    colWidths: [150, 120, 100, 130, 90, 90, 100, 130, 170, 320, 180]
  },
  'reservasi_smartboard': {
    headers: ['reservasi_id', 'papan_id', 'guru_id', 'kelas_id', 'tp_id', 'game_id', 'tanggal_pinjam', 'jam_mulai', 'jam_selesai', 'status_reservasi', 'created_at'],
    validations: { 'status_reservasi': ['CONFIRMED', 'CANCELLED', 'COMPLETED'] },
    colWidths: [170, 120, 120, 100, 130, 130, 130, 100, 100, 150, 170]
  },
  'jurnal_harian_kbm': {
    headers: ['jurnal_id', 'reservasi_id', 'guru_id', 'kelas_id', 'tanggal', 'materi_pembahasan', 'catatan_hambatan'],
    validations: {}, colWidths: [170, 170, 120, 100, 120, 400, 400]
  },
  'presensi_siswa': {
    headers: ['presensi_id', 'jurnal_id', 'siswa_id', 'status_kehadiran', 'keterangan'],
    validations: { 'status_kehadiran': ['HADIR', 'IZIN', 'SAKIT', 'ALPA'] },
    colWidths: [170, 170, 130, 140, 300]
  },
  'penilaian_formatif_sumatif': {
    headers: ['nilai_id', 'siswa_id', 'tp_id', 'jenis_asesmen', 'nilai_angka', 'sumber_data', 'tanggal_input'],
    validations: { 'jenis_asesmen': ['FORMATIF_GAME', 'FORMATIF_TUGAS', 'SUMATIF_STS', 'SUMATIF_SAS'] },
    colWidths: [170, 130, 130, 180, 100, 220, 170]
  },
  'log_supervisi': {
    headers: ['log_id', 'supervisor_id', 'guru_id', 'referensi_tipe', 'referensi_id', 'catatan', 'tanggal'],
    validations: { 'referensi_tipe': ['PERANGKAT_AJAR', 'JURNAL_HARIAN', 'UMUM'] },
    colWidths: [170, 130, 120, 160, 180, 400, 170]
  }
};

const DEFAULT_CONFIG = [
  ['tahun_ajaran_aktif',        '2026/2027',  'Tahun ajaran aktif saat ini'],
  ['timezone',                  'Asia/Jakarta', 'Timezone sistem (WIB)'],
  ['jam_operasional_mulai',     '07:00',      'Jam mulai operasional KBM'],
  ['jam_operasional_selesai',   '15:00',      'Jam selesai operasional KBM'],
  ['istirahat_mulai',           '12:00',      'Jam mulai istirahat'],
  ['istirahat_selesai',         '13:00',      'Jam selesai istirahat'],
  ['kuota_jp_per_guru_minggu',  '10',         'Maks JP reservasi per guru per minggu'],
  ['max_reservasi_aktif',       '5',          'Maks reservasi CONFIRMED bersamaan per guru'],
  ['auto_release_menit',        '15',         'Auto-cancel jika idle X menit setelah jam_mulai'],
  ['app_version',               '2.0.0',      'Versi aplikasi'],
  ['school_name',               'SDN Babakansitu', 'Nama sekolah'],
  ['admin_initial_password',    'admin123',   'Password admin default']
];

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summary = { created: [], errors: [] };

  console.log('═══════════════════════════════════');
  console.log('🚀 Setup Database v2.0 Dimulai');
  console.log('═══════════════════════════════════');

  // 1. Buat semua sheet & header
  Object.keys(DB_SCHEMA).forEach(sheetName => {
    try {
      let sheet = ss.getSheetByName(sheetName);
      if (sheet) { ss.deleteSheet(sheet); } // Hapus jika sudah ada
      sheet = ss.insertSheet(sheetName);
      
      const schema = DB_SCHEMA[sheetName];
      const headerRange = sheet.getRange(1, 1, 1, schema.headers.length);
      headerRange.setValues([schema.headers])
        .setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF')
        .setHorizontalAlignment('left').setVerticalAlignment('middle');
      
      sheet.setRowHeight(1, 32);
      sheet.setFrozenRows(1);

      if (schema.colWidths) {
        schema.colWidths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
      }

      // Data validations
      Object.keys(schema.validations || {}).forEach(colName => {
        const colIdx = schema.headers.indexOf(colName);
        if (colIdx !== -1) {
          const rule = SpreadsheetApp.newDataValidation()
            .requireValueInList(schema.validations[colName], true)
            .setAllowInvalid(false).build();
          sheet.getRange(2, colIdx + 1, 1000, 1).setDataValidation(rule);
        }
      });

      console.log(`✅ Created: "${sheetName}"`);
      summary.created.push(sheetName);
    } catch (err) {
      console.error(`❌ Error sheet "${sheetName}": ${err.message}`);
      summary.errors.push(sheetName);
    }
  });

  // 2. Seed _config
  try {
    const configSheet = ss.getSheetByName('_config');
    configSheet.getRange(2, 1, DEFAULT_CONFIG.length, 3).setValues(DEFAULT_CONFIG);
    console.log(`✅ Seeded: _config`);
  } catch (e) { console.error('❌ Gagal seed _config'); }

  // 3. Seed Admin Default
  try {
    const usersSheet = ss.getSheetByName('master_users');
    const email = Session.getActiveUser().getEmail() || 'admin@sd.babakansitu.sch.id';
    const salt = Utilities.getUuid().replace(/-/g, '').substring(0, 32);
    const combined = salt + 'admin123';
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined, Utilities.Charset.UTF_8);
    const hash = digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');

    usersSheet.appendRow([
      'USR-A001', 'Administrator Sistem', '000000000000000000', 'admin', email, hash, salt, 'ADMIN', 'TRUE', nowWIB_()
    ]);
    console.log(`✅ Created Admin: admin / admin123 (Email: ${email})`);
  } catch (e) { console.error('❌ Gagal seed admin: ' + e.message); }

  // 4. Hapus Sheet1 default
  try {
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet) { ss.deleteSheet(defaultSheet); }
  } catch (e) { }

  console.log('═══════════════════════════════════');
  console.log(`📊 Selesai: ${summary.created.length} sheet dibuat.`);
  console.log('═══════════════════════════════════');
}

function nowWIB_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Fungsi khusus untuk menambahkan sheet master_tahun_ajaran
 * tanpa menghapus data yang sudah ada.
 */
function createTahunAjaranSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'master_tahun_ajaran';
  
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    console.log('⚠️ Sheet master_tahun_ajaran sudah ada.');
    return;
  }

  sheet = ss.insertSheet(sheetName);
  
  const headers = ['tahun_ajaran_id', 'nama_tahun_ajaran', 'semester_aktif', 'tanggal_mulai', 'tanggal_selesai', 'status', 'is_aktif'];
  const colWidths = [150, 150, 130, 130, 130, 120, 100];
  
  // Format Header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setBackground('#2563EB')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);

  // Atur lebar kolom
  colWidths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // Data Validation
  const semRule = SpreadsheetApp.newDataValidation().requireValueInList(['Ganjil', 'Genap'], true).build();
  sheet.getRange(2, 3, 1000, 1).setDataValidation(semRule); // Kolom semester_aktif

  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(['AKTIF', 'SELESAI', 'AKAN_DATANG'], true).build();
  sheet.getRange(2, 6, 1000, 1).setDataValidation(statusRule); // Kolom status

  const aktifRule = SpreadsheetApp.newDataValidation().requireValueInList(['TRUE', 'FALSE'], true).build();
  sheet.getRange(2, 7, 1000, 1).setDataValidation(aktifRule); // Kolom is_aktif

  // Seed Data Awal
  sheet.appendRow([
    'TA-2026-2027',
    '2026/2027',
    'Ganjil',
    '2026-07-01',
    '2027-06-30',
    'AKTIF',
    'TRUE'
  ]);

  console.log('✅ Sheet master_tahun_ajaran berhasil dibuat dan data awal ditambahkan.');
}

/**
 * Fungsi untuk membuat sheet mapping_mengajar secara otomatis.
 * Jalankan fungsi ini SEKALI dari Editor Apps Script.
 */
function createMappingMengajarSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'mapping_mengajar';
  
  // Cek apakah sheet sudah ada
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    console.log('⚠️ Sheet mapping_mengajar sudah ada. Tidak ada tindakan yang dilakukan.');
    return;
  }

  // Buat sheet baru
  sheet = ss.insertSheet(sheetName);
  
  // Definisikan Header dan Lebar Kolom
  const headers = ['mapping_id', 'guru_id', 'mapel_id', 'kelas_id', 'tahun_ajaran'];
  const colWidths = [150, 150, 150, 150, 150];
  
  // Format Header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setBackground('#2563EB')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  
  // Freeze baris pertama & atur tinggi
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);

  // Atur lebar kolom
  colWidths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  console.log('✅ Sheet "mapping_mengajar" berhasil dibuat dengan format header yang benar.');
}

/**
 * Fungsi untuk membuat sheet perangkat_ajar secara otomatis.
 * Jalankan fungsi ini SEKALI dari Editor Apps Script.
 */
function createPerangkatAjarSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'perangkat_ajar';
  
  // Cek apakah sheet sudah ada
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    console.log('⚠️ Sheet perangkat_ajar sudah ada. Tidak ada tindakan yang dilakukan.');
    return;
  }

  // Buat sheet baru
  sheet = ss.insertSheet(sheetName);
  
  // Definisikan Header dan Lebar Kolom
  const headers = [
    'perangkat_id', 'kategori', 'guru_id', 'kelas_id', 'mapel_id', 
    'tahun_ajaran_id', 'judul', 'deskripsi', 'konten_ai', 'file_url', 
    'status_dokumen', 'created_at'
  ];
  
  const colWidths = [150, 100, 120, 100, 100, 130, 250, 300, 400, 200, 130, 170];
  
  // Format Header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setBackground('#2563EB')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  
  // Freeze baris pertama & atur tinggi
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);

  // Atur lebar kolom
  colWidths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // Data Validation (Opsional untuk kategori dan status)
  const kategoriRule = SpreadsheetApp.newDataValidation().requireValueInList(['ATP', 'MODUL', 'LKPD', 'GBL'], true).build();
  sheet.getRange(2, 2, 1000, 1).setDataValidation(kategoriRule); // Kolom kategori

  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(['DRAFT', 'PUBLISHED'], true).build();
  sheet.getRange(2, 11, 1000, 1).setDataValidation(statusRule); // Kolom status_dokumen

  console.log('✅ Sheet "perangkat_ajar" berhasil dibuat dengan format header yang benar.');
}

function forceFixPerangkatAjarHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('perangkat_ajar');
  if (!sheet) {
    sheet = ss.insertSheet('perangkat_ajar');
  }
  
  const headers = [
    'perangkat_id', 'kategori', 'guru_id', 'kelas_id', 'mapel_id', 
    'tahun_ajaran_id', 'judul', 'deskripsi', 'konten_ai', 'file_url', 
    'status_dokumen', 'created_at'
  ];
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setBackground('#2563EB')
    .setFontColor('#FFFFFF');
    
  sheet.setFrozenRows(1);
  console.log('✅ Header sheet perangkat_ajar berhasil diperbaiki!');
}


/**
 * FUNGSI DARURAT: Menghapus sheet perangkat_ajar yang rusak 
 * dan membuat ulang dengan header yang 100% benar.
 */
function resetPerangkatAjarSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('perangkat_ajar');
  
  // Hapus sheet jika sudah ada
  if (sheet) {
    ss.deleteSheet(sheet);
    console.log('🗑️ Sheet perangkat_ajar lama dihapus.');
  }
  
  // Buat sheet baru
  sheet = ss.insertSheet('perangkat_ajar');
  
  // Header yang 100% sesuai dengan kode backend
  const headers = [
    'perangkat_id', 'kategori', 'guru_id', 'kelas_id', 'mapel_id', 
    'tahun_ajaran_id', 'judul', 'deskripsi', 'alokasi_waktu', 
    'kesiapan_murid', 'profil_lulusan', 'praktik_pedagogis', 
    'pemanfaatan_digital', 'konten_ai', 'file_url', 'status_dokumen', 'created_at'
  ];
  
  // Format Header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setBackground('#2563EB')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
  
  console.log('✅ Sheet perangkat_ajar berhasil dibuat ulang dengan header yang benar!');
}

function factoryResetPerangkatAjar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'perangkat_ajar';
  
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    ss.deleteSheet(sheet);
  }
  
  sheet = ss.insertSheet(sheetName);
  
  // 17 Kolom Baku
  const headers = [
    'perangkat_id', 'kategori', 'guru_id', 'kelas_id', 'mapel_id', 
    'tahun_ajaran_id', 'judul', 'deskripsi', 'alokasi_waktu', 
    'kesiapan_murid', 'profil_lulusan', 'praktik_pedagogis', 
    'pemanfaatan_digital', 'konten_ai', 'file_url', 'status_dokumen', 'created_at'
  ];
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight('bold')
    .setBackground('#2563EB')
    .setFontColor('#FFFFFF');
    
  sheet.setFrozenRows(1);
  console.log('✅ Sheet perangkat_ajar berhasil di-reset total.');
}


function forceResetPerangkatAjar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'perangkat_ajar';
  
  // Hapus sheet jika ada
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    ss.deleteSheet(sheet);
  }
  
  // Buat baru
  sheet = ss.insertSheet(sheetName);
  
  const headers = [
    'perangkat_id', 'kategori', 'guru_id', 'kelas_id', 'mapel_id', 
    'tahun_ajaran_id', 'judul', 'deskripsi', 'alokasi_waktu', 
    'kesiapan_murid', 'profil_lulusan', 'praktik_pedagogis', 
    'pemanfaatan_digital', 'konten_ai', 'file_url', 'status_dokumen', 'created_at'
  ];
  
  // Masukkan header
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  
  // Kunci 17 kolom pertama agar tidak ada data liar
  sheet.setFrozenRows(1);
  
  console.log('✅ Database Perangkat Ajar BERHASIL DIBUAT ULANG dengan 17 kolom.');
}

function upgradePerangkatAjarUntukThumbnail() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('perangkat_ajar');
  
  const newHeaders = [
    { name: 'konten_lkpd', width: 200 },
    { name: 'konten_game', width: 200 },
    { name: 'thumbnail_url', width: 150 }
  ];

  const lastCol = sheet.getLastColumn();
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  
  newHeaders.forEach(item => {
    if (!currentHeaders.includes(item.name)) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(item.name)
        .setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF');
      sheet.setColumnWidth(nextCol, item.width);
    }
  });
  console.log('✅ Database berhasil diupgrade untuk fitur Thumbnail!');
}

function addStatusAksesColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('perangkat_ajar');
  if(!sheet) return;
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if(!headers.includes('status_akses')) {
    const nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('status_akses')
      .setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF');
    console.log('✅ Kolom status_akses berhasil ditambahkan!');
  } else {
    console.log('⚠️ Kolom status_akses sudah ada.');
  }
}

function tambahKolomPerangkatDiReservasi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('reservasi_smartboard');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (!headers.includes('perangkat_id')) {
    const nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('perangkat_id')
      .setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF');
    console.log('✅ Kolom perangkat_id berhasil ditambahkan ke reservasi_smartboard!');
  } else {
    console.log('⚠️ Kolom perangkat_id sudah ada.');
  }
}