/* Dot grid background for the legal pages and 404. */
(function () {
  'use strict';
  var c = document.getElementById('dotCanvas');
  if (!c || !window.DotGrid) return;
  new window.DotGrid(c, {
    dotSize: 4, gap: 30, baseColor: '#2a381c', activeColor: '#a6ff00',
    proximity: 150, strength: 1, bounce: 0.6, tension: 0.4, returnDuration: 0.8,
    shockRadius: 360, shockStrength: 5, swell: 0.9, stretch: 0.5, glow: 0.6, fade: 0.5,
    paused: false
  });
})();
