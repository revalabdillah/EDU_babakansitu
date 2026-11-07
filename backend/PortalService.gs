/**
 * ============================================================
 *  PortalService.gs — Backend untuk Menu Guru & Kepsek
 * ============================================================
 */

// 1. PUSTAKA GAME HTML
function apiGetGames(token) {
  return apiWrapper_(function() {
    requireSession_(token);
    return sheetToObjects_('pustaka_game_html');
  })();
}

function apiSaveGame(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['GURU', 'ADMIN']);
    
    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('pustaka_game_html');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      if (payload.game_id) {
        const row = findRow_('pustaka_game_html', 'game_id', payload.game_id);
        headers.forEach((h, i) => {
          if (payload[h] !== undefined && h !== 'game_id' && h !== 'created_by') {
            sheet.getRange(row, i + 1).setValue(payload[h]);
          }
        });
        return { message: 'Game diupdate' };
      } else {
        payload.game_id = generateId_('pustaka_game_html', 'game_id', 'GME');
        payload.created_by = session.userId;
        const row = headers.map(h => payload[h] || '');
        sheet.appendRow(row);
        return { game_id: payload.game_id, message: 'Game dibuat' };
      }
    });
  })();
}





// 3. CATATAN SUPERVISI
function apiGetSupervisi(token) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    let data = sheetToObjects_('log_supervisi');
    if (session.role === 'GURU') {
      data = data.filter(d => d.guru_id === session.userId);
    }
    return data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  })();
}

function apiAddSupervisi(token, payload) {
  return apiWrapper_(function() {
    const session = requireSession_(token);
    requireRole_(session, ['KEPALA_SEKOLAH', 'ADMIN']);
    
    return withLock_(function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('log_supervisi');
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      const newLog = {
        log_id: generateId_('log_supervisi', 'log_id', 'SUP'),
        supervisor_id: session.userId,
        guru_id: payload.guru_id,
        referensi_tipe: payload.referensi_tipe || 'UMUM',
        referensi_id: payload.referensi_id || '',
        catatan: payload.catatan,
        tanggal: nowWIB()
      };
      
      sheet.appendRow(headers.map(h => newLog[h] || ''));
      return { message: 'Catatan supervisi terkirim' };
    });
  })();
}