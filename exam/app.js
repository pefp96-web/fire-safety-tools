(function(){
const D = window.DATA, $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const page = document.body.dataset.page;
// 공통 머리·꼬리
const nav = [['index.html','소개'],['cards.html','암기 카드'],['mock.html','모의고사'],['wiring.html','가닥수·결선'],['updates.html','개정 알림'],['errata.html','정오표']];
document.body.insertAdjacentHTML('afterbegin', `<header><div class="in"><b>소방설비기사 전기 실기 ${D.full ? '<span class="pill">전체본</span>' : '<span class="pill">무료 맛보기</span>'}</b><nav>${nav.map(([h,t]) => `<a href="${h}" class="${location.pathname.endsWith(h) || (h==='index.html' && /\/$/.test(location.pathname)) ? 'on' : ''}">${t}</a>`).join('')}</nav></div></header>`);
document.body.insertAdjacentHTML('beforeend', `<footer>${esc(D.meta.ver)} · 법제처 국가법령정보센터 원문 대조일 ${D.meta.checked} · 기출 원문·그림은 싣지 않고 법령·NFTC 조문 인용과 직접 만든 문제만 씁니다. · <a href="errata.html">오타 신고</a></footer>`);
const fmtDates = () => Object.entries(D.meta.dates).map(([k,v]) => `<tr><td>${k}</td><td>${esc(D.meta.names[k]||'')}</td><td>${v}</td></tr>`).join('');

if (page === 'index') {
  const f = D.meta.freq;
  $('#freq').innerHTML = `<div class="tw"><table><tr><th>주제</th>${f.cols.map(([c,u]) => `<th><a href="${u}" target="_blank" rel="noopener">${c}</a></th>`).join('')}<th>합</th></tr>${f.rows.map(([t,v]) => `<tr><td>${esc(t)}</td>${v.map(x => `<td>${x}</td>`).join('')}<td>${v.filter(x => typeof x === 'number').reduce((a,b) => a+b, 0)}${v.some(x => typeof x !== 'number' && x) ? '+' : ''}</td></tr>`).join('')}</table></div><p class="hint">${esc(f.note)}</p>`;
  $('#dates').innerHTML = `<table><tr><th>기준</th><th>설비</th><th>시행일</th></tr>${fmtDates()}</table>`;
  $('#plan').innerHTML = `<div class="tw"><table><tr><th>일</th><th>할 것</th><th>도구</th></tr>${D.meta.plan.map(([d,t,w]) => `<tr><td>${d}</td><td>${esc(t)}</td><td>${esc(w)}</td></tr>`).join('')}</table></div>`;
  $('#cnt').textContent = D.cards.length;
}
if (page === 'updates') $('#dates').innerHTML = `<table><tr><th>기준</th><th>설비</th><th>현재 시행일</th></tr>${fmtDates()}</table>`;

if (page === 'cards') {
  const KEY = 'elec_known_' + (D.full ? 'f' : 's');
  let known = JSON.parse(localStorage.getItem(KEY) || '{}'), list = [], i = 0, open = false;
  const syss = [...new Set(D.cards.map(c => c.sys))];
  $('#sys').innerHTML = '<option value="">전체 설비</option>' + syss.map(s => `<option>${s}</option>`).join('');
  function build(){ const s = $('#sys').value, only = $('#only').checked, kw = $('#kw').value.trim();
    list = D.cards.filter(c => (!s || c.sys === s) && (!only || known[c.id] !== 1) && (!kw || (c.art + ' ' + c.q + ' ' + c.a).includes(kw)));
    if ($('#shuf').checked) list.sort(() => Math.random() - .5); i = 0; open = false; show(); }
  function show(){ const n = Object.values(known).filter(v => v === 1).length;
    $('#prog').textContent = `${list.length ? i+1 : 0} / ${list.length}장 · 아는 카드 ${n} / ${D.cards.length}`;
    if (!list.length) { $('#fc').innerHTML = '<p>조건에 맞는 카드가 없습니다. 필터를 바꿔 보세요.</p>'; return; }
    const c = list[i];
    $('#fc').innerHTML = `<span class="band">${esc(c.sys)} · ${esc(c.code)}</span><div class="q">${esc(c.q)}</div>` + (open ? `<div class="a">${esc(c.a)}</div><div class="lab">왜?</div><div>${esc(c.why)}</div>${c.field ? `<div class="lab">현장에서는</div><div>${esc(c.field)}</div>` : ''}<div class="lab">근거 원문 · ${esc(c.code)} ${esc(c.art)}</div><div class="src">${esc(c.quote)}</div><p class="hint">기준 시행일 ${esc(c.date)} · 원문 대조 ${D.meta.checked}</p>` : '<p class="hint">눌러서 답 보기</p>'); }
  $('#fc').onclick = () => { open = !open; show(); };
  const mark = v => { if (!list.length) return; known[list[i].id] = v; localStorage.setItem(KEY, JSON.stringify(known)); i = (i + 1) % list.length; open = false; show(); };
  $('#yes').onclick = () => mark(1); $('#no').onclick = () => mark(0);
  $('#prev').onclick = () => { if (list.length) { i = (i - 1 + list.length) % list.length; open = false; show(); } };
  ['#sys','#only','#shuf'].forEach(s => $(s).onchange = build); $('#kw').oninput = build;
  $('#reset').onclick = () => { if (confirm('아는 카드 기록을 지울까요?')) { known = {}; localStorage.removeItem(KEY); build(); } };
  document.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); open = !open; show(); } if (e.key === 'ArrowRight') mark(1); if (e.key === 'ArrowLeft') mark(0); });
  build();
}

if (page === 'mock') {
  let ex = 0, qs = [], timer = null, left = 0;
  $('#sel').innerHTML = D.exams.map((e, k) => `<option value="${k}">모의고사 ${k+1}회 (${e.length}문항)</option>`).join('');
  function start(onlyIdx){ ex = +$('#sel').value; const all = D.exams[ex].map((q, k) => ({...q, k}));
    qs = onlyIdx ? all.filter(q => onlyIdx.includes(q.k)) : all;
    left = Math.max(5, Math.round(qs.length * 2)) * 60; clearInterval(timer); timer = setInterval(tick, 1000); tick();
    $('#res').innerHTML = ''; $('#paper').innerHTML = qs.map((q, n) => `<div class="qbox" id="q${n}"><div><span class="n">${q.k+1}.</span> ${esc(q.q)}</div>` +
      (q.type === 'mc' ? `<div class="ch">${q.ch.map((c, j) => `<label><input type="radio" name="a${n}" value="${j}">${'①②③④'[j]} ${esc(c)}</label>`).join('')}</div>` : `<div class="row" style="margin-top:8px"><input inputmode="decimal" id="a${n}" placeholder="숫자만" style="width:160px"> <span>${esc(q.unit)}</span></div>`) + `<div class="fb"></div></div>`).join('');
    $('#paper').style.display = ''; $('#submit').style.display = ''; window.scrollTo(0, $('#paper').offsetTop - 70); }
  function tick(){ left--; const m = Math.floor(Math.max(left,0) / 60), s = Math.max(left,0) % 60; $('#tm').textContent = `${m}:${String(s).padStart(2,'0')}`; if (left <= 0) { clearInterval(timer); grade(true); } }
  function grade(auto){ clearInterval(timer); let ok = 0; const wrong = [];
    qs.forEach((q, n) => { let good = false, given = '';
      if (q.type === 'mc') { const r = document.querySelector(`input[name=a${n}]:checked`); given = r ? '①②③④'[+r.value] : '(안 품)'; good = r && +r.value === q.ans;
        document.querySelectorAll(`input[name=a${n}]`).forEach(x => { const l = x.parentNode; if (+x.value === q.ans) l.classList.add('right'); else if (x.checked) l.classList.add('wrong'); x.disabled = true; }); }
      else { const v = $('#a' + n).value.replace(/,/g, '').trim(); given = v || '(안 품)'; good = v !== '' && Math.abs(parseFloat(v) - q.ans) < 1e-6; $('#a' + n).classList.add(good ? 'right' : 'wrong'); $('#a' + n).disabled = true; }
      if (good) ok++; else wrong.push(q.k);
      document.querySelector(`#q${n} .fb`).innerHTML = `<div class="steps"><b style="color:${good ? 'var(--ok)' : 'var(--bad)'}">${good ? '정답' : '오답'}</b> · 내 답 ${esc(given)} · 정답 ${q.type === 'mc' ? '①②③④'[q.ans] + ' ' + esc(q.ch[q.ans]) : esc(q.ans) + ' ' + esc(q.unit)}<br><b>단계별 풀이</b><ol>${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><span class="hint">근거: ${esc(q.art)}</span></div>`; });
    const sc = Math.round(ok / qs.length * 100);
    const hist = JSON.parse(localStorage.getItem('elec_mock') || '[]'); hist.push({ex: ex+1, sc, n: qs.length, t: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)}); localStorage.setItem('elec_mock', JSON.stringify(hist.slice(-20)));
    $('#res').innerHTML = `<div class="card"><div class="big">${sc}점</div><p>${qs.length}문항 중 ${ok}개 정답${auto ? ' (시간 종료로 자동 채점)' : ''}. 60점 이상이면 합격선입니다.</p>${wrong.length ? `<button class="btn" id="retry">틀린 ${wrong.length}문항만 다시 풀기</button>` : '<p>모두 맞혔습니다.</p>'}<p class="hint">최근 기록: ${hist.slice(-5).map(h => `${h.t.replace('T',' ')} ${h.ex}회 ${h.sc}점`).join(' / ')}</p></div>`;
    $('#submit').style.display = 'none'; if (wrong.length) $('#retry').onclick = () => start(wrong); window.scrollTo(0, 0); }
  $('#go').onclick = () => start(); $('#submit').onclick = () => grade(false);
}

if (page === 'wiring') {
  // 가닥수 계산기
  function wires(n, mode, floors){ const com = Math.ceil(n / 7), bell = mode === 'zone' ? floors : 1;
    return {rows: [['회로선(감지기·발신기 회로)', n, '회로(경계구역)마다 1'], ['회로공통선', com, `${n} ÷ 7 올림 (NFTC 203 2.8.1.7)`], ['경종선', bell, mode === 'zone' ? '구분 경보: 층마다 1 (2.5.1.2, 11층 이상)' : '일제 경보: 1'], ['경종표시등공통선', 1, ''], ['표시등선', 1, ''], ['응답선', 1, '']], total: n + com + bell + 3}; }
  function calc(){ const n = Math.max(1, +$('#wn').value || 1), mode = $('#wm').value, fl = Math.max(1, +$('#wf').value || 1); const r = wires(n, mode, fl);
    $('#wout').innerHTML = `<table><tr><th>선 이름</th><th>가닥</th><th>근거·계산</th></tr>${r.rows.map(x => `<tr><td>${x[0]}</td><td><b>${x[1]}</b></td><td>${x[2]}</td></tr>`).join('')}<tr><th>합계</th><th>${r.total}</th><th></th></tr></table>`; }
  ['#wn','#wm','#wf'].forEach(s => $(s).oninput = calc); calc();
  // 연습
  let cur = null, score = [0,0];
  function newQ(){ const n = 1 + Math.floor(Math.random() * 20), zone = Math.random() < .4, fl = zone ? Math.max(11, n) : 1; cur = {n, mode: zone ? 'zone' : 'all', fl, r: wires(n, zone ? 'zone' : 'all', fl)};
    $('#pq').innerHTML = `P형 수신기, 발신기세트 회로 <b>${n}개</b>가 한 간선에 모여 수신기로 간다. ${zone ? `건물은 지상 <b>${fl}층</b>(공동주택 아님), 층마다 회로가 있어 <b>구분 경보</b>.` : '<b>일제 경보</b> 방식.'} 이 간선의 가닥수는?`;
    $('#pa').value = ''; $('#pf').innerHTML = ''; }
  $('#pnew').onclick = newQ; $('#pchk').onclick = () => { const v = +$('#pa').value, good = v === cur.r.total; score[1]++; if (good) score[0]++;
    $('#pf').innerHTML = `<div class="steps"><b style="color:${good ? 'var(--ok)' : 'var(--bad)'}">${good ? '정답' : '오답'}</b> · 정답 ${cur.r.total}가닥 (${cur.r.rows.map(x => x[0] + ' ' + x[1]).join(' + ')}) · 누적 ${score[0]}/${score[1]}</div>`; };
  newQ();
  // 감지기 개수
  const T = { '차동식스포트형 1종': {'4m 미만|내화': 90, '4m 미만|기타': 50, '4~8m|내화': 45, '4~8m|기타': 30}, '차동식스포트형 2종': {'4m 미만|내화': 70, '4m 미만|기타': 40, '4~8m|내화': 35, '4~8m|기타': 25},
    '보상식스포트형 1종': {'4m 미만|내화': 90, '4m 미만|기타': 50, '4~8m|내화': 45, '4~8m|기타': 30}, '보상식스포트형 2종': {'4m 미만|내화': 70, '4m 미만|기타': 40, '4~8m|내화': 35, '4~8m|기타': 25},
    '정온식스포트형 특종': {'4m 미만|내화': 70, '4m 미만|기타': 40, '4~8m|내화': 35, '4~8m|기타': 25}, '정온식스포트형 1종': {'4m 미만|내화': 60, '4m 미만|기타': 30, '4~8m|내화': 30, '4~8m|기타': 15}, '정온식스포트형 2종': {'4m 미만|내화': 20, '4m 미만|기타': 15},
    '연기감지기 1종·2종': {'4m 미만|내화': 150, '4m 미만|기타': 150, '4~8m|내화': 75, '4~8m|기타': 75, '8~15m|내화': 75, '8~15m|기타': 75}, '연기감지기 3종': {'4m 미만|내화': 50, '4m 미만|기타': 50} };
  $('#dt').innerHTML = Object.keys(T).map(k => `<option>${k}</option>`).join('');
  function det(){ const t = $('#dt').value, h = $('#dh').value, s = $('#ds').value, A = +$('#da').value || 0, base = T[t][h + '|' + s];
    const src = t.startsWith('연기') ? '표 2.4.3.10.1' : '표 2.4.3.5';
    $('#dout').innerHTML = base ? `<div class="steps">① ${src}: ${h}, ${s}구조, ${t} → <b>${base} ㎡</b>마다 1개<br>② ${A} ÷ ${base} = ${(A / base).toFixed(2)}<br>③ 소수점 올림 → <b style="font-size:22px">${Math.ceil(A / base)}개</b></div>` : `<div class="steps" style="color:var(--bad)">이 높이에는 이 감지기를 쓸 수 없습니다(표에 '-' 또는 표 2.4.1 부착높이 밖). 근거: NFTC 203 ${src}, 표 2.4.1</div>`; }
  ['#dt','#dh','#ds','#da'].forEach(s => $(s).oninput = det); det();
}
})();


