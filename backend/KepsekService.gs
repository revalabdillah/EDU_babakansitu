/**
 * ============================================================
 *  KepsekService.gs — API untuk Dashboard & Monitoring Kepsek
 * ============================================================
 */

function apiGetKepsekDashboard(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['KEPALA_SEKOLAH', 'ADMIN']);

    const allGuru = sheetToObjects_('master_users').filter(u => u.role === 'GURU');
    const allPerangkat = sheetToObjects_('perangkat_ajar_promes');
    const allSupervisi = sheetToObjects_('log_supervisi');
    const allReservasi = sheetToObjects_('reservasi_smartboard');

    // Hitung statistik
    const totalGuru = allGuru.length;
    const perangkatTerbit = allPerangkat.filter(p => p.status_dokumen === 'PUBLISHED').length;
    const catatanBulanIni = allSupervisi.filter(s => String(s.tanggal).includes(todayWIB().substring(0, 7))).length;
    
    // Hitung utilisasi (Reservasi yang COMPLETED dibanding total)
    const totalReservasi = allReservasi.length;
    const completedReservasi = allReservasi.filter(r => r.status_reservasi === 'COMPLETED').length;
    const utilisasi = totalReservasi === 0 ? 0 : Math.round((completedReservasi / totalReservasi) * 100);

    // Ambil 5 catatan supervisi terbaru
    const recentSupervisi = allSupervisi
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
      .slice(0, 5);

    return {
      stats: { totalGuru, perangkatTerbit, catatanBulanIni, utilisasi },
      recentSupervisi
    };
  })();
}

function apiGetMonitoringGuru(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['KEPALA_SEKOLAH', 'ADMIN']);

    const guruList = sheetToObjects_('master_users').filter(u => u.role === 'GURU');
    const perangkatList = sheetToObjects_('perangkat_ajar_promes');

    // Gabungkan data guru dengan jumlah perangkat ajar mereka
    return guruList.map(g => {
      const perangkatGuru = perangkatList.filter(p => p.guru_id === g.user_id);
      const terbit = perangkatGuru.filter(p => p.status_dokumen === 'PUBLISHED').length;
      const draft = perangkatGuru.filter(p => p.status_dokumen === 'DRAFT').length;
      
      return {
        user_id: g.user_id,
        nama_lengkap: g.nama_lengkap,
        nip_nik: g.nip_nik,
        total_perangkat: perangkatGuru.length,
        terbit: terbit,
        draft: draft
      };
    });
  })();
}

function apiGetAnalitikSmartboard(token) {
  return apiWrapper_(function() {
    requireSession_(token);
    requireRole_(session, ['KEPALA_SEKOLAH', 'ADMIN']);

    const papanList = sheetToObjects_('master_papan_interaktif');
    const reservasiList = sheetToObjects_('reservasi_smartboard').filter(r => r.status_reservasi === 'COMPLETED');

    // Hitung berapa kali tiap papan digunakan
    return papanList.map(p => {
      const usage = reservasiList.filter(r => r.papan_id === p.papan_id).length;
      return {
        papan_id: p.papan_id,
        nama_perangkat: p.nama_perangkat,
        lokasi_ruangan: p.lokasi_ruangan,
        status_kondisi: p.status_kondisi,
        total_penggunaan: usage
      };
    }).sort((a, b) => b.total_penggunaan - a.total_penggunaan);
  })();
}