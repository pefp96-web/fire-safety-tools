/* 공통 화면 기능: 명령 팔레트(Ctrl+K·/), 자동 저장 표시, 삭제 실행 취소. 서버 없음, 이 기기 안에서만 동작. */
(function () {
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? me.replace(/assets\/ui\.js.*$/, '') : '/fire-safety-tools/';
  var CMDS = [
    ['대시보드(첫 화면)', '', '홈'],
    ['현장 수첩 홈', 'kit/', '수첩'],
    ['건물 목록·등록', 'kit/buildings.html', '수첩'],
    ['자체점검 점검표·결과보고서', 'kit/inspect.html', '수첩'],
    ['지적사항 대장(이행 기한)', 'kit/defects.html', '수첩'],
    ['연간 업무 달력·알림(.ics)', 'kit/calendar.html', '수첩'],
    ['업무수행기록표', 'kit/record.html', '수첩'],
    ['설치대상·관리등급 판정', 'kit/judge.html', '수첩'],
    ['기록부 10종·결재', 'kit/logs.html', '수첩'],
    ['근무표', 'kit/duty.html', '수첩'],
    ['날짜별 법령·점검항목 검색', 'kit/law.html', '수첩'],
    ['세대 점검표', 'kit/household.html', '수첩'],
    ['점검인력 배치·점검면적·일정 배치', 'kit/staff.html', '수첩'],
    ['펌프 성능시험표', 'kit/pump.html', '수첩'],
    ['질의회신 찾기(소방청 질의회신집 657건)', 'kit/qna.html', '수첩'],
    ['야간 비화재보 대응 카드', 'kit/alarm-card.html', '수첩'],
    ['선임 첫 30일 할 일·실무교육 기한', 'kit/start30.html', '수첩'],
    ['화재안전조사 대비 점검·과태료 표', 'kit/audit.html', '수첩'],
    ['출력 전 누락 검사', 'kit/check.html', '수첩'],
    ['관계인 공유 보고서·확인 서명', 'kit/share.html', '수첩'],
    ['수리비 견적서(단가표)', 'kit/quote.html', '수첩'],
    ['설비 QR 라벨·스캔·설비 이력', 'kit/equip.html', '수첩'],
    ['엑셀·한글 표 붙여넣기 불러오기', 'kit/import.html', '수첩'],
    ['앱 설치 안내(안드로이드·아이폰)', 'install.html', '안내'],
    ['의견 보내기(후기·오류 신고·기능 요청)', 'feedback.html', '안내'],
    ['다중이용업소 안전시설 체크·방염 면적', 'kit/multiuse.html', '수첩'],
    ['점검 면제·연기·업체 교체 예외 안내', 'inspection-deadline/#exc', '계산기'],
    ['부속용도 추가 소화기·옥내소화전 수원 계산', 'facility-calc/#water', '계산기'],
    ['자체점검 서류 기한 계산기', 'inspection-deadline/', '계산기'],
    ['소화기·감지기 수량 계산기', 'facility-calc/', '계산기'],
    ['소방도면 검토 결과', 'drawing-checker/sample_result/report.html', '도면'],
    ['소방계획서 자동 생성기', 'https://pefp96-web.github.io/sobang-docs/', '외부'],
    ['이 화면 인쇄(A4)', '#print', '동작'],
    ['맨 위로', '#top', '동작']
  ];
  function el(t, a, h) { var e = document.createElement(t); if (a) for (var k in a) e.setAttribute(k, a[k]); if (h != null) e.textContent = h; return e; }
  function go(c) {
    if (c[1] === '#print') { close(); setTimeout(function () { window.print(); }, 50); return; }
    if (c[1] === '#top') { close(); window.scrollTo(0, 0); return; }
    location.href = /^https?:/.test(c[1]) ? c[1] : ROOT + c[1];
  }
  var bg = null, sel = 0, shown = [], lastFocus = null;
  function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ''); }
  function render(list, q) {
    var ul = bg.querySelector('ul'); ul.innerHTML = '';
    var n = norm(q);
    // 화면 안 제목(h2·h3)도 검색 대상
    var heads = [].slice.call(document.querySelectorAll('main h2, main h3')).filter(function (h) { return h.offsetParent; }).slice(0, 40)
      .map(function (h) { if (!h.id) h.id = 'h-' + Math.random().toString(36).slice(2, 8); return [h.textContent.trim(), '#' + h.id, '이 화면']; });
    shown = list.concat(heads).filter(function (c) { return !n || norm(c[0] + c[2]).indexOf(n) !== -1; }).slice(0, 30);
    if (sel >= shown.length) sel = 0;
    shown.forEach(function (c, i) {
      var li = el('li', { role: 'option', 'aria-selected': i === sel ? 'true' : 'false', id: 'cmd-' + i });
      li.appendChild(el('span', null, c[0])); li.appendChild(el('small', null, c[2]));
      li.onclick = function () { if (c[1].charAt(0) === '#' && c[2] === '이 화면') { close(); var t = document.querySelector(c[1]); if (t) t.scrollIntoView(); } else go(c); };
      ul.appendChild(li);
    });
    if (!shown.length) ul.appendChild(el('li', null, '찾는 항목이 없습니다'));
    bg.querySelector('input').setAttribute('aria-activedescendant', 'cmd-' + sel);
  }
  function open() {
    if (bg) return; lastFocus = document.activeElement;
    bg = el('div', { class: 'cmdk-bg' });
    var box = el('div', { class: 'cmdk', role: 'dialog', 'aria-modal': 'true', 'aria-label': '빠른 이동' });
    var inp = el('input', { type: 'search', placeholder: '도구·서류·이 화면 제목 검색', 'aria-label': '검색', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'cmdk-list', autocomplete: 'off' });
    box.appendChild(inp); box.appendChild(el('ul', { role: 'listbox', id: 'cmdk-list' }));
    box.appendChild(el('div', { class: 'foot' }, '↑↓ 고르기 · Enter 열기 · Esc 닫기'));
    bg.appendChild(box); document.body.appendChild(bg);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
    inp.addEventListener('input', function () { sel = 0; render(CMDS, inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); render(CMDS, inp.value); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); render(CMDS, inp.value); e.preventDefault(); }
      else if (e.key === 'Enter') { var li = bg.querySelectorAll('li')[sel]; if (li) li.click(); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); }
      else if (e.key === 'Tab') { e.preventDefault(); }
    });
    render(CMDS, ''); inp.focus();
  }
  function close() { if (!bg) return; bg.remove(); bg = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  window.UI = { open: open, close: close };
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); bg ? close() : open(); }
    else if (e.key === '/' && !typing && !bg) { e.preventDefault(); open(); }
  });

  // 머리 막대에 검색 단추
  function addBtn() {
    var h = document.querySelector('header.top nav') || document.querySelector('header.top .in, header.top .wrap, body>header');
    if (!h || h.querySelector('.kbd')) return;
    var b = el('button', { type: 'button', class: 'kbd', 'aria-label': '빠른 이동 열기 (Ctrl+K)' });
    b.innerHTML = '<span class="t">검색·이동</span> <kbd>Ctrl</kbd><kbd>K</kbd>';
    b.onclick = open; h.appendChild(b);
    if (!document.querySelector('.skip') && document.querySelector('main')) {
      var m = document.querySelector('main'); if (!m.id) m.id = 'main';
      var s = el('a', { class: 'skip', href: '#' + m.id }, '본문 바로가기'); document.body.insertBefore(s, document.body.firstChild);
    }
  }

  // 자동 저장 표시 + 삭제 실행 취소 (수첩 KIT 저장소를 감쌈)
  var chip = null, ct = null;
  function saved() {
    if (!chip) { chip = el('div', { class: 'ui-save', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(chip); }
    var d = new Date(); chip.textContent = '이 기기에 자동 저장됨 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
    chip.classList.add('on'); clearTimeout(ct); ct = setTimeout(function () { chip.classList.remove('on'); }, 2600);
  }
  var undoBox = null, undoT = null;
  function offerUndo(label, fn) {
    if (undoBox) undoBox.remove();
    undoBox = el('div', { class: 'ui-undo', role: 'alert' });
    undoBox.appendChild(el('span', null, label));
    var b = el('button', { type: 'button' }, '실행 취소 (Ctrl+Z)'); undoBox.appendChild(b);
    var done = false;
    function doUndo() { if (done) return; done = true; fn().then(function () { if (undoBox) undoBox.remove(); undoBox = null; location.reload(); }); }
    b.onclick = doUndo; window.__undo = doUndo;
    document.body.appendChild(undoBox);
    clearTimeout(undoT); undoT = setTimeout(function () { if (undoBox) undoBox.remove(); undoBox = null; window.__undo = null; }, 10000);
  }
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !typing && window.__undo) { e.preventDefault(); window.__undo(); }
  });
  function wrapKit() {
    var K = window.KIT; if (!K || K.__ui) return; K.__ui = 1;
    ['put', 'set'].forEach(function (f) { var o = K[f]; if (o) K[f] = function () { return o.apply(K, arguments).then(function (r) { saved(); return r; }); }; });
    var od = K.del, oc = K.clear;
    if (od) K.del = function (store, id) {
      return K.all(store).then(function (list) {
        var old = (list || []).filter(function (x) { return x && x.id === id; })[0];
        return od.call(K, store, id).then(function (r) { saved(); if (old) offerUndo('1건 지웠습니다', function () { return K.put(store, old); }); return r; });
      });
    };
    if (oc) K.clear = function (store) {
      return K.all(store).then(function (list) {
        return oc.call(K, store).then(function (r) { saved(); if (list && list.length) offerUndo(list.length + '건 지웠습니다', function () { return list.reduce(function (p, v) { return p.then(function () { return K.put(store, v); }); }, Promise.resolve()); }); return r; });
      });
    };
  }
  function boot() { addBtn(); wrapKit(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', wrapKit);
})();

/* 2026-11-25 추가: 모든 화면 '의견 보내기', 음성 메모(브라우저 음성 인식), 수첩 인쇄 전 누락 검사 */
(function () {
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? me.replace(/assets\/ui\.js.*$/, '') : '/fire-safety-tools/';
  var FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSclhgEM4yGzquJzb3NtVbfydJB8YqKhOaRvF_Sd7-Hc0nrhvw/viewform';
  function fb() {
    if (document.querySelector('.fb-link')) return;
    var page = location.pathname.replace(/^\/fire-safety-tools/, '') || '/';
    var url = FORM + '?usp=pp_url&entry.945022373=' + encodeURIComponent(page);
    var p = document.createElement('p'); p.className = 'fb-link noprint';
    p.innerHTML = '<a href="' + url + '" target="_blank" rel="noopener" data-gc="feedback-open">의견 보내기</a> (후기·오류 신고·기능 요청, 로그인 없음, 이름·연락처는 선택) · <a href="' + ROOT + 'feedback.html">개인정보 안내·반영 기록</a> · <a href="' + ROOT + 'install.html">앱 설치</a>';
    var f = document.querySelector('footer'); if (f) f.appendChild(p); else document.body.appendChild(p);
  }
  // 음성 메모: 글 칸 옆 마이크 단추. 크롬(안드로이드·PC)·사파리(아이폰 14.5+)에서 됨, 대부분 인터넷 필요
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function mic(t) {
    if (t.dataset.mic) return; t.dataset.mic = 1;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'mic noprint'; b.textContent = '말로 입력(음성)'; b.setAttribute('aria-label', '음성으로 입력');
    b.onclick = function () {
      if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다.\n대신 휴대폰 키보드의 마이크 단추(구글 키보드·삼성 키보드·아이폰 키보드)를 눌러 말하면 같은 칸에 글자로 들어갑니다.\n지원: 안드로이드 크롬, PC 크롬·엣지, 아이폰 사파리(인터넷 연결 필요).'); return; }
      if (!navigator.onLine) { alert('음성 인식은 인터넷이 필요한 기기가 많습니다. 지금 오프라인이라 휴대폰 키보드의 마이크 단추를 써 주세요.'); return; }
      var r = new SR(); r.lang = 'ko-KR'; r.interimResults = false; r.maxAlternatives = 1;
      b.textContent = '● 듣는 중… (말이 끝나면 자동 입력)'; b.disabled = true;
      r.onresult = function (e) { var s = e.results[0][0].transcript; t.value = (t.value ? t.value.replace(/\s*$/, ' ') : '') + s; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); };
      r.onerror = function (e) { alert('음성 인식 실패: ' + (e.error === 'not-allowed' ? '마이크 권한을 허용해 주세요' : e.error === 'network' ? '인터넷 연결이 필요합니다' : e.error)); };
      r.onend = function () { b.textContent = '말로 입력(음성)'; b.disabled = false; };
      try { r.start(); } catch (err) { r.onend(); }
    };
    t.insertAdjacentElement('afterend', b);
  }
  function mics() {
    if (!/\/kit\//.test(location.pathname)) return;
    [].forEach.call(document.querySelectorAll('textarea:not([readonly]), input[data-voice], #d-desc, #d-fixdesc, #d-loc, #e-note'), mic);
  }
  // 수첩 인쇄 전 누락 검사: 빨간 항목이 있으면 인쇄 전에 알려 줌
  function guard() {
    var K = window.KIT; if (!K || !K.audit || window.__pg) return; window.__pg = 1;
    var path = location.pathname, scope = /defects/.test(path) ? 'defects' : /inspect/.test(path) ? 'inspect' : /record/.test(path) ? 'record' : null;
    if (!scope) return;
    var orig = window.print.bind(window);
    window.print = function () {
      K.audit(scope).then(function (a) {
        var bad = a.filter(function (x) { return x.lv === 'err'; }), warn = a.filter(function (x) { return x.lv !== 'err'; });
        if (!bad.length && !warn.length) return orig();
        var msg = '출력 전 누락 검사: 빨강 ' + bad.length + '건 · 노랑 ' + warn.length + '건\n\n' + bad.concat(warn).slice(0, 10).map(function (x) { return (x.lv === 'err' ? '■ ' : '□ ') + x.where + ': ' + x.msg; }).join('\n') + (a.length > 10 ? '\n… 외 ' + (a.length - 10) + '건 (전체는 수첩 > 출력 전 누락 검사)' : '') + '\n\n그래도 인쇄할까요?';
        if (confirm(msg)) orig();
      }).catch(function () { orig(); });
    };
  }
  function boot() { fb(); mics(); guard(); setTimeout(mics, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
