// BOBA-Bench — charts of the findings and benchmark pages (Chart.js 4), drawn lazily when they scroll into view
// so that their entry animation plays; data arrives in window.BOBA_FINDINGS / window.BOBA_BENCH (see build.py chart_data).
(function() {
  if (typeof Chart === 'undefined') return;
  var F = window.BOBA_FINDINGS || null, B = window.BOBA_BENCH || null;
  // The record's drawing style (the design specification, §5): Plex Mono numbers, condensed axis titles, ink axes, no grid,
  // ink = verified, ochre hatch = assumed / carried, red = broken; models by glyph + cold tone.
  var MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace";
  var COND = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  var SERIF = MONO;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var charts = [];
  var GLYPHS = (F && F.glyphs) || {};

  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function cssVar(name, fallback) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }
  function pal() {
    var d = isDark();
    return { grid: cssVar('--border', d ? '#2f4260' : '#d9d1c3'), text: cssVar('--text', d ? '#c9d1dc' : '#2b2b2b'), muted: cssVar('--text-m', d ? '#8e9aab' : '#6e6a62'),
             faint: cssVar('--text-m', '#6e6a62'), paper: cssVar('--bg', d ? '#121b2a' : '#faf8f3'), paper2: cssVar('--bg-r', d ? '#1f2e47' : '#f1ece3'),
             red: '#994B3C', ochre: '#D8BB91' };
  }
  // the site's original chart colours (the paper's figure palette): navy, clay, blue, grey, sand
  var ROLE = { ink: function() { return '#203F60'; }, grey: function() { return '#6b6b6b'; }, light: function() { return '#c3b7a0'; }, red: function() { return '#994B3C'; }, ochre: function() { return '#D8BB91'; }, blue: function() { return '#477DA5'; }, green: function() { return '#7EAD36'; } };
  function alpha(hex, a) { if (!hex || hex[0] !== '#') return hex; var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  // diagonal hatch (45°, 3 px pitch) in a colour: the mark of "assumed, not checked" — the same hatch the stylesheet draws
  var hatchCache = {};
  function hatch(color, bg) {
    var key = color + '|' + (bg || '');
    if (hatchCache[key]) return hatchCache[key];
    var c = document.createElement('canvas'); c.width = 6; c.height = 6; var x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, 6, 6); }
    x.strokeStyle = color; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-1, 7); x.lineTo(7, -1); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(5, 7); x.lineTo(7, 5); x.stroke();
    var pat = x.createPattern(c, 'repeat'); hatchCache[key] = pat; return pat;
  }
  // a model's tone: as given on the record (light), lightened on the carbon copy so that it keeps ≥ 3:1 against the dark paper
  function mix(hex, white, t) { if (!hex || hex[0] !== '#') return hex; var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; var f = function(c) { return Math.round(c * (1 - t) + 255 * t); }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
  function tone(hex) { return isDark() ? mix(hex, '#ffffff', 0.25) : hex; }
  function font(size, family) { return { family: family || MONO, size: size || 11 }; }
  function pct(v) { return v + '%'; }

  Chart.defaults.font.family = COND;
  // keep Chart.js's animation defaults object (its keys define which per-property options exist: delay, from, ...)
  if (REDUCED) Chart.defaults.animation = false; else { Chart.defaults.animation.duration = 900; Chart.defaults.animation.easing = 'easeOutQuart'; }

  // Bars: each row pops a little after the previous one, each series after the previous series
  // (paced like harnesstax.github.io's rank race: ~1.4 s per bar).
  function staggered() {
    if (REDUCED) return false;
    return { duration: 1400, easing: 'easeOutQuart', delay: function(ctx) { return ctx.type === 'data' ? ctx.dataIndex * 130 + ctx.datasetIndex * 280 : 0; } };
  }

  // Motion model. A chart is built static. Until its story has started it is "armed": axes and legend are drawn, the
  // data is not. The story of a line chart is a sweep: a clip that widens left to right at constant speed reveals the
  // lines pixel by pixel (all series together), with a pulse ring where the sweep crosses a point; the story of a bar
  // chart is the staggered Chart.js animation from zero.
  var motion = {
    id: 'motion',
    beforeDatasetsDraw: function(chart) {
      var ctx = chart.ctx, area = chart.chartArea;
      if (chart.$armed) { ctx.save(); ctx.beginPath(); ctx.rect(area.left, area.top, 0, 0); ctx.clip(); chart.$clipped = true; return; }
      var st = chart.$story; if (!st || st.kind !== 'sweep') return;
      var p = Math.max(0, Math.min(1, (performance.now() - st.start) / st.total));
      ctx.save(); ctx.beginPath(); ctx.rect(area.left - 12, area.top - 24, (area.width + 24) * p, area.height + 48); ctx.clip(); chart.$clipped = true;
    },
    afterDatasetsDraw: function(chart) {
      var ctx = chart.ctx;
      if (chart.$clipped) { ctx.restore(); chart.$clipped = false; }
      var st = chart.$story; if (!st || st.kind !== 'sweep') return;
      var area = chart.chartArea, el = performance.now() - st.start;
      chart.data.datasets.forEach(function(ds, di) {
        var meta = chart.getDatasetMeta(di);
        if (meta.hidden || ds.showLine === false || ds.borderDash) return;
        var color = Array.isArray(ds.borderColor) ? ds.borderColor[0] : ds.borderColor;
        meta.data.forEach(function(pt) {
          if (pt.skip || isNaN(pt.x)) return;
          var passedAt = (pt.x - area.left) / area.width * st.total, t = el - passedAt;
          if (t < 0 || t > 750) return;
          var k = t / 750;
          ctx.save(); ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = color; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 4 + 20 * k, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        });
      });
    }
  };
  Chart.register(motion);

  // value labels on bars, so that a chart reads without hovering. The formatter is kept outside the Chart.js options
  // (whose resolver would call any function it finds as a scriptable option).
  var VALUE_FORMAT = {};
  function labelValues(chart, fmt) { VALUE_FORMAT[chart.id] = fmt; chart.draw(); return chart; }
  var valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw: function(chart) {
      var fmt = VALUE_FORMAT[chart.id];
      if (!fmt || chart.$armed) return;
      var ctx = chart.ctx, horizontal = chart.options.indexAxis === 'y', p = pal();
      ctx.save();
      ctx.font = '600 11px ' + COND;
      chart.data.datasets.forEach(function(ds, di) {
        var meta = chart.getDatasetMeta(di);
        if (meta.hidden || meta.type !== 'bar') return;
        meta.data.forEach(function(bar, i) {
          var v = ds.data[i];
          var lab = fmt(v, di, i, ds, bar);
          if ((v === null || v === undefined) && !lab) return;
          if (lab === null || lab === undefined || lab === '') return;
          if (typeof lab === 'string') lab = { text: lab };
          ctx.fillStyle = lab.color || p.text;
          var missing = (v === null || v === undefined);
          if (horizontal) {
            var bx = missing ? chart.scales.x.getPixelForValue(0) : bar.x, by = missing ? chart.scales.y.getPixelForValue(i) : bar.y;
            if (missing) { ctx.fillStyle = p.muted; var n = chart.data.datasets.length, h = (chart.scales.y.getPixelForValue(1) - chart.scales.y.getPixelForValue(0)) * 0.84 / n; by += (di - (n - 1) / 2) * h; }
            ctx.textBaseline = 'middle';
            if (lab.inside) { ctx.textAlign = 'right'; ctx.fillText(lab.text, bx - 5, by); }
            else { ctx.textAlign = 'left'; ctx.fillText(lab.text, bx + 5 + (lab.dx || 0), by); }
          } else {
            var w = bar.width || 20;
            if (w < 18) { ctx.save(); ctx.translate(bar.x, bar.y - 4); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(lab.text, 0, 0); ctx.restore(); }
            else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(lab.text, bar.x, bar.y - 3); }
          }
        });
      });
      ctx.restore();
    }
  };
  Chart.register(valueLabels);

  // start (or restart) a chart's story
  function replay(chart) {
    if (REDUCED) return;
    chart.$armed = false;
    if (chart.$sweep) {
      var total = chart.$sweep;
      chart.$story = { kind: 'sweep', start: performance.now(), total: total };
      (function loop() {
        if (!chart.$story) return;
        if (performance.now() - chart.$story.start > total + 900) { chart.$story = null; chart.draw(); return; }
        chart.draw(); requestAnimationFrame(loop);
      })();
      return;
    }
    chart.options.animation = staggered();
    chart.reset(); chart.update();
  }

  function base(opts) {
    var p = pal();
    var o = {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { titleFont: font(13, COND), bodyFont: font(13, COND), padding: 10 }
      },
      scales: {}
    };
    // horizontal bars: room for the widest category label (left) and the value labels drawn past the bars (right)
    if (opts.indexAxis === 'y') o.layout = { padding: { left: 4, right: 34 } };
    (opts.axes || ['x', 'y']).forEach(function(ax) {
      var a = opts[ax] || {};
      // keys are only set when needed: an explicit `undefined` would override Chart.js defaults
      // (for instance the category scale's tick callback, which turns indices into the labels)
      var sc = {
        title: a.title ? { display: true, text: a.title, color: p.text, font: font(13, COND) } : { display: false },
        ticks: { color: p.text, font: font(12, COND), maxRotation: 0, autoSkip: a.autoSkip !== false },
        grid: { color: (a.noGrid === true || (ax === 'x' && a.noGrid !== false)) ? 'transparent' : p.grid, drawTicks: false },
        border: { display: false }
      };
      if (a.pct) sc.ticks.callback = function(v) { return v + '%'; };
      if (a.min !== undefined) sc.min = a.min;
      if (a.max !== undefined) sc.max = a.max;
      if (a.stacked) sc.stacked = true;
      if (a.type) sc.type = a.type;
      o.scales[ax] = sc;
    });
    if (opts.indexAxis) o.indexAxis = opts.indexAxis;
    // the category axis of horizontal bars measures its labels a few pixels short of how they are drawn: widen it
    if (opts.indexAxis === 'y' && o.scales.y) o.scales.y.afterFit = function(scale) { scale.width += 12; };
    if (opts.interaction) o.interaction = opts.interaction;
    if (opts.tooltipLabel) o.plugins.tooltip.callbacks = { label: opts.tooltipLabel };
    if (opts.tooltipTitle) { o.plugins.tooltip.callbacks = o.plugins.tooltip.callbacks || {}; o.plugins.tooltip.callbacks.title = opts.tooltipTitle; }
    return o;
  }

  // Every chart is built as soon as the script runs, so nothing depends on scroll events or observers to appear;
  // the entry animation is replayed (reset + update) the first time the chart scrolls into view.
  var built = [];
  function lazy(id, build) {
    var canvas = document.getElementById(id);
    if (!canvas) return;
    var ch = null;
    try {
      var block = canvas.parentElement, wrap = document.createElement('div');
      wrap.className = 'chart-canvas'; block.insertBefore(wrap, canvas); wrap.appendChild(canvas); block.classList.add('has-legend');
      ch = build(canvas);
      if (ch) { charts.push(ch); htmlLegend(ch, block, wrap); }
    } catch (e) { console.error('chart ' + id, e); }
    if (!ch || REDUCED || !('IntersectionObserver' in window)) return;
    var item = { canvas: canvas, chart: ch, played: false };
    built.push(item);
    var r = canvas.getBoundingClientRect(), vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh * 0.9 && r.bottom > 0) { item.played = true; replay(ch); return; } // on screen at load: play now
    ch.$armed = true; ch.draw(); // off screen: axes only until the story starts
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) { if (en.isIntersecting && !item.played) { item.played = true; obs.disconnect(); try { replay(ch); } catch (e) {} } });
    }, { threshold: 0.4 });
    obs.observe(canvas);
  }
  // safety net beside the observer: on scroll, any armed chart that is on screen starts its story
  var ticking = false;
  function sweepArmed() {
    ticking = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    built.forEach(function(item) {
      if (item.played) return;
      var r = item.canvas.getBoundingClientRect();
      if (r.top < vh * 0.7 && r.bottom > vh * 0.1) { item.played = true; try { replay(item.chart); } catch (e) {} }
    });
  }
  window.addEventListener('scroll', function() { if (!ticking) { ticking = true; requestAnimationFrame(sweepArmed); } }, { passive: true });

  // HTML legend: one entry per dataset unless the dataset sets _legend: false; swatch shape follows the dataset
  function htmlLegend(chart, block, wrap) {
    var items = [];
    chart.data.datasets.forEach(function(ds) {
      if (ds._legend === false) return;
      var isLine = ds.type === 'line' || (!ds.type && chart.config.type === 'line');
      var kind = ds._swatch || (ds.type === 'scatter' ? (ds.pointStyle === 'line' ? 'tick' : 'diamond') : isLine ? (ds.borderDash ? 'dash' : 'line') : 'bar');
      var bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[0] : ds.backgroundColor, bd = Array.isArray(ds.borderColor) ? ds.borderColor[0] : ds.borderColor;
      items.push({ text: ds._legendLabel || ds.label, kind: kind, color: ds._swatchColor || (kind === 'bar' ? bg : (bd || bg)), last: !!ds._legendLast });
    });
    if (!items.length) return;
    items.sort(function(x, y) { return (x.last ? 1 : 0) - (y.last ? 1 : 0); });
    var el = document.createElement('div'); el.className = 'chart-legend';
    items.forEach(function(it) {
      var sp = document.createElement('span'); sp.className = 'chart-legend-item';
      var sw = document.createElement('i'); sw.className = 'sw sw-' + it.kind; sw.style.setProperty('--c', it.color);
      sp.appendChild(sw); sp.appendChild(document.createTextNode(it.text)); el.appendChild(sp);
    });
    if (!REDUCED) {
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'chart-replay'; btn.setAttribute('aria-label', 'Replay animation');
      btn.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M13.8 2.6v3.2h-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Replay';
      btn.addEventListener('click', function() { replay(chart); });
      el.appendChild(btn);
    }
    block.insertBefore(el, wrap);
    chart.resize();
  }

  function luminance(hex) { if (!hex || hex[0] !== '#') return 0; var n = parseInt(hex.slice(1), 16); var r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

  function counts(ch) { ch.options.animation = false; return labelValues(ch, function(v) { return v.toLocaleString(); }); }

  function pctLabel(ctx) { var v = ctx.parsed[ctx.chart.options.indexAxis === 'y' ? 'x' : 'y']; return ' ' + ctx.dataset.label + ': ' + (v === null ? '—' : v + '%'); }

  function barOpts(o) { o.animation = false; return o; }

  function groupedBars(canvas, cats, series, opts) {
    // cats: x labels; series: [{label, color, values}]
    var ch = new Chart(canvas, {
      type: 'bar',
      data: { labels: cats, datasets: series.map(function(s) { return { label: s.label, data: s.values, backgroundColor: s.alpha ? alpha(s.color, s.alpha) : s.color, borderColor: s.color, borderWidth: s.alpha ? 1.5 : 0, maxBarThickness: 46 }; }) },
      options: barOpts(base(Object.assign({ y: { min: 0, max: opts.max === undefined ? 100 : opts.max, pct: opts.pct !== false, title: opts.ytitle }, x: { title: opts.xtitle }, tooltipLabel: pctLabel }, opts.extra || {})))
    });
    return labelValues(ch, function(v) { return (Math.round(v * 10) / 10) + (opts.pct === false ? '' : '%'); });
  }

  // horizontal grouped bars: one row per model, values at the end of each bar
  function hbars(canvas, cats, series, opts) {
    var ch = new Chart(canvas, {
      type: 'bar',
      data: { labels: cats, datasets: series.map(function(sr) { return { label: sr.label, data: sr.values, _ci: null, _swatch: sr.hatch ? 'hatch' : undefined, _swatchColor: sr.color, backgroundColor: sr.hatch ? hatch(sr.color, pal().paper) : (sr.alpha ? alpha(sr.color, sr.alpha) : sr.color), borderColor: sr.color, borderWidth: sr.hatch ? 1 : (sr.alpha ? 1.2 : 0), maxBarThickness: opts.thick || 18, categoryPercentage: 0.84, barPercentage: 0.9 }; }),
        _rowColors: cats.map(function(_, i) { return (opts.rowColors || [])[i]; }) },
      options: barOpts(base(Object.assign({ indexAxis: 'y', axes: ['x', 'y'], x: { min: 0, max: opts.max === undefined ? 100 : opts.max, pct: opts.pct !== false, title: opts.xtitle, noGrid: false }, y: { noGrid: true, autoSkip: false }, tooltipLabel: pctLabel }, opts.extra || {})))
    });
    // a value label sits after the bar, or after the whisker when the series carries confidence intervals
    var fmt = opts.labelFormat || function(v) { return (Math.round(v * 10) / 10) + (opts.pct === false ? '' : '%'); };
    return labelValues(ch, function(v, di, i, ds, bar) {
      var lab = fmt(v, di, i, ds, bar); if (lab == null || lab === '') return lab;
      if (typeof lab === 'string') lab = { text: lab };
      var ci = ds._ci && ds._ci[i];
      if (ci && ci[1] != null && !lab.inside && v != null) lab.dx = Math.max(0, ch.scales.x.getPixelForValue(ci[1]) - bar.x) + 2;
      return lab;
    });
  }

  // confidence whiskers: a dataset's _ci = [[lo, hi], …] per point; drawn along the value axis at each bar's centre
  var whiskers = {
    id: 'whiskers',
    afterDatasetsDraw: function(chart) {
      var horizontal = chart.options.indexAxis === 'y', ctx = chart.ctx;
      chart.data.datasets.forEach(function(ds, di) {
        if (!ds._ci) return;
        var meta = chart.getDatasetMeta(di); if (meta.hidden) return;
        var scale = horizontal ? chart.scales.x : chart.scales.y;
        meta.data.forEach(function(bar, i) {
          var ci = ds._ci[i]; if (!ci || ci[0] == null || ci[1] == null) return;
          var a = scale.getPixelForValue(ci[0]), b = scale.getPixelForValue(ci[1]), cap = 3;
          ctx.save(); ctx.strokeStyle = pal().text; ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.beginPath();
          if (horizontal) { ctx.moveTo(a, bar.y); ctx.lineTo(b, bar.y); ctx.moveTo(a, bar.y - cap); ctx.lineTo(a, bar.y + cap); ctx.moveTo(b, bar.y - cap); ctx.lineTo(b, bar.y + cap); }
          else { ctx.moveTo(bar.x, a); ctx.lineTo(bar.x, b); ctx.moveTo(bar.x - cap, a); ctx.lineTo(bar.x + cap, a); ctx.moveTo(bar.x - cap, b); ctx.lineTo(bar.x + cap, b); }
          ctx.stroke(); ctx.restore();
        });
      });
    }
  };
  Chart.register(whiskers);

  // stacked horizontal shares (one row per model; the series sum to 100%)
  function stackedShares(canvas, cats, series, opts) {
    var ch = new Chart(canvas, {
      type: 'bar',
      data: { labels: cats, datasets: series.map(function(sr) { return { label: sr.label, data: sr.values, backgroundColor: sr.color, borderColor: '#fff', borderWidth: 1, maxBarThickness: 22, stack: 's' }; }) },
      options: (function() {
        var o = base(Object.assign({ indexAxis: 'y', axes: ['x', 'y'], x: { min: 0, max: 100, pct: true, title: opts.xtitle, noGrid: false }, y: { noGrid: true, autoSkip: false },
          tooltipLabel: function(ctx) { return ' ' + ctx.dataset.label + ': ' + (Math.round(ctx.parsed.x * 10) / 10) + '%'; }, tooltipTitle: function(items) { return items[0].label; } }, opts.extra || {}));
        o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.y.type = 'category'; o.animation = false;
        return o;
      })()
    });
    return ch;
  }

  // verification and repair: pass@1 as a solid bar, the chains rescued by one "verification failed" message stacked on it
  // in a lighter tint, pass@8 as a tick
  function progress(canvas, rows) {
    var cats = rows.map(function(r) { return r.short; });
    var ch = new Chart(canvas, {
      data: { labels: cats, datasets: [
        { type: 'bar', label: 'Without the signal (pass@1)', _swatchColor: ROLE.grey(), data: rows.map(function(r) { return r.pass1; }), backgroundColor: rows.map(function(r) { return r.color; }), maxBarThickness: 22, stack: 's', order: 2 },
        { type: 'bar', label: 'Added by one "verification failed" message and one repair round', _swatchColor: alpha(ROLE.grey(), 0.35), data: rows.map(function(r) { return Math.round((r.vr - r.pass1) * 10) / 10; }), backgroundColor: rows.map(function(r) { return alpha(r.color, 0.35); }), borderColor: rows.map(function(r) { return r.color; }), borderWidth: 1.2, maxBarThickness: 22, stack: 's', order: 2 },
      ].concat(rows.some(function(r) { return r.pass8 != null; }) ? [
        { type: 'scatter', label: 'Best of eight attempts (pass@8)', data: rows.map(function(r, i) { return { x: r.pass8, y: i }; }), pointStyle: 'line', pointRotation: 90, pointRadius: 14, pointHoverRadius: 16, borderColor: ROLE.ink(), borderWidth: 2.2, backgroundColor: ROLE.ink(), order: 1, yAxisID: 'y' }
      ] : []) },
      options: (function() {
        var o = base({ indexAxis: 'y', axes: ['x', 'y'], x: { min: 0, max: 100, pct: true, title: 'Chains completed', noGrid: false }, y: { noGrid: true, autoSkip: false },
          tooltipLabel: function(ctx) {
            var r = rows[ctx.dataIndex];
            if (ctx.dataset.type === 'scatter') return ' pass@8: ' + r.pass8 + '%';
            if (ctx.datasetIndex === 0) return ' pass@1 without the signal: ' + r.pass1 + '%';
            return ' pass@1 with the signal: ' + r.vr + '% (' + (r.delta != null ? (r.delta >= 0 ? '+' : '') + r.delta + ' points, 95% CI ' + r.ci[0] + ' to ' + r.ci[1] : '+' + (Math.round((r.vr - r.pass1) * 10) / 10) + ' points') + ')';
          }, tooltipTitle: function(items) { return items[0].label; } });
        o.scales.x.stacked = true; o.scales.y.stacked = true;
        o.scales.y.type = 'category';
        o.animation = false;
        return o;
      })()
    });
    return labelValues(ch, function(v, di, i, ds, bar) {
      var r = rows[i];
      if (di === 0) {
        // inside the solid bar when the text fits, otherwise just right of the divider
        var text = r.pass1 + '%', len = Math.abs(bar.x - bar.base), need = ch.ctx.measureText(text).width + 12;
        if (len >= need) return { text: text, inside: true, color: luminance(r.color) > 0.6 ? pal().text : pal().paper };
        return { text: text, color: pal().text };
      }
      if (di === 1) {
        // the gain label sits after the stack; when the pass@8 tick falls on it, it moves to the right of the tick
        var t = '+' + (Math.round((r.vr - r.pass1) * 10) / 10) + ' → ' + r.vr + '%';
        if (r.pass8 == null) return t;
        var end = bar.x, tickX = ch.scales.x.getPixelForValue(r.pass8), w = ch.ctx.measureText(t).width;
        if (tickX >= end - 3 && tickX <= end + w + 10) return { text: t, dx: tickX - end + 6 };
        return t;
      }
      return null;
    });
  }

  function lines(canvas, labels, series, opts) {
    var o = base(Object.assign({ interaction: { mode: 'index', intersect: false }, y: { min: opts.min === undefined ? 0 : opts.min, max: opts.max === undefined ? 100 : opts.max, pct: opts.pct !== false, title: opts.ytitle }, x: { title: opts.xtitle, noGrid: true }, tooltipLabel: pctLabel, tooltipTitle: opts.tooltipTitle }, opts.extra || {}));
    // the curve is swept into view over about six seconds, as harnesstax.github.io's accrual story (STORY_MS = 6000)
    var total = opts.duration || (labels.length >= 10 ? 6000 : 4500);
    o.animation = false;
    var ch = new Chart(canvas, {
      type: 'line',
      data: { labels: labels, datasets: series.map(function(sr) {
        return Object.assign({ label: sr.label, data: sr.values, borderColor: sr.color, backgroundColor: sr.color, borderWidth: 2.2, pointRadius: 3, pointHoverRadius: 5, tension: 0.15, fill: false, spanGaps: true }, sr.extra || {}); }) },
      options: o
    });
    ch.$sweep = total;
    return ch;
  }

  if (F) {
    // completion by request, leaderboard runs (ten models, uncensored): request k passed on its step | chains clean at k
    var K20 = Array.from({ length: 20 }, function(_, i) { return i + 1; });
    lazy('completionChart', function(c) {
      return lines(c, K20, F.by_request.map(function(m) { return { label: m.short, color: m.color, values: m.completion }; }),
        { xtitle: 'Request', ytitle: 'Passed', tooltipTitle: function(items) { return 'request ' + items[0].label; } });
    });
    lazy('cleanChart', function(c) {
      return lines(c, K20, F.by_request.map(function(m) { return { label: m.short, color: m.color, values: m.clean }; }),
        { xtitle: 'Request', ytitle: 'Clean', tooltipTitle: function(items) { return 'after request ' + items[0].label; } });
    });

    lazy('verifiedChart', function(c) {
      var V = F.verified;
      return hbars(c, V.map(function(m) { return m.short; }), [
        { label: 'pass@1 without the signal', color: ROLE.grey(), values: V.map(function(m) { return m.pass1; }) },
        { label: 'pass@1 with one "verification failed" message and one repair round', color: ROLE.red(), values: V.map(function(m) { return m.vr; }) }
      ], { xtitle: 'pass@1', thick: 12,
           labelFormat: function(v, di, i) { var m = V[i]; return di === 1 ? m.vr + '%  (' + (m.delta >= 0 ? '+' : '') + m.delta + ')' : v + '%'; },
           extra: { tooltipLabel: function(ctx) { var m = V[ctx.dataIndex]; return ctx.datasetIndex === 0 ? ' without the signal: ' + m.pass1 + '%' : ' with the signal: ' + m.vr + '% (paired Δ ' + (m.delta >= 0 ? '+' : '') + m.delta + ' pp, 95% CI ' + m.ci[0] + ' to ' + m.ci[1] + ')'; } } });
    });
    lazy('verifiedRegressionChart', function(c) {
      return hbars(c, F.verified_regression.map(function(m) { return m.short; }), [
        { label: 'Regression rate without the signal', color: ROLE.grey(), values: F.verified_regression.map(function(m) { return m.plain; }) },
        { label: 'Regression rate with the signal', color: ROLE.red(), values: F.verified_regression.map(function(m) { return m.verify; }) }
      ], { xtitle: 'Regression rate', thick: 12 });
    });
    // recovery of failed tests: share still failing d requests after they failed (survival), one line per model
    if (F.recovery) {
      lazy('recoveryCurveChart', function(c) {
        return lines(c, Array.from({ length: 20 }, function(_, i) { return i; }), F.recovery.curve.map(function(m) { return { label: m.short, color: m.color, values: m.values }; }),
          { xtitle: 'Requests later', ytitle: 'Still failing', tooltipTitle: function(items) { return items[0].label + ' request' + (items[0].label === '1' ? '' : 's') + ' later'; } });
      });
    }
    // new-failure probability by the number of earlier requests still carried broken (every graded request, ten models)
    if (F.dose_handoff) {
      lazy('doseHandoffChart', function(c) {
        return lines(c, F.dose_handoff.bins, F.dose_handoff.series.map(function(m) { return { label: m.short, color: m.color, values: m.values }; }),
          { xtitle: 'Earlier failures present', ytitle: 'Success', max: 100, min: 50,
            tooltipTitle: function(items) { return items[0].label + ' earlier failure' + (items[0].label === '1' ? '' : 's') + ' present'; } });
      });
    }

    lazy('matchedChart', function(c) {
      return hbars(c, F.matched.map(function(m) { return m.short; }), [
        { label: "From the developers' code", color: ROLE.ink(), values: F.matched.map(function(m) { return m.human; }) },
        { label: "From the agent's own verified code", color: ROLE.red(), values: F.matched.map(function(m) { return m.agent; }) }
      ], { xtitle: 'Success' });
    });

    lazy('continuationChart', function(c) {
      return hbars(c, F.continuation.map(function(m) { return m.short; }), [
        { label: 'From a state that was never wrong', color: ROLE.ink(), values: F.continuation.map(function(m) { return m.clean; }) },
        { label: 'After one silent miss nobody flagged', color: ROLE.red(), values: F.continuation.map(function(m) { return m.after_miss; }) },
        { label: 'After the miss was repaired', color: ROLE.blue(), values: F.continuation.map(function(m) { return m.after_repair; }) }
      ], { xtitle: 'Success' });
    });

    lazy('doseChart', function(c) {
      return lines(c, F.dose.bins, F.dose.series.map(function(s) { return { label: s.short, color: s.color, values: s.values }; }),
        { xtitle: 'Open mistakes', ytitle: 'Success', tooltipTitle: function(items) { return items[0].label + ' open mistake' + (items[0].label === '1' ? '' : 's'); } });
    });

    // four harnesses on the same 58 chains: mini-swe-agent (the leaderboard's) against Codex CLI, OpenHands SDK and pi, paired
    if (F.harness) {
      lazy('harnessChart', function(c) {
        var H = F.harness, R = H.rows, cols = { codex: ROLE.blue(), openhands: ROLE.grey(), pi: ROLE.light() };
        var series = [{ label: H.harness_names.mini + ' (the leaderboard)', color: ROLE.ink(), values: R.map(function(r) { return r.base.pct; }), ci: R.map(function(r) { return r.base.ci; }) }]
          .concat(H.arms.map(function(a) { return { label: H.harness_names[a], color: cols[a], values: R.map(function(r) { return r.arms[a].pct; }), ci: R.map(function(r) { return r.arms[a].ci; }) }; }));
        return hbars(c, R.map(function(r) { return r.short; }), series, { xtitle: 'pass@1', thick: 11,
          labelFormat: function(v, di, i) { if (di === 0) return v + '%'; var a = R[i].arms[H.arms[di - 1]]; return v + '%  (' + (a.diff.pp >= 0 ? '+' : '') + a.diff.pp + ')'; },
          extra: { tooltipLabel: function(ctx) { var r = R[ctx.dataIndex]; if (ctx.datasetIndex === 0) return ' ' + ctx.dataset.label + ': ' + r.base.pct + '% (' + r.base.k + ' of ' + r.base.n + ')'; var a = r.arms[H.arms[ctx.datasetIndex - 1]]; return ' ' + ctx.dataset.label + ': ' + a.pct + '%; paired Δ ' + (a.diff.pp >= 0 ? '+' : '') + a.diff.pp + ' pp [' + a.diff.ci[0] + ', ' + a.diff.ci[1] + '], McNemar p = ' + a.p.toFixed(3); } } });
      });
    }
    // Verified variants: repair rate after the bare message once, after insisting four times, after naming the failing tests once
    if (F.repair) {
      lazy('repairChart', function(c) {
        var R = F.repair;
        var fmt = function(v, di, i) { var r = R[i]; if (v == null) return di === 2 ? 'pending' : ''; var t = v + '%'; if (di === 2 && r.name_minus_insist) t += '  (' + (r.name_minus_insist.pp >= 0 ? '+' : '') + r.name_minus_insist.pp + ' vs the bare message)'; if ((di === 2 && !r.name_final) || (di !== 2 && !r.insist_final)) t += ' ·interim'; return t; };
        return hbars(c, R.map(function(r) { return r.short; }), [
          { label: 'The bare message, once', color: ROLE.grey(), values: R.map(function(r) { return r.insist_r1; }), ci: R.map(function(r) { return r.insist_r1_ci; }) },
          { label: 'The bare message, up to four times', color: ROLE.blue(), values: R.map(function(r) { return r.insist_r4; }), ci: R.map(function(r) { return r.insist_r4_ci; }) },
          { label: 'The message with the failing tests named, once', color: ROLE.red(), values: R.map(function(r) { return r.name_r1; }), ci: R.map(function(r) { return r.name_r1_ci; }) }
        ], { xtitle: 'Repaired', thick: 11, labelFormat: fmt,
             extra: { tooltipLabel: function(ctx) { var r = R[ctx.dataIndex], v = ctx.parsed.x; if (v == null) return ' pending'; var t = ' ' + ctx.dataset.label + ': ' + v + '%'; if (ctx.datasetIndex === 2) t += ' (' + r.name_closed[0] + ' of ' + r.name_closed[1] + ' slots' + (r.name_final ? '' : ', interim') + '; regressions introduced ' + r.name_reg + '%)'; else t += ' (' + r.insist_closed[0] + ' of ' + r.insist_closed[1] + ' slots' + (r.insist_final ? '' : ', interim') + ')'; return t; } } });
      });
    }
    // the noisy watcher: pass@1 with no supervisor, with alarms only on failures, and with phantom alarms at p = 0.1 and 0.5
    if (F.noisy) {
      lazy('noisyChart', function(c) {
        var R = F.noisy;
        var fmt = function(v, di, i) { var r = R[i]; if (v == null) return di === 3 ? 'pending' : ''; var t = v + '%'; if (di === 3 && r.d05) t += '  (' + (r.d05.pp >= 0 ? '+' : '') + r.d05.pp + ' vs no watcher)'; if (di === 3 && !r.final) t += ' ·interim'; return t; };
        return hbars(c, R.map(function(r) { return r.short; }), [
          { label: 'No watcher (plain handoff, same chains)', color: ROLE.grey(), values: R.map(function(r) { return r.plain; }) },
          { label: 'A watcher that is never wrong (alarm only on failures)', color: ROLE.ink(), values: R.map(function(r) { return r.p0; }) },
          { label: 'Wrong one time in ten (p = 0.1)', color: ROLE.blue(), values: R.map(function(r) { return r.p01; }), ci: R.map(function(r) { return r.p01_ci; }) },
          { label: 'Wrong half the time (p = 0.5)', color: ROLE.red(), values: R.map(function(r) { return r.p05; }), ci: R.map(function(r) { return r.p05_ci; }) }
        ], { xtitle: 'pass@1', thick: 9, labelFormat: fmt,
             extra: { tooltipLabel: function(ctx) { var r = R[ctx.dataIndex], v = ctx.parsed.x, k = ['reg_plain', 'reg_p0', 'reg_p01', 'reg_p05'][ctx.datasetIndex]; if (v == null) return ' pending'; var t = ' ' + ctx.dataset.label + ': ' + v + '%; regression rate ' + r[k] + '%'; if (ctx.datasetIndex === 2 && r.phantom_broken_01 != null) t += '; phantom rounds that broke the work ' + r.phantom_broken_01 + '%'; if (ctx.datasetIndex === 3 && r.phantom_broken_05 != null) t += '; phantom rounds that broke the work ' + r.phantom_broken_05 + '%'; if (!r.final) t += ' (' + r.closed['0.1'][0] + '/' + r.closed['0.1'][1] + ' and ' + r.closed['0.5'][0] + '/' + r.closed['0.5'][1] + ' chains closed, interim)'; return t; } } });
      });
    }

    lazy('memorizationChart', function(c) {
      var MM = F.memorization.models, S = function(k) { return MM.map(function(m) { return m[k]; }); };
      var ch = hbars(c, S('short'), [
        { label: 'Benchmark code (BENCH)', color: ROLE.red(), values: S('bench'), ci: S('bench_ci') },
        { label: "The same repositories' code outside the benchmark (PRE)", color: ROLE.blue(), values: S('pre'), ci: S('pre_ci') },
        { label: 'Code written after the training cutoff (POST)', color: ROLE.light(), values: S('post'), ci: S('post_ci') }
      ], { xtitle: 'Recall', thick: 12, max: 30,
           extra: { tooltipLabel: function(ctx) {
             var m = MM[ctx.dataIndex], k = ['bench', 'pre', 'post'][ctx.datasetIndex], n = m[k + '_n'];
             var line = ' ' + ctx.dataset.label + ': ' + m[k] + '% (' + n[0] + ' of ' + n[1] + ' blocks; 95% CI ' + m[k + '_ci'][0] + '–' + m[k + '_ci'][1] + ')';
             if (ctx.datasetIndex === 0) line += [' · exact reproductions: ' + m.exact, ' · BENCH − PRE, paired by repository: ' + (m.excess_pre.pp >= 0 ? '+' : '') + m.excess_pre.pp + ' pp [' + m.excess_pre.ci[0] + ', ' + m.excess_pre.ci[1] + ']', ' · BENCH − POST: ' + (m.excess_post.pp >= 0 ? '+' : '') + m.excess_post.pp + ' pp [' + m.excess_post.ci[0] + ', ' + m.excess_post.ci[1] + ']'].join('');
             return line;
           } } });
      return ch;
    });
    lazy('memorizationHelpChart', function(c) {
      var H = F.memorization.helps;
      return hbars(c, H.map(function(m) { return m.short + ' (' + m.repos + ' repos)'; }), [
        { label: 'pass@1 on the repositories the model remembers', color: ROLE.red(), values: H.map(function(m) { return m.repos ? m.pass1_mem : null; }) },
        { label: 'pass@1 on the other repositories', color: ROLE.grey(), values: H.map(function(m) { return m.pass1_other; }) }
      ], { xtitle: 'pass@1', thick: 12,
           labelFormat: function(v, di, i) { var m = H[i]; if (di === 1) return m.repos ? (Math.round(v * 10) / 10) + '%  (' + (m.diff_pp >= 0 ? '+' : '') + m.diff_pp + ')' : 'none remembered'; return (Math.round(v * 10) / 10) + '%'; },
           extra: { tooltipLabel: function(ctx) { var m = H[ctx.dataIndex]; return ctx.datasetIndex === 0 ? ' remembered repositories: ' + m.pass1_mem + '% (' + m.chains_mem + ' chains of ' + m.repos + ' repositories)' : ' other repositories: ' + m.pass1_other + '% (' + m.chains_other + ' chains); paired difference ' + (m.diff_pp >= 0 ? '+' : '') + m.diff_pp + ' pp [' + m.ci_pp[0] + ', ' + m.ci_pp[1] + ']'; } } });
    });
  }

  if (B) {
    lazy('domainsChart', function(c) {
      return counts(new Chart(c, {
        type: 'bar',
        data: { labels: B.domains.map(function(d) { return d.label; }), datasets: [{ label: 'Repositories', data: B.domains.map(function(d) { return d.n; }), backgroundColor: ROLE.blue(), maxBarThickness: 22 }] },
        options: (base({ indexAxis: 'y', legend: false, axes: ['x', 'y'], x: { title: 'Repositories', min: 0, noGrid: false }, y: { autoSkip: false, noGrid: true }, tooltipLabel: function(ctx) { return ' ' + ctx.parsed.x + ' repositories'; } }))
      }));
    });

    lazy('positionsChart', function(c) {
      var P = B.positions;
      var ch = new Chart(c, {
        type: 'line',
        data: { labels: P.k, datasets: [
          { label: 'Tests that must keep passing (P2P)', data: P.p2p, borderColor: ROLE.ink(), backgroundColor: alpha(ROLE.ink(), 0.12), fill: true, borderWidth: 2.2, pointRadius: 2.5, tension: 0.2 },
          { label: 'of which hidden tests of earlier requests', data: P.earlier_f2p, borderColor: ROLE.red(), backgroundColor: alpha(ROLE.red(), 0.18), fill: true, borderWidth: 2.2, pointRadius: 2.5, tension: 0.2 },
          { label: 'New hidden tests of the request (F2P)', data: P.f2p, borderColor: ROLE.green(), backgroundColor: ROLE.green(), borderWidth: 2, pointRadius: 2.5, tension: 0.2, fill: false }
        ] },
        options: (function() {
          var o = base({ interaction: { mode: 'index', intersect: false }, x: { title: 'Request', noGrid: true }, y: { title: 'Tests', min: 0 },
            tooltipTitle: function(items) { return 'Request ' + items[0].label; }, tooltipLabel: function(ctx) { return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y; } });
          o.animation = false;
          return o;
        })()
      });
      ch.$sweep = 6000;
      return ch;
    });

    lazy('goldHistChart', function(c) {
      var h = B.hists.gold_total, labels = Object.keys(h);
      return counts(new Chart(c, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Requests', data: labels.map(function(k) { return h[k]; }), backgroundColor: ROLE.red(), maxBarThickness: 60 }] },
        options: (base({ legend: false, x: { title: 'Lines changed' }, y: { title: 'Requests', min: 0 }, tooltipLabel: function(ctx) { return ' ' + ctx.parsed.y.toLocaleString() + ' requests'; } }))
      }));
    });

    lazy('spanChart', function(c) {
      var h = B.hists.span, labels = Object.keys(h);
      return counts(new Chart(c, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Chains', data: labels.map(function(k) { return h[k]; }), backgroundColor: ROLE.ink(), maxBarThickness: 60 }] },
        options: (base({ legend: false, x: { title: 'Time span' }, y: { title: 'Chains', min: 0 }, tooltipLabel: function(ctx) { return ' ' + ctx.parsed.y + ' chains'; } }))
      }));
    });

    lazy('funnelChart', function(c) {
      return counts(new Chart(c, {
        type: 'bar',
        data: { labels: B.funnel.map(function(f) { return f.stage; }), datasets: [{ label: 'Chains', data: B.funnel.map(function(f) { return f.tasks; }), backgroundColor: B.funnel.map(function(f, i) { return i === B.funnel.length - 1 ? ROLE.red() : ROLE.blue(); }), maxBarThickness: 22 }] },
        options: (base({ indexAxis: 'y', legend: false, x: { title: 'Chains', min: 0, noGrid: false }, y: { autoSkip: false, noGrid: true }, tooltipLabel: function(ctx) { return ' ' + ctx.parsed.x + ' chains'; } }))
      }));
    });
  }

  document.addEventListener('themechange', function() {
    var q = pal();
    charts.forEach(function(ch) {
      Object.keys(ch.options.scales).forEach(function(ax) {
        var s = ch.options.scales[ax];
        s.ticks.color = q.text; if (s.title) s.title.color = q.text;
        if (s.grid.color !== 'transparent') s.grid.color = q.grid;
      });
      ch.update('none');
    });
  });
})();

// Web fonts may arrive after the charts were laid out with a fallback font (narrower glyphs): lay every chart out again once
// they are ready, so that axis labels such as "GLM-5.3-Flash" are measured with the font they are drawn in.
(function() {
  if (!(document.fonts && document.fonts.ready) || typeof Chart === 'undefined') return;
  document.fonts.ready.then(function() {
    Object.values(Chart.instances || {}).forEach(function(c) { try { c.resize(); c.update('none'); } catch (e) {} });
  });
})();
