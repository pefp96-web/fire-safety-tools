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
  // 사진 도장: 찍은 날짜·시각(파일 시각, 없으면 지금)과 건물명을 아래쪽에 찍음. 끄기: 수첩 홈 설정
  K.stampOn = function () { try { return localStorage.getItem('fst-stamp') !== '0'; } catch (e) { return true; } };
  K.stamp = function (c, ms, bname) {
    var d = new Date(ms && ms < Date.now() + 60000 ? ms : Date.now());
    var p = function (n) { return String(n).padStart(2, '0'); };
    var txt = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + (bname ? ' · ' + bname : '');
    var g = c.getContext('2d'), fs = Math.max(14, Math.round(c.width / 34)), pad = Math.round(fs * 0.45);
    g.font = '700 ' + fs + 'px Pretendard, "Malgun Gothic", sans-serif';
    var w = g.measureText(txt).width;
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(0, c.height - fs - pad * 2, Math.min(c.width, w + pad * 2), fs + pad * 2);
    g.fillStyle = '#FFD84D'; g.textBaseline = 'bottom'; g.fillText(txt, pad, c.height - pad);
    return txt;
  };
  document.addEventListener('DOMContentLoaded', function () { K.building().then(function (b) { K._bn = b.name || ''; }).catch(function () {}); });
  K.shrink = function (file, max, opt) {
    max = max || 1280;
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          var g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
          if (K.stampOn() && !(opt && opt.noStamp)) K.stamp(c, file.lastModified, K._bn);
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
    return Promise.all([K.get('building'), K.get('calendar'), K.all('defects'), K.all('records'), K.all('inspections'), K.all('logs'), K.all('buildings'), K.all('households'), K.get('duty'), K.get('quotes'), K.get('equips'), K.get('prices')]).then(function (r) {
      return { app: 'fst-kit', version: K.VERSION, exported: new Date().toISOString(), building: r[0] || {}, calendar: r[1] || {}, defects: r[2] || [], records: r[3] || [], inspections: r[4] || [], logs: r[5] || [], buildings: r[6] || [], households: r[7] || [], duty: r[8] || null, quotes: r[9] || null, equips: r[10] || null, prices: r[11] || null };
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
    if (data.equips) jobs.push(K.set('equips', data.equips));
    if (data.prices) jobs.push(K.set('prices', data.prices));
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

  // ---------- 2026-11-25 추가: 의견 창구, 길안내, 누락 검사, 반복 불량, 한눈에 보기 ----------
  K.FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSclhgEM4yGzquJzb3NtVbfydJB8YqKhOaRvF_Sd7-Hc0nrhvw/viewform';
  K.feedbackUrl = function (page) { return K.FORM + '?usp=pp_url&entry.945022373=' + encodeURIComponent(page || location.pathname.replace('/fire-safety-tools', '')); };

  // 주소 → 지도 앱 (앱 키 없이 쓰는 공개 주소 형식)
  K.navLinks = function (addr) {
    if (!addr) return '';
    var q = encodeURIComponent(addr);
    return '<span class="navl">길안내: <a href="https://map.kakao.com/link/search/' + q + '" target="_blank" rel="noopener">카카오맵</a> · <a href="tmap://search?name=' + q + '">티맵</a> · <a href="https://map.naver.com/p/search/' + q + '" target="_blank" rel="noopener">네이버 지도</a></span>';
  };

  // 지적사항 기한 (defects.html 과 같은 계산)
  K.defDue = function (x) {
    var o = {}, rep = K.parse(x.report), fix = K.parse(x.fix), act = +x.act;
    if (rep && act) { o.due = K.deadline(rep, act); o.delay = K.add(o.due, -3); }
    if (fix && act) o.doneRep = K.deadline(fix, 10);
    var t = K.today(); o.late = false;
    if (!fix && o.due && o.due < t) o.late = true;
    if (fix && act && !x.sent && o.doneRep < t) o.late = true;
    o.next = !fix ? o.due : (act && !x.sent ? o.doneRep : null);
    return o;
  };

  // 반복 불량: 같은 설비(QR 설비 또는 설비명+위치)에서 같은 불량이 전에 나온 횟수
  function nz(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
  K.defKey = function (x) { return (x.equip ? 'E' + x.equip : nz(x.eq) + '|' + nz(x.loc)) + '|' + nz(x.desc).slice(0, 16); };
  K.repeats = function (list) {
    var g = {}, out = {};
    list.slice().sort(function (a, b) { return (a.found || '').localeCompare(b.found || ''); }).forEach(function (x) {
      var k = K.defKey(x); g[k] = (g[k] || 0) + 1; out[x.id] = g[k];
    });
    return out; // 1 = 처음, 2 이상 = N번째 반복
  };

  // 출력 전 누락 검사. scope: 'all' | 'defects' | 'inspect' | 'record' | 'building'
  K.audit = function (scope) {
    scope = scope || 'all';
    return Promise.all([K.building(), K.all('defects'), K.all('records'), K.all('inspections')]).then(function (r) {
      var b = r[0], D = r[1], R = r[2], I = r[3], out = [];
      function add(lv, where, msg, link) { out.push({ lv: lv, where: where, msg: msg, link: link }); }
      var need = { name: '건물명', addr: '소재지', grade: '등급', approval: '사용승인일', manager: '소방안전관리자 이름' };
      Object.keys(need).forEach(function (k) { if (!b[k]) add('err', '건물 정보', need[k] + ' 없음 (모든 서류 머리에 들어감)', 'index.html'); });
      if (scope === 'all' || scope === 'defects') {
        D.forEach(function (x) {
          var nm = (x.eq || '설비 미기재') + ' · ' + (x.desc || '').slice(0, 20), o = K.defDue(x);
          if (o.late) add('err', '지적사항', nm + ': 기한 지남(' + K.fmt(o.next || o.due) + ')', 'defects.html');
          if (!x.pre) add('warn', '지적사항', nm + ': 조치 전 사진 없음', 'defects.html');
          if (x.fix && !x.post) add('err', '지적사항', nm + ': 조치 완료인데 조치 후 사진 없음(이행완료 보고에 전·후 사진 필요)', 'defects.html');
          if (!x.loc) add('warn', '지적사항', nm + ': 위치 없음', 'defects.html');
          if (x.act && !x.report) add('warn', '지적사항', nm + ': 소방서 보고일 없음 → 이행 기한 계산 안 됨', 'defects.html');
          if (x.fix && !x.fixdesc) add('warn', '지적사항', nm + ': 조치 내용 없음', 'defects.html');
        });
      }
      if (scope === 'all' || scope === 'record') {
        var t = K.today(), ym = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
        var have = {}; R.forEach(function (x) { if (x.date) have[x.date.slice(0, 7)] = 1; });
        var pm = new Date(t.getFullYear(), t.getMonth() - 1, 1);
        if (R.length && !have[ym(pm)]) add('err', '업무수행기록표', ym(pm) + ' 기록표 없음(월 1회 이상, 화재예방법 시행규칙 제10조)', 'record.html');
        if (!have[ym(t)]) add('warn', '업무수행기록표', ym(t) + ' 이번 달 기록표 아직 없음', 'record.html');
        R.forEach(function (x) { if (!x.who) add('warn', '업무수행기록표', (x.date || '날짜 없음') + ' 기록표: 작성자(서명) 없음', 'record.html'); });
      }
      if (scope === 'all' || scope === 'inspect') {
        var cur = I.slice().sort(function (a, c) { return (c.s || '').localeCompare(a.s || ''); })[0];
        if (cur) {
          var res = cur.res || {}, xs = Object.keys(res).filter(function (k) { return res[k] === 'x'; });
          var noMemo = xs.filter(function (k) { return !(cur.memo || {})[k]; }).length, noPh = xs.filter(function (k) { return !(cur.photo || {})[k]; }).length;
          if (!Object.keys(res).length) add('err', '자체점검 점검표', (cur.s || '') + ' 점검: 체크한 항목이 하나도 없음', 'inspect.html');
          if (noMemo) add('warn', '자체점검 점검표', '불량(×) ' + xs.length + '개 중 ' + noMemo + '개에 불량 내용 메모 없음', 'inspect.html');
          if (noPh) add('warn', '자체점검 점검표', '불량(×) ' + xs.length + '개 중 ' + noPh + '개에 사진 없음', 'inspect.html');
          if (!((cur.staff || [])[0] || {}).name) add('err', '자체점검 점검표', '점검인력(점검자) 이름 없음', 'inspect.html');
          if (cur.e && K.parse(cur.e) && !cur.reported) { var rd = K.bizDeadline(K.parse(cur.e), 15); if (K.daysLeft(rd) < 0 && K.daysLeft(rd) > -60) add('warn', '자체점검 점검표', '점검 끝난 날 ' + cur.e + ' → 소방서 보고 기한 ' + K.fmt(rd) + ' 지남(보고했으면 무시)', 'inspect.html'); }
        }
      }
      return out;
    });
  };

  // 다음 점검 달 (별표 3: 종합점검 대상은 사용승인 달 종합·6개월 뒤 작동, 아니면 사용승인 달 작동)
  K.nextInspect = function (b) {
    var a = K.parse(b.approval); if (!a) return null;
    var m = a.getMonth(), list = b.comp === 'y' ? [[m, '종합점검'], [(m + 6) % 12, '작동점검']] : [[m, '작동점검']];
    var t = K.today(), best = null;
    [t.getFullYear(), t.getFullYear() + 1].forEach(function (y) { list.forEach(function (p) { var end = K.lastDay(y, p[0]); if (end >= t && (!best || end < best.end)) best = { end: end, kind: p[1], month: p[0] + 1, year: y }; }); });
    return best;
  };

  // 첫 화면 한눈에 보기 (el 에 그림, base 는 수첩 폴더 경로)
  K.glance = function (el, base) {
    base = base || '';
    return Promise.all([K.building(), K.all('defects'), K.all('records'), K.audit('all')]).then(function (r) {
      var b = r[0], D = r[1], R = r[2], A = r[3], t = K.today();
      var open = D.filter(function (x) { return !x.fix; }), late = D.filter(function (x) { return K.defDue(x).late; });
      var soon = D.map(function (x) { return { x: x, o: K.defDue(x) }; }).filter(function (p) { return p.o.next && K.daysLeft(p.o.next) >= 0 && K.daysLeft(p.o.next) <= 7; }).sort(function (p, q) { return p.o.next - q.o.next; });
      var ym = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
      var recNow = R.some(function (x) { return (x.date || '').slice(0, 7) === ym; });
      var ni = K.nextInspect(b), rep = K.repeats(D), rpt = D.filter(function (x) { return rep[x.id] > 1 && !x.fix; }).length;
      var errs = A.filter(function (a) { return a.lv === 'err'; }).length;
      function tile(n, label, href, cls) { return '<a class="gl ' + (cls || '') + '" href="' + base + href + '"><b>' + n + '</b><span>' + label + '</span></a>'; }
      var h = '<div class="gls">' +
        tile(open.length, '미조치 지적사항', 'defects.html', open.length ? 'warn' : 'ok') +
        tile(soon.length, '7일 안 기한', 'defects.html', soon.length ? 'warn' : 'ok') +
        tile(late.length, '기한 지남', 'defects.html', late.length ? 'bad' : 'ok') +
        tile(recNow ? '작성함' : '안 함', (t.getMonth() + 1) + '월 업무수행기록표', 'record.html', recNow ? 'ok' : 'warn') +
        tile(ni ? 'D-' + K.daysLeft(ni.end) : '-', ni ? ni.year + '년 ' + ni.month + '월 ' + ni.kind + '(그 달 말까지)' : '다음 점검: 사용승인일 넣으면 계산', ni ? 'calendar.html' : 'index.html#b-approval', ni && K.daysLeft(ni.end) <= 31 ? 'warn' : 'ok') +
        tile(errs, '출력 전 누락(빨간 항목)', 'check.html', errs ? 'bad' : 'ok') +
        '</div>';
      if (rpt) h += '<p class="hint">반복 불량(전에도 나온 불량) 미조치 ' + rpt + '건 → <a href="' + base + 'defects.html">지적사항에서 보기</a></p>';
      if (soon.length) h += '<ul class="soon">' + soon.slice(0, 5).map(function (p) { return '<li>' + K.fmt(p.o.next) + ' (D-' + K.daysLeft(p.o.next) + ') · ' + K.esc(p.x.eq || '') + ' ' + K.esc((p.x.desc || '').slice(0, 30)) + (p.x.fix ? ' · 이행완료 보고' : ' · 이행 완료') + '</li>'; }).join('') + '</ul>';
      if (b.addr) h += '<p class="hint">' + K.esc(b.name || '') + ' ' + K.navLinks(b.addr) + '</p>';
      el.innerHTML = h;
    });
  };
})();
