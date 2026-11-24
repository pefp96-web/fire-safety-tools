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
    var h = document.querySelector('header.top nav, header.top .in, header.top .wrap, body>header');
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
