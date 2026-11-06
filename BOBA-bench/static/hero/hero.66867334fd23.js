(function () {
  var v = document.querySelector('[data-hero-video]'); if (!v) return;
  var replay = document.querySelector('[data-hero-replay]');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function theme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function load(play) {
    var t = theme();
    v.poster = reduce ? v.dataset['end' + (t === 'dark' ? 'Dark' : 'Light')] : v.dataset['poster' + (t === 'dark' ? 'Dark' : 'Light')];
    if (reduce) { replay.hidden = false; return; }
    var src = v.dataset['src' + (t === 'dark' ? 'Dark' : 'Light')], at = v.currentTime || 0;
    if (v.getAttribute('src') !== src) { v.setAttribute('src', src); v.load(); if (at) v.currentTime = at; }
    if (play) { var p = v.play(); if (p && p.catch) p.catch(function () { replay.hidden = false; }); }
  }
  v.addEventListener('ended', function () { replay.hidden = false; });
  replay.addEventListener('click', function () {
    if (reduce) { reduce = false; }
    replay.hidden = true; load(false); v.currentTime = 0; v.play();
  });
  new MutationObserver(function () { load(!v.paused || v.currentTime === 0); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  load(true);
})();
