/* 소방안전관리자 현장 수첩 오프라인 저장: 한 번 열면 지하·기계실에서도 열림 */
var C = 'fst-kit-v2';
var FILES = ['./', 'index.html', 'calendar.html', 'defects.html', 'record.html', 'inspect.html', 'judge.html', 'logs.html', 'duty.html', 'law.html', 'household.html', 'staff.html', 'buildings.html', 'checklist-data.js', 'common.js', 'kit.css', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('fst-kit-') === 0 && k !== C; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // 새 판을 먼저 받고, 통신이 안 되면 저장본
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok && u.pathname.indexOf('/kit/') !== -1) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match('index.html'); }); }));
});
