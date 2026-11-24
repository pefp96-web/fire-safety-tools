/* 소방안전관리자 현장 수첩 공통 기능: 기기 저장(IndexedDB), 건물 정보, 날짜 계산, 백업, 오프라인 */
(function () {
  var K = window.KIT = {};
  K.VERSION = '2026-11-24';
  K.LAW_CHECKED = '2026-11-24';

  // ---------- 저장소 (서버 없음, 이 기기 브라우저 안에만 저장) ----------
  var DBN = 'fst-kit', dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, no) {
      var r = indexedDB.open(DBN, 2);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('defects')) d.createObjectStore('defects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('records')) d.createObjectStore('records', { keyPath: 'id' });
        ['inspections', 'logs', 'buildings', 'households'].forEach(function (n) { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' }); });
      };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, no) {
        var t = d.transaction(store, mode), s = t.objectStore(store), res;
        res = fn(s);
        t.oncomplete = function () { ok(res instanceof IDBRequest ? res.result : res); };
        t.onerror = function () { no(t.error); };
      });
    });
  }
  K.get = function (k) { return tx('kv', 'readonly', function (s) { return s.get(k); }); };
  K.set = function (k, v) { return tx('kv', 'readwrite', function (s) { s.put(v, k); }); };
  K.all = function (store) { return tx(store, 'readonly', function (s) { return s.getAll(); }); };
  K.put = function (store, v) { return tx(store, 'readwrite', function (s) { s.put(v); }); };
  K.del = function (store, id) { return tx(store, 'readwrite', function (s) { s.delete(id); }); };
  K.clear = function (store) { return tx(store, 'readwrite', function (s) { s.clear(); }); };
  K.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  // ---------- 건물 정보 (한 번 입력하면 모든 화면이 같이 씀) ----------
  K.BFIELDS = ['name', 'use', 'grade', 'addr', 'approval', 'comp', 'under', 'above', 'area', 'floorArea', 'dongs', 'manager', 'appointed', 'eduFirst'];
  K.building = function () { return K.get('building').then(function (b) { return b || {}; }); };
  K.saveBuilding = function (b) { return K.set('building', b); };

  // ---------- 날짜 ----------
  // 관공서 공휴일 2026~2027 (기존 '자체점검 서류 기한 계산기'와 같은 목록)
  K.HOL = {
    '2026-01-01': 1, '2026-02-16': 1, '2026-02-17': 1, '2026-02-18': 1, '2026-03-01': 1, '2026-03-02': 1, '2026-05-01': 1, '2026-05-05': 1, '2026-05-24': 1, '2026-05-25': 1, '2026-06-03': 1,
    '2026-06-06': 1, '2026-07-17': 1, '2026-08-15': 1, '2026-08-17': 1, '2026-09-24': 1, '2026-09-25': 1, '2026-09-26': 1, '2026-10-03': 1, '2026-10-05': 1, '2026-10-09': 1, '2026-12-25': 1,
    '2027-01-01': 1, '2027-02-06': 1, '2027-02-07': 1, '2027-02-08': 1, '2027-02-09': 1, '2027-03-01': 1, '2027-05-01': 1, '2027-05-03': 1, '2027-05-05': 1, '2027-05-13': 1, '2027-06-06': 1, '2027-07-17': 1,
    '2027-07-19': 1, '2027-08-15': 1, '2027-08-16': 1, '2027-09-14': 1, '2027-09-15': 1, '2027-09-16': 1, '2027-10-03': 1, '2027-10-04': 1, '2027-10-09': 1, '2027-10-11': 1, '2027-12-25': 1, '2027-12-27': 1
  };
  K.HOL_RANGE = [2026, 2027];
  K.parse = function (s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  K.key = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  K.add = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  K.offDay = function (d) { return d.getDay() === 0 || d.getDay() === 6 || !!K.HOL[K.key(d)]; };
  K.inHolRange = function (d) { return d.getFullYear() >= K.HOL_RANGE[0] && d.getFullYear() <= K.HOL_RANGE[1]; };
  // 초일 불산입 후 n일째, 말일이 토·공휴일이면 다음 날(민법 제157조·제161조)
  K.deadline = function (d, n) { var e = K.add(d, n); while (K.offDay(e)) e = K.add(e, 1); return e; };
  // 토·공휴일을 빼고 n일째 (시행규칙 제23조③: 보고기간에 공휴일·토요일 산입 안 함, 일요일은 공휴일)
  K.bizDeadline = function (d, n) { var e = new Date(d), c = 0; while (c < n) { e = K.add(e, 1); if (!K.offDay(e)) c++; } return e; };
  K.lastDay = function (y, m) { return new Date(y, m + 1, 0); }; // m: 0~11
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  K.fmt = function (d) { if (!d) return '-'; return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.(' + WD[d.getDay()] + ')'; };
  K.today = function () { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  K.daysLeft = function (d) { return Math.round((d - K.today()) / 86400000); };
  K.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ---------- 사진 줄이기 (기기 저장 용량 절약) ----------
  K.shrink = function (file, max) {
    max = max || 1280;
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = no; img.src = fr.result;
      };
      fr.onerror = no; fr.readAsDataURL(file);
    });
  };

  // ---------- 파일 내려받기 ----------
  K.download = function (name, text, type) {
    var b = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // ---------- 백업·복원 (회원가입 없이 기기 이동) ----------
  K.exportAll = function () {
    return Promise.all([K.get('building'), K.get('calendar'), K.all('defects'), K.all('records'), K.all('inspections'), K.all('logs'), K.all('buildings'), K.all('households'), K.get('duty'), K.get('quotes')]).then(function (r) {
      return { app: 'fst-kit', version: K.VERSION, exported: new Date().toISOString(), building: r[0] || {}, calendar: r[1] || {}, defects: r[2] || [], records: r[3] || [], inspections: r[4] || [], logs: r[5] || [], buildings: r[6] || [], households: r[7] || [], duty: r[8] || null, quotes: r[9] || null };
    });
  };
  K.importAll = function (data) {
    if (!data || data.app !== 'fst-kit') return Promise.reject(new Error('수첩 백업 파일이 아닙니다.'));
    var jobs = [K.set('building', data.building || {}), K.set('calendar', data.calendar || {})];
    (data.defects || []).forEach(function (x) { jobs.push(K.put('defects', x)); });
    (data.records || []).forEach(function (x) { jobs.push(K.put('records', x)); });
    ['inspections', 'logs', 'buildings', 'households'].forEach(function (n) { (data[n] || []).forEach(function (x) { jobs.push(K.put(n, x)); }); });
    if (data.duty) jobs.push(K.set('duty', data.duty));
    if (data.quotes) jobs.push(K.set('quotes', data.quotes));
    return Promise.all(jobs);
  };

  // 파일 공유(휴대폰 공유 창: 카카오톡·메일 등). 안 되면 내려받기
  K.shareFile = function (name, text, type, title) {
    var f = new File([text], name, { type: type || 'text/html' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: title || name }).catch(function () {});
    K.download(name, text, type || 'text/html;charset=utf-8'); K.toast('이 기기는 바로 공유를 지원하지 않아 파일로 받았습니다'); return Promise.resolve();
  };
  K.toast = function (msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'on';
    clearTimeout(K._tt); K._tt = setTimeout(function () { t.className = ''; }, 2200);
  };

  // ---------- 오프라인 (한 번 열면 통신 없이 다시 열림) ----------
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  K.netBadge = function () {
    var el = document.getElementById('net'); if (!el) return;
    function u() { el.textContent = navigator.onLine ? '온라인' : '오프라인(기기 저장 중)'; el.className = navigator.onLine ? 'net on' : 'net off'; }
    u(); window.addEventListener('online', u); window.addEventListener('offline', u);
  };
  document.addEventListener('DOMContentLoaded', K.netBadge);
})();
