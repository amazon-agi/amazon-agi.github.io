// BOBA-Bench — "How a chain is scored": one illustrative chain played step by step (templates/_macros.html scoring_demo).
(function() {
  var demos = document.querySelectorAll('[data-scoring-demo]');
  if (!demos.length) return;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the story: at each request k, the request's own result (P pass / F fail / R passed but broke a protected test), and what
  // happens to the tests of earlier requests ("heal": request h's tests pass again; "break": request b's tests start failing)
  var STORY = {
    4: { own: 'F', caption: 'Request 4 fails its tests. Strict pass@1: lost.', cards: { strict: ['✗', 'request 4 failed on its step'] }, hold: 2400 },
    5: { own: 'P', caption: "The agent builds on it. Request 4's tests keep failing.", hold: 1500 },
    6: { own: 'P', hold: 1100 }, 7: { own: 'P', hold: 1100 }, 8: { own: 'P', hold: 1100 }, 9: { own: 'P', hold: 1100 }, 10: { own: 'P', hold: 1100 }, 11: { own: 'P', hold: 1100 },
    12: { own: 'P', heal: 4, caption: 'Request 12 happens to fix them: healed.', hold: 2400 },
    15: { own: 'R', brk: 2, caption: 'Request 15 breaks a test of request 2: a regression.', cards: { regression: ['counted', 'a passing test broke'] }, hold: 2400 },
    16: { own: 'P', hold: 1100 }, 17: { own: 'P', hold: 1100 }, 18: { own: 'P', hold: 1100 },
    19: { own: 'P', heal: 2, caption: 'Request 19 repairs it.', hold: 1800 },
    20: { own: 'P', caption: 'Every test passes at 20: pass@1 = 1. Strict = 0.', cards: { pass1: ['✓', 'every test passes at 20'] }, hold: 4000 }
  };
  var INTRO = 'Twenty requests, one at a time. A hidden grader runs after each; the agent is never told.';
  var STEP = 650;
  function cls(code) { return code === 'F' ? 'c-miss' : code === 'R' ? 'c-reg' : 'c-pass'; }

  demos.forEach(function(root) {
    var own = root.querySelector('[data-strip="own"]'), all = root.querySelector('[data-strip="all"]');
    var ks = root.querySelectorAll('.scoring-ks span'), caption = root.querySelector('[data-scoring-caption]');
    var cards = {}; root.querySelectorAll('.scoring-card').forEach(function(c) { cards[c.dataset.card] = c; });
    var timer = null, playing = false;
    function cell(strip, k) { return strip.querySelector('i[data-k="' + k + '"]'); }
    function setCard(name, val, sub, state) {
      var c = cards[name]; if (!c) return;
      c.querySelector('.scoring-card-val').textContent = val; c.querySelector('.scoring-card-sub').textContent = sub;
      c.classList.remove('is-pass', 'is-fail', 'is-note'); if (state) c.classList.add(state);
    }
    function reset() {
      [own, all].forEach(function(s) { s.querySelectorAll('i').forEach(function(i) { i.className = 'c-none'; i.classList.remove('is-now', 'is-pulse'); }); });
      ks.forEach(function(k) { k.classList.remove('is-now'); });
      caption.textContent = INTRO;
      setCard('pass1', '·', 'every test passes at 20', null);
      setCard('strict', '·', 'every request passed on its step, nothing broke', null);
      setCard('regression', '·', 'a passing test broke', null);
    }
    function applyStep(k) {
      var st = STORY[k] || { own: 'P' };
      ks.forEach(function(e) { e.classList.toggle('is-now', +e.dataset.k === k); });
      var o = cell(own, k); o.className = cls(st.own);
      var a = cell(all, k); a.className = st.own === 'F' ? 'c-miss' : 'c-pass';
      if (st.heal) { var h = cell(all, st.heal); h.className = 'c-pass is-pulse'; }
      if (st.brk) { var b = cell(all, st.brk); b.className = 'c-miss is-pulse'; }
      if (st.caption) caption.textContent = st.caption;
      if (st.cards) Object.keys(st.cards).forEach(function(name) { var v = st.cards[name]; setCard(name, v[0], v[1], name === 'pass1' ? 'is-pass' : name === 'strict' ? 'is-fail' : 'is-note'); });
      return st.hold || STEP;
    }
    function finalState() { reset(); for (var k = 1; k <= 20; k++) applyStep(k); ks.forEach(function(e) { e.classList.remove('is-now'); }); }
    function play() {
      if (timer) clearTimeout(timer);
      reset(); playing = true;
      var k = 1;
      (function next() {
        if (k > 20) { playing = false; ks.forEach(function(e) { e.classList.remove('is-now'); }); return; }
        var hold = applyStep(k); k += 1;
        timer = setTimeout(next, hold);
      })();
    }
    if (REDUCED) { finalState(); root.querySelector('[data-scoring-replay]').hidden = true; return; }
    reset();
    root.querySelector('[data-scoring-replay]').addEventListener('click', play);
    var started = false;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) { entries.forEach(function(en) { if (en.isIntersecting && !started) { started = true; io.disconnect(); setTimeout(play, 300); } }); }, { threshold: 0.5 });
      io.observe(root);
    } else { started = true; play(); }
  });
})();
