// Failure census — "Failure modes by model": stacked label bars per model with a position-band toggle, a grouped legend,
// and a detail panel (definition + the judge's summaries of example sites). One dataset (window.BOBA_CENSUS: the census of the
// leaderboard runs); one instance per .census-card on the page. The compact card of the front page expands the detail in place
// (a click never leaves the page) and offers an explicit "open in the failures tab" link; the full card of /failures/ keeps the
// selection in the URL hash.
(function() {
  var C = window.BOBA_CENSUS, MODELS = window.BOBA_MODELS || {};
  if (!C) return;
  var initialHash = location.hash.slice(1);
  var META = C.model_meta || MODELS;

  function esc(s) { return String(s).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function modelName(mk, field) { var m = META[mk] || MODELS[mk]; return m ? m[field] : mk; }
  var KIND = { miss: 'missed request', regression: 'regression', both: 'missed request and regression' };

  function initCard(card) {
    var tax = {}; C.taxonomy.forEach(function(t) { tax[t.tag] = t; });
    var order = C.taxonomy.map(function(t) { return t.tag; });
    var compact = !!card.dataset.compact;
    var band = 'all', selected = compact ? null : 'FAIL_REGRESSION';
    if (!compact && initialHash && tax[initialHash]) selected = initialHash;
    var rows = card.querySelector('.census-rows'), detail = card.querySelector('.census-detail');

    function renderBars() {
      var counts = C.counts[band] || {};
      rows.querySelectorAll('.census-bar').forEach(function(bar, bi) {
        var mk = bar.dataset.model, c = counts[mk];
        bar.style.setProperty('--d', (bi * 0.18) + 's');
        bar.innerHTML = '';
        if (!c) { bar.classList.add('is-empty'); return; }
        bar.classList.remove('is-empty');
        bar.classList.toggle('has-selection', !!selected);
        order.forEach(function(tag) {
          var k = c.labels[tag]; if (!k) return;
          var seg = document.createElement('button');
          seg.type = 'button';
          seg.className = 'census-seg' + (tag === selected ? ' is-selected' : '');
          seg.style.flex = '0 1 ' + (100 * k / c.n) + '%'; seg.style.background = tax[tag].color;
          seg.title = modelName(mk, 'short') + ' · ' + tax[tag].label + ': ' + k + ' of ' + c.n + ' requests (' + Math.round(100 * k / c.n) + '%)';
          seg.setAttribute('aria-label', 'Select ' + tax[tag].label + ' (' + k + ' requests for ' + modelName(mk, 'label') + ')');
          seg.dataset.tag = tag;
          seg.addEventListener('click', function() { select(tag); });
          bar.appendChild(seg);
        });
      });
    }

    function renderDetail() {
      var t = tax[selected];
      if (!detail) return;
      if (!t) { detail.innerHTML = ''; if (compact) detail.hidden = true; return; }
      var groupName = ''; (C.groups || []).forEach(function(g) { if (g[0] === t.group) groupName = g[1]; });
      var counts = C.counts[band] || {};
      var inBand = Object.keys(counts).reduce(function(a, mk) { return a + (counts[mk].labels[selected] || 0); }, 0);
      var nBand = Object.keys(counts).reduce(function(a, mk) { return a + counts[mk].n; }, 0);
      var html = '<div class="census-detail-head"><span class="census-swatch" style="background:' + t.color + '"></span>' +
        '<span class="census-detail-tag">' + esc(t.label) + '</span><span class="census-detail-group">' + esc(groupName) + '</span>' +
        '<span class="census-detail-count">' + inBand + ' of ' + nBand + ' model × request pairs' + (band === 'all' ? '' : ' at requests ' + band) + ' (' + (nBand ? Math.round(100 * inBand / nBand) : 0) + '%)</span>' +
        (compact ? '<a class="census-open" href="/BOBA-bench/failures/#' + esc(selected) + '">Open in the failures tab →</a><button type="button" class="census-close" aria-label="Close">×</button>' : '') + '</div>' +
        '<p class="census-definition">' + esc(t.definition) + '</p>';
      (C.examples[selected] || []).forEach(function(e) {
        var head = '<a href="/BOBA-bench/chain/' + esc(e.chain_id) + '/#request-' + e.k + '">' + esc(modelName(e.model, 'short')) + ' · ' + esc(e.repo) + ' · request ' + e.k + ' of 20</a>';
        html += '<article class="census-example"><header class="census-example-head">' + head + '</header><p class="census-example-summary">' +
          (e.kind && KIND[e.kind] ? '<span class="census-kind">' + KIND[e.kind] + (e.step_outcome === 'both' ? ' while carrying ' + e.carried + ' earlier failing test' + (e.carried === 1 ? '' : 's') : '') + (e.first_failure ? ' · first failure of the chain' : '') + '</span> · ' : '') + esc(e.summary) +
          (e.elsewhere ? ' <span class="muted">Passed elsewhere: ' + esc(e.elsewhere) + '.</span>' : '') + '</p></article>';
      });
      detail.innerHTML = html;
      if (compact) { detail.hidden = false; var x = detail.querySelector('.census-close'); if (x) x.addEventListener('click', function() { select(null, false); }); }
    }

    function select(tag, updateHash) {
      if (compact && tag !== null && tag === selected) tag = null; // a second click on the same label folds the detail away
      selected = tag;
      if (!compact && tag && updateHash !== false && history.replaceState) history.replaceState(null, '', '#' + tag);
      card.querySelectorAll('.census-chip').forEach(function(ch) { ch.setAttribute('aria-pressed', ch.dataset.tag === tag ? 'true' : 'false'); });
      card.querySelectorAll('.census-seg').forEach(function(seg) { seg.classList.toggle('is-selected', seg.dataset.tag === tag); });
      card.querySelectorAll('.census-bar').forEach(function(bar) { bar.classList.toggle('has-selection', !!tag); });
      renderDetail();
    }

    card.querySelectorAll('.census-chip').forEach(function(ch) { ch.addEventListener('click', function() { select(ch.dataset.tag); }); });
    card.querySelectorAll('.census-tabs button').forEach(function(b) {
      b.addEventListener('click', function() {
        card.querySelectorAll('.census-tabs button').forEach(function(x) { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        band = b.dataset.band; renderBars(); renderDetail();
      });
    });
    renderBars();
    if (!compact) {
      select(selected, false);
      if (initialHash === selected) card.scrollIntoView({ block: 'start' });
      window.addEventListener('hashchange', function() { var t = location.hash.slice(1); if (tax[t] && t !== selected) select(t, false); });
    }
  }

  document.querySelectorAll('.census-card').forEach(initCard);
})();
