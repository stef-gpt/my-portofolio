/* Interactive WebGL dot grid (vanilla port). Used as the "Let's talk" background. */
(function () {
  'use strict';

  var VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aMotion;
layout(location = 2) in vec2 aState;

uniform vec2 uResolution;
uniform float uSize;
uniform float uSwell;
uniform float uStretch;
uniform float uGlow;

out vec2 vLocal;
out vec2 vPoint;
out float vLength;
out float vRadius;
out float vEnergy;

void main() {
  float energy = aState.x;
  float radius = 0.5 * uSize * aState.y * (1.0 + uSwell * energy);
  float speed = length(aMotion.zw);
  float angle = speed > 0.001 ? atan(aMotion.w, aMotion.z) : 0.0;
  float axis = floor(angle / 1.5707963 + 0.5) * 1.5707963;
  angle = axis + (angle - axis) * smoothstep(8.0, 70.0, speed);
  vec2 dir = vec2(cos(angle), sin(angle));
  float halfLength = min(uSize * 2.0, speed * uStretch * 0.02);
  float pad = radius * (1.0 + uGlow * energy * 2.5) + 2.0;
  vec2 local = aCorner * vec2(halfLength + pad, pad);
  vec2 point = aMotion.xy + dir * local.x + vec2(-dir.y, dir.x) * local.y;
  vLocal = local;
  vPoint = point;
  vLength = halfLength;
  vRadius = radius;
  vEnergy = energy;
  vec2 clip = point / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

  var FRAGMENT = `#version 300 es
precision highp float;

in vec2 vLocal;
in vec2 vPoint;
in float vLength;
in float vRadius;
in float vEnergy;

uniform vec2 uResolution;
uniform vec3 uBase;
uniform vec3 uActive;
uniform float uGlow;
uniform float uOpacity;
uniform float uFade;
uniform int uShape;

out vec4 outColor;

float smootherstep01(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  float d;
  if (uShape == 1) {
    float corner = vRadius * 0.3;
    vec2 q = abs(vLocal) - vec2(vLength + vRadius, vRadius) + corner;
    d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
  } else {
    d = length(vec2(max(abs(vLocal.x) - vLength, 0.0), vLocal.y)) - vRadius;
  }
  float aa = max(fwidth(d), 0.0001);
  float body = clamp(0.5 - d / aa, 0.0, 1.0);
  float halo = uGlow * vEnergy * 0.5 * exp(-max(d, 0.0) / max(vRadius * 1.3, 0.6));
  float alpha = body + (1.0 - body) * halo;
  vec3 color = mix(uBase, uActive, clamp(vEnergy * 1.2, 0.0, 1.0));
  float fade = 1.0;
  if (uFade > 0.0) {
    vec2 edge = min(vPoint, uResolution - vPoint) / (uFade * 0.4 * min(uResolution.x, uResolution.y));
    fade = smootherstep01(edge.x) * smootherstep01(edge.y);
  }
  alpha *= uOpacity * fade;
  outColor = vec4(color * alpha, alpha);
}
`;

  function toRgb(color) {
    var match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
    if (!match) return [1, 1, 1];
    var hex = match[1].length === 3 ? match[1].replace(/./g, function (d) { return d + d; }) : match[1];
    return [0, 2, 4].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; });
  }

  function smootherstep(t) {
    var x = Math.min(1, Math.max(0, t));
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  function backOut(t) {
    var s = 1.9;
    var x = t - 1;
    return 1 + x * x * ((s + 1) * x + s);
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  function DotGrid(canvas, options) {
    var s = Object.assign({
      dotSize: 5,
      gap: 18,
      baseColor: '#3a3446',
      activeColor: '#ffffff',
      proximity: 140,
      strength: 1,
      bounce: 0.6,
      tension: 0.4,
      returnDuration: 0.8,
      shockRadius: 320,
      shockStrength: 5,
      swell: 0.8,
      stretch: 0.5,
      glow: 0.5,
      shape: 'circle',
      fade: 0,
      opacity: 1,
      intro: true,
      mouseInteraction: true,
      clickShock: true,
      paused: false,
      dpr: 0
    }, options || {});

    var noop = function () {};
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) {
      this.supported = false;
      this.setPaused = noop;
      this.update = noop;
      this.destroy = noop;
      return;
    }

    var program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      this.supported = false;
      this.setPaused = noop;
      this.update = noop;
      this.destroy = noop;
      return;
    }
    this.supported = true;

    var uniforms = {};
    ['uResolution', 'uSize', 'uSwell', 'uStretch', 'uGlow', 'uBase', 'uActive', 'uOpacity', 'uFade', 'uShape']
      .forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var view = { width: 0, height: 0, left: 0, top: 0, ratio: 1 };
    var grid = { count: 0, cols: 1, rows: 1, cell: 1, centerX: 0, centerY: 0, reach: 1 };
    var rest = new Float32Array(0);
    var offset = new Float32Array(0);
    var velocity = new Float32Array(0);
    var force = new Float32Array(0);
    var next = new Float32Array(0);
    var wave = new Float32Array(0);
    var energy = new Float32Array(0);
    var instances = new Float32Array(0);
    var pointer = { x: 0, y: 0, vx: 0, vy: 0, time: 0, inside: false, presence: 0 };
    var shocks = [];
    var introStart = s.intro && !reduced ? -1 : null;
    var visible = true;
    var raf = 0;
    var last = 0;

    function rebuild() {
      var size = s.dotSize;
      var spacing = s.gap;
      var cell = Math.max(2, size + spacing);
      var cols = Math.max(1, Math.floor((view.width + spacing) / cell));
      var rows = Math.max(1, Math.floor((view.height + spacing) / cell));
      var startX = (view.width - (cols * cell - spacing)) / 2 + size / 2;
      var startY = (view.height - (rows * cell - spacing)) / 2 + size / 2;
      var count = cols * rows;
      rest = new Float32Array(count * 2);
      offset = new Float32Array(count * 2);
      velocity = new Float32Array(count * 2);
      force = new Float32Array(count * 2);
      next = new Float32Array(count * 2);
      wave = new Float32Array(count * 4);
      energy = new Float32Array(count);
      instances = new Float32Array(count * 6);
      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          var index = (row * cols + col) * 2;
          rest[index] = startX + col * cell;
          rest[index + 1] = startY + row * cell;
        }
      }
      Object.assign(grid, {
        count: count,
        cols: cols,
        rows: rows,
        cell: cell,
        centerX: view.width / 2,
        centerY: view.height / 2,
        reach: Math.hypot(view.width, view.height) / 2
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW);
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
      var width = Math.max(1, Math.round(canvas.clientWidth));
      var height = Math.max(1, Math.round(canvas.clientHeight));
      Object.assign(view, { width: width, height: height, left: rect.left, top: rect.top, ratio: ratio });
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      rebuild();
      render(performance.now());
    }

    function step(dt, now) {
      var motion = reduced ? 0 : 1;
      var zeta = 1 - 0.85 * Math.min(1, Math.max(0, s.bounce));
      var omega = 4 / (zeta * Math.max(0.2, s.returnDuration));
      var stiffness = omega * omega;
      var damping = 2 * zeta * omega;
      var radius = Math.max(1, s.proximity);
      var speed = Math.hypot(pointer.vx, pointer.vy);
      var drive = s.mouseInteraction && pointer.inside ? 6500 * Math.tanh(speed / 900) * s.strength * motion : 0;
      var dirX = speed > 0.001 ? pointer.vx / speed : 0;
      var dirY = speed > 0.001 ? pointer.vy / speed : 0;
      var width = grid.cell * 1.4;
      var travel = 650;
      var active = shocks.map(function (shock) {
        var front = ((now - shock.start) / 1000) * travel;
        var power = smootherstep(1 - front / Math.max(1, s.shockRadius));
        return { x: shock.x, y: shock.y, front: front, amplitude: power * s.shockStrength * grid.cell * 0.24 * motion };
      });
      var coupling = Math.pow(Math.max(0, s.tension) * 900, 2) / (grid.cell * grid.cell);
      var viscosity = Math.sqrt(coupling) * 0.06;
      var limit = Math.sqrt(stiffness + 8 * coupling) + damping + 8 * viscosity;
      var steps = Math.min(24, Math.max(1, Math.ceil(dt / Math.min(1 / 120, 1.2 / limit))));
      var h = dt / steps;
      var i;
      for (i = 0; i < grid.count; i++) {
        var index = i * 2;
        var rx = rest[index];
        var ry = rest[index + 1];
        var ax = 0;
        var ay = 0;
        if (drive > 0) {
          var ex = rx + offset[index] - pointer.x;
          var ey = ry + offset[index + 1] - pointer.y;
          var distance = Math.hypot(ex, ey);
          if (distance < radius) {
            var weight = smootherstep(1 - distance / radius) * drive;
            var nx = distance > 0.001 ? ex / distance : 0;
            var ny = distance > 0.001 ? ey / distance : 0;
            ax += weight * (dirX + nx * 0.6);
            ay += weight * (dirY + ny * 0.6);
          }
        }
        var wx = 0;
        var wy = 0;
        var wvx = 0;
        var wvy = 0;
        for (var k = 0; k < active.length; k++) {
          var shock = active[k];
          if (shock.amplitude <= 0) continue;
          var sx = rx - shock.x;
          var sy = ry - shock.y;
          var dist = Math.hypot(sx, sy);
          var u = (dist - shock.front) / width;
          if (Math.abs(u) < 3 && dist > 0.001) {
            var snx = sx / dist;
            var sny = sy / dist;
            var profile = Math.exp(-u * u);
            var push = shock.amplitude * profile;
            var rate = ((shock.amplitude * 2 * u * profile) / width) * travel;
            wx += snx * push;
            wy += sny * push;
            wvx += snx * rate;
            wvy += sny * rate;
            ax += snx * push * stiffness * 0.35;
            ay += sny * push * stiffness * 0.35;
          }
        }
        force[index] = ax;
        force[index + 1] = ay;
        var t4 = i * 4;
        wave[t4] = wx;
        wave[t4 + 1] = wy;
        wave[t4 + 2] = wvx;
        wave[t4 + 3] = wvy;
      }
      var cols = grid.cols;
      var rows = grid.rows;
      var stride = cols * 2;
      for (var n = 0; n < steps; n++) {
        for (var row = 0; row < rows; row++) {
          for (var col = 0; col < cols; col++) {
            var idx = (row * cols + col) * 2;
            var bx = force[idx] - stiffness * offset[idx] - damping * velocity[idx];
            var by = force[idx + 1] - stiffness * offset[idx + 1] - damping * velocity[idx + 1];
            if (coupling > 0) {
              var lx = -4 * offset[idx];
              var ly = -4 * offset[idx + 1];
              var mx = -4 * velocity[idx];
              var my = -4 * velocity[idx + 1];
              if (col > 0) {
                lx += offset[idx - 2];
                ly += offset[idx - 1];
                mx += velocity[idx - 2];
                my += velocity[idx - 1];
              }
              if (col < cols - 1) {
                lx += offset[idx + 2];
                ly += offset[idx + 3];
                mx += velocity[idx + 2];
                my += velocity[idx + 3];
              }
              if (row > 0) {
                lx += offset[idx - stride];
                ly += offset[idx - stride + 1];
                mx += velocity[idx - stride];
                my += velocity[idx - stride + 1];
              }
              if (row < rows - 1) {
                lx += offset[idx + stride];
                ly += offset[idx + stride + 1];
                mx += velocity[idx + stride];
                my += velocity[idx + stride + 1];
              }
              bx += coupling * lx + viscosity * mx;
              by += coupling * ly + viscosity * my;
            }
            next[idx] = velocity[idx] + bx * h;
            next[idx + 1] = velocity[idx + 1] + by * h;
          }
        }
        for (i = 0; i < offset.length; i++) {
          velocity[i] = next[i];
          offset[i] += velocity[i] * h;
        }
      }
      for (i = 0; i < grid.count; i++) {
        var p = i * 2;
        var q = i * 4;
        energy[i] = Math.min(
          1,
          (Math.hypot(velocity[p] + wave[q + 2], velocity[p + 1] + wave[q + 3]) / 380) * 0.85 +
            (Math.hypot(offset[p] + wave[q], offset[p + 1] + wave[q + 1]) / (grid.cell * 2.2)) * 0.35
        );
      }
      for (i = shocks.length - 1; i >= 0; i--) {
        if (active[i].front > s.shockRadius + width * 3) shocks.splice(i, 1);
      }
      var decay = 1 - Math.exp(-dt / 0.08);
      pointer.vx -= pointer.vx * decay;
      pointer.vy -= pointer.vy * decay;
      var presenceTarget = s.mouseInteraction && pointer.inside ? 1 : 0;
      pointer.presence += (presenceTarget - pointer.presence) * (1 - Math.exp(-dt / 0.2));
    }

    function render(now) {
      var radius = Math.max(1, s.proximity);
      var introAge = introStart === null ? Infinity : introStart < 0 ? 0 : (now - introStart) / 1000;
      var introFront = introAge * grid.reach * 1.25;
      var introBand = grid.cell * 4;
      for (var i = 0; i < grid.count; i++) {
        var index = i * 2;
        var source = i * 4;
        var x = rest[index] + offset[index] + wave[source];
        var y = rest[index + 1] + offset[index + 1] + wave[source + 1];
        var glowing = energy[i];
        if (pointer.presence > 0.001) {
          var distance = Math.hypot(x - pointer.x, y - pointer.y);
          if (distance < radius) {
            glowing = Math.max(glowing, smootherstep(1 - distance / radius) * 0.4 * pointer.presence);
          }
        }
        var scale = 1;
        if (introStart !== null) {
          var d0 = Math.hypot(rest[index] - grid.centerX, rest[index + 1] - grid.centerY);
          var appear = Math.min(1, Math.max(0, (introFront - d0) / introBand));
          scale = appear >= 1 ? 1 : Math.max(0, backOut(appear));
          glowing = Math.max(glowing, Math.sin(appear * Math.PI) * 0.6);
        }
        var target = i * 6;
        instances[target] = x;
        instances[target + 1] = y;
        instances[target + 2] = velocity[index] + wave[source + 2];
        instances[target + 3] = velocity[index + 1] + wave[source + 3];
        instances[target + 4] = glowing;
        instances[target + 5] = scale;
      }
      var base = toRgb(s.baseColor);
      var accent = toRgb(s.activeColor);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uResolution, view.width, view.height);
      gl.uniform1f(uniforms.uSize, Math.max(0.5, s.dotSize));
      gl.uniform1f(uniforms.uSwell, reduced ? 0 : Math.max(0, s.swell));
      gl.uniform1f(uniforms.uStretch, reduced ? 0 : Math.max(0, s.stretch));
      gl.uniform1f(uniforms.uGlow, Math.max(0, s.glow));
      gl.uniform3f(uniforms.uBase, base[0], base[1], base[2]);
      gl.uniform3f(uniforms.uActive, accent[0], accent[1], accent[2]);
      gl.uniform1f(uniforms.uOpacity, Math.min(1, Math.max(0, s.opacity)));
      gl.uniform1f(uniforms.uFade, Math.min(1, Math.max(0, s.fade)));
      gl.uniform1i(uniforms.uShape, s.shape === 'square' ? 1 : 0);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, grid.count);
      gl.bindVertexArray(null);
    }

    function settled(now) {
      if (shocks.length) return false;
      if (introStart !== null) {
        if (introStart < 0 || (now - introStart) / 1000 < 1.6) return false;
        introStart = null;
      }
      if (Math.abs(pointer.vx) + Math.abs(pointer.vy) > 1) return false;
      var presenceTarget = s.mouseInteraction && pointer.inside ? 1 : 0;
      if (Math.abs(presenceTarget - pointer.presence) > 0.002) return false;
      for (var i = 0; i < offset.length; i++) {
        if (Math.abs(offset[i]) > 0.02 || Math.abs(velocity[i]) > 0.5) return false;
      }
      return true;
    }

    function frame(now) {
      raf = 0;
      if (s.paused || !visible) return;
      if (introStart !== null && introStart < 0) introStart = now;
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt, now);
      render(now);
      if (!settled(now)) raf = requestAnimationFrame(frame);
    }

    function wake() {
      if (raf || s.paused || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function locate(event) {
      var rect = canvas.getBoundingClientRect();
      view.left = rect.left;
      view.top = rect.top;
      var sx = rect.width ? view.width / rect.width : 1;
      var sy = rect.height ? view.height / rect.height : 1;
      return [(event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy];
    }

    function onMove(event) {
      if (!s.mouseInteraction || s.paused) return;
      var pos = locate(event);
      var x = pos[0];
      var y = pos[1];
      var inside = x >= 0 && y >= 0 && x <= view.width && y <= view.height;
      var time = event.timeStamp || performance.now();
      if (inside && pointer.inside && pointer.time) {
        var elapsed = Math.max(4, time - pointer.time) / 1000;
        var vx = (x - pointer.x) / elapsed;
        var vy = (y - pointer.y) / elapsed;
        pointer.vx += (vx - pointer.vx) * 0.6;
        pointer.vy += (vy - pointer.vy) * 0.6;
      } else {
        pointer.vx = 0;
        pointer.vy = 0;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.time = time;
      if (inside !== pointer.inside || inside) {
        pointer.inside = inside;
        wake();
      }
    }

    function onLeave() {
      pointer.inside = false;
      pointer.time = 0;
      wake();
    }

    function onOut(event) {
      if (!event.relatedTarget) onLeave();
    }

    function onDown(event) {
      if (!s.clickShock || reduced || s.paused) return;
      var pos = locate(event);
      if (pos[0] < 0 || pos[1] < 0 || pos[0] > view.width || pos[1] > view.height) return;
      shocks.push({ x: pos[0], y: pos[1], start: performance.now() });
      if (shocks.length > 6) shocks.shift();
      wake();
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerout', onOut);
    window.addEventListener('blur', onLeave);

    var resizeObserver = new ResizeObserver(function () {
      resize();
      wake();
    });
    resizeObserver.observe(canvas);

    var visibilityObserver = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) wake();
    });
    visibilityObserver.observe(canvas);

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        wake();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    resize();
    wake();

    this.setPaused = function (value) {
      s.paused = !!value;
      if (s.paused) {
        cancelAnimationFrame(raf);
        raf = 0;
        pointer.inside = false;
      } else {
        wake();
      }
    };

    this.update = function (patch) {
      Object.assign(s, patch || {});
      if (patch && (patch.dotSize !== undefined || patch.gap !== undefined)) {
        rebuild();
      }
      render(performance.now());
      wake();
    };

    this.destroy = function () {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerout', onOut);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteBuffer(cornerBuffer);
      gl.deleteBuffer(instanceBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    };
  }

  window.DotGrid = DotGrid;
})();