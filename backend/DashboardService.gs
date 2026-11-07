/**
 * ============================================================
 *  DashboardService.gs — API untuk Dashboard Admin
 * ============================================================
 */

function apiGetAdminDashboard(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['ADMIN']);

    // 👇 CEK CACHE DULU 👇
    const cacheKey = 'dash_admin_' + session.userId;
    const cached = CACHE_.get(cacheKey);
    if (cached) return cached;

    const allTA = sheetToObjects_('master_tahun_ajaran');
    const activeTA = allTA.find(t => String(t.is_aktif).toUpperCase() === 'TRUE') || null;

    // Helper untuk menghitung baris dengan filter
    const countRows = (sheetName, filterFn) => {
      const data = sheetToObjects_(sheetName);
      return filterFn ? data.filter(filterFn).length : data.length;
    };

    // 1. Hitung KPI
    const totalGuru = countRows('master_users', r => r.role === 'GURU');
    const totalSiswa = countRows('master_siswa', r => r.status_siswa === 'AKTIF');
    const papanAktif = countRows('master_papan_interaktif', r => r.status_kondisi === 'BAIK');
    
    const today = todayWIB();
    const reservasiHariIni = countRows('reservasi_smartboard', r => 
      normalizeDate_(r.tanggal_pinjam) === today && r.status_reservasi !== 'CANCELLED'
    );

    // 2. Ambil 5 Aktivitas/Reservasi Terbaru
    const allRes = sheetToObjects_('reservasi_smartboard');
    const recentRes = allRes
      .filter(r => r.created_at)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

       const result = {
      stats: { totalGuru, totalSiswa, papanAktif, reservasiHariIni },
      recent: recentRes,
      activeTA: activeTA
    };

    // 👇 SIMPAN KE CACHE (300 detik = 5 menit) 👇
    CACHE_.put(cacheKey, result, 300);
    
    return result;
  })();
}
