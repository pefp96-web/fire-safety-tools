/* 사용 집계: data.json 의 goatcounter 코드가 있으면 GoatCounter 스크립트를 불러오고, data-gc 가 붙은 버튼 클릭을 이벤트로 보낸다. */
(function () {
  var me = document.currentScript;
  var base = me.src.replace(/gc\.js(\?.*)?$/, '');
  var FST = window.FST = { base: base, data: null };
  function load(code) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
    document.head.appendChild(s);
  }
  FST.event = function (name) {
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: name, title: name, event: true });
    }
  };
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-gc]') : null;
    if (t) FST.event(t.getAttribute('data-gc'));
  });
  fetch(base + 'data.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      FST.data = d;
      if (d.goatcounter) load(d.goatcounter);
      document.dispatchEvent(new CustomEvent('fst-data', { detail: d }));
    })
    .catch(function () { document.dispatchEvent(new CustomEvent('fst-data', { detail: null })); });
})();
