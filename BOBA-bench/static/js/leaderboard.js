// BOBA-Bench — quadrant scatter of the leaderboard (handoff protocol): x = regression rate (share of chains in which a
// protected test broke at some request, healed or not), y = pass@1 (the final repository passes every test of F2P20 ∪ P2P20).
// The ideal corner is top-left: finishes projects and does not break things. No frontier; faint quadrant guides at the model
// means, short corner labels, the leaderboard's chip/logo styling, provider filter, side list and tooltips.
(function() {
  var canvas = document.getElementById('scatterChart');
  if (!canvas || !window.BOBA_SCATTER || typeof Chart === 'undefined') return;
  var results = window.BOBA_SCATTER;
  var PROVIDER_COLORS = window.BOBA_PROVIDER_COLORS || {};
  var points = results.map(function(r, i) { return { r: r, idx: i }; }).filter(function(p) { return p.r.score != null; });

  function colorFor(provider) { return PROVIDER_COLORS[provider] || '#203F60'; }
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function palette() {
    var d = isDark();
    return {
      grid: d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      text: d ? '#c9d1dc' : '#2b2b2b',
      faint: d ? 'rgba(201,209,220,0.55)' : 'rgba(43,43,43,0.5)',
      guide: d ? 'rgba(201,209,220,0.35)' : 'rgba(43,43,43,0.28)',
      ideal: d ? 'rgba(126,173,54,0.10)' : 'rgba(126,173,54,0.10)',
      tooltipBg: d ? '#182439' : '#ffffff', tooltipTitle: d ? '#f3eee4' : '#161616', tooltipBody: d ? '#c9d1dc' : '#2b2b2b', tooltipBorder: d ? '#2f4260' : '#d9d1c3'
    };
  }
  var SERIF = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  var allowedProviders = null;
  function providerOk(r) { return !allowedProviders || allowedProviders[r.provider]; }
  function xVal(r) { return r.regression == null ? null : 100 * r.regression; }
  function yVal(r) { return r.score == null ? null : 100 * r.score; }
  function valid(r) { return xVal(r) != null && yVal(r) != null; }

  // quadrant guides: the means over all plotted models (the whole leaderboard; the provider filter does not move them)
  var all = points.filter(function(p) { return valid(p.r); });
  var meanX = all.reduce(function(s, p) { return s + xVal(p.r); }, 0) / Math.max(1, all.length);
  var meanY = all.reduce(function(s, p) { return s + yVal(p.r); }, 0) / Math.max(1, all.length);
  var maxX = all.reduce(function(m, p) { return Math.max(m, xVal(p.r)); }, 0);
  var xMax = Math.max(50, Math.ceil((maxX + 8) / 10) * 10);

  function scatterData() {
    return points.filter(function(p) { return valid(p.r) && providerOk(p.r); }).map(function(p) {
      return { x: xVal(p.r), y: yVal(p.r), _idx: p.idx, _p: p.r };
    });
  }

  var baseRadius = 13, hoverRadius = 16, highlightIdx = null, chips = {};
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Entry story: the chips pop in one after another, best pass@1 first, each with a pulse ring (no frontier trace).
  var story = { playing: false, armed: !REDUCED && 'IntersectionObserver' in window, start: 0, arrival: {}, end: 0 };
  function ease(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }
  function prepareStory() {
    var data = chart.data.datasets[0].data.slice().sort(function(a, b) { return b.y - a.y || a.x - b.x; });
    var base = 140, step = 160, arrival = {};
    data.forEach(function(d, i) { arrival[d._idx] = base + i * step; });
    story.arrival = arrival; story.end = base + Math.max(0, data.length - 1) * step + 400;
  }
  function playStory() {
    if (REDUCED || !chart.chartArea || chart.chartArea.width <= 0) return;
    prepareStory();
    story.playing = true; story.armed = false; story.start = performance.now();
    (function loop() {
      if (!story.playing) return;
      var el = performance.now() - story.start;
      chart.draw();
      if (el > story.end + 800) { story.playing = false; chart.draw(); return; }
      requestAnimationFrame(loop);
    })();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // quadrant guides and corner labels, drawn under the points
  var quadrantPlugin = {
    id: 'quadrants',
    beforeDatasetsDraw: function(ch) {
      var ctx = ch.ctx, area = ch.chartArea, xs = ch.scales.x, ys = ch.scales.y, p = palette();
      if (!area || !xs || !ys) return;
      var gx = xs.getPixelForValue(meanX), gy = ys.getPixelForValue(meanY);
      ctx.save();
      // the ideal quadrant, faintly tinted
      ctx.fillStyle = p.ideal; ctx.fillRect(area.left, area.top, Math.max(0, gx - area.left), Math.max(0, gy - area.top));
      // guides at the model means
      ctx.strokeStyle = p.guide; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(gx, area.top); ctx.lineTo(gx, area.bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(area.left, gy); ctx.lineTo(area.right, gy); ctx.stroke();
      ctx.setLineDash([]);
      // mean labels along the guides
      ctx.font = '400 11px ' + SERIF; ctx.fillStyle = p.faint; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
      ctx.fillText('mean regression rate ' + meanX.toFixed(0) + '%', Math.min(gx + 6, area.right - 150), area.bottom - 4);
      ctx.textBaseline = 'top';
      ctx.fillText('mean pass@1 ' + meanY.toFixed(0) + '%', area.left + 6, Math.min(gy + 4, area.bottom - 16));
      // short corner labels
      ctx.font = '600 11px ' + SERIF; ctx.fillStyle = p.faint;
      var pad = 8;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('\u2191 finishes projects, breaks little', area.left + pad, area.top + pad);
      ctx.textAlign = 'right'; ctx.fillText('finishes projects, breaks things on the way', area.right - pad, area.top + pad);
      ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.fillText('breaks little, finishes few', area.left + pad, area.bottom - 20);
      ctx.textAlign = 'right'; ctx.fillText('breaks things, finishes few', area.right - pad, area.bottom - 20);
      ctx.restore();
    }
  };
  var chipPlugin = {
    id: 'logoChips',
    afterDatasetsDraw: function(chartInstance) {
      var meta = chartInstance.getDatasetMeta(0);
      if (!meta || meta.hidden) return;
      var ctx = chartInstance.ctx, data = chartInstance.data.datasets[0].data, area = chartInstance.chartArea;
      if (story.armed) return; // nothing until the story starts
      var el = story.playing ? performance.now() - story.start : Infinity;
      meta.data.forEach(function(pt, i) {
        var raw = data[i];
        if (!raw || !raw._p || pt.skip) return;
        if (pt.x < area.left - 20 || pt.x > area.right + 20) return;
        var arrived = story.playing ? el - (story.arrival[raw._idx] || 0) : Infinity;
        if (arrived < 0) return;
        var k = story.playing ? ease(arrived / 380) : 1;
        var big = raw._idx === highlightIdx;
        var s = (big ? hoverRadius * 2 : baseRadius * 2) * (0.55 + 0.45 * k);
        var chip = chips[raw._p.provider];
        ctx.save(); ctx.globalAlpha = k;
        if (chip) { ctx.drawImage(big ? chip.large : chip.normal, pt.x - s / 2, pt.y - s / 2, s, s); }
        else { roundRect(ctx, pt.x - s / 2, pt.y - s / 2, s, s, s * 0.22); ctx.fillStyle = colorFor(raw._p.provider); ctx.fill(); }
        // model name next to the chip (to the left when the chip sits near the right edge)
        ctx.font = (big ? '700 ' : '400 ') + '12px ' + SERIF;
        ctx.fillStyle = palette().text;
        ctx.textBaseline = 'middle';
        var w = ctx.measureText(raw._p.short).width;
        if (pt.x + s / 2 + 5 + w > area.right) { ctx.textAlign = 'right'; ctx.fillText(raw._p.short, pt.x - s / 2 - 5, pt.y); }
        else { ctx.textAlign = 'left'; ctx.fillText(raw._p.short, pt.x + s / 2 + 5, pt.y); }
        ctx.restore();
        // pulse ring as the chip arrives
        if (story.playing && arrived < 750) {
          var q = arrived / 750;
          ctx.save(); ctx.globalAlpha = 0.6 * (1 - q); ctx.strokeStyle = colorFor(raw._p.provider); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, baseRadius + 2 + 22 * q, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      });
    }
  };

  var pal = palette();
  var chart = new Chart(canvas, {
    plugins: [quadrantPlugin, chipPlugin],
    data: { datasets: [
      { type: 'scatter', label: 'Models', data: scatterData(), pointRadius: 0, pointHoverRadius: 0, pointHitRadius: baseRadius, order: 1 }
    ] },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      layout: { padding: { right: 24, top: 6 } },
      onClick: function(e, els) {
        if (els.length) { var d = chart.data.datasets[els[0].datasetIndex].data[els[0].index]; if (d && d._p) window.location = '/BOBA-bench/model/' + d._p.slug + '/'; }
      },
      onHover: function(e, els) {
        var idx = null;
        for (var i = 0; i < els.length; i++) { var d = chart.data.datasets[els[i].datasetIndex].data[els[i].index]; if (d && d._idx != null) { idx = d._idx; break; } }
        setHighlight(idx);
        canvas.style.cursor = idx != null ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: pal.tooltipBg, titleColor: pal.tooltipTitle, bodyColor: pal.tooltipBody, borderColor: pal.tooltipBorder, borderWidth: 1, padding: 12,
          titleFont: { family: SERIF, weight: 700, size: 14 }, bodyFont: { family: SERIF, size: 13 }, displayColors: false,
          filter: function(item) { return item.raw && item.raw._p; },
          callbacks: {
            title: function(items) { return items[0].raw._p.model; },
            label: function(ctx) {
              var r = ctx.raw._p;
              var lines = [r.provider, 'pass@1: ' + (r.score * 100).toFixed(1) + '%', 'Strict pass@1: ' + (r.strict * 100).toFixed(1) + '%', 'Regression rate: ' + (r.regression * 100).toFixed(1) + '%'];
              if (r.pass8 != null) lines.push('pass@8: ' + (r.pass8 * 100).toFixed(1) + '%');
              if (r.calls != null) lines.push('Model calls per chain (median): ' + Math.round(r.calls).toLocaleString());
              if (r.self_hosted) lines.push('open weights, served on our own GPUs');
              return lines;
            }
          }
        }
      },
      scales: {
        x: { type: 'linear', min: 0, max: xMax,
             title: { display: true, text: 'Regression rate', color: pal.text, font: { family: SERIF, size: 13 } },
             ticks: { color: pal.text, font: { family: SERIF, size: 12 }, maxTicksLimit: 8, callback: function(v) { return v + '%'; } },
             grid: { color: pal.grid } },
        y: { min: 0, max: 100,
             title: { display: true, text: 'pass@1', color: pal.text, font: { family: SERIF, size: 13 } },
             ticks: { color: pal.text, font: { family: SERIF, size: 12 }, callback: function(v) { return v + '%'; } }, grid: { color: pal.grid } }
      }
    }
  });

  if (!REDUCED && 'IntersectionObserver' in window) {
    var played = false;
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) { if (en.isIntersecting && !played && canvas.getBoundingClientRect().width > 0) { played = true; io.disconnect(); setTimeout(playStory, 60); } });
    }, { threshold: 0.4 });
    io.observe(canvas);
    var replayBtn = document.createElement('button'); replayBtn.type = 'button'; replayBtn.className = 'chart-replay chart-replay-float'; replayBtn.setAttribute('aria-label', 'Replay animation');
    replayBtn.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M13.8 2.6v3.2h-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Replay';
    replayBtn.addEventListener('click', function() { played = true; playStory(); });
    canvas.parentElement.appendChild(replayBtn);
    setTimeout(function() { if (!played && story.armed && canvas.getBoundingClientRect().width > 0) { var r = canvas.getBoundingClientRect(); if (r.top < window.innerHeight && r.bottom > 0) { played = true; playStory(); } } }, 5000);
  }

  var CHIP_RES = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  function drawChip(provider, img, size) {
    var c = document.createElement('canvas'); c.width = size * CHIP_RES; c.height = size * CHIP_RES;
    var ctx = c.getContext('2d'); ctx.scale(CHIP_RES, CHIP_RES);
    var inset = 1;
    roundRect(ctx, inset, inset, size - inset * 2, size - inset * 2, Math.round(size * 0.22));
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.75; ctx.strokeStyle = colorFor(provider); ctx.stroke();
    if (img && img.complete && (img.naturalWidth || 0) > 0) {
      var box = size * 0.56, iw = img.naturalWidth || box, ih = img.naturalHeight || box, scale = Math.min(box / iw, box / ih), w = iw * scale, h = ih * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    }
    return c;
  }
  var logoByProvider = {};
  results.forEach(function(r) { if (r.logo) logoByProvider[r.provider] = r.logo; });
  var providers = Object.keys(logoByProvider), pending = providers.length;
  providers.forEach(function(p) {
    var img = new Image();
    img.onload = img.onerror = function() { chips[p] = { normal: drawChip(p, img, 26), large: drawChip(p, img, 32) }; if (--pending === 0) chart.update('none'); };
    img.src = '/BOBA-bench/static/images/' + logoByProvider[p];
  });

  var sideItems = Array.prototype.slice.call(document.querySelectorAll('.scatter-side-item'));
  function setHighlight(idx) {
    if (idx === highlightIdx) return;
    highlightIdx = idx;
    sideItems.forEach(function(el) { el.classList.toggle('active', parseInt(el.dataset.idx, 10) === idx); });
    chart.update('none');
  }
  var plottable = {}; points.forEach(function(p) { plottable[p.idx] = true; });
  sideItems.forEach(function(el) {
    var idx = parseInt(el.dataset.idx, 10);
    el.addEventListener('mouseenter', function() { if (plottable[idx]) setHighlight(idx); });
    el.addEventListener('mouseleave', function() { setHighlight(null); });
  });
  canvas.addEventListener('mouseleave', function() { setHighlight(null); });

  function refresh() {
    var p = palette();
    chart.data.datasets[0].data = scatterData();
    chart.options.scales.x.title.color = chart.options.scales.y.title.color = p.text;
    chart.options.scales.x.ticks.color = chart.options.scales.y.ticks.color = p.text;
    chart.options.scales.x.grid.color = chart.options.scales.y.grid.color = p.grid;
    chart.options.plugins.tooltip.backgroundColor = p.tooltipBg; chart.options.plugins.tooltip.titleColor = p.tooltipTitle;
    chart.options.plugins.tooltip.bodyColor = p.tooltipBody; chart.options.plugins.tooltip.borderColor = p.tooltipBorder;
    chart.update('none');
  }
  document.addEventListener('themechange', refresh);

  window.__bobaScatterFilter = function(allowedList) {
    allowedProviders = null;
    if (allowedList) { allowedProviders = {}; allowedList.forEach(function(p) { allowedProviders[p] = true; }); }
    var rank = 0;
    sideItems.forEach(function(el) {
      var ok = !allowedProviders || allowedProviders[el.dataset.provider];
      el.style.display = ok ? '' : 'none';
      if (ok) {
        rank += 1;
        var r = el.querySelector('.scatter-side-rank');
        if (r) { r.textContent = rank; r.classList.remove('rank-1', 'rank-2', 'rank-3'); if (rank <= 3) r.classList.add('rank-' + rank); }
      }
    });
    setHighlight(null);
    refresh();
  };
})();
