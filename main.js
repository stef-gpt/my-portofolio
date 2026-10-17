/* Home page: scene manager (zoom out / zoom in), reveal text, glass parallax, form, dot grid. */
(function () {
  'use strict';

  var VEN = window.VEN || {};
  var cfg = VEN.config || {};
  var reduce = !!VEN.reduce;
  var body = document.body;

  var stage = document.querySelector('.stage');
  var scenes = [].slice.call(document.querySelectorAll('.scene'));
  var ids = scenes.map(function (s) { return s.getAttribute('data-scene'); });
  var counter = document.getElementById('hudCount');
  var label = document.getElementById('hudLabel');
  var dotsWrap = document.getElementById('dots');

  var DURATION = reduce ? 0 : 1000;
  var EASE = 'cubic-bezier(.7,0,.2,1)';
  var current = -1;
  var busy = false;
  var pending = null;
  var lockUntil = 0;
  var lastInner = 0;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- dots + hud ---------------- */
  var dotButtons = ids.map(function (id, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Go to ' + scenes[i].getAttribute('data-label'));
    b.addEventListener('click', function () { go(i); });
    dotsWrap.appendChild(b);
    return b;
  });

  /* ---------------- reveal text ---------------- */
  var reveal = document.getElementById('revealText');
  var words = [];
  var revealTimer = 0;

  if (reveal) {
    var parts = reveal.textContent.trim().split(/\s+/);
    reveal.textContent = '';
    parts.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'w';
      span.textContent = word;
      reveal.appendChild(span);
      if (i < parts.length - 1) reveal.appendChild(document.createTextNode(' '));
      words.push(span);
    });
  }

  function resetReveal() {
    window.clearTimeout(revealTimer);
    words.forEach(function (w) { w.classList.remove('lit'); });
  }

  function playReveal() {
    resetReveal();
    if (reduce) {
      words.forEach(function (w) { w.classList.add('lit'); });
      return;
    }
    var i = 0;
    revealTimer = window.setTimeout(function tick() {
      if (i >= words.length) return;
      words[i++].classList.add('lit');
      revealTimer = window.setTimeout(tick, 34);
    }, 650);
  }

  /* ---------------- dot grid ---------------- */
  var dots = null;
  var canvas = document.getElementById('dotCanvas');
  if (canvas && window.DotGrid) {
    dots = new window.DotGrid(canvas, {
      dotSize: 4,
      gap: 30,
      baseColor: '#2a381c',
      activeColor: '#a6ff00',
      proximity: 150,
      strength: 1,
      bounce: 0.6,
      tension: 0.4,
      returnDuration: 0.8,
      shockRadius: 360,
      shockStrength: 5,
      swell: 0.9,
      stretch: 0.5,
      glow: 0.6,
      fade: 0.5,
      paused: true
    });
  }

  var hooks = {
    about: { on: playReveal, off: resetReveal },
    contact: {
      on: function () { if (dots) dots.setPaused(false); },
      off: function () { if (dots) dots.setPaused(true); }
    }
  };

  /* ---------------- scene manager ---------------- */
  function scroller(i) { return scenes[i].querySelector('.scene-scroll'); }

  function paint(i) {
    var s = scenes[i];
    VEN.setTheme(s.getAttribute('data-theme'));
    VEN.setGhost(s.getAttribute('data-ghost') === 'true');
    VEN.setActive(ids[i]);
    counter.textContent = pad(i + 1) + ' / ' + pad(scenes.length);
    label.textContent = s.getAttribute('data-label');
    dotButtons.forEach(function (b, n) {
      if (n === i) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    try { window.history.replaceState(null, '', '#' + ids[i]); } catch (err) { /* file:// restrictions */ }
  }

  function go(target, instant) {
    var next = typeof target === 'number' ? target : ids.indexOf(target);
    if (next < 0 || next >= scenes.length || next === current) return;
    if (busy) { pending = next; return; }

    var prev = current;
    current = next;
    var inEl = scenes[next];
    var outEl = prev >= 0 ? scenes[prev] : null;
    var inScroll = scroller(next);
    if (inScroll) inScroll.scrollTop = 0;

    inEl.classList.add('is-active');
    paint(next);
    if (hooks[ids[next]]) hooks[ids[next]].on();

    function settle() {
      if (outEl) {
        outEl.classList.remove('is-leaving');
        if (hooks[ids[prev]]) hooks[ids[prev]].off();
      }
      busy = false;
      lockUntil = performance.now() + 350;
      if (pending !== null) {
        var p = pending;
        pending = null;
        go(p);
      }
    }

    if (!outEl || instant || reduce) {
      if (outEl) outEl.classList.remove('is-active');
      settle();
      return;
    }

    busy = true;
    lockUntil = performance.now() + DURATION + 400;
    var forward = next > prev;
    outEl.classList.remove('is-active');
    outEl.classList.add('is-leaving');

    var outAnim = outEl.animate(
      forward
        ? [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.7)', opacity: 0 }]
        : [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }],
      { duration: DURATION, easing: EASE, fill: 'forwards' }
    );
    var inAnim = inEl.animate(
      forward
        ? [{ transform: 'scale(1.4)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 0.5, offset: 0.4 }, { transform: 'scale(1)', opacity: 1 }]
        : [{ transform: 'scale(0.7)', opacity: 0 }, { transform: 'scale(0.9)', opacity: 0.5, offset: 0.4 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: DURATION, easing: EASE, fill: 'both' }
    );

    window.setTimeout(function () {
      outAnim.cancel();
      inAnim.cancel();
      settle();
    }, DURATION + 30);
  }

  VEN.goTo = function (id) { go(id); };

  /* ---------------- input: wheel, keys, touch ---------------- */
  function canScroll(i, dir) {
    var el = scroller(i);
    if (!el) return false;
    var room = el.scrollHeight - el.clientHeight;
    if (room < 3) return false;
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 2;
  }

  window.addEventListener('wheel', function (e) {
    if (body.classList.contains('menu-open') || e.ctrlKey) return;
    var dy = e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(dy) || !dy) return;
    var t = e.target;
    if (t && t.closest && t.closest('textarea') && t.scrollHeight > t.clientHeight) return;
    var dir = dy > 0 ? 1 : -1;
    var now = performance.now();
    if (canScroll(current, dir)) { lastInner = now; return; }
    e.preventDefault();
    if (busy || now < lockUntil || now - lastInner < 260 || Math.abs(dy) < 6) return;
    go(current + dir);
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (body.classList.contains('menu-open')) return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    var dir = 0;
    var key = e.key;
    if (key === 'ArrowDown' || key === 'PageDown') dir = 1;
    else if (key === 'ArrowUp' || key === 'PageUp') dir = -1;
    else if (key === ' ' && !/^(BUTTON|A)$/.test(t.tagName)) dir = e.shiftKey ? -1 : 1;
    else if (key === 'Home') { e.preventDefault(); go(0); return; }
    else if (key === 'End') { e.preventDefault(); go(scenes.length - 1); return; }
    if (!dir) return;
    if (canScroll(current, dir)) return;
    e.preventDefault();
    if (!busy) go(current + dir);
  });

  var touch = null;
  window.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { touch = null; return; }
    var t = e.touches[0];
    touch = {
      x: t.clientX,
      y: t.clientY,
      atTop: !canScroll(current, -1),
      atBottom: !canScroll(current, 1),
      track: !!(e.target.closest && e.target.closest('.work-track'))
    };
  }, { passive: true });

  window.addEventListener('touchend', function (e) {
    if (!touch || body.classList.contains('menu-open')) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touch.x;
    var dy = t.clientY - touch.y;
    var info = touch;
    touch = null;
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
    if (info.track && Math.abs(dx) > 20) return;
    if (dy < 0 && info.atBottom && !busy) go(current + 1);
    else if (dy > 0 && info.atTop && !busy) go(current - 1);
  }, { passive: true });

  stage.addEventListener('scroll', function () { stage.scrollTop = 0; stage.scrollLeft = 0; });

  window.addEventListener('hashchange', function () {
    var i = ids.indexOf(window.location.hash.slice(1));
    if (i >= 0) go(i);
  });

  /* ---------------- glass parallax (hero + profile) ---------------- */
  var px = 0;
  var py = 0;
  var tx = 0;
  var ty = 0;
  var pRaf = 0;

  function parallax() {
    pRaf = 0;
    px += (tx - px) * 0.07;
    py += (ty - py) * 0.07;
    var s = scenes[current];
    if (s) {
      [].forEach.call(s.querySelectorAll('[data-depth]'), function (el) {
        var d = parseFloat(el.getAttribute('data-depth')) || 0;
        el.style.transform = 'translate3d(' + (px * d).toFixed(2) + 'px,' + (py * d).toFixed(2) + 'px,0)';
      });
    }
    if (Math.abs(tx - px) > 0.0006 || Math.abs(ty - py) > 0.0006) pRaf = requestAnimationFrame(parallax);
  }

  if (!reduce) {
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
      if (!pRaf) pRaf = requestAnimationFrame(parallax);
    }, { passive: true });
  }

  /* ---------------- profile card tilt ---------------- */
  var card = document.getElementById('profileCard');
  if (card && !reduce) {
    card.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      card.style.transform = 'perspective(1400px) rotateY(' + ((x - 0.5) * 6).toFixed(2) + 'deg) rotateX(' + ((0.5 - y) * 6).toFixed(2) + 'deg)';
      card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', function () { card.style.transform = ''; });
  }

  /* ---------------- pills marquee ---------------- */
  [].forEach.call(document.querySelectorAll('.pill-row'), function (row) {
    var track = row.querySelector('.pill-track');
    if (!track) return;
    var clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    row.appendChild(clone);
  });

  /* ---------------- work track: drag + arrows ---------------- */
  var track = document.getElementById('workTrack');
  if (track) {
    var dragging = false;
    var startX = 0;
    var startLeft = 0;
    var moved = false;

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4 && !moved) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = startLeft - dx;
    });
    var suppress = false;
    window.addEventListener('pointerup', function () {
      if (moved) { suppress = true; window.setTimeout(function () { suppress = false; }, 0); }
      dragging = false;
      track.classList.remove('is-drag');
    });
    /* A drag must not count as a click on a project card. */
    track.addEventListener('click', function (e) {
      if (suppress) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });

    var step = function (dir) {
      var first = track.querySelector('.card');
      var amount = first ? first.getBoundingClientRect().width + 24 : 340;
      track.scrollBy({ left: dir * amount, behavior: reduce ? 'auto' : 'smooth' });
    };
    var prev = document.getElementById('workPrev');
    var nextBtn = document.getElementById('workNext');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
  }

  /* ---------------- contact form (redirects to 404.html until connected) ---------------- */
  var form = document.getElementById('contactForm');
  var statusEl = document.getElementById('formStatus');
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function flag(el, bad) {
    el.classList.toggle('invalid', bad);
    el.setAttribute('aria-invalid', bad ? 'true' : 'false');
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameEl = document.getElementById('fName');
      var emailEl = document.getElementById('fEmail');
      var msgEl = document.getElementById('fMsg');
      var nameBad = nameEl.value.trim().length < 2;
      var emailBad = !emailPattern.test(emailEl.value.trim());
      var msgBad = msgEl.value.trim().length < 5;
      flag(nameEl, nameBad);
      flag(emailEl, emailBad);
      flag(msgEl, msgBad);

      if (nameBad || emailBad || msgBad) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Please fill in your name, a valid email, and a short message.';
        return;
      }

      /* The form is not connected to a mail service yet, so a valid send lands on the custom 404 page. */
      statusEl.className = 'status ok';
      statusEl.textContent = 'Sending your message...';
      form.reset();
      window.setTimeout(function () { window.location.href = '404.html'; }, reduce ? 0 : 450);
    });
  }

  /* ---------------- entrance delays ---------------- */
  [].forEach.call(document.querySelectorAll('[data-d]'), function (el) {
    el.style.setProperty('--d', el.getAttribute('data-d') + 's');
  });


  /* ---------------- adaptive glass quality ----------------
     Full blur looks best but is heavy. Measure the frame rate: strong device = rich blur,
     weak device (or it starts stuttering later) = light version. Phones always stay light. */
  (function () {
    var root = document.documentElement;
    var weak = reduce || window.innerWidth <= 900 || (window.matchMedia && window.matchMedia('(hover: none)').matches);
    if (weak) return;
    var phase = 'probe';
    var frames = 0;
    var start = 0;
    var bad = 0;

    function tick(now) {
      if (!start) start = now;
      frames++;
      var span = now - start;
      if (span >= (phase === 'probe' ? 1200 : 2000)) {
        var fps = frames * 1000 / span;
        frames = 0;
        start = now;
        if (phase === 'probe') {
          if (fps >= 56) { root.classList.add('fx-rich'); phase = 'watch'; }
          else return;
        } else if (!document.hidden) {
          bad = fps < 42 ? bad + 1 : 0;
          if (bad >= 2) { root.classList.remove('fx-rich'); return; }
        }
      }
      requestAnimationFrame(tick);
    }
    window.setTimeout(function () { requestAnimationFrame(tick); }, 1800);
  })();

  /* ---------------- start ---------------- */
  var startIndex = ids.indexOf(window.location.hash.slice(1));
  go(startIndex >= 0 ? startIndex : 0, true);
})();