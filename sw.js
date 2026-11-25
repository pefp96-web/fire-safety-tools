/* 대시보드·계산기 오프라인 저장 (현장 수첩은 kit/sw.js 가 따로 맡음) */
var C = 'fst-root-v2';
var FILES = ['./', 'index.html', 'inspection-deadline/', 'facility-calc/', 'drawing-checker/sample_result/report.html', 'assets/ds.css', 'assets/ui.js', 'assets/PretendardVariable.woff2', 'assets/demo-poster.webp', 'assets/icon-192.png', 'manifest.webmanifest', 'data.json', 'install.html', 'feedback.html'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('fst-root-') === 0 && k !== C; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || e.request.headers.get('range')) return;
  if (/\.(mp4|webm|apk)$/.test(u.pathname)) return; // 영상은 저장하지 않음(용량)
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match('index.html'); }); }));
});
