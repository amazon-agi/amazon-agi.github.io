// BOBA-Bench — shared behaviour: theme toggle, sortable tables, clickable rows,
// Leaderboard / Details / Quadrant view toggle, FAQ permalinks, provider filter.
function toggleTheme() {
  var html = document.documentElement;
  var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
}

// Column sorting (click a <th data-sort="num|str">). Rank cells are renumbered unless the table is data-static-rank.
document.querySelectorAll('th[data-sort]').forEach(function(th) {
  th.addEventListener('click', function() {
    var table = th.closest('table'), body = table.querySelector('tbody');
    var keepRanks = table.hasAttribute('data-static-rank');
    var rows = Array.from(body.querySelectorAll('tr[data-row]'));
    var index = Array.from(th.parentNode.children).indexOf(th);
    var ascending = th.classList.contains('sort-asc');
    th.parentNode.querySelectorAll('th').forEach(function(cell) { cell.classList.remove('sort-asc', 'sort-desc'); });
    th.classList.add(ascending ? 'sort-desc' : 'sort-asc');
    rows.sort(function(a, b) {
      var av = a.children[index].dataset.val || '';
      var bv = b.children[index].dataset.val || '';
      if (th.dataset.sort === 'num') { av = av === '' ? -Infinity : Number(av); bv = bv === '' ? -Infinity : Number(bv); }
      return (av < bv ? -1 : av > bv ? 1 : 0) * (ascending ? 1 : -1);
    });
    rows.forEach(function(row, i) { body.appendChild(row); var rank = row.querySelector('.col-rank'); if (rank && !keepRanks) rank.textContent = i + 1; });
  });
});

document.querySelectorAll('.clickable-row').forEach(function(row) {
  row.addEventListener('click', function(e) { if (!e.target.closest('a')) window.location = row.dataset.href; });
});

// Leaderboard / Details / Quadrant.
(function() {
  var leaderboard = document.getElementById('view-leaderboard');
  var quadrant = document.getElementById('view-quadrant');
  var container = document.querySelector('.leaderboard-container');
  var table = document.querySelector('[data-leaderboard-table]');
  var detailsHint = document.getElementById('details-hint');
  if (!leaderboard || !table) return;
  document.querySelectorAll('.view-toggle-btn').forEach(function(button) {
    button.addEventListener('click', function() {
      var view = button.dataset.view;
      var showQuadrant = view === 'quadrant';
      var showDetails = view === 'details';
      leaderboard.style.display = showQuadrant ? 'none' : '';
      if (quadrant) quadrant.style.display = showQuadrant ? '' : 'none';
      container.classList.toggle('details-active', showDetails);
      table.classList.toggle('lb-table-details', showDetails);
      document.querySelectorAll('[data-summary-column]').forEach(function(column) { column.hidden = showDetails; });
      document.querySelectorAll('[data-detail-column]').forEach(function(column) { column.hidden = !showDetails; });
      if (detailsHint) detailsHint.hidden = !showDetails;
      document.querySelectorAll('.view-toggle-btn').forEach(function(item) {
        var isActive = item.dataset.view === view;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      if (showQuadrant) window.dispatchEvent(new Event('resize'));
    });
  });
})();

// FAQ permalinks and deep links.
(function() {
  var linkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  document.querySelectorAll('.faq-item[id]').forEach(function(item) {
    var summary = item.querySelector('.faq-question');
    var button = document.createElement('button');
    button.className = 'faq-link-btn';
    button.type = 'button';
    button.title = 'Copy link';
    button.setAttribute('aria-label', 'Copy link to this question');
    button.innerHTML = linkIcon;
    button.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      var url = location.origin + location.pathname + '#' + item.id;
      if (navigator.clipboard) { navigator.clipboard.writeText(url); }
      else {
        var textarea = document.createElement('textarea');
        textarea.value = url; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
        document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); document.body.removeChild(textarea);
      }
      button.textContent = 'Copied!';
      setTimeout(function() { button.innerHTML = linkIcon; }, 1500);
    });
    summary.appendChild(button);
  });
  function openFromHash() {
    var id = location.hash.replace('#', '');
    if (!id) return;
    var item = document.getElementById(id);
    if (item && item.tagName === 'DETAILS') { item.open = true; item.scrollIntoView({ behavior: 'smooth' }); }
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();

// Provider filter (funnel button + checkbox popover); also restricts the quadrant chart.
(function() {
  var containers = Array.from(document.querySelectorAll('[data-org-filter]'));
  var rows = Array.from(document.querySelectorAll('.lb-table tr[data-provider]'));
  var providers = Array.from(new Set(rows.map(function(row) { return row.dataset.provider; }))).sort();
  if (!containers.length || providers.length < 2) return;
  var active = {}; providers.forEach(function(provider) { active[provider] = true; });
  var icon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 3H2l8 9.5V19l4 2v-8.5z"/></svg>';
  containers.forEach(function(container) {
    container.innerHTML = '<button class="org-filter-btn" aria-label="Filter providers">' + icon + '</button><div class="org-filter-menu"><div class="org-filter-head">Providers</div>' + providers.map(function(provider) { return '<label class="org-filter-opt"><input type="checkbox" checked data-provider="' + provider + '">' + provider + '</label>'; }).join('') + '<button class="org-filter-reset">Show all</button></div>';
    container.querySelector('.org-filter-btn').addEventListener('click', function() { container.querySelector('.org-filter-menu').classList.toggle('open'); });
    container.querySelectorAll('input').forEach(function(input) { input.addEventListener('change', function() { active[input.dataset.provider] = input.checked; apply(); }); });
    container.querySelector('.org-filter-reset').addEventListener('click', function() { providers.forEach(function(provider) { active[provider] = true; }); apply(); });
  });
  function apply() {
    var allowed = providers.filter(function(provider) { return active[provider]; });
    rows.forEach(function(row) { row.style.display = active[row.dataset.provider] ? '' : 'none'; });
    containers.forEach(function(container) {
      container.querySelector('.org-filter-btn').classList.toggle('is-filtered', allowed.length !== providers.length);
      container.querySelectorAll('input').forEach(function(input) { input.checked = active[input.dataset.provider]; });
    });
    if (window.__bobaScatterFilter) window.__bobaScatterFilter(allowed.length === providers.length ? null : allowed);
  }
  document.addEventListener('click', function(event) { if (!event.target.closest('.org-filter')) document.querySelectorAll('.org-filter-menu.open').forEach(function(menu) { menu.classList.remove('open'); }); });
})();


// Entry animations: elements with .reveal fade in when they scroll into view; numbers in .stat-num / .finding-num count up.
(function() {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = Array.prototype.slice.call(document.querySelectorAll('.reveal, .census-rows, .lb-table'));
  ['.findings-grid', '.pillars', '.compare-highlights', '.link-tiles', '.discoverability-grid', '.stat-strip', '.chart-grid'].forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(g) { g.classList.add('reveal-stagger'); });
  });
  if (reduced || !('IntersectionObserver' in window)) { els.forEach(function(e) { e.classList.add('is-visible'); }); return; }
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); obs.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach(function(e) { obs.observe(e); });

  function countUp(el) {
    var text = el.textContent.trim();
    var m = text.match(/^([+±]?)(\d[\d,]*)(\.\d+)?(.*)$/);
    if (!m) return;
    var prefix = m[1], intPart = m[2].replace(/,/g, ''), decimals = m[3] ? m[3].length - 1 : 0, suffix = m[4];
    var target = parseFloat(intPart + (m[3] || '')), grouped = m[2].indexOf(',') >= 0;
    if (!isFinite(target)) return;
    var start = null, dur = 1800;
    function fmt(v) { var s = v.toFixed(decimals); if (grouped) { var parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = parts.join('.'); } return prefix + s + suffix; }
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * e);
      if (t < 1) requestAnimationFrame(step); else el.textContent = text;
    }
    requestAnimationFrame(step);
  }
  var nums = Array.prototype.slice.call(document.querySelectorAll('.stat-num, .finding-num, .compare-num'));
  var nobs = new IntersectionObserver(function(entries) {
    entries.forEach(function(en) { if (en.isIntersecting) { nobs.unobserve(en.target); countUp(en.target); } });
  }, { threshold: 0.5 });
  nums.forEach(function(n) { nobs.observe(n); });
})();
