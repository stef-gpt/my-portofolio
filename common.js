/* Shared chrome for every page: logo sprite, staggered menu, page zoom transitions, helpers. */
(function () {
  'use strict';

  var cfg = window.VEN_CONFIG || {};
  var doc = document;
  var body = doc.body;
  var page = body.getAttribute('data-page') || 'home';
  var isHome = page === 'home';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  doc.documentElement.classList.add('js');

  var VEN = (window.VEN = window.VEN || {});
  VEN.config = cfg;
  VEN.reduce = reduce;
  VEN.isHome = isHome;
  VEN.goTo = null;

  /* ------------------------------------------------------------------
     VEN wordmark: custom drawn letterforms (not a typeface).
     Signature details: sliced V, E with a detached spine and slanted bars,
     N cut from a single stroke. Viewbox is 300 x 100.
  ------------------------------------------------------------------ */
  var GLYPHS = [
    'M0 0H27L46 58L65 0H92L62 100H30Z',
    'M106 0H132V100H106Z',
    'M138 0H188L180 24H138Z',
    'M138 38H172L164 62H138Z',
    'M138 76H196L188 100H138Z',
    'M210 0H238L276 58V0H300V100H272L234 42V100H210Z'
  ];

  function glyphs(forClip) {
    return GLYPHS.map(function (d) {
      return forClip
        ? '<path d="' + d + '" transform="scale(0.0033333 0.01)"/>'
        : '<path d="' + d + '" vector-effect="non-scaling-stroke"/>';
    }).join('');
  }

  var sprite =
    '<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">' +
    '<symbol id="ven-mark" viewBox="0 0 300 100">' + glyphs(false) + '</symbol>' +
    '<clipPath id="venClip" clipPathUnits="objectBoundingBox">' + glyphs(true) + '</clipPath>' +
    '<symbol id="i-github" viewBox="0 0 16 16"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></symbol>' +
    '<symbol id="i-instagram" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></symbol>' +
    '<symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 7.5l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-arrow" viewBox="0 0 16 16"><path d="M4 12L12 4M5 4h7v7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square"/></symbol>' +
    '<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="10" r="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 18l5.5-5.5 4 4 2.5-2.5L20 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>' +
    '</svg>';

  body.insertAdjacentHTML('afterbegin', sprite);

  /* ------------------------------------------------------------------
     Staggered menu
  ------------------------------------------------------------------ */
  var ITEMS = [
    { id: 'home', label: 'Home' },
    { id: 'profile', label: 'Profile' },
    { id: 'about', label: 'About' },
    { id: 'work', label: 'Work' },
    { id: 'services', label: 'Services' },
    { id: 'contact', label: 'Contact' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function hrefFor(id) {
    if (isHome) return '#' + id;
    return id === 'home' ? 'index.html' : 'index.html#' + id;
  }

  var itemsHtml = ITEMS.map(function (it, i) {
    return '<li class="sm-item"><a class="sm-link" href="' + hrefFor(it.id) + '" data-scene="' + it.id + '" data-num="' + pad(i + 1) + '"><span class="sm-label">' + it.label + '</span></a></li>';
  }).join('');

  var ghostClass = '';
  var chromeHtml =
    '<div class="sm" id="sm" data-open="false">' +
    '<div class="sm-backdrop" data-sm-close></div>' +
    '<div class="sm-layers" aria-hidden="true"><i></i><i></i></div>' +
    '<aside class="sm-panel" id="sm-panel" aria-label="Site menu" aria-hidden="true">' +
    '<nav aria-label="Main"><ul class="sm-list">' + itemsHtml + '</ul></nav>' +
    '<div class="sm-foot">' +
    '<h3 class="sm-title">Socials</h3>' +
    '<ul class="sm-socials">' +
    '<li><a data-link="github" href="' + cfg.github + '" target="_blank" rel="noopener noreferrer">GitHub</a></li>' +
    '<li><a data-link="instagram" href="' + cfg.instagram + '" target="_blank" rel="noopener noreferrer">Instagram</a></li>' +
    '</ul>' +
    '<ul class="sm-legal"><li><a href="terms.html">Terms</a></li><li><a href="privacy.html">Privacy</a></li><li><a href="copyright.html">Copyright</a></li></ul>' +
    '</div></aside>' +
    '<header class="chrome">' +
    '<a class="logo' + ghostClass + '" data-scene="home" href="index.html" aria-label="VEN, go to home"><svg viewBox="0 0 300 100" aria-hidden="true"><use href="#ven-mark"/></svg></a>' +
    '<div class="chrome-right">' +
    '<a class="chrome-cta" data-scene="contact" href="' + hrefFor('contact') + '"><span>Let\'s talk</span><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><use href="#i-arrow"/></svg></a>' +
    '<button class="sm-toggle" id="smToggle" type="button" aria-expanded="false" aria-controls="sm-panel" aria-label="Open menu">' +
    '<span class="sm-toggle-text" aria-hidden="true"><span class="sm-toggle-inner"><span>Menu</span><span>Close</span></span></span>' +
    '<span class="sm-icon" aria-hidden="true"><i></i><i></i></span>' +
    '</button></div></header></div>';

  body.insertAdjacentHTML('beforeend', chromeHtml);

  var sm = doc.getElementById('sm');
  var panel = doc.getElementById('sm-panel');
  var toggle = doc.getElementById('smToggle');
  var links = [].slice.call(panel.querySelectorAll('.sm-link'));

  links.forEach(function (a, i) { a.parentNode.style.setProperty('--i', i); });
  panel.inert = true;

  function setMenu(open) {
    var was = sm.getAttribute('data-open') === 'true';
    if (was === open) return;
    sm.setAttribute('data-open', open ? 'true' : 'false');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    panel.inert = !open;
    body.classList.toggle('menu-open', open);
    if (open) {
      window.setTimeout(function () { if (links[0]) links[0].focus({ preventScroll: true }); }, 420);
    } else if (panel.contains(doc.activeElement)) {
      toggle.focus({ preventScroll: true });
    }
  }

  toggle.addEventListener('click', function () {
    setMenu(sm.getAttribute('data-open') !== 'true');
  });

  sm.addEventListener('click', function (e) {
    if (e.target.closest('[data-sm-close]')) setMenu(false);
  });

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  VEN.setMenu = setMenu;

  VEN.setActive = function (id) {
    links.forEach(function (a) {
      if (a.getAttribute('data-scene') === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };

  VEN.setTheme = function (theme) {
    body.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  };

  VEN.setGhost = function (on) {
    body.classList.toggle('is-ghost', !!on);
  };

  /* ------------------------------------------------------------------
     Link wiring from config
  ------------------------------------------------------------------ */
  [].forEach.call(doc.querySelectorAll('[data-link]'), function (a) {
    var type = a.getAttribute('data-link');
    if (type === 'github' && cfg.github) a.setAttribute('href', cfg.github);
    if (type === 'instagram' && cfg.instagram) a.setAttribute('href', cfg.instagram);
    if (type === 'email' && cfg.email) a.setAttribute('href', 'mailto:' + cfg.email);
  });

  [].forEach.call(doc.querySelectorAll('[data-text]'), function (el) {
    var key = el.getAttribute('data-text');
    if (cfg[key]) el.textContent = cfg[key];
  });

  [].forEach.call(doc.querySelectorAll('[data-year]'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* Images that are placeholders until you drop the real file in. */
  [].forEach.call(doc.querySelectorAll('img[data-fallback]'), function (img) {
    function miss() { img.classList.add('is-missing'); }
    img.addEventListener('error', miss);
    if (img.complete && img.naturalWidth === 0) miss();
  });

  /* ------------------------------------------------------------------
     Scene links (home only) and zoom page transitions
  ------------------------------------------------------------------ */
  function plain(e) {
    return !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
  }

  doc.addEventListener('click', function (e) {
    if (!plain(e)) return;
    var a = e.target.closest && e.target.closest('a[data-scene]');
    if (!a || !isHome || typeof VEN.goTo !== 'function') return;
    e.preventDefault();
    setMenu(false);
    VEN.goTo(a.getAttribute('data-scene'));
  });

  var zoomEl = doc.querySelector('[data-zoom]');
  var leaving = false;
  var leaveAnim = null;

  doc.addEventListener('click', function (e) {
    if (!plain(e)) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var raw = a.getAttribute('href') || '';
    if (/^(mailto:|tel:|javascript:)/i.test(raw)) return;
    var url;
    try { url = new URL(a.href, window.location.href); } catch (err) { return; }
    if (/^https?:$/.test(url.protocol) && url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.hash) return;
    if (reduce || !zoomEl) return;
    e.preventDefault();
    if (leaving) return;
    leaving = true;
    setMenu(false);
    leaveAnim = zoomEl.animate(
      [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.82)', opacity: 0 }],
      { duration: 480, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' }
    );
    window.setTimeout(function () { window.location.href = a.href; }, 460);
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      leaving = false;
      if (leaveAnim) { leaveAnim.cancel(); leaveAnim = null; }
    }
  });

  if (zoomEl && !reduce) {
    zoomEl.animate(
      [{ transform: 'scale(1.16)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 800, easing: 'cubic-bezier(.16,1,.3,1)' }
    );
  }

  /* ------------------------------------------------------------------
     Table of contents scroll spy (legal pages)
  ------------------------------------------------------------------ */
  var toc = doc.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var map = {};
    [].forEach.call(toc.querySelectorAll('a[href^="#"]'), function (a) {
      map[a.getAttribute('href').slice(1)] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(map).forEach(function (k) { map[k].removeAttribute('aria-current'); });
        if (map[en.target.id]) map[en.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    [].forEach.call(doc.querySelectorAll('.legal-body section[id]'), function (s) { spy.observe(s); });
  }
})();