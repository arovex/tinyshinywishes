/* Happy Birthday — a tiny shiny particle show.
 * Pure WebGL1 + vanilla JS. No dependencies.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('scene');
  var gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    document.body.insertAdjacentHTML('beforeend',
      '<div class="fallback">This little show needs WebGL.<br>Try a modern browser.</div>');
    return;
  }

  /* ------------------------------------------------------------------ math */
  var TAU = Math.PI * 2;
  var rand = Math.random;
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var mixc = function (a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  };
  var easeInOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  var shade = function (c, k) {
    return [clamp(c[0] * k, 0, 1.4), clamp(c[1] * k, 0, 1.4), clamp(c[2] * k, 0, 1.4)];
  };
  var pick = function (arr) { return arr[(rand() * arr.length) | 0]; };

  /* --------------------------------------------------------------- palette */
  var C = {
    white:     [1.00, 1.00, 1.00],
    warmWhite: [1.00, 0.95, 0.83],
    gold:      [1.00, 0.80, 0.33],
    amber:     [1.00, 0.55, 0.16],
    flame:     [1.00, 0.47, 0.08],
    pink:      [1.00, 0.42, 0.68],
    rose:      [1.00, 0.24, 0.48],
    cyan:      [0.42, 0.90, 1.00],
    violet:    [0.72, 0.53, 1.00],
    mint:      [0.52, 1.00, 0.82],
    cream:     [1.00, 0.90, 0.72],
    peach:     [1.00, 0.66, 0.45],
    red:       [1.00, 0.28, 0.32],
    blue:      [0.45, 0.68, 1.00]
  };

  /* ---------------------------------------------------------- sizes / state */
  var IS_SMALL = Math.min(window.innerWidth, window.innerHeight) < 640;
  var N = IS_SMALL ? 7000 : 12000;
  var AMB_N = 42;
  var FW_MAX = 1800;
  var CAP = N + AMB_N + FW_MAX;

  var data = new Float32Array(CAP * 8);
  var ptr = 0;

  var P = {
    x: new Float32Array(N), y: new Float32Array(N),
    sx: new Float32Array(N), sy: new Float32Array(N),
    tx: new Float32Array(N), ty: new Float32Array(N),
    cr: new Float32Array(N), cg: new Float32Array(N), cb: new Float32Array(N),
    scr: new Float32Array(N), scg: new Float32Array(N), scb: new Float32Array(N),
    tcr: new Float32Array(N), tcg: new Float32Array(N), tcb: new Float32Array(N),
    sz: new Float32Array(N), ssz: new Float32Array(N), tsz: new Float32Array(N),
    al: new Float32Array(N), sal: new Float32Array(N), tal: new Float32Array(N),
    st: new Float32Array(N), sst: new Float32Array(N), tst: new Float32Array(N),
    dl: new Float32Array(N), du: new Float32Array(N),
    sd: new Float32Array(N), ws: new Float32Array(N), am: new Float32Array(N),
    kd: new Uint8Array(N)
  };

  for (var pi = 0; pi < N; pi++) {
    P.sd[pi] = rand();
    P.ws[pi] = 0.6 + rand() * 1.8;
    P.am[pi] = 26 + rand() * 96;
    P.du[pi] = 0.001;
  }

  /* ------------------------------------------------------------- viewport */
  var W = 0, H = 0, DPR = 1, scale = 1;

  function resize() {
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
    scale = Math.max(0.16, Math.min(W / 1020, H / 960));
  }
  window.addEventListener('resize', resize, { passive: true });

  /* --------------------------------------------------------------- shaders */
  var BG_VS = [
    'attribute vec2 a_p;',
    'void main(){ gl_Position = vec4(a_p, 0.0, 1.0); }'
  ].join('\n');

  var BG_FS = [
    'precision highp float;',
    'uniform vec2 u_res;',
    'uniform float u_time;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  vec2 p = uv - 0.5;',
    '  vec3 col = mix(vec3(0.012, 0.006, 0.038), vec3(0.052, 0.016, 0.095), smoothstep(0.0, 1.0, uv.y));',
    '  float r = length((uv - vec2(0.5, 0.60)) * vec2(1.0, 1.25));',
    '  col += vec3(0.23, 0.06, 0.15) * exp(-r * r * 9.0) * 0.72;',
    '  float r2 = length(uv - vec2(0.5, 0.06));',
    '  col += vec3(0.03, 0.08, 0.18) * exp(-r2 * r2 * 10.0) * 0.85;',
    '  vec2 g = gl_FragCoord.xy / 62.0;',
    '  vec2 id = floor(g);',
    '  vec2 f = fract(g) - 0.5;',
    '  float h = hash(id);',
    '  vec2 off = vec2(hash(id + 13.7), hash(id + 71.3)) - 0.5;',
    '  float d = length(f - off * 0.55);',
    '  float tw = 0.55 + 0.45 * sin(u_time * 1.7 + h * 40.0);',
    '  float star = smoothstep(0.05, 0.0, d) * step(0.90, h) * tw;',
    '  col += vec3(0.55, 0.66, 1.0) * star * 0.75;',
    '  float vig = smoothstep(0.95, 0.22, length(p));',
    '  col *= mix(0.52, 1.0, vig);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var P_VS = [
    'attribute vec2 a_pos;',
    'attribute vec3 a_color;',
    'attribute float a_size;',
    'attribute float a_alpha;',
    'attribute float a_star;',
    'uniform vec2 u_res;',
    'uniform float u_scale;',
    'uniform float u_zoom;',
    'uniform float u_dpr;',
    'uniform vec2 u_shift;',
    'varying vec3 v_color;',
    'varying float v_alpha;',
    'varying float v_star;',
    'void main(){',
    '  vec2 px = a_pos * (u_scale * u_zoom) + u_res * 0.5 + u_shift;',
    '  vec2 clip = px / u_res * 2.0 - 1.0;',
    '  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);',
    '  gl_PointSize = min(230.0, max(1.0, a_size * u_scale * u_zoom * u_dpr));',
    '  v_color = a_color;',
    '  v_alpha = a_alpha;',
    '  v_star = a_star;',
    '}'
  ].join('\n');

  var P_FS = [
    'precision highp float;',
    'varying vec3 v_color;',
    'varying float v_alpha;',
    'varying float v_star;',
    'void main(){',
    '  vec2 p = gl_PointCoord * 2.0 - 1.0;',
    '  float d = length(p);',
    '  if (d > 1.0) discard;',
    '  float glow = exp(-d * d * 5.0);',
    '  float core = exp(-d * d * 28.0);',
    '  float a = (glow * 0.52 + core * 0.95) * v_alpha;',
    '  float sx = pow(max(0.0, 1.0 - abs(p.x) * 9.0), 3.0) * max(0.0, 1.0 - abs(p.y));',
    '  float sy = pow(max(0.0, 1.0 - abs(p.y) * 9.0), 3.0) * max(0.0, 1.0 - abs(p.x));',
    '  a += (sx + sy) * v_star * v_alpha * 1.7;',
    '  a = min(a, 1.0);',
    '  gl_FragColor = vec4(v_color * a, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('Shader error: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Link error: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  var bgProg = program(BG_VS, BG_FS);
  var pProg = program(P_VS, P_FS);

  var bgU = {
    res: gl.getUniformLocation(bgProg, 'u_res'),
    time: gl.getUniformLocation(bgProg, 'u_time')
  };
  var pU = {
    res: gl.getUniformLocation(pProg, 'u_res'),
    scale: gl.getUniformLocation(pProg, 'u_scale'),
    zoom: gl.getUniformLocation(pProg, 'u_zoom'),
    dpr: gl.getUniformLocation(pProg, 'u_dpr'),
    shift: gl.getUniformLocation(pProg, 'u_shift')
  };

  var aPos = gl.getAttribLocation(pProg, 'a_pos');
  var aColor = gl.getAttribLocation(pProg, 'a_color');
  var aSize = gl.getAttribLocation(pProg, 'a_size');
  var aAlpha = gl.getAttribLocation(pProg, 'a_alpha');
  var aStar = gl.getAttribLocation(pProg, 'a_star');

  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);

  var bgVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bgVbo);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var bgAP = gl.getAttribLocation(bgProg, 'a_p');

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  /* --------------------------------------------------------------- helpers */
  function pt(x, y, c, size, alpha, star, kind) {
    return {
      x: x, y: y,
      r: c[0], g: c[1], b: c[2],
      s: size, a: alpha,
      st: star ? 1 : 0,
      k: kind || 0
    };
  }

  /* ------------------------------------------------------------- gradients */
  var GRAD = [
    { t: 0.00, c: [1.00, 0.84, 0.40] },
    { t: 0.34, c: [1.00, 0.46, 0.66] },
    { t: 0.68, c: [0.78, 0.52, 1.00] },
    { t: 1.00, c: [0.42, 0.90, 1.00] }
  ];

  function gradColor(t) {
    t = clamp(t, 0, 1);
    for (var i = 1; i < GRAD.length; i++) {
      if (t <= GRAD[i].t) {
        var a = GRAD[i - 1], b = GRAD[i];
        return mixc(a.c, b.c, (t - a.t) / (b.t - a.t));
      }
    }
    return GRAD[GRAD.length - 1].c;
  }

  /* ---------------------------------------------------------------- baking */
  function bake(points, n) {
    for (var i = points.length - 1; i > 0; i--) {
      var j = (rand() * (i + 1)) | 0;
      var tmp = points[i]; points[i] = points[j]; points[j] = tmp;
    }
    var out = {
      x: new Float32Array(n), y: new Float32Array(n),
      r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n),
      s: new Float32Array(n), a: new Float32Array(n),
      st: new Float32Array(n), k: new Uint8Array(n)
    };
    var L = points.length;
    for (i = 0; i < n; i++) {
      var p = points[i % L];
      out.x[i] = p.x + (rand() * 2 - 1);
      out.y[i] = p.y + (rand() * 2 - 1);
      out.r[i] = p.r; out.g[i] = p.g; out.b[i] = p.b;
      out.s[i] = p.s * (0.8 + rand() * 0.4);
      out.a[i] = clamp(p.a * (0.85 + rand() * 0.3), 0, 1);
      out.st[i] = p.st;
      out.k[i] = p.k;
    }
    return out;
  }

  /* ----------------------------------------------------------- text sampler */
  function sampleText(layout, colorFn, opts) {
    opts = opts || {};
    var S = 1024;
    var cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var g = cv.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (var li = 0; li < layout.length; li++) {
      var L = layout[li];
      g.font = '900 ' + L.size + 'px "Trebuchet MS", "Segoe UI", Arial, sans-serif';
      g.fillText(L.text, S / 2, L.y);
    }
    var img = g.getImageData(0, 0, S, S).data;
    var pts = [];
    var step = opts.step || 2;
    var prob = opts.prob == null ? 0.6 : opts.prob;
    var sc = opts.scale || 1;
    var sparkle = opts.sparkle == null ? 0.05 : opts.sparkle;
    for (var y = 0; y < S; y += step) {
      for (var x = 0; x < S; x += step) {
        if (img[(y * S + x) * 4 + 3] > 110 && rand() < prob) {
          var wx = (x - S / 2) * sc;
          var wy = (y - S / 2) * sc;
          var star = rand() < sparkle;
          var c = star ? mixc(C.warmWhite, C.white, rand()) : colorFn(wx, wy);
          var sz = star ? 4 + rand() * 4.5 : 1.9 + rand() * 2.2;
          pts.push(pt(wx, wy, c, sz, star ? 0.95 : 0.5 + rand() * 0.42, star, 0));
        }
      }
    }
    return pts;
  }

  /* ------------------------------------------------------------------ cloud */
  function buildCloud() {
    var pts = [];
    for (var i = 0; i < 9000; i++) {
      var arm = (rand() * 3) | 0;
      var r = 30 + Math.pow(rand(), 0.62) * 470;
      var a = rand() * TAU + r * 0.008 + arm * TAU / 3;
      var x = Math.cos(a) * r;
      var y = Math.sin(a) * r * 0.62;
      var t = clamp(r / 500, 0, 1);
      var c = mixc(C.warmWhite, mixc(C.violet, C.cyan, rand()), Math.pow(t, 0.8));
      if (rand() < 0.10) c = mixc(C.pink, C.white, rand() * 0.6);
      if (rand() < 0.035) c = C.gold;
      var star = rand() < 0.06;
      pts.push(pt(x, y, c,
        star ? 3.4 + rand() * 4 : 1.8 + rand() * 3.2,
        star ? 0.9 : 0.32 + rand() * 0.5, star, 0));
    }
    for (i = 0; i < 420; i++) {
      var rr = Math.pow(rand(), 2) * 150;
      var aa = rand() * TAU;
      pts.push(pt(Math.cos(aa) * rr, Math.sin(aa) * rr * 0.7,
        mixc(C.gold, C.warmWhite, rand()), 7 + rand() * 18,
        0.05 + rand() * 0.07, 0, 0));
    }
    return pts;
  }

  /* ------------------------------------------------------------------ title */
  function buildTitle() {
    var pts = sampleText(
      [
        { text: 'HAPPY', size: 178, y: 402 },
        { text: 'BIRTHDAY', size: 178, y: 626 }
      ],
      function (x) { return gradColor((x + 400) / 800); },
      { step: 2, prob: 0.72, sparkle: 0.055 }
    );
    for (var i = 0; i < 170; i++) {
      var a = rand() * TAU;
      var r = 360 + rand() * 200;
      var c = pick([C.gold, C.pink, C.cyan, C.white]);
      pts.push(pt(Math.cos(a) * r, Math.sin(a) * r * 0.52, c,
        1.6 + rand() * 2.4, 0.14 + rand() * 0.5, rand() < 0.55, 0));
    }
    return pts;
  }

  /* ------------------------------------------------------------------- cake */
  function buildCake() {
    var pts = [];
    var add = function (x, y, c, s, a, st, k) { pts.push(pt(x, y, c, s, a, st, k)); };
    var cream = [1.00, 0.90, 0.72];
    var pinkBody = [1.00, 0.70, 0.81];
    var pinkFrost = [1.00, 0.48, 0.68];
    var pinkLight = [1.00, 0.76, 0.86];
    var white = [1.00, 0.97, 0.91];
    var plate = [0.55, 0.74, 1.00];
    var sprinkles = [C.cyan, C.gold, C.violet, C.mint, C.pink];

    /* plate */
    for (var i = 0; i < 950; i++) {
      var a = rand() * TAU, rr = Math.sqrt(rand());
      var x = Math.cos(a) * 365 * rr, y = 372 + Math.sin(a) * 44 * rr;
      var edge = rr > 0.93;
      add(x, y, mixc(plate, white, rr * 0.55), 2.0 + rand() * 2.0,
        (edge ? 0.55 : 0.30) + rand() * 0.25, rr > 0.97 && rand() < 0.3, 0);
    }
    for (i = 0; i < 420; i++) {
      a = rand() * TAU;
      x = Math.cos(a) * 365; y = 372 + Math.sin(a) * 44;
      add(x, y, mixc(white, plate, rand() * 0.65), 2.6 + rand() * 2.2,
        0.45 + rand() * 0.4, rand() < 0.1, 0);
    }

    /* bottom tier body */
    var hw1 = 290, top1 = 130, bot1 = 330;
    for (i = 0; i < 5000; i++) {
      x = (rand() * 2 - 1) * hw1;
      var bottom = bot1 + 26 * Math.sqrt(Math.max(0, 1 - (x / hw1) * (x / hw1)));
      y = top1 + rand() * (bottom - top1);
      var e1 = Math.abs(x) / hw1;
      var k = 0.72 + 0.42 * (1 - e1 * e1) + rand() * 0.07;
      add(x, y, shade(cream, k), 2.0 + rand() * 2.1, 0.40 + rand() * 0.35, rand() < 0.018, 0);
    }
    for (i = 0; i < 240; i++) {
      x = (rand() * 2 - 1) * hw1 * 0.93;
      y = top1 + 34 + rand() * 165;
      add(x, y, pick(sprinkles), 2.4 + rand() * 2.2, 0.75 + rand() * 0.25, rand() < 0.16, 0);
    }
    for (i = 0; i < 780; i++) {
      a = rand() * TAU; rr = 0.72 + 0.28 * Math.sqrt(rand());
      x = Math.cos(a) * hw1 * rr; y = top1 + Math.sin(a) * 36 * rr;
      add(x, y, mixc(pinkLight, cream, 0.3 + rand() * 0.4), 2.0 + rand() * 2.0,
        0.35 + rand() * 0.3, 0, 0);
    }

    /* bottom frosting + drips */
    var fTop1 = 116;
    for (i = 0; i < 2500; i++) {
      x = (rand() * 2 - 1) * (hw1 + 3);
      var u = (x + hw1) / (2 * hw1);
      var lobe = Math.pow(Math.max(0, Math.sin(u * Math.PI * 7 + 1.15)), 2);
      var len = 15 + 40 * lobe + rand() * 5;
      y = fTop1 + rand() * len;
      var ft = (y - fTop1) / len;
      add(x, y, mixc(pinkLight, pinkFrost, 0.2 + ft * 0.55 + rand() * 0.2),
        2.2 + rand() * 2.2, 0.5 + rand() * 0.4, rand() < 0.028, 0);
    }
    for (i = 0; i < 650; i++) {
      x = (rand() * 2 - 1) * hw1;
      y = fTop1 - 2 + rand() * 9;
      add(x, y, mixc(white, pinkLight, rand() * 0.45), 2.2 + rand() * 2.2,
        0.55 + rand() * 0.4, rand() < 0.05, 0);
    }

    /* top tier body */
    var hw2 = 190, top2 = -30, bot2 = 130;
    for (i = 0; i < 3300; i++) {
      x = (rand() * 2 - 1) * hw2;
      y = top2 + rand() * (bot2 - top2);
      var e2 = Math.abs(x) / hw2;
      k = 0.78 + 0.36 * (1 - e2 * e2) + rand() * 0.07;
      add(x, y, shade(pinkBody, k), 2.0 + rand() * 2.0, 0.4 + rand() * 0.35, rand() < 0.02, 0);
    }
    for (i = 0; i < 150; i++) {
      x = (rand() * 2 - 1) * hw2 * 0.9;
      y = top2 + 30 + rand() * 120;
      add(x, y, pick(sprinkles), 2.2 + rand() * 2.2, 0.75 + rand() * 0.25, rand() < 0.15, 0);
    }
    for (i = 0; i < 620; i++) {
      a = rand() * TAU; rr = Math.sqrt(rand());
      x = Math.cos(a) * hw2 * rr; y = top2 + Math.sin(a) * 24 * rr;
      add(x, y, mixc(white, C.cream, rand() * 0.5), 1.9 + rand() * 1.9,
        0.4 + rand() * 0.3, 0, 0);
    }

    /* top frosting */
    var fTop2 = -46;
    for (i = 0; i < 1700; i++) {
      x = (rand() * 2 - 1) * (hw2 + 2);
      u = (x + hw2) / (2 * hw2);
      lobe = Math.pow(Math.max(0, Math.sin(u * Math.PI * 6 + 0.35)), 2);
      len = 11 + 28 * lobe + rand() * 4;
      y = fTop2 + rand() * len;
      add(x, y, mixc(white, C.cream, rand() * 0.55), 2.1 + rand() * 2.1,
        0.5 + rand() * 0.4, rand() < 0.03, 0);
    }

    /* candles + flames */
    var candleXs = [-115, 0, 115];
    var candleCols = [C.cyan, C.gold, C.violet];
    for (var ci = 0; ci < 3; ci++) {
      var cx = candleXs[ci], cTop = -162, cBase = -30, hwC = 9;
      var body = candleCols[ci];
      for (i = 0; i < 480; i++) {
        y = cTop + rand() * (cBase - cTop);
        x = cx + (rand() * 2 - 1) * hwC;
        var ec = Math.abs(x - cx) / hwC;
        if (y < cTop + 8 && ec > 0.68) continue;
        var stripe = ((y - cTop + ci * 11) % 34) < 12;
        add(x, y, shade(stripe ? white : body, 0.86 + 0.32 * (1 - ec * ec)),
          2.0 + rand() * 1.9, 0.55 + rand() * 0.4, 0, 0);
      }
      for (i = 0; i < 24; i++) {
        add(cx + (rand() * 2 - 1) * 1.2, cTop - 2 - rand() * 9, C.amber,
          1.4 + rand() * 1.1, 0.65, 0, 0);
      }
      for (i = 0; i < 22; i++) {
        add(cx + (rand() * 2 - 1) * 10, -186 - rand() * 18, C.flame,
          26 + rand() * 30, 0.045 + rand() * 0.045, 0, 1);
      }
      for (i = 0; i < 300; i++) {
        var ft2 = rand();
        y = -168 - ft2 * 64;
        var fw = 1.5 + 15 * Math.sin(Math.PI * Math.min(1, ft2 * 0.92)) * (1 - 0.32 * ft2);
        x = cx + (rand() * 2 - 1) * fw;
        var dd = Math.abs(x - cx) / Math.max(fw, 0.01);
        add(x, y, mixc([1.0, 0.97, 0.78], [1.0, 0.40, 0.05],
          clamp(dd * 0.72 + ft2 * 0.45, 0, 1)),
          3.0 + rand() * 3.4 * (1 - ft2 * 0.35), 0.5 + rand() * 0.4, rand() < 0.1, 1);
      }
    }

    /* berries */
    var berries = [[-150, -40], [150, -40]];
    for (var bi = 0; bi < berries.length; bi++) {
      var bx = berries[bi][0], by = berries[bi][1];
      for (i = 0; i < 110; i++) {
        a = rand() * TAU; rr = Math.pow(rand(), 0.55) * 16;
        add(bx + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.9,
          mixc(C.rose, C.peach, 0.12 + rand() * 0.42), 2.2 + rand() * 2.0,
          0.55 + rand() * 0.4, rand() < 0.1, 0);
      }
      for (i = 0; i < 16; i++) {
        a = rand() * TAU; rr = Math.pow(rand(), 0.7) * 6;
        add(bx - 5 + Math.cos(a) * rr, by - 6 + Math.sin(a) * rr, white,
          1.8 + rand() * 1.6, 0.8, rand() < 0.4, 0);
      }
    }

    /* little banner above the flames */
    var tp = sampleText(
      [{ text: 'HAPPY BIRTHDAY', size: 82, y: 182 }],
      function () { return mixc(C.gold, C.warmWhite, rand() * 0.55); },
      { step: 2, prob: 0.62, sparkle: 0.14 }
    );
    for (i = 0; i < tp.length; i++) pts.push(tp[i]);

    /* sparkle halo */
    for (i = 0; i < 190; i++) {
      a = rand() * TAU; rr = 330 + rand() * 290;
      x = Math.cos(a) * rr;
      y = 40 + Math.sin(a) * rr * 0.82;
      add(x, y, pick([C.gold, C.pink, C.cyan, C.violet, C.white]),
        1.6 + rand() * 2.6, 0.12 + rand() * 0.4, rand() < 0.5, 0);
    }
    return pts;
  }

  /* ------------------------------------------------------------------ heart */
  function buildHeart() {
    var pts = [];
    var S = 250, cy = 10, guard = 0;
    while (pts.length < 6500 && guard < 90000) {
      guard++;
      var x = (rand() * 2 - 1) * 1.32;
      var y = (rand() * 2 - 1) * 1.32;
      var q = x * x + y * y - 1;
      if (q * q * q - x * x * y * y * y > 0) continue;
      var wx = x * S;
      var wy = -y * S + cy;
      var tt = clamp((y + 1.15) / 2.3, 0, 1);
      var c = mixc(C.rose, C.pink, 0.15 + tt * 0.75);
      if (rand() < 0.09) c = mixc(C.warmWhite, C.white, rand());
      var star = rand() < 0.06;
      pts.push(pt(wx + (rand() * 2 - 1) * 1.6, wy + (rand() * 2 - 1) * 1.6, c,
        star ? 4 + rand() * 4 : 2.2 + rand() * 2.4,
        star ? 0.95 : 0.5 + rand() * 0.4, star, 0));
    }
    var tp = sampleText(
      [{ text: 'MAKE A WISH', size: 88, y: 884 }],
      function () { return mixc(C.gold, C.warmWhite, rand() * 0.6); },
      { step: 2, prob: 0.66, sparkle: 0.12 }
    );
    for (var i = 0; i < tp.length; i++) pts.push(tp[i]);
    for (i = 0; i < 140; i++) {
      var a = rand() * TAU, r = 310 + rand() * 200;
      pts.push(pt(Math.cos(a) * r, Math.sin(a) * r * 0.85 + 10,
        pick([C.gold, C.pink, C.white, C.violet]), 1.5 + rand() * 2.2,
        0.12 + rand() * 0.4, rand() < 0.5, 0));
    }
    return pts;
  }

  /* ------------------------------------------------------------ shape cache */
  var shapeCache = {};
  var shapeBuilders = {
    cloud: buildCloud,
    title: buildTitle,
    cake: buildCake,
    heart: buildHeart
  };

  function getShape(key) {
    if (!shapeCache[key]) shapeCache[key] = bake(shapeBuilders[key](), N);
    return shapeCache[key];
  }

  /* ---------------------------------------------------------------- camera */
  var zoom = 1;
  var shiftX = 0, shiftY = 0;
  var mouseX = 0, mouseY = 0;
  var viewZoom = 1;

  /* --------------------------------------------------------------- timeline */
  var SEQ = [
    { key: 'cloud', morph: 2600, hold: 1500, zoom: 0.95 },
    { key: 'title', morph: 2400, hold: 3400, zoom: 0.99 },
    { key: 'cake',  morph: 2700, hold: 8000, zoom: 1.06 },
    { key: 'heart', morph: 2400, hold: 4200, zoom: 0.99 }
  ];
  var phase = -1;
  var phaseStart = 0;
  var morphStart = 0;

  function startMorph(shape, durMs, now) {
    morphStart = now;
    var dur = Math.max(0.001, durMs / 1000);
    for (var i = 0; i < N; i++) {
      P.sx[i] = P.x[i]; P.sy[i] = P.y[i];
      P.scr[i] = P.cr[i]; P.scg[i] = P.cg[i]; P.scb[i] = P.cb[i];
      P.ssz[i] = P.sz[i]; P.sal[i] = P.al[i]; P.sst[i] = P.st[i];
      P.tx[i] = shape.x[i]; P.ty[i] = shape.y[i];
      P.tcr[i] = shape.r[i]; P.tcg[i] = shape.g[i]; P.tcb[i] = shape.b[i];
      P.tsz[i] = shape.s[i]; P.tal[i] = shape.a[i]; P.tst[i] = shape.st[i];
      P.kd[i] = shape.k[i];
      P.dl[i] = rand() * 0.30 * dur;
      P.du[i] = dur * (0.62 + rand() * 0.55);
    }
  }

  function phaseZoom(cfg) {
    var z = cfg.zoom;
    if (W < 640) {
      z *= cfg.key === 'cake' ? 1.22 : (cfg.key === 'heart' ? 1.10 : 1.04);
    }
    return z;
  }

  function enterPhase(i, now) {
    phase = i;
    phaseStart = now;
    var cfg = SEQ[i];
    startMorph(getShape(cfg.key), cfg.morph, now);
    zoom = phaseZoom(cfg) * (cfg.morph > 0 ? 1.14 : 1);
    pending.length = 0;
    if (cfg.key === 'cake') {
      autoFire = 2.4;
      scheduleBurst(now + 0.35, -380, -280, [C.gold, C.white, C.amber], 120);
      scheduleBurst(now + 1.15, 390, -300, [C.pink, C.white, C.rose], 120);
      scheduleBurst(now + 2.20, 0, -380, [C.cyan, C.white, C.violet], 140);
    } else if (cfg.key === 'heart') {
      scheduleBurst(now + 0.20, -350, -160, [C.pink, C.white], 110);
      scheduleBurst(now + 0.55, 350, -160, [C.gold, C.white], 110);
      scheduleBurst(now + 1.40, 0, -300, [C.violet, C.pink, C.white], 150);
    }
  }

  function initParticles(now) {
    var cloud = getShape('cloud');
    for (var i = 0; i < N; i++) {
      var a = rand() * TAU;
      var r = 760 + rand() * 900;
      P.x[i] = Math.cos(a) * r;
      P.y[i] = Math.sin(a) * r * 0.7;
      P.cr[i] = cloud.r[i]; P.cg[i] = cloud.g[i]; P.cb[i] = cloud.b[i];
      P.sz[i] = cloud.s[i] * 0.6;
      P.al[i] = 0;
      P.st[i] = cloud.st[i];
      P.kd[i] = 0;
    }
    enterPhase(0, now);
  }

  /* --------------------------------------------------------------- particles */
  function updateParticles(t, now) {
    var elapsed = (now - morphStart) / 1000;
    for (var i = 0; i < N; i++) {
      var p = (elapsed - P.dl[i]) / P.du[i];
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      var e = easeInOut(p);
      var px = P.sx[i] + (P.tx[i] - P.sx[i]) * e;
      var py = P.sy[i] + (P.ty[i] - P.sy[i]) * e;

      /* bloom outward mid-flight, then spiral home */
      if (p > 0 && p < 1) {
        var pop = Math.sin(Math.PI * p) * P.am[i];
        var ang = P.sd[i] * TAU + p * 2.4;
        px += Math.cos(ang) * pop;
        py += Math.sin(ang) * pop;
      }

      var kd = P.kd[i];
      var wob = (kd === 1 ? 2.6 : 0.7) * e;
      px += Math.sin(t * P.ws[i] + P.sd[i] * 31.4) * wob;
      py += Math.cos(t * P.ws[i] * 0.83 + P.sd[i] * 23.1) * wob;
      if (kd === 1) {
        px += Math.sin(t * 13.7 + P.sd[i] * 50) * 1.6;
        py += Math.sin(t * 9.3 + P.sd[i] * 37) * 1.4;
      }
      P.x[i] = px; P.y[i] = py;

      var cr = P.scr[i] + (P.tcr[i] - P.scr[i]) * e;
      var cg = P.scg[i] + (P.tcg[i] - P.scg[i]) * e;
      var cb = P.scb[i] + (P.tcb[i] - P.scb[i]) * e;
      if (kd === 1) {
        var fl = 0.82 + 0.22 * Math.sin(t * 17 + P.sd[i] * 40);
        cr *= fl; cg *= fl; cb *= fl;
      }
      P.cr[i] = cr; P.cg[i] = cg; P.cb[i] = cb;

      var sz = P.ssz[i] + (P.tsz[i] - P.ssz[i]) * e;
      var al = P.sal[i] + (P.tal[i] - P.sal[i]) * e;
      var st = P.sst[i] + (P.tst[i] - P.sst[i]) * e;
      if (st > 0.5) {
        var tw = Math.abs(Math.sin(t * 3.2 + P.sd[i] * 19));
        sz *= 0.72 + tw * 0.7;
        al *= 0.62 + tw * 0.55;
      }
      P.sz[i] = sz; P.al[i] = al; P.st[i] = st;

      pushP(px, py, cr, cg, cb, sz, clamp(al, 0, 1), st);
    }
  }

  /* ---------------------------------------------------------------- ambient */
  var amb = [];

  function initAmbient() {
    var cols = [C.violet, C.pink, C.cyan, C.gold, C.rose];
    for (var i = 0; i < AMB_N; i++) {
      amb.push({
        x: (rand() * 2 - 1) * 700,
        y: (rand() * 2 - 1) * 460,
        size: 42 + rand() * 90,
        alpha: 0.026 + rand() * 0.05,
        c: pick(cols),
        seed: rand() * TAU,
        sp: 0.05 + rand() * 0.14,
        orbit: 18 + rand() * 46
      });
    }
  }

  function updateAmbient(t) {
    for (var i = 0; i < amb.length; i++) {
      var b = amb[i];
      var x = b.x + Math.sin(t * b.sp + b.seed) * b.orbit;
      var y = b.y + Math.cos(t * b.sp * 0.8 + b.seed * 1.7) * b.orbit * 0.7;
      var tw = 0.65 + 0.35 * Math.sin(t * 0.9 + b.seed * 3.1);
      pushP(x, y, b.c[0], b.c[1], b.c[2], b.size, b.alpha * tw, 0);
    }
  }

  /* ----------------------------------------------------------------- camera */
  function updateCamera(t, now, dt) {
    var cfg = SEQ[phase];
    var target = phaseZoom(cfg);
    zoom += (target - zoom) * (1 - Math.exp(-dt * 1.6));

    var breathe = Math.sin(t * 0.55) * 0.016 + Math.sin(t * 0.23 + 1.3) * 0.011;
    var extra = 0;
    if (cfg.key === 'cake') {
      var holdT = (now - phaseStart) / 1000 - cfg.morph / 1000;
      if (holdT > 0) extra = Math.sin(holdT * 0.55) * 0.045;
    } else if (cfg.key === 'heart') {
      extra = Math.sin(t * 3.0) * 0.018;
    }

    shiftX += (-mouseX * 26 - shiftX) * 0.06;
    shiftY += (-mouseY * 20 - shiftY) * 0.06;
    return zoom + breathe + extra;
  }

  function updateTimeline(now) {
    var cfg = SEQ[phase];
    if (now - phaseStart > cfg.morph + cfg.hold) {
      enterPhase((phase + 1) % SEQ.length, now);
    }
  }

  /* -------------------------------------------------------------- fireworks */
  var fw = [];
  var pending = [];
  var glitterAcc = 0;
  var emberAcc = 0;
  var autoFire = 0;

  function scheduleBurst(at, x, y, cols, count) {
    pending.push({ at: at, x: x, y: y, cols: cols, count: count });
  }

  function spawnBurst(x, y, cols, count, opts) {
    opts = opts || {};
    var speed = opts.speed || 190;
    for (var i = 0; i < count; i++) {
      if (fw.length >= FW_MAX) break;
      var a = rand() * TAU;
      var sp = speed * (0.18 + Math.pow(rand(), 0.55) * 0.9);
      var col = pick(cols);
      fw.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - speed * 0.12,
        r: col[0], g: col[1], b: col[2],
        life: 0,
        max: (opts.life || 1.5) * (0.6 + rand() * 0.8),
        size: (opts.size || 2.4) * (0.7 + rand() * 1.1),
        star: rand() < 0.3 ? 1 : 0,
        drag: opts.drag || 0.975,
        grav: opts.gravity == null ? 90 : opts.gravity,
        type: 0,
        seed: rand() * TAU,
        tw: rand() < 0.6
      });
    }
  }

  function spawnGlitter(x, y, vy) {
    if (fw.length >= FW_MAX) return;
    var col = pick([C.white, C.gold, C.pink, C.cyan]);
    fw.push({
      x: x, y: y, vx: 0, vy: vy,
      r: col[0], g: col[1], b: col[2],
      life: 0, max: 4 + rand() * 3,
      size: 1.3 + rand() * 1.7,
      star: rand() < 0.65 ? 1 : 0,
      drag: 1, grav: 0, type: 1,
      seed: rand() * TAU, tw: true
    });
  }

  function spawnEmber(x, y) {
    if (fw.length >= FW_MAX) return;
    var col = pick([C.amber, C.gold, C.flame, C.warmWhite]);
    fw.push({
      x: x, y: y,
      vx: (rand() * 2 - 1) * 10,
      vy: -30 - rand() * 50,
      r: col[0], g: col[1], b: col[2],
      life: 0, max: 0.8 + rand() * 1.1,
      size: 1.4 + rand() * 1.8,
      star: rand() < 0.3 ? 1 : 0,
      drag: 1, grav: 0, type: 2,
      seed: rand() * TAU, tw: true
    });
  }

  function updateFireworks(dt, now) {
    for (var i = pending.length - 1; i >= 0; i--) {
      if (now >= pending[i].at) {
        var b = pending[i];
        spawnBurst(b.x, b.y, b.cols, b.count, {});
        pending.splice(i, 1);
      }
    }

    var cfg = SEQ[phase];

    if (cfg.key === 'cake') {
      autoFire -= dt;
      if (autoFire <= 0) {
        autoFire = 2.4 + rand() * 1.6;
        var side = rand() < 0.5 ? -1 : 1;
        spawnBurst(side * (300 + rand() * 140), -180 - rand() * 160,
          pick([[C.gold, C.white], [C.pink, C.white], [C.cyan, C.white], [C.violet, C.pink]]),
          80 + ((rand() * 60) | 0),
          { speed: 150, life: 1.3, size: 2.2 });
      }
      emberAcc += dt;
      if (emberAcc > 0.06) {
        emberAcc = 0;
        var ex = pick([-115, 0, 115]) + (rand() * 2 - 1) * 4;
        spawnEmber(ex, -228 - rand() * 8);
      }
    }

    if (cfg.key === 'cake' || cfg.key === 'heart') {
      glitterAcc += dt;
      if (glitterAcc > 0.055) {
        glitterAcc = 0;
        spawnGlitter((rand() * 2 - 1) * 560, -470, 26 + rand() * 50);
      }
    }

    for (i = fw.length - 1; i >= 0; i--) {
      var p = fw[i];
      p.life += dt;
      if (p.life >= p.max) { fw.splice(i, 1); continue; }

      if (p.type === 1) {
        p.x += Math.sin(p.life * 2.2 + p.seed) * 22 * dt;
        p.y += p.vy * dt;
      } else if (p.type === 2) {
        p.vy += 22 * dt;
        p.x += Math.sin(p.life * 5 + p.seed) * 16 * dt;
        p.y += p.vy * dt;
      } else {
        p.vy += p.grav * dt;
        var d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  }

  function drawFireworks() {
    for (var i = 0; i < fw.length; i++) {
      var p = fw[i];
      var k = p.life / p.max;
      var a = Math.pow(1 - k, 1.4);
      if (p.tw) a *= 0.65 + 0.35 * Math.abs(Math.sin(p.life * 22 + p.seed));
      pushP(p.x, p.y, p.r, p.g, p.b, p.size, a, p.star);
    }
  }

  /* ------------------------------------------------------------------ draw */
  function pushP(x, y, r, g, b, s, a, st) {
    if (ptr + 8 > data.length) return;
    data[ptr] = x;
    data[ptr + 1] = y;
    data[ptr + 2] = r;
    data[ptr + 3] = g;
    data[ptr + 4] = b;
    data[ptr + 5] = s;
    data[ptr + 6] = a;
    data[ptr + 7] = st;
    ptr += 8;
  }

  function render(t, z) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    /* background */
    gl.useProgram(bgProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, bgVbo);
    gl.enableVertexAttribArray(bgAP);
    gl.vertexAttribPointer(bgAP, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    gl.uniform2f(bgU.res, canvas.width, canvas.height);
    gl.uniform1f(bgU.time, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(bgAP);

    /* points */
    gl.useProgram(pProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(aSize);
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 32, 20);
    gl.enableVertexAttribArray(aAlpha);
    gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 32, 24);
    gl.enableVertexAttribArray(aStar);
    gl.vertexAttribPointer(aStar, 1, gl.FLOAT, false, 32, 28);

    gl.uniform2f(pU.res, W, H);
    gl.uniform1f(pU.scale, scale);
    gl.uniform1f(pU.zoom, z);
    gl.uniform1f(pU.dpr, DPR);
    gl.uniform2f(pU.shift, shiftX, shiftY);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, ptr));
    gl.drawArrays(gl.POINTS, 0, ptr / 8);
    gl.disable(gl.BLEND);
  }

  /* ------------------------------------------------------------------ loop */
  var last = 0;

  function frame(now) {
    var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    var t = now / 1000;

    updateTimeline(now);
    var z = updateCamera(t, now, dt);
    viewZoom = z;

    ptr = 0;
    updateAmbient(t);
    updateParticles(t, now);
    updateFireworks(dt, now);
    drawFireworks();
    render(t, z);

    requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------------- input */
  canvas.addEventListener('pointerdown', function (e) {
    mouseX = e.clientX / W - 0.5;
    mouseY = e.clientY / H - 0.5;
    var wx = (e.clientX - W / 2 - shiftX) / (scale * viewZoom);
    var wy = (e.clientY - H / 2 - shiftY) / (scale * viewZoom);
    var pal = pick([
      [C.gold, C.white, C.amber],
      [C.pink, C.white, C.rose],
      [C.cyan, C.white, C.violet],
      [C.mint, C.white, C.cyan]
    ]);
    spawnBurst(wx, wy, pal, 110, { speed: 210, life: 1.5, size: 2.6 });
    spawnBurst(wx, wy, [C.white], 26, { speed: 80, life: 0.9, size: 3.2 });
  }, { passive: true });

  window.addEventListener('pointermove', function (e) {
    mouseX = e.clientX / W - 0.5;
    mouseY = e.clientY / H - 0.5;
  }, { passive: true });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      spawnBurst(0, -60, [C.gold, C.pink, C.cyan, C.white], 160,
        { speed: 260, life: 1.7, size: 2.8 });
    }
  });

  /* ------------------------------------------------------------------ boot */
  function warmShapes() {
    setTimeout(function () { getShape('title'); }, 700);
    setTimeout(function () { getShape('cake'); }, 2000);
    setTimeout(function () { getShape('heart'); }, 3400);
  }

  function start() {
    resize();
    initAmbient();
    var now = performance.now();
    initParticles(now);
    last = now;
    warmShapes();
    requestAnimationFrame(frame);
  }

  start();
})();
