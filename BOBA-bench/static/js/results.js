// BOBA-Bench — findings page behaviour (the charts live in charts.js).

// Findings page: highlight the sub-navigation entry of the section in view (the last section whose top has passed the bars).
(function() {
  var nav = document.getElementById('subnav');
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var targets = links.map(function(a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var ticking = false;
  function update() {
    ticking = false;
    var line = nav.getBoundingClientRect().bottom + 60, best = -1; // a section jumped to by anchor (scroll-margin 140px) counts as in view
    targets.forEach(function(el, i) { if (el && el.getBoundingClientRect().top <= line) best = i; });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) best = targets.length - 1;
    links.forEach(function(a, i) { a.classList.toggle('active', i === best); });
  }
  window.addEventListener('scroll', function() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

// A link with an anchor (/#review, or the old /results/#review redirected here) must land on its section even though the
// hero image and the web fonts, which arrive after the first scroll, push the page down.
(function() {
  if (!location.hash) return;
  var id = location.hash.slice(1);
  window.addEventListener('load', function() {
    var el = document.getElementById(id);
    if (!el) return;
    var go = function() { el.scrollIntoView(); };
    setTimeout(go, 60);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function() { setTimeout(go, 30); });
  });
})();
