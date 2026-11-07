/**
 * ============================================================
 *  GuruService.gs — Logika Khusus Role Guru
 * ============================================================
 */

/**
 * Mengambil data siswa HANYA dari kelas yang diampu oleh Guru yang sedang login.
 */
function apiGetMyStudents(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['GURU']);
    
    const activeTA = getActiveTahunAjaranId_();
    if (activeTA === 'UNKNOWN') return [];

    // 1. Cari kelas apa saja yang diampu guru ini berdasarkan Pemetaan Mengajar
    const mappings = sheetToObjects_('mapping_mengajar').filter(m => 
      m.guru_id === session.userId && m.tahun_ajaran_id === activeTA
    );
    
    // Ambil daftar ID Kelas yang unik (buang duplikat)
    const myKelasIds = [...new Set(mappings.map(m => m.kelas_id))];

    if (myKelasIds.length === 0) return []; // Jika guru belum di-mapping

    // 2. Ambil siswa yang berada di kelas tersebut
    const students = sheetToObjects_('master_siswa').filter(s => 
      myKelasIds.includes(s.kelas_id) &&
      s.status_siswa === 'AKTIF' &&
      s.tahun_ajaran_id === activeTA
    );

    // 3. Lengkapi dengan Nama Kelas
    const kelases = sheetToObjects_('master_kelas');
    return students.map(s => {
      const kls = kelases.find(k => k.kelas_id === s.kelas_id);
      return { 
        ...s, 
        nama_kelas: kls ? kls.nama_kelas : s.kelas_id 
      };
    });
  })();
}