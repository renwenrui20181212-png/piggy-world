/* 小猪欢乐世界 — 原创儿童探索小游戏 v3
   保留：泥坑跳跳 / 粉色小房子 / 生日聚会 / 开车郊游 / 8 位小猪朋友
   新增：家庭乐园 —— 12 个家人主题小游戏（剪草/采草莓/看电视/做手工/烤饼干/洗车/搭积木/喂小鸡/钓鱼/买菜/涂色/收拾玩具）
   iPad 触摸优化：左半屏任意位置浮动摇杆、大号情境按钮、小游戏全程点击或拖动
   纯 Canvas，无外部依赖，可离线运行 */
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  // ---------- 视口与缩放 ----------
  var VIEW_W = 1024, VIEW_H = 640;
  var scale = 1, offsetX = 0, offsetY = 0;
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var s = Math.min(w / VIEW_W, h / VIEW_H);
    scale = s * dpr;
    offsetX = (canvas.width - VIEW_W * scale) / 2;
    offsetY = (canvas.height - VIEW_H * scale) / 2;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
  resize();

  // ---------- 音效 ----------
  var audioCtx = null, musicOn = true, sfxOn = true;
  function initAudio() {
    if (audioCtx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    } catch (e) { audioCtx = null; }
  }
  function tone(freq, dur, type, vol, when) {
    if (!audioCtx || !sfxOn) return;
    try {
      var t = audioCtx.currentTime + (when || 0);
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function noise(dur, vol, when) {
    if (!audioCtx || !sfxOn) return;
    try {
      var t = audioCtx.currentTime + (when || 0);
      var len = Math.floor(audioCtx.sampleRate * dur);
      var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = audioCtx.createBufferSource(); src.buffer = buf;
      var g = audioCtx.createGain(); g.gain.value = vol || 0.1;
      var f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      src.connect(f); f.connect(g); g.connect(audioCtx.destination);
      src.start(t);
    } catch (e) {}
  }
  function sfxCollect() { tone(660, 0.12, 'sine', 0.18); tone(990, 0.16, 'sine', 0.16, 0.09); }
  function sfxJump() { tone(380, 0.14, 'sine', 0.14); tone(560, 0.16, 'sine', 0.12, 0.08); }
  function sfxHi() { tone(523, 0.1, 'triangle', 0.16); tone(659, 0.1, 'triangle', 0.16, 0.1); tone(784, 0.18, 'triangle', 0.16, 0.2); }
  function sfxMud() { noise(0.3, 0.16); tone(180, 0.22, 'sine', 0.12); }
  function sfxCar() { tone(120, 0.18, 'square', 0.1); tone(90, 0.25, 'square', 0.09, 0.12); }
  function sfxBlow() { noise(0.4, 0.2); tone(1046, 0.3, 'sine', 0.12, 0.15); }
  function sfxWin() {
    var notes = [523, 659, 784, 1046, 784, 1046];
    for (var i = 0; i < notes.length; i++) tone(notes[i], 0.3, 'triangle', 0.18, i * 0.16);
  }
  var melody = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 880, 784, 659, 587];
  var birthday = [523,523,587,523,698,659, 523,523,587,523,784,698];
  var melodyIdx = 0, melodyTimer = 0;
  function musicTick(dt, partyMode) {
    if (!musicOn || !audioCtx || (state !== 'play' && state !== 'party')) return;
    melodyTimer -= dt;
    if (melodyTimer <= 0) {
      var seq = partyMode ? birthday : melody;
      tone(seq[melodyIdx % seq.length], 0.26, 'sine', partyMode ? 0.07 : 0.05);
      melodyIdx++;
      melodyTimer = partyMode ? 0.3 : 0.34;
    }
  }

  // ---------- 输入 ----------
  var keys = {};
  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
    if (e.key === 'Enter' && state === 'title') startGame();
  });
  window.addEventListener('keyup', function (e) { keys[e.key] = false; });

  var input = { lx: 0, ly: 0, jump: false, wave: false, action: false };
  var stick = { active: false, id: null, cx: 0, cy: 0, r: 72, kx: 0, ky: 0 };
  var btnJump  = { x: 952, y: 540, r: 58, id: null, pressed: false, label: '跳', show: true };
  var btnWave  = { x: 838, y: 574, r: 46, id: null, pressed: false, label: '你好', show: true };
  var btnAct   = { x: 880, y: 440, r: 56, id: null, pressed: false, label: '', show: false };
  var btnExit  = { x: 952, y: 96,  r: 44, id: null, pressed: false, label: '出屋' };

  function screenToLogical(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var px = (clientX - rect.left) * (canvas.width / rect.width);
    var py = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
  }
  function hitBtn(b, p) { return Math.hypot(p.x - b.x, p.y - b.y) < b.r; }

  function pointerDown(e) {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    var touches = e.changedTouches ? Array.prototype.slice.call(e.changedTouches) : [e];
    for (var i = 0; i < touches.length; i++) {
      var p = screenToLogical(touches[i].clientX, touches[i].clientY);
      var id = touches[i].identifier != null ? touches[i].identifier : 'mouse';
      if (state === 'title') { startGame(); return; }
      if (state === 'win') { startGame(); return; }
      if (state === 'courtyard') { courtyardDown(p); continue; }
      if (state === 'mini' || state === 'miniDone') { miniDown(p); continue; }
      if (state === 'party') {
        if (hitBtn(btnAct, p) && btnAct.show) { btnAct.id = id; btnAct.pressed = true; input.action = true; continue; }
        if (hitBtn(btnExit, p)) { exitHouse(); continue; }
        continue;
      }
      if (state !== 'play') continue;
      if (p.x > VIEW_W - 70 && p.y < 70) { togglePause(); continue; }
      if (p.x > VIEW_W - 150 && p.x < VIEW_W - 88 && p.y < 70) { musicOn = !musicOn; continue; }
      if (btnAct.show && hitBtn(btnAct, p) && btnAct.id === null) { btnAct.id = id; btnAct.pressed = true; input.action = true; continue; }
      if (hitBtn(btnJump, p) && btnJump.id === null) { btnJump.id = id; btnJump.pressed = true; input.jump = true; continue; }
      if (hitBtn(btnWave, p) && btnWave.id === null) { btnWave.id = id; btnWave.pressed = true; input.wave = true; continue; }
      if (!stick.active && p.x < VIEW_W * 0.52) {
        stick.active = true; stick.id = id;
        stick.cx = p.x; stick.cy = p.y;
        updateStick(p);
      }
    }
  }
  function updateStick(p) {
    var dx = p.x - stick.cx, dy = p.y - stick.cy;
    var d = Math.hypot(dx, dy), max = stick.r;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; d = max; }
    stick.kx = dx; stick.ky = dy;
    input.lx = dx / max; input.ly = dy / max;
  }
  function pointerMove(e) {
    var touches = e.changedTouches ? Array.prototype.slice.call(e.changedTouches) : [e];
    if (state === 'mini' && mg && mg.def.move) {
      for (var m = 0; m < touches.length; m++) mg.def.move(mg.data, screenToLogical(touches[m].clientX, touches[m].clientY));
      return;
    }
    for (var i = 0; i < touches.length; i++) {
      var id = touches[i].identifier != null ? touches[i].identifier : 'mouse';
      if (stick.active && id === stick.id) updateStick(screenToLogical(touches[i].clientX, touches[i].clientY));
    }
  }
  function pointerUp(e) {
    var touches = e.changedTouches ? Array.prototype.slice.call(e.changedTouches) : [e];
    if (state === 'mini' && mg && mg.def.up) {
      for (var m = 0; m < touches.length; m++) mg.def.up(mg.data, screenToLogical(touches[m].clientX, touches[m].clientY));
      return;
    }
    for (var i = 0; i < touches.length; i++) {
      var id = touches[i].identifier != null ? touches[i].identifier : 'mouse';
      if (stick.active && id === stick.id) {
        stick.active = false; stick.id = null; stick.kx = 0; stick.ky = 0;
        input.lx = 0; input.ly = 0;
      }
      if (btnJump.id === id) { btnJump.id = null; btnJump.pressed = false; }
      if (btnWave.id === id) { btnWave.id = null; btnWave.pressed = false; }
      if (btnAct.id === id) { btnAct.id = null; btnAct.pressed = false; }
    }
  }
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); pointerDown(e); }, { passive: false });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); pointerMove(e); }, { passive: false });
  canvas.addEventListener('touchend', function (e) { e.preventDefault(); pointerUp(e); }, { passive: false });
  canvas.addEventListener('touchcancel', function (e) { e.preventDefault(); pointerUp(e); }, { passive: false });
  canvas.addEventListener('mousedown', pointerDown);
  window.addEventListener('mousemove', function (e) { if ((stick.active && stick.id === 'mouse') || state === 'mini') pointerMove(e); });
  window.addEventListener('mouseup', pointerUp);

  // ---------- 世界 ----------
  var WORLD_W = 3000, WORLD_H = 2000;
  var player, friends, apples, balloons, stars, butterflies, trees, flowers, clouds;
  var muds, cars, house, picnic, garden, particles, floaters;
  var score = 0, goal = 30, timeLeft = 300, state = 'title', paused = false;
  var ach = { mud: false, party: false, drive: false };
  var completed = []; // 12 个小游戏完成标记
  var cam = { x: 0, y: 0 };
  var worldTime = 0, candlesBlown = false;
  var toast = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function makeWorld() {
    score = 0; timeLeft = 300; paused = false; worldTime = 0;
    candlesBlown = false; toast = null;
    ach = { mud: false, party: false, drive: false };
    completed = [];
    for (var ci = 0; ci < 12; ci++) completed.push(false);
    player = {
      x: 1500, y: 1150, vx: 0, vy: 0, dir: 1, walk: 0,
      jumpY: 0, jumpV: 0, jumping: false,
      body: '#ff9ec4', cloth: '#ef4e6b', blink: 0, blinkT: rnd(2, 5),
      waveT: 0, mode: 'walk', car: null, mudDip: 0
    };
    var palettes = [
      { body: '#ffd45e', cloth: '#4aa3df' }, { body: '#c9a7f5', cloth: '#59c38b' },
      { body: '#7fd7c4', cloth: '#f08a3c' }, { body: '#ffb0b0', cloth: '#7b6cf0' },
      { body: '#ffe08a', cloth: '#e0557f' }, { body: '#b7e37f', cloth: '#3f8fd0' },
      { body: '#f7b6e0', cloth: '#39b3a0' }, { body: '#a9c4f5', cloth: '#e07c3c' }
    ];
    var spots = [[900,600],[2000,700],[1250,900],[2300,1150],[700,1500],[1750,1550],[2600,800],[1150,500]];
    friends = [];
    for (var i = 0; i < 8; i++) {
      friends.push({
        x: spots[i][0], y: spots[i][1], dir: 1, walk: rnd(0, 6),
        body: palettes[i].body, cloth: palettes[i].cloth,
        homeX: spots[i][0], homeY: spots[i][1], t: rnd(0, 6),
        blink: 0, blinkT: rnd(2, 5), waveT: 0, talked: 0
      });
    }
    apples = [];
    for (var a = 0; a < 22; a++) apples.push({ x: rnd(120, WORLD_W - 120), y: rnd(120, WORLD_H - 120), got: false, bob: rnd(0, 6) });
    stars = [];
    for (var s = 0; s < 7; s++) stars.push({ x: rnd(150, WORLD_W - 150), y: rnd(150, WORLD_H - 150), got: false, bob: rnd(0, 6) });
    balloons = [];
    for (var b = 0; b < 10; b++) balloons.push({ x: rnd(150, WORLD_W - 150), y: rnd(150, WORLD_H - 150), got: false, bob: rnd(0, 6), hue: [0, 200, 280, 45][b % 4] });
    muds = [
      { x: 780, y: 780, r: 62, splash: 0, cool: 0 },
      { x: 900, y: 900, r: 54, splash: 0, cool: 0 },
      { x: 1030, y: 790, r: 58, splash: 0, cool: 0 },
      { x: 880, y: 1030, r: 50, splash: 0, cool: 0 }
    ];
    house = { x: 2200, y: 420, w: 300, h: 250 };
    picnic = { x: 2650, y: 1650, r: 150 };
    garden = { x: 1120, y: 1330, r: 96 };
    cars = [
      { x: 1550, y: 1350, dir: 1, speed: 0, hue: 340 },
      { x: 2350, y: 1750, dir: -1, speed: 0, hue: 200 }
    ];
    butterflies = [];
    for (var f = 0; f < 14; f++) butterflies.push({ x: rnd(0, WORLD_W), y: rnd(0, WORLD_H), t: rnd(0, 6), sp: rnd(0.5, 1.2), hue: rnd(0, 360) });
    trees = [];
    for (var t = 0; t < 34; t++) trees.push({ x: rnd(60, WORLD_W - 60), y: rnd(60, WORLD_H - 60), s: rnd(0.8, 1.4) });
    flowers = [];
    for (var fl = 0; fl < 90; fl++) flowers.push({ x: rnd(20, WORLD_W - 20), y: rnd(20, WORLD_H - 20), hue: [340, 45, 280, 200, 15][fl % 5], s: rnd(0.7, 1.3) });
    clouds = [];
    for (var c = 0; c < 16; c++) clouds.push({ x: rnd(0, WORLD_W), y: rnd(40, WORLD_H * 0.5), s: rnd(0.7, 1.5), sp: rnd(6, 14) });
    particles = [];
    floaters = [];
    cam.x = clamp(player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    cam.y = clamp(player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  }

  function startGame() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    makeWorld();
    state = 'play'; paused = false;
  }
  function togglePause() { if (state === 'play') paused = !paused; }
  function showToast(text) { toast = { text: text, life: 2.6 }; }

  // ---------- 主世界互动 ----------
  function nearestAction() {
    if (player.mode === 'drive') return { type: 'exitcar', label: '下车' };
    if (Math.hypot(player.x - garden.x, player.y - garden.y) < garden.r + 40) return { type: 'garden', label: '进乐园' };
    var dh = Math.hypot(player.x - house.x, player.y - (house.y + 90));
    if (dh < 130) return { type: 'house', label: '进屋' };
    for (var i = 0; i < cars.length; i++) {
      if (Math.hypot(player.x - cars[i].x, player.y - cars[i].y) < 100) return { type: 'boardcar', car: cars[i], label: '上车' };
    }
    return null;
  }
  function doAction() {
    var a = nearestAction();
    if (!a) return;
    if (a.type === 'garden') enterCourtyard();
    else if (a.type === 'house') enterHouse();
    else if (a.type === 'boardcar') boardCar(a.car);
    else if (a.type === 'exitcar') exitCar();
  }
  function enterHouse() { state = 'party'; candlesBlown = false; melodyIdx = 0; }
  function exitHouse() { state = 'play'; showToast('下次再来玩吧!'); }
  function boardCar(car) {
    player.mode = 'drive'; player.car = car; car.speed = 0;
    sfxCar(); showToast('开车郊游去咯! 开到野餐草地');
  }
  function exitCar() {
    player.mode = 'walk';
    if (player.car) { player.x = player.car.x + 70; player.car.speed = 0; }
    player.car = null; showToast('下车啦');
  }
  function blowCandles() {
    if (candlesBlown) { showToast('蜡烛已经吹灭啦 🎂'); return; }
    candlesBlown = true; sfxBlow();
    score += 5; ach.party = true;
    for (var i = 0; i < 46; i++) {
      particles.push({ sx: rnd(VIEW_W*0.25, VIEW_W*0.75), sy: rnd(VIEW_H*0.2, VIEW_H*0.5),
        x: rnd(VIEW_W*0.25, VIEW_W*0.75), y: rnd(VIEW_H*0.2, VIEW_H*0.5),
        vx: rnd(-160,160), vy: rnd(-220,-60), life: rnd(1.2,2.4),
        color: ['#ff5b8a','#ffd23f','#4aa3df','#59c38b','#c9a7f5'][i%5], r: rnd(4,8), screen: true });
    }
    showToast('生日快乐! +5');
    checkWin();
  }

  // ---------- 主世界更新 ----------
  function updatePlay(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; win(); }
    var kx = input.lx, ky = input.ly;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) kx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) kx = 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) ky = -1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) ky = 1;
    var mag = Math.hypot(kx, ky);
    if (mag > 1) { kx /= mag; ky /= mag; }
    var speed = player.mode === 'drive' ? 400 : 235;
    player.vx = kx * speed; player.vy = ky * speed;
    player.x = clamp(player.x + player.vx * dt, 40, WORLD_W - 40);
    player.y = clamp(player.y + player.vy * dt, 40, WORLD_H - 40);
    if (player.mode === 'drive' && player.car) {
      player.car.x = player.x; player.car.y = player.y;
      if (kx > 0.2) player.car.dir = 1;
      if (kx < -0.2) player.car.dir = -1;
      player.car.speed = mag > 0.1 ? 1 : 0;
      if (!ach.drive && Math.hypot(player.x - picnic.x, player.y - picnic.y) < picnic.r) {
        ach.drive = true; score += 5; sfxWin(); showToast('郊游到达! +5'); checkWin();
      }
    }
    if (mag > 0.1) {
      player.walk += dt * (player.mode === 'drive' ? 4 : 10);
      if (kx > 0.25) player.dir = 1;
      if (kx < -0.25) player.dir = -1;
    } else player.walk += dt * 2;
    if (input.jump && !player.jumping && player.mode === 'walk') {
      player.jumping = true; player.jumpV = 340; sfxJump();
    }
    input.jump = false;
    if (player.jumping) {
      player.jumpY += player.jumpV * dt; player.jumpV -= 900 * dt;
      if (player.jumpY <= 0) { player.jumpY = 0; player.jumping = false; }
    }
    if (player.mudDip > 0) player.mudDip -= dt;
    player.blinkT -= dt;
    if (player.blinkT <= 0) { player.blink = 0.16; player.blinkT = rnd(2.5, 6); }
    if (player.blink > 0) player.blink -= dt;
    if (player.waveT > 0) player.waveT -= dt;
    var tx = clamp(player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    var ty = clamp(player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 6);
    if (input.wave) {
      player.waveT = 0.8; sfxHi();
      for (var fi = 0; fi < friends.length; fi++) {
        var fr = friends[fi];
        if (Math.hypot(fr.x - player.x, fr.y - player.y) < 200) {
          fr.waveT = 0.9; fr.talked = 1.6; spawnHearts(fr.x, fr.y - 60);
        }
      }
      input.wave = false;
    }
    if (input.action) { doAction(); input.action = false; }
    if (player.mode === 'walk') {
      for (var mi = 0; mi < muds.length; mi++) {
        var m = muds[mi];
        if (m.cool > 0) m.cool -= dt;
        if (m.cool <= 0 && Math.hypot(player.x - m.x, player.y - m.y) < m.r) {
          m.cool = 1.6; m.splash = 0.6; player.mudDip = 0.35;
          sfxMud(); spawnMud(m.x, m.y);
          if (!ach.mud) { ach.mud = true; score += 2; showToast('泥坑跳跳! +2'); }
          else if (Math.random() < 0.4) { score += 1; }
          checkWin();
        }
      }
    }
    collect(apples, 1, '#e74b53');
    collect(stars, 3, '#ffd23f');
    collect(balloons, 2, '#ff6b9d');
    for (var j = 0; j < friends.length; j++) {
      var f = friends[j];
      f.t += dt;
      f.x = clamp(f.homeX + Math.sin(f.t * 0.5 + j) * 55, 40, WORLD_W - 40);
      f.y = clamp(f.homeY + Math.cos(f.t * 0.4 + j) * 35, 40, WORLD_H - 40);
      f.walk += dt * 3;
      f.dir = Math.cos(f.t * 0.5 + j) > 0 ? 1 : -1;
      f.blinkT -= dt;
      if (f.blinkT <= 0) { f.blink = 0.14; f.blinkT = rnd(2, 6); }
      if (f.blink > 0) f.blink -= dt;
      if (f.waveT > 0) f.waveT -= dt;
      if (f.talked > 0) f.talked -= dt;
    }
    for (var c = 0; c < clouds.length; c++) {
      clouds[c].x += clouds[c].sp * dt;
      if (clouds[c].x > WORLD_W + 120) clouds[c].x = -120;
    }
    updateParticles(dt);
    musicTick(dt, false);
  }

  function updateParticles(dt) {
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vy += (pt.gravity == null ? 220 : pt.gravity) * dt;
      if (pt.life <= 0) particles.splice(p, 1);
    }
    for (var q = floaters.length - 1; q >= 0; q--) {
      floaters[q].life -= dt; floaters[q].y -= 40 * dt;
      if (floaters[q].life <= 0) floaters.splice(q, 1);
    }
  }
  function collect(list, pts, color) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.got) continue;
      if (Math.hypot(o.x - player.x, o.y - player.y) < 54 && player.jumpY < 60) {
        o.got = true; score += pts; sfxCollect();
        spawnBurst(o.x, o.y, color);
        floaters.push({ x: o.x, y: o.y - 10, text: '+' + pts, life: 1, color: color });
        checkWin();
      }
    }
  }
  function spawnBurst(x, y, color) {
    for (var i = 0; i < 12; i++) {
      var a = (Math.PI * 2 / 12) * i + rnd(-0.2, 0.2);
      particles.push({ x: x, y: y, vx: Math.cos(a)*rnd(60,150), vy: Math.sin(a)*rnd(60,150)-40, life: rnd(0.5,0.9), color: color, r: rnd(3,6) });
    }
  }
  function spawnHearts(x, y) {
    for (var i = 0; i < 6; i++) particles.push({ x: x+rnd(-20,20), y: y+rnd(-10,10), vx: rnd(-25,25), vy: rnd(-70,-30), life: rnd(0.8,1.3), color: '#ff5b8a', r: 5, heart: true });
  }
  function spawnMud(x, y) {
    for (var i = 0; i < 18; i++) {
      var a = rnd(0, Math.PI*2);
      particles.push({ x: x, y: y, vx: Math.cos(a)*rnd(50,180), vy: Math.sin(a)*rnd(80,220)-60, life: rnd(0.5,1), color: '#7a5230', r: rnd(3,8) });
    }
  }
  function checkWin() { if (score >= goal && (state === 'play' || state === 'party')) win(); }
  function win() {
    if (state === 'win') return;
    state = 'win'; sfxWin();
    for (var i = 0; i < 40; i++) particles.push({ sx: rnd(0,VIEW_W), sy: rnd(-VIEW_H,0), x: rnd(0,VIEW_W), y: rnd(-VIEW_H,0), vx: rnd(-40,40), vy: rnd(60,180), life: rnd(2,4), color: ['#ff5b8a','#ffd23f','#4aa3df','#59c38b','#c9a7f5'][i%5], r: rnd(4,8), screen: true });
  }

  // ================= 家庭乐园：12 个小游戏 =================
  var mg = null; // {idx, def, data, t, doneT}

  function enterCourtyard() { state = 'courtyard'; showToast('欢迎来到家庭乐园!'); }
  function exitCourtyard() { state = 'play'; checkWin(); showToast('回到欢乐世界啦!'); }
  function startMini(i) {
    mg = { idx: i, def: MGAMES[i], data: {}, t: 0, doneT: 0 };
    if (mg.def.init) mg.def.init(mg.data);
    state = 'mini';
  }
  function leaveMini() { state = 'courtyard'; mg = null; }

  var COURT_BACK = { x: VIEW_W - 96, y: 62, r: 44 };
  function courtyardDown(p) {
    if (Math.hypot(p.x - COURT_BACK.x, p.y - COURT_BACK.y) < COURT_BACK.r + 10) { exitCourtyard(); return; }
    var cols = 4, rowsL = 3, gx = 60, gy = 130, cw = 218, ch = 148, gap = 12;
    for (var i = 0; i < 12; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      var x = gx + c * (cw + gap), y = gy + r * (ch + gap);
      if (p.x >= x && p.x <= x + cw && p.y >= y && p.y <= y + ch) { startMini(i); return; }
    }
  }
  function miniDown(p) {
    if (state === 'miniDone') { leaveMini(); return; }
    if (p.x < 92 && p.y < 78) { leaveMini(); return; }
    if (mg && mg.def.down) mg.def.down(mg.data, p);
  }
  function updateMini(dt) {
    if (!mg) return;
    mg.t += dt;
    if (state === 'mini' && !mg.data.done && mg.def.update) mg.def.update(mg.data, dt);
    if (mg.data.done && state === 'mini') {
      state = 'miniDone'; mg.doneT = 0;
      score += 3;
      completed[mg.idx] = true;
      sfxWin();
      for (var i = 0; i < 30; i++) particles.push({ sx: rnd(0,VIEW_W), sy: rnd(-VIEW_H,0), x: rnd(0,VIEW_W), y: rnd(-VIEW_H,0), vx: rnd(-40,40), vy: rnd(60,180), life: rnd(2,4), color: ['#ff5b8a','#ffd23f','#4aa3df','#59c38b','#c9a7f5'][i%5], r: rnd(4,8), screen: true });
    }
    if (state === 'miniDone') mg.doneT += dt;
  }

  // 12 个小游戏：每个含 name/hint/init/update/draw/down/move/up
  var MGAMES = [
    // 0 剪草
    {
      name: '帮爷爷剪草', hint: '手指拖动剪草机，把长草剪短（剪 30 格）',
      init: function (d) {
        d.cells = [];
        for (var r = 0; r < 5; r++) for (var c = 0; c < 9; c++) d.cells.push({ c: c, r: r, cut: false });
        d.count = 0; d.mx = VIEW_W / 2; d.my = 360;
      },
      update: function (d) { if (d.count >= 30) d.done = true; },
      draw: function (d) {
        var cw = 100, ch = 84, ox = (VIEW_W - 9 * cw) / 2, oy = 130;
        for (var i = 0; i < d.cells.length; i++) {
          var cl = d.cells[i], x = ox + cl.c * cw, y = oy + cl.r * ch;
          ctx.fillStyle = cl.cut ? '#c9eda6' : '#5fae55';
          roundRect(x + 2, y + 2, cw - 4, ch - 4, 8); ctx.fill();
          if (!cl.cut) {
            ctx.strokeStyle = '#3f8f43'; ctx.lineWidth = 3;
            for (var g = 0; g < 4; g++) { var gx = x + 18 + g * 22; ctx.beginPath(); ctx.moveTo(gx, y + ch - 12); ctx.lineTo(gx - 4, y + ch - 30); ctx.stroke(); }
          }
        }
        ctx.fillStyle = '#3b3b3b'; roundRect(d.mx - 34, d.my - 16, 68, 36, 8); ctx.fill();
        ctx.fillStyle = '#ff5b5b'; roundRect(d.mx - 26, d.my - 12, 52, 20, 5); ctx.fill();
        ellipse(d.mx - 20, d.my + 22, 10, 10, '#333'); ellipse(d.mx + 20, d.my + 22, 10, 10, '#333');
        drawPig(96, 520, 0.8, { body: '#ffd45e', cloth: '#4aa3df', dir: 1, waving: true });
        ctx.fillStyle = '#2f7a35'; ctx.font = 'bold 24px "Comic Sans MS",sans-serif'; ctx.textAlign = 'right'; ctx.fillText('已剪 ' + d.count + ' / 30', VIEW_W - 40, 100);
      },
      down: function (d, p) { d.mx = p.x; d.my = p.y; mowAt(d, p); },
      move: function (d, p) { d.mx = p.x; d.my = p.y; mowAt(d, p); }
    },
    // 1 采草莓
    {
      name: '帮奶奶采草莓', hint: '只点红色的熟草莓，采满 10 颗（青的先留下）',
      init: function (d) {
        d.bs = [];
        for (var i = 0; i < 14; i++) d.bs.push({ x: rnd(140, VIEW_W - 140), y: rnd(160, 520), ripe: i < 10, picked: false, bob: rnd(0, 6) });
        d.count = 0;
      },
      update: function (d) { if (d.count >= 10) d.done = true; },
      draw: function (d) {
        for (var i = 0; i < d.bs.length; i++) {
          var b = d.bs[i]; if (b.picked) continue;
          var y = b.y + Math.sin(worldTime * 3 + b.bob) * 4;
          ctx.strokeStyle = '#4a9e57'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x, y + 16); ctx.lineTo(b.x, y + 42); ctx.stroke();
          var col = b.ripe ? '#e74b53' : '#9fd36a';
          ellipse(b.x - 9, y, 12, 14, col); ellipse(b.x + 9, y, 12, 14, col); ellipse(b.x, y + 3, 14, 13, col);
          ctx.fillStyle = '#59c38b'; ctx.beginPath(); ctx.ellipse(b.x, y - 14, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
          if (b.ripe) ellipse(b.x - 5, y - 3, 3, 5, 'rgba(255,255,255,0.6)');
        }
        drawPig(96, 560, 0.85, { body: '#c9a7f5', cloth: '#59c38b', dir: 1, waving: true });
        ctx.fillStyle = '#2f7a35'; ctx.font = 'bold 24px "Comic Sans MS",sans-serif'; ctx.textAlign = 'right'; ctx.fillText('篮子 ' + d.count + ' / 10 🍓', VIEW_W - 40, 100);
      },
      down: function (d, p) {
        for (var i = 0; i < d.bs.length; i++) {
          var b = d.bs[i];
          if (!b.picked && Math.hypot(b.x - p.x, b.y - p.y) < 40) {
            b.picked = true;
            if (b.ripe) { d.count++; sfxCollect(); } else showToast('还没熟哦~');
          }
        }
      }
    },
    // 2 看电视
    {
      name: '和妈妈看电视', hint: '屏幕上冒出图案时，快点它！跟对 8 次',
      init: function (d) { d.items = []; d.spawn = 0.4; d.hits = 0; d.face = 0; },
      update: function (d, dt) {
        d.spawn -= dt;
        if (d.spawn <= 0) {
          d.spawn = 0.8;
          d.items.push({ x: rnd(260, VIEW_W - 260), y: rnd(200, 400), life: 1.5, got: false, e: ['🐷','⭐','🐸','🎵','🌸'][Math.floor(rnd(0, 5))] });
        }
        for (var i = d.items.length - 1; i >= 0; i--) { d.items[i].life -= dt; if (d.items[i].life <= 0 || d.items[i].got) d.items.splice(i, 1); }
        if (d.face > 0) d.face -= dt;
        if (d.hits >= 8) d.done = true;
      },
      draw: function (d) {
        ctx.fillStyle = '#8b5a3a'; roundRect(VIEW_W / 2 - 300, 130, 600, 350, 20); ctx.fill();
        ctx.fillStyle = '#222'; roundRect(VIEW_W / 2 - 282, 148, 564, 300, 12); ctx.fill();
        ctx.fillStyle = '#8ed6ff'; roundRect(VIEW_W / 2 - 272, 158, 544, 280, 8); ctx.fill();
        for (var i = 0; i < d.items.length; i++) {
          var it = d.items[i];
          ctx.save(); ctx.globalAlpha = Math.min(1, it.life); ctx.font = '52px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(it.e, it.x, it.y); ctx.restore();
        }
        if (d.face > 0) { ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('😆', VIEW_W / 2, 300); }
        drawPig(VIEW_W / 2 - 150, 540, 0.95, { body: '#ff9ec4', cloth: '#ef4e6b', dir: 1, waving: d.face > 0 });
        drawPig(VIEW_W / 2 + 150, 540, 0.95, { body: '#ffd45e', cloth: '#4aa3df', dir: -1 });
        ctx.fillStyle = '#c85a2a'; ctx.font = 'bold 24px "Comic Sans MS",sans-serif'; ctx.textAlign = 'right'; ctx.fillText('跟对 ' + d.hits + ' / 8', VIEW_W - 40, 100);
      },
      down: function (d, p) {
        for (var i = 0; i < d.items.length; i++) {
          var it = d.items[i];
          if (!it.got && Math.hypot(it.x - p.x, it.y - p.y) < 52) { it.got = true; d.hits++; d.face = 0.5; sfxHi(); }
        }
      }
    },
    // 3 做手工
    {
      name: '和爸爸做手工', hint: '看提示，按顺序点下方的材料（彩纸→胶棒→剪刀…）',
      init: function (d) { d.seq = ['彩纸','胶棒','剪刀','胶棒','彩纸']; d.step = 0; },
      update: function (d) { if (d.step >= 5) d.done = true; },
      draw: function (d) {
        ctx.fillStyle = '#b07d46'; roundRect(120, 150, VIEW_W - 240, 260, 16); ctx.fill();
        ctx.fillStyle = '#c99560'; roundRect(120, 150, VIEW_W - 240, 22, 10); ctx.fill();
        var made = ['📄','📄📄','✂️📄','🎨','🎊'];
        ctx.font = '72px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(made[Math.min(d.step, 4)], VIEW_W / 2, 290);
        drawPig(180, 200, 0.85, { body: '#ffb0b0', cloth: '#7b6cf0', dir: 1, waving: true });
        var opts = [
          { n: '彩纸', e: '📄', c: '#ff8fa8', x: VIEW_W / 2 - 200 },
          { n: '胶棒', e: '🧴', c: '#4aa3df', x: VIEW_W / 2 },
          { n: '剪刀', e: '✂️', c: '#59c38b', x: VIEW_W / 2 + 200 }
        ];
        for (var i = 0; i < opts.length; i++) {
          var o = opts[i];
          ellipse(o.x, 500, 70, 70, o.c);
          ctx.fillStyle = '#fff'; ctx.font = '46px sans-serif'; ctx.fillText(o.e, o.x, 495);
          ctx.font = 'bold 20px "Comic Sans MS",sans-serif'; ctx.fillText(o.n, o.x, 556);
        }
        ctx.fillStyle = '#8a5e34'; ctx.font = 'bold 24px "Comic Sans MS",sans-serif'; ctx.fillText('现在需要：' + (d.seq[d.step] || '完成啦'), VIEW_W / 2, 110);
      },
      down: function (d, p) {
        var opts = [ { n: '彩纸', x: VIEW_W / 2 - 200 }, { n: '胶棒', x: VIEW_W / 2 }, { n: '剪刀', x: VIEW_W / 2 + 200 } ];
        if (p.y < 430 || p.y > 580) return;
        for (var i = 0; i < opts.length; i++) {
          if (Math.abs(p.x - opts[i].x) < 80) {
            if (opts[i].n === d.seq[d.step]) { d.step++; sfxCollect(); }
            else showToast('再看看提示哦~');
            return;
          }
        }
      }
    },
    // 4 烤饼干
    {
      name: '帮妈妈烤饼干', hint: '点 5 种配料放进碗里，烤出香香饼干',
      init: function (d) { d.added = 0; d.ings = [
        { n: '面粉', e: '🌾', c: '#f0e0b0', x: 190 }, { n: '糖', e: '🍬', c: '#ffd1e0', x: 360 },
        { n: '鸡蛋', e: '🥚', c: '#fff3c4', x: 530 }, { n: '黄油', e: '🧈', c: '#ffe08a', x: 700 },
        { n: '巧克力', e: '🍫', c: '#c99a6a', x: 870 }
      ]; },
      update: function (d) { if (d.added >= 5) d.done = true; },
      draw: function (d) {
        ctx.fillStyle = '#edd9b0'; roundRect(100, 140, VIEW_W - 200, 200, 16); ctx.fill();
        for (var i = 0; i < d.ings.length; i++) {
          var g = d.ings[i];
          ellipse(g.x, 230, 62, 62, g.c);
          ctx.font = '44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g.e, g.x, 226);
          ctx.fillStyle = '#7a5a3a'; ctx.font = 'bold 18px "Comic Sans MS",sans-serif'; ctx.fillText(g.n, g.x, 300);
        }
        ellipse(VIEW_W / 2, 450, 110, 60, '#d9d9d9');
        ellipse(VIEW_W / 2, 435, 96, 46, '#fff');
        for (var k = 0; k < d.added; k++) ellipse(VIEW_W / 2 - 60 + k * 28, 430, 14, 12, ['#f0e0b0','#ffd1e0','#fff3c4','#ffe08a','#c99a6a'][k]);
        if (d.added >= 5) { ctx.font = '58px sans-serif'; ctx.fillText('🍪🍪🍪', VIEW_W / 2, 530); }
        else { ctx.fillStyle = '#7a5a3a'; ctx.font = 'bold 22px "Comic Sans MS",sans-serif'; ctx.fillText('已放 ' + d.added + ' / 5 种', VIEW_W / 2, 520); }
      },
      down: function (d, p) {
        if (p.y < 160 || p.y > 320) return;
        for (var i = 0; i < d.ings.length; i++) {
          var g = d.ings[i];
          if (Math.hypot(p.x - g.x, p.y - 230) < 70 && d.ings[i].used !== true) { d.ings[i].used = true; d.added++; sfxCollect(); return; }
        }
      }
    },
    // 5 洗车
    {
      name: '帮爸爸洗车', hint: '手指拖动海绵，把车窗上的污渍擦干净',
      init: function (d) { d.dirt = []; for (var i = 0; i < 7; i++) d.dirt.push({ x: rnd(300, VIEW_W - 300), y: rnd(230, 460), clean: false }); d.sx = VIEW_W / 2; d.sy = 400; },
      update: function (d) { var all = true; for (var i = 0; i < d.dirt.length; i++) if (!d.dirt[i].clean) all = false; if (all) d.done = true; },
      draw: function (d) {
        ctx.fillStyle = '#5aa7e0'; roundRect(VIEW_W / 2 - 260, 240, 520, 200, 30); ctx.fill();
        ctx.fillStyle = '#bfe4ff'; roundRect(VIEW_W / 2 - 220, 260, 440, 150, 20); ctx.fill();
        ellipse(VIEW_W / 2 - 150, 450, 44, 44, '#333'); ellipse(VIEW_W / 2 + 150, 450, 44, 44, '#333');
        for (var i = 0; i < d.dirt.length; i++) {
          var q = d.dirt[i]; if (q.clean) continue;
          ellipse(q.x, q.y, 26, 20, 'rgba(120,90,50,0.75)');
        }
        ellipse(d.sx, d.sy, 30, 22, '#f5d06a');
        ctx.fillStyle = '#7a5a3a'; ctx.font = 'bold 22px "Comic Sans MS",sans-serif'; ctx.textAlign = 'right'; ctx.fillText('擦 ' + d.dirt.filter(function (q) { return q.clean; }).length + ' / 7', VIEW_W - 40, 100);
      },
      down: function (d, p) { d.sx = p.x; d.sy = p.y; washAt(d, p); },
      move: function (d, p) { d.sx = p.x; d.sy = p.y; washAt(d, p); }
    },
    // 6 搭积木
    {
      name: '和乔治搭积木', hint: '点一下放一块积木，搭到 6 层高',
      init: function (d) { d.stack = []; },
      update: function (d) { if (d.stack.length >= 6) d.done = true; },
      draw: function (d) {
        ctx.fillStyle = '#8fd45f'; ctx.fillRect(0, 520, VIEW_W, 120);
        var cols = ['#ff5b8a','#ffd23f','#4aa3df','#59c38b','#c9a7f5','#f08a3c'];
        for (var i = 0; i < d.stack.length; i++) {
          var b = d.stack[i], y = 520 - (i + 1) * 56;
          ctx.fillStyle = cols[i % cols.length]; roundRect(b.x - 55, y, 110, 52, 8); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(b.x - 48, y + 6, 96, 12, 5); ctx.fill();
          ctx.fillStyle = '#333'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), b.x, y + 30);
        }
        drawPig(170, 540, 0.9, { body: '#7fd7c4', cloth: '#f08a3c', dir: 1, waving: true });
        ctx.fillStyle = '#2f7a35'; ctx.font = 'bold 24px "Comic Sans MS",sans-serif'; ctx.textAlign = 'right'; ctx.fillText('高度 ' + d.stack.length + ' / 6', VIEW_W - 40, 100);
      },
      down: function (d, p) {
        if (p.y < 120) return;
        d.stack.push({ x: clamp(p.x, 200, VIEW_W - 200) });
        tone(400 + d.stack.length * 60, 0.1, 'triangle', 0.14);
      }
    },
    // 7 喂小鸡
    {
      name: '帮奶奶喂小鸡', hint: '拖动饲料袋，走到小鸡身边喂它们（5 只）',
      init: function (d) { d.chicks = []; for (var i = 0; i < 5; i++) d.chicks.push({ x: rnd(160, VIEW_W - 160), y: rnd(200, 500), fed: false, bob: rnd(0, 6) }); d.fx = VIEW_W / 2; d.fy = 500; },
      update: function (d) { var all = true; for (var i = 0; i < d.chicks.length; i++) if (!d.chicks[i].fed) all = false; if (all) d.done = true; },
      draw: function (d) {
        for (var i = 0; i < d.chicks.length; i++) {
          var c = d.chicks[i], y = c.y + Math.sin(worldTime * 4 + c.bob) * 4;
          ellipse(c.x, y, 24, 22, '#fff3b0'); ellipse(c.x + 16, y - 12, 10, 10, '#fff3b0');
          ctx.fillStyle = '#f08a3c'; ctx.beginPath(); ctx.moveTo(c.x + 24, y - 12); ctx.lineTo(c.x + 36, y - 9); ctx.lineTo(c.x + 24, y - 6); ctx.fill();
          ellipse(c.x + 6, y - 3, 3, 4, '#333');
          if (c.fed) { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🌾', c.x, y + 20); }
        }
        ctx.fillStyle = '#b07d46'; roundRect(d.fx - 26, d.fy - 20, 52, 50, 8); ctx.fill();
        ctx.fillStyle = '#f0d68a'; ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🌾', d.fx, d.fy + 8);
        ctx.fillStyle = '#2f7a35'; ctx.font = 'bold 24px "Comic Sans MS",sans-serif'; ctx.textAlign = 'right'; ctx.fillText('喂 ' + d.chicks.filter(function (c) { return c.fed; }).length + ' / 5', VIEW_W - 40, 100);
      },
      down: function (d, p) { d.fx = p.x; d.fy = p.y; feedAt(d, p); },
      move: function (d, p) { d.fx = p.x; d.fy = p.y; feedAt(d, p); }
    },
    // 8 钓鱼
    {
      name: '帮爷爷钓鱼', hint: '先点一下甩竿，浮漂下沉时马上再点收线（钓 3 条）',
      init: function (d) { d.phase = 'idle'; d.wait = 0; d.biteT = 0; d.caught = 0; },
      update: function (d, dt) {
        if (d.phase === 'wait') { d.wait -= dt; if (d.wait <= 0) { d.phase = 'bite'; d.biteT = 1.2; } }
        else if (d.phase === 'bite') { d.biteT -= dt; if (d.biteT <= 0) d.phase = 'idle'; }
      },
      draw: function (d) {
        ctx.fillStyle = '#7ec8e3'; ctx.fillRect(0, 330, VIEW_W, VIEW_H - 330);
        ctx.fillStyle = '#5aa7cf'; for (var w = 0; w < 6; w++) { ctx.beginPath(); ctx.ellipse(140 + w * 160, 430, 60, 10, 0, 0, Math.PI * 2); ctx.fill(); }
        var px = 200, py = 300;
        drawPig(px, py, 1.1, { body: '#ffe08a', cloth: '#e0557f', dir: 1 });
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px + 40, py - 60); ctx.lineTo(px + 200, py - 200); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 200, py - 200); ctx.lineTo(px + 200, 420); ctx.stroke();
        var bobY = d.phase === 'bite' ? 440 : 420;
        ctx.fillStyle = '#e74b53'; ctx.beginPath(); ctx.ellipse(px + 200, bobY, 12, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; roundRect(px + 194, bobY - 26, 12, 14, 4); ctx.fill();
        if (d.phase === 'bite') { ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', px + 200, bobY - 50); }
        var tip = d.phase === 'idle' ? '点一下甩竿' : (d.phase === 'wait' ? '等待鱼儿…' : '快！点收线！');
        ctx.fillStyle = '#2f6a8a'; ctx.font = 'bold 26px "Comic Sans MS",sans-serif'; ctx.textAlign = 'right'; ctx.fillText(tip + '  ' + d.caught + '/3', VIEW_W - 40, 100);
      },
      down: function (d) {
        if (d.phase === 'idle') { d.phase = 'wait'; d.wait = rnd(0.8, 2.2); }
        else if (d.phase === 'bite') { d.caught++; d.phase = 'idle'; sfxCollect(); if (d.caught >= 3) d.done = true; }
      }
    },
    // 9 买菜
    {
      name: '和妈妈买菜', hint: '看左边的清单，点右边货架上对应的东西',
      init: function (d) {
        d.need = [ { n: '苹果', e: '🍎' }, { n: '香蕉', e: '🍌' }, { n: '牛奶', e: '🥛' }, { n: '面包', e: '🍞' }, { n: '鸡蛋', e: '🥚' } ];
        d.goods = [ { e: '🍎', k: 0 }, { e: '🍌', k: 1 }, { e: '🥛', k: 2 }, { e: '🍞', k: 3 }, { e: '🥚', k: 4 }, { e: '🍇', k: -1 }, { e: '🧀', k: -1 }, { e: '🍅', k: -1 } ];
        for (var i = d.goods.length - 1; i > 0; i--) { var j = Math.floor(rnd(0, i + 1)), t = d.goods[i]; d.goods[i] = d.goods[j]; d.goods[j] = t; }
        d.got = [false, false, false, false, false];
      },
      update: function (d) { var all = true; for (var i = 0; i < d.got.length; i++) if (!d.got[i]) all = false; if (all) d.done = true; },
      draw: function (d) {
        ctx.fillStyle = '#fff4d6'; roundRect(40, 130, 300, 420, 16); ctx.fill();
        ctx.fillStyle = '#7a5a3a'; ctx.font = 'bold 26px "Comic Sans MS",sans-serif'; ctx.textAlign = 'left'; ctx.fillText('购物清单', 64, 172);
        for (var i = 0; i < d.need.length; i++) {
          var y = 220 + i * 62;
          ctx.fillStyle = d.got[i] ? '#cfe8c0' : '#fff'; roundRect(60, y - 26, 260, 50, 10); ctx.fill();
          ctx.font = '30px sans-serif'; ctx.fillText(d.need[i].e, 74, y + 4);
          ctx.fillStyle = d.got[i] ? '#59a35a' : '#555'; ctx.font = 'bold 22px "Comic Sans MS",sans-serif'; ctx.fillText(d.need[i].n + (d.got[i] ? ' ✓' : ''), 122, y + 4);
        }
        ctx.fillStyle = '#c99560'; roundRect(380, 130, VIEW_W - 420, 420, 16); ctx.fill();
        for (var g = 0; g < d.goods.length; g++) {
          var col = g % 4, row = Math.floor(g / 4), gx = 450 + col * 145, gy = 220 + row * 170;
          ctx.fillStyle = '#fff'; roundRect(gx - 52, gy - 52, 104, 104, 12); ctx.fill();
          ctx.font = '56px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.goods[g].e, gx, gy);
        }
      },
      down: function (d, p) {
        if (p.x < 380) return;
        for (var g = 0; g < d.goods.length; g++) {
          var col = g % 4, row = Math.floor(g / 4), gx = 450 + col * 145, gy = 220 + row * 170;
          if (Math.hypot(p.x - gx, p.y - gy) < 60) {
            var k = d.goods[g].k;
            if (k >= 0 && !d.got[k]) { d.got[k] = true; sfxCollect(); }
            else showToast('清单上不需要这个~');
            return;
          }
        }
      }
    },
    // 10 涂色
    {
      name: '给图画涂色', hint: '先选下面的颜色，再点上面的花朵涂色（涂满 6 块）',
      init: function (d) { d.parts = []; for (var i = 0; i < 6; i++) d.parts.push(null); d.ci = 0; },
      update: function (d) { var all = true; for (var i = 0; i < d.parts.length; i++) if (d.parts[i] === null) all = false; if (all) d.done = true; },
      draw: function (d) {
        var cx = VIEW_W / 2, cy = 300, cols = ['#ff5b8a','#ffd23f','#4aa3df','#59c38b','#c9a7f5','#f08a3c'];
        var petals = [[0,-110],[95,-55],[95,55],[0,110],[-95,55],[-95,-55]];
        for (var i = 0; i < 6; i++) {
          var px = cx + petals[i][0], py = cy + petals[i][1];
          ellipse(px, py, 58, 58, d.parts[i] === null ? '#fff' : cols[d.parts[i]]);
          ctx.strokeStyle = '#ccc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 58, 0, Math.PI * 2); ctx.stroke();
        }
        ellipse(cx, cy, 52, 52, '#ffd23f');
        ctx.fillStyle = '#7a5a3a'; ctx.font = 'bold 24px "Comic Sans MS",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('调色板', cx, 460);
        for (var k = 0; k < 6; k++) {
          var bx = cx - 200 + k * 80;
          ellipse(bx, 510, 32, 32, cols[k]);
          if (k === d.ci) { ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, 510, 38, 0, Math.PI * 2); ctx.stroke(); }
        }
      },
      down: function (d, p) {
        var cx = VIEW_W / 2, cy = 300;
        if (p.y > 470 && p.y < 550) {
          var k = Math.round((p.x - (cx - 200)) / 80);
          if (k >= 0 && k < 6) d.ci = k;
          return;
        }
        var petals = [[0,-110],[95,-55],[95,55],[0,110],[-95,55],[-95,-55]];
        for (var i = 0; i < 6; i++) {
          if (Math.hypot(p.x - (cx + petals[i][0]), p.y - (cy + petals[i][1])) < 58) { d.parts[i] = d.ci; sfxCollect(); return; }
        }
      }
    },
    // 11 收拾玩具
    {
      name: '收拾玩具', hint: '把玩具拖到对应的箱子里（球 ⚽ / 积木 🧱 / 书 📚）',
      init: function (d) {
        d.boxes = [ { n: '球', e: '⚽', c: '#4aa3df', x: 200 }, { n: '积木', e: '🧱', c: '#ff8fa8', x: VIEW_W / 2 }, { n: '书', e: '📚', c: '#59c38b', x: VIEW_W - 200 } ];
        d.toys = [];
        var emos = ['⚽','🧱','📚'];
        for (var i = 0; i < 6; i++) d.toys.push({ type: i % 3, e: emos[i % 3], x: rnd(160, VIEW_W - 160), y: rnd(200, 420), put: false });
        d.drag = null;
      },
      update: function (d) { var all = true; for (var i = 0; i < d.toys.length; i++) if (!d.toys[i].put) all = false; if (all) d.done = true; },
      draw: function (d) {
        ctx.fillStyle = '#b07d46'; roundRect(60, 140, VIEW_W - 120, 120, 12); ctx.fill();
        for (var b = 0; b < d.boxes.length; b++) {
          var box = d.boxes[b];
          ctx.fillStyle = box.c; roundRect(box.x - 80, 470, 160, 110, 12); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(box.e, box.x, 515);
          ctx.font = 'bold 18px "Comic Sans MS",sans-serif'; ctx.fillText(box.n, box.x, 558);
        }
        for (var i = 0; i < d.toys.length; i++) {
          var t = d.toys[i]; if (t.put) continue;
          ctx.font = '46px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.e, t.x, t.y);
        }
        var doneN = d.toys.filter(function (t) { return t.put; }).length;
        ctx.fillStyle = '#7a5a3a'; ctx.font = 'bold 24px "Comic Sans MS",sans-serif'; ctx.textAlign = 'right'; ctx.fillText('收好 ' + doneN + ' / 6', VIEW_W - 40, 100);
      },
      down: function (d, p) {
        for (var i = 0; i < d.toys.length; i++) {
          var t = d.toys[i];
          if (!t.put && Math.hypot(t.x - p.x, t.y - p.y) < 48) { d.drag = t; t.x = p.x; t.y = p.y; return; }
        }
      },
      move: function (d, p) { if (d.drag) { d.drag.x = p.x; d.drag.y = p.y; } },
      up: function (d, p) {
        if (!d.drag) return;
        var t = d.drag;
        for (var b = 0; b < d.boxes.length; b++) {
          if (Math.hypot(d.boxes[b].x - t.x, 525 - t.y) < 100) {
            if (b === t.type) { t.put = true; sfxCollect(); }
            else showToast('放到对应的箱子哦~');
            break;
          }
        }
        d.drag = null;
      }
    }
  ];

  // 小游戏内的共享命中逻辑
  var MOW_CW = 100, MOW_CH = 84, MOW_OX = (VIEW_W - 9 * MOW_CW) / 2, MOW_OY = 130;
  function mowAt(d, p) {
    var c = Math.floor((p.x - MOW_OX) / MOW_CW), r = Math.floor((p.y - MOW_OY) / MOW_CH);
    for (var i = 0; i < d.cells.length; i++) {
      var cell = d.cells[i];
      if (cell.c === c && cell.r === r && !cell.cut) { cell.cut = true; d.count++; tone(500, 0.05, 'square', 0.05); }
    }
  }
  function washAt(d, p) {
    for (var i = 0; i < d.dirt.length; i++) if (!d.dirt[i].clean && Math.hypot(d.dirt[i].x - p.x, d.dirt[i].y - p.y) < 40) { d.dirt[i].clean = true; tone(700, 0.06, 'sine', 0.08); }
  }
  function feedAt(d, p) {
    for (var i = 0; i < d.chicks.length; i++) if (!d.chicks[i].fed && Math.hypot(d.chicks[i].x - p.x, d.chicks[i].y - p.y) < 56) { d.chicks[i].fed = true; sfxCollect(); }
  }

  // ---------- 绘制工具 ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }
  function ellipse(x, y, rx, ry, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill();
  }
  function drawPig(x, y, s, opt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (opt.dir || 1), s);
    var body = opt.body || '#ff9ec4', cloth = opt.cloth || '#ef4e6b';
    var bob = (opt.jumpY || 0) - (opt.mudDip || 0) * 30;
    var walking = opt.walking || false, ph = opt.walk || 0;
    ctx.save(); ctx.globalAlpha = 0.18; ellipse(0, 2, 40, 12, '#1b4a2a'); ctx.restore();
    ctx.translate(0, -bob);
    var legSw = walking ? Math.sin(ph) * 9 : 0;
    ctx.fillStyle = body;
    roundRect(-24 + legSw, -26, 18, 30, 9); ctx.fill();
    roundRect(6 - legSw, -26, 18, 30, 9); ctx.fill();
    ellipse(-15 + legSw, 2, 11, 6, '#5a3a2a'); ellipse(15 - legSw, 2, 11, 6, '#5a3a2a');
    ellipse(0, -60, 36, 44, body);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0,-58,37,45,0,0,Math.PI*2); ctx.clip();
    ctx.fillStyle = cloth; ctx.fillRect(-40,-78,80,34); ctx.restore();
    var armSw = opt.waving ? Math.sin(worldTime*18)*0.9-0.6 : (walking ? Math.sin(ph)*0.35 : 0.1);
    ctx.save(); ctx.translate(-32,-70); ctx.rotate(-0.3-armSw); ellipse(0,12,9,16,body); ctx.restore();
    ctx.save(); ctx.translate(32,-70); ctx.rotate(0.3+armSw); ellipse(0,12,9,16,body); ctx.restore();
    var hy = -120;
    ellipse(0, hy, 46, 42, body);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-40,hy-26); ctx.lineTo(-30,hy-62); ctx.lineTo(-8,hy-34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(40,hy-26); ctx.lineTo(30,hy-62); ctx.lineTo(8,hy-34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.moveTo(-35,hy-30); ctx.lineTo(-30,hy-54); ctx.lineTo(-16,hy-36); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(35,hy-30); ctx.lineTo(30,hy-54); ctx.lineTo(16,hy-36); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.5; ellipse(-30,hy+6,9,6,'#ff5b8a'); ellipse(30,hy+6,9,6,'#ff5b8a'); ctx.globalAlpha = 1;
    var blink = opt.blink > 0;
    ctx.fillStyle = '#fff';
    if (blink) {
      ctx.strokeStyle='#333'; ctx.lineWidth=3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(-20,hy-4); ctx.lineTo(-11,hy-4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(11,hy-4); ctx.lineTo(20,hy-4); ctx.stroke();
    } else {
      ellipse(-15,hy-4,8,10,'#fff'); ellipse(15,hy-4,8,10,'#fff');
      ellipse(-13,hy-2,4.5,6,'#2b2b2b'); ellipse(17,hy-2,4.5,6,'#2b2b2b');
      ellipse(-14.5,hy-5,1.6,2,'#fff'); ellipse(15.5,hy-5,1.6,2,'#fff');
    }
    ellipse(0,hy+16,22,16,'#ff7eae');
    ellipse(-8,hy+16,4,6,'#e05286'); ellipse(8,hy+16,4,6,'#e05286');
    ctx.strokeStyle='#c8406a'; ctx.lineWidth=2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(0,hy+24,9,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
    ctx.restore();
  }
  function drawApple(x,y,bob){ ctx.save(); ctx.translate(x,y+Math.sin(worldTime*3+bob)*5);
    ellipse(0,6,3,7,'rgba(0,0,0,0.12)'); ellipse(-8,0,11,12,'#e74b53'); ellipse(8,0,11,12,'#e74b53');
    ctx.fillStyle='#e74b53'; ctx.beginPath(); ctx.ellipse(0,0,13,12,0,0,Math.PI*2); ctx.fill();
    ellipse(-4,-4,3.5,6,'rgba(255,255,255,0.6)');
    ctx.strokeStyle='#6b4a2a'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(2,-20); ctx.stroke();
    ctx.fillStyle='#59c38b'; ctx.beginPath(); ctx.ellipse(8,-17,8,4,-0.5,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  function starShape(r1,r2){ ctx.beginPath(); for(var i=0;i<10;i++){ var r=i%2===0?r1:r2, a=-Math.PI/2+i*Math.PI/5, px=Math.cos(a)*r, py=Math.sin(a)*r; if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);} ctx.closePath(); }
  function drawStar(x,y,bob){ ctx.save(); ctx.translate(x,y+Math.sin(worldTime*3+bob)*6); ctx.rotate(Math.sin(worldTime*2+bob)*0.2);
    ctx.shadowColor='rgba(255,210,63,0.7)'; ctx.shadowBlur=18; starShape(20,9); ctx.fillStyle='#ffd23f'; ctx.fill();
    ctx.shadowBlur=0; starShape(12,5.5); ctx.fillStyle='#ffe98a'; ctx.fill(); ctx.restore(); }
  function drawBalloon(x,y,bob,hue){ ctx.save(); ctx.translate(x,y+Math.sin(worldTime*2+bob)*8); var col='hsl('+hue+',75%,62%)';
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(0,22); ctx.quadraticCurveTo(8,55,0,80); ctx.stroke();
    ellipse(0,0,20,25,col); ellipse(-7,-8,5,8,'rgba(255,255,255,0.5)');
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(-5,22); ctx.lineTo(5,22); ctx.lineTo(0,30); ctx.closePath(); ctx.fill(); ctx.restore(); }
  function drawTree(x,y,s){ ctx.save(); ctx.translate(x,y); ctx.scale(s,s); ellipse(0,0,46,14,'rgba(0,0,0,0.10)');
    ctx.fillStyle='#8b5a2b'; roundRect(-10,-70,20,72,8); ctx.fill();
    ellipse(-22,-92,30,30,'#4fa85a'); ellipse(22,-92,30,30,'#57b463'); ellipse(0,-112,38,36,'#5fbf6c'); ellipse(-10,-118,16,14,'#79cf82'); ctx.restore(); }
  function drawFlower(x,y,hue,s){ ctx.save(); ctx.translate(x,y); ctx.scale(s,s); ctx.strokeStyle='#4a9e57'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-14); ctx.stroke(); var col='hsl('+hue+',80%,65%)';
    for(var i=0;i<5;i++){var a=i*Math.PI*2/5; ellipse(Math.cos(a)*6,-14+Math.sin(a)*6,5,5,col);} ellipse(0,-14,4,4,'#ffd23f'); ctx.restore(); }
  function drawCloud(x,y,s){ ctx.save(); ctx.translate(x,y); ctx.scale(s,s); ctx.globalAlpha=0.9;
    ellipse(0,0,46,22,'#fff'); ellipse(-30,8,28,18,'#fff'); ellipse(32,8,30,18,'#fff'); ellipse(-8,-14,26,20,'#fff'); ellipse(18,-10,24,18,'#fff'); ctx.restore(); }
  function drawButterfly(x,y,t,hue){ ctx.save(); ctx.translate(x,y); var flap=Math.abs(Math.sin(t*8))*0.5+0.25; ctx.scale(1,flap); var col='hsl('+hue+',80%,65%)';
    ellipse(-7,0,8,10,col); ellipse(7,0,8,10,col); ellipse(-6,6,5,6,col); ellipse(6,6,5,6,col); ctx.scale(1,1/flap);
    ellipse(0,1,2,7,'#5a4a3a'); ctx.strokeStyle='#5a4a3a'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,-5); ctx.quadraticCurveTo(-4,-10,-7,-9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-5); ctx.quadraticCurveTo(4,-10,7,-9); ctx.stroke(); ctx.restore(); }
  function drawMud(x,y,m){ ctx.save(); ctx.translate(x,y); ellipse(0,8,m.r+8,16,'rgba(60,40,20,0.18)');
    ellipse(0,0,m.r,m.r*0.62,'#8a5e34'); ellipse(0,-3,m.r-8,m.r*0.5,'#6f4926');
    ellipse(-m.r*0.35,-3,8,4,'rgba(255,255,255,0.15)'); ellipse(m.r*0.3,5,6,3,'#5c3b1e');
    if(m.splash>0){ ctx.globalAlpha=m.splash; ellipse(0,-6,m.r*0.5,m.r*0.25,'#a8794c'); ctx.globalAlpha=1; }
    for(var i=0;i<3;i++){var bx=Math.sin(worldTime*2+i*2)*m.r*0.5, by=-8-Math.abs(Math.sin(worldTime*3+i))*10; ellipse(bx,by,4,4,'#a8794c');}
    ctx.restore(); }
  function drawHouse(x,y){ ctx.save(); ctx.translate(x,y); var w=300,h=250;
    ellipse(0,h-4,w*0.6,22,'rgba(0,0,0,0.14)');
    ctx.fillStyle='#ffa1c3'; roundRect(-w/2,-20,w,h,14); ctx.fill();
    ctx.fillStyle='#ef5b8b'; ctx.beginPath(); ctx.moveTo(-w/2-20,-20); ctx.lineTo(0,-130); ctx.lineTo(w/2+20,-20); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff7aa8'; ctx.beginPath(); ctx.moveTo(-w/2-20,-20); ctx.lineTo(0,-130); ctx.lineTo(0,-100); ctx.lineTo(-w/2+40,-20); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#f2e3d0'; roundRect(w*0.28,-110,34,60,4); ctx.fill();
    ctx.fillStyle='#a8703f'; roundRect(-32,h-102,64,82,8); ctx.fill();
    ellipse(18,h-62,5,5,'#ffd23f');
    var win=function(wx,wy){ ctx.fillStyle='#fff'; roundRect(wx-38,wy-34,76,68,8); ctx.fill(); ctx.fillStyle='#8ed6ff'; roundRect(wx-33,wy-29,66,58,6); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(wx,wy-29); ctx.lineTo(wx,wy+29); ctx.moveTo(wx-33,wy); ctx.lineTo(wx+33,wy); ctx.stroke(); };
    win(-95,40); win(95,40);
    ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,-130); ctx.lineTo(0,-168); ctx.stroke();
    ctx.fillStyle='#ffd23f'; ctx.beginPath(); ctx.moveTo(0,-168); ctx.lineTo(34,-158); ctx.lineTo(0,-148); ctx.closePath(); ctx.fill();
    ctx.restore(); }
  function drawCar(x,y,dir,hue,moving){ ctx.save(); ctx.translate(x,y); ctx.scale(dir,1);
    ellipse(0,10,58,14,'rgba(0,0,0,0.16)');
    var col='hsl('+hue+',70%,60%)';
    ctx.fillStyle=col; roundRect(-58,-30,116,46,14); ctx.fill();
    ctx.fillStyle='hsl('+hue+',70%,72%)'; roundRect(-30,-58,64,34,12); ctx.fill();
    ctx.fillStyle='#8ed6ff'; roundRect(-24,-53,24,24,6); ctx.fill(); roundRect(6,-53,24,24,6); ctx.fill();
    ctx.fillStyle='#fff'; ellipse(42,-6,9,9,'#fff'); ellipse(-42,-6,9,9,'#fff');
    ctx.fillStyle='#ffd23f'; roundRect(52,-22,12,8,3); ctx.fill(); roundRect(-64,-22,12,8,3); ctx.fill();
    if(moving){ var wob=Math.sin(worldTime*20)*3; ctx.globalAlpha=0.3; ellipse(-62,8,10,6,'#ccc'); ellipse(-72+wob,8,8,5,'#ccc'); }
    ctx.restore(); }
  function drawPicnic(x,y){ ctx.save(); ctx.translate(x,y);
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(0,0,150,90,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; roundRect(-90,-10,180,90,10); ctx.fill();
    ctx.fillStyle='#ff8fa8'; for(var i=0;i<5;i++) ctx.fillRect(-90, -10+i*18,180,9);
    ctx.fillStyle='#b07d46'; roundRect(-70,-40,46,34,8); ctx.fill(); ctx.strokeStyle='#8a5e34'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(-47,-40,16,Math.PI,0); ctx.stroke();
    ellipse(40,10,12,12,'#e74b53'); ellipse(62,12,12,12,'#ffd23f'); ellipse(50,-8,10,10,'#8b5ae0');
    ctx.fillStyle='#7a5a3a'; ctx.font='bold 20px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.fillText('野餐地点 🧺',0,-60); ctx.restore(); }
  function drawGarden(x,y){ ctx.save(); ctx.translate(x,y);
    ellipse(0,20,110,26,'rgba(0,0,0,0.14)');
    var cols=['#ff5b8a','#ff9f43','#ffd23f','#59c38b','#4aa3df','#c9a7f5'];
    for(var i=0;i<6;i++){ctx.strokeStyle=cols[i];ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,40,96-i*13,Math.PI,0);ctx.stroke();}
    ctx.fillStyle='#fff'; roundRect(-86,36,172,52,12); ctx.fill();
    ctx.fillStyle='#ef4e6b'; ctx.font='bold 22px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('家庭乐园',0,62);
    ctx.fillStyle='#ffd23f'; ctx.font='30px sans-serif'; ctx.fillText('🎪',0,-70);
    ctx.restore(); }

  function drawGround(){ var g=ctx.createLinearGradient(0,0,0,VIEW_H); g.addColorStop(0,'#a8e06a'); g.addColorStop(1,'#7cc85a'); ctx.fillStyle=g; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=2; var step=80, ox=-(cam.x%step), oy=-(cam.y%step);
    for(var x=ox;x<VIEW_W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,VIEW_H);ctx.stroke();}
    for(var y=oy;y<VIEW_H;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(VIEW_W,y);ctx.stroke();} }
  function drawSun(){ ctx.save(); ctx.translate(VIEW_W-90,80); ctx.shadowColor='rgba(255,220,80,0.8)'; ctx.shadowBlur=30; ellipse(0,0,34,34,'#ffd93b'); ctx.shadowBlur=0;
    ctx.strokeStyle='#ffd93b'; ctx.lineWidth=5; ctx.lineCap='round'; for(var i=0;i<8;i++){var a=i*Math.PI/4; ctx.beginPath(); ctx.moveTo(Math.cos(a)*44,Math.sin(a)*44); ctx.lineTo(Math.cos(a)*56,Math.sin(a)*56); ctx.stroke();}
    ellipse(-10,-8,4,5,'#3a3a3a'); ellipse(10,-8,4,5,'#3a3a3a'); ctx.strokeStyle='#3a3a3a'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(0,2,12,0.2,Math.PI-0.2); ctx.stroke(); ctx.restore(); }
  function worldToScreen(x,y){ return {x:x-cam.x,y:y-cam.y}; }
  function onScreen(p){ return p.x>-160 && p.x<VIEW_W+160 && p.y>-160 && p.y<VIEW_H+160; }
  function drawBubble(x,y,text){ ctx.save(); ctx.font='bold 18px "Comic Sans MS",sans-serif'; var w=ctx.measureText(text).width+28;
    ctx.globalAlpha=0.95; ctx.fillStyle='#fff'; roundRect(x-w/2,y-20,w,36,18); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(x-8,y+14); ctx.lineTo(x,y+26); ctx.lineTo(x+8,y+14); ctx.fill();
    ctx.fillStyle='#e8557f'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,x,y-1); ctx.restore(); }

  function drawScene(){
    ctx.setTransform(scale,0,0,scale,offsetX,offsetY);
    ctx.clearRect(0,0,VIEW_W,VIEW_H);
    drawGround(); drawSun();
    var i,o,sp;
    for(i=0;i<clouds.length;i++){var cc=clouds[i], sc=worldToScreen(cc.x,cc.y); if(onScreen(sc)){ctx.save();ctx.globalAlpha=0.55;drawCloud(sc.x,sc.y,cc.s);ctx.restore();}}
    sp=worldToScreen(picnic.x,picnic.y); if(onScreen(sp)) drawPicnic(sp.x,sp.y);
    for(i=0;i<apples.length;i++){o=apples[i];if(o.got)continue;sp=worldToScreen(o.x,o.y);if(onScreen(sp))drawApple(sp.x,sp.y,o.bob);}
    for(i=0;i<stars.length;i++){o=stars[i];if(o.got)continue;sp=worldToScreen(o.x,o.y);if(onScreen(sp))drawStar(sp.x,sp.y,o.bob);}
    var d=[];
    for(i=0;i<trees.length;i++)d.push({y:trees[i].y,t:'tree',o:trees[i]});
    for(i=0;i<muds.length;i++)d.push({y:muds[i].y,t:'mud',o:muds[i]});
    for(i=0;i<cars.length;i++)d.push({y:cars[i].y,t:'car',o:cars[i]});
    d.push({y:garden.y+40,t:'garden',o:garden});
    d.push({y:house.y+house.h-20,t:'house',o:house});
    for(i=0;i<friends.length;i++)d.push({y:friends[i].y,t:'friend',o:friends[i]});
    for(i=0;i<flowers.length;i++)d.push({y:flowers[i].y,t:'flower',o:flowers[i]});
    d.push({y:player.y,t:'player',o:player});
    d.sort(function(a,b){return a.y-b.y;});
    for(i=0;i<d.length;i++){
      var e=d[i]; sp=worldToScreen(e.o.x, e.o.y);
      if(e.t==='house') sp=worldToScreen(house.x, house.y);
      if(!onScreen(sp) && e.t!=='house' && e.t!=='garden')continue;
      if(e.t==='tree')drawTree(sp.x,sp.y,e.o.s);
      else if(e.t==='flower')drawFlower(sp.x,sp.y,e.o.hue,e.o.s);
      else if(e.t==='garden')drawGarden(sp.x,sp.y);
      else if(e.t==='mud'){var ms=worldToScreen(e.o.x,e.o.y);if(onScreen(ms)){e.o.splash=Math.max(0,e.o.splash-0.016);drawMud(ms.x,ms.y,e.o);}}
      else if(e.t==='car'){var cs=worldToScreen(e.o.x,e.o.y);if(onScreen(cs))drawCar(cs.x,cs.y,e.o.dir,e.o.hue,e.o.speed);}
      else if(e.t==='house'){if(sp.x>-350&&sp.x<VIEW_W+350)drawHouse(sp.x,sp.y);}
      else if(e.t==='friend'){
        drawPig(sp.x,sp.y,0.92,{body:e.o.body,cloth:e.o.cloth,dir:e.o.dir,walk:e.o.walk,walking:true,blink:e.o.blink,waving:e.o.waveT>0});
        if(e.o.talked>0)drawBubble(sp.x,sp.y-150,['你好呀!','一起玩!','嘿嘿~'][i%3]);
      } else {
        if(player.mode==='drive'&&player.car) drawCar(sp.x,sp.y,player.car.dir,player.car.hue,Math.hypot(player.vx,player.vy)>10);
        else drawPig(sp.x,sp.y,1,{body:player.body,cloth:player.cloth,dir:player.dir,walk:player.walk,walking:Math.hypot(player.vx,player.vy)>10,blink:player.blink,jumpY:player.jumpY,mudDip:player.mudDip,waving:player.waveT>0});
      }
    }
    for(i=0;i<balloons.length;i++){o=balloons[i];if(o.got)continue;sp=worldToScreen(o.x,o.y);if(onScreen(sp))drawBalloon(sp.x,sp.y,o.bob,o.hue);}
    for(i=0;i<butterflies.length;i++){var bf=butterflies[i];var bx=bf.x+Math.sin(worldTime*bf.sp)*40,by=bf.y+Math.cos(worldTime*bf.sp*0.8)*30;sp=worldToScreen(bx,by);if(onScreen(sp))drawButterfly(sp.x,sp.y,worldTime+bf.t,bf.hue);}
    drawWorldParticles();
    drawHUD();
    if(paused)drawPause();
  }
  function drawWorldParticles(){ var i,sp;
    for(i=0;i<particles.length;i++){var pt=particles[i];if(pt.screen)continue;sp=worldToScreen(pt.x,pt.y);ctx.save();ctx.globalAlpha=Math.min(1,pt.life);
      if(pt.heart){ctx.fillStyle=pt.color;ctx.font='20px sans-serif';ctx.fillText('♥',sp.x-6,sp.y);}else ellipse(sp.x,sp.y,pt.r,pt.r,pt.color);ctx.restore();}
    for(i=0;i<floaters.length;i++){var fl=floaters[i];sp=worldToScreen(fl.x,fl.y);ctx.save();ctx.globalAlpha=Math.min(1,fl.life);
      ctx.font='bold 26px "Comic Sans MS",sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(fl.text,sp.x+1,sp.y+1);ctx.fillStyle=fl.color;ctx.fillText(fl.text,sp.x,sp.y);ctx.restore();}
    if(toast)drawToast();
  }
  function drawToast(){ ctx.save(); var alpha=Math.min(1,toast.life); ctx.globalAlpha=alpha;
    ctx.font='bold 26px "Comic Sans MS",sans-serif'; var w=ctx.measureText(toast.text).width+50;
    ctx.fillStyle='rgba(0,0,0,0.55)'; roundRect(VIEW_W/2-w/2,110,w,52,26); ctx.fill();
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(toast.text,VIEW_W/2,137); ctx.restore(); }
  function drawActionBtn(b,color){ if(!b.show)return; ctx.save();
    ctx.globalAlpha=b.pressed?0.95:0.8;
    ellipse(b.x,b.y+4,b.r+3,b.r+3,'rgba(0,0,0,0.18)'); ellipse(b.x,b.y,b.r,b.r,color);
    ctx.globalAlpha=1; ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r-4,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='bold '+(b.label.length>2?20:26)+'px "Comic Sans MS",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b.label,b.x,b.y+1); ctx.restore(); }

  function drawHUD(){
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.92)'; roundRect(20,18,250,58,20); ctx.fill();
    ellipse(56,47,12,13,'#e74b53'); ctx.fillStyle='#59c38b'; ctx.beginPath(); ctx.ellipse(62,33,7,3.5,-0.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3b3b3b'; ctx.font='bold 26px "Comic Sans MS",sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(score+' / '+goal,84,48);
    var tasks=[{k:'mud',t:'泥坑跳跳'},{k:'party',t:'生日聚会'},{k:'drive',t:'开车郊游'}];
    ctx.font='bold 15px "Comic Sans MS",sans-serif'; ctx.textAlign='left';
    for(var i=0;i<tasks.length;i++){
      var y=92+i*24, done=ach[tasks[i].k];
      ctx.fillStyle='rgba(255,255,255,0.8)'; roundRect(20,y-13,150,22,11); ctx.fill();
      ctx.fillStyle=done?'#59c38b':'#bbb'; ctx.beginPath(); ctx.arc(36,y-2,9,0,Math.PI*2); ctx.fill();
      if(done){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(32,y-2);ctx.lineTo(35,y+2);ctx.lineTo(41,y-6);ctx.stroke();}
      ctx.fillStyle=done?'#4a9e57':'#888'; ctx.fillText(tasks[i].t,52,y-2);
    }
    var miniDoneN = completed.filter(Boolean).length;
    ctx.fillStyle='rgba(255,255,255,0.8)'; roundRect(20,164,196,22,11); ctx.fill();
    ctx.fillStyle='#ff9f43'; ctx.font='15px "Comic Sans MS",sans-serif'; ctx.fillText('🎪 家庭游戏 '+miniDoneN+' / 12',28,175);
    ctx.fillStyle='rgba(255,255,255,0.92)'; roundRect(VIEW_W/2-66,18,132,44,20); ctx.fill();
    ctx.fillStyle=timeLeft<25?'#e74b53':'#3b3b3b'; ctx.font='bold 23px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.fillText('⏱ '+Math.ceil(timeLeft)+'s',VIEW_W/2,41);
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(VIEW_W-44,44,26,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4a90d9'; ctx.fillRect(VIEW_W-52,34,6,20); ctx.fillRect(VIEW_W-42,34,6,20);
    ctx.beginPath(); ctx.arc(VIEW_W-118,44,24,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=musicOn?'#59c38b':'#aaa'; ctx.font='22px sans-serif'; ctx.fillText(musicOn?'♪':'✕',VIEW_W-118,47);
    if(stick.active){ctx.globalAlpha=0.32;ellipse(stick.cx,stick.cy,stick.r,stick.r,'#fff');ctx.globalAlpha=0.6;ellipse(stick.cx+stick.kx,stick.cy+stick.ky,30,30,'#4a90d9');ctx.globalAlpha=1;}
    else{ctx.globalAlpha=0.22;ellipse(VIEW_W*0.18,VIEW_H-110,stick.r,stick.r,'#fff');ctx.globalAlpha=0.35;ellipse(VIEW_W*0.18,VIEW_H-110,26,26,'#4a90d9');ctx.globalAlpha=1;
      ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='15px "Comic Sans MS",sans-serif';ctx.textAlign='center';ctx.fillText('移动',VIEW_W*0.18,VIEW_H-110+5);}
    var a=nearestAction();
    btnAct.show=!!a; if(a)btnAct.label=a.label;
    drawActionBtn(btnJump,'#ef6a8b'); drawActionBtn(btnWave,'#4a90d9'); drawActionBtn(btnAct,'#ffb23f');
    if(a && a.type==='garden'){ ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='bold 16px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.fillText('12 个小游戏', btnAct.x, btnAct.y + btnAct.r + 20); }
    ctx.restore();
  }

  // ---------- 生日聚会场景 ----------
  function drawParty(){
    ctx.setTransform(scale,0,0,scale,offsetX,offsetY);
    ctx.clearRect(0,0,VIEW_W,VIEW_H);
    var g=ctx.createLinearGradient(0,0,0,VIEW_H); g.addColorStop(0,'#ffe3ef'); g.addColorStop(1,'#ffd0e2'); ctx.fillStyle=g; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.fillStyle='#f5b8cf'; ctx.fillRect(0,VIEW_H-170,VIEW_W,170);
    ctx.fillStyle='#e8a7c2'; ctx.fillRect(0,VIEW_H-176,VIEW_W,12);
    var flags=['#ff5b8a','#ffd23f','#4aa3df','#59c38b','#c9a7f5'];
    ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,40); ctx.quadraticCurveTo(VIEW_W/2,140,VIEW_W,40); ctx.stroke();
    for(var i=0;i<15;i++){var t=(i+0.5)/15, fx=t*VIEW_W, fy=40+Math.sin(Math.PI*t)*85;
      ctx.fillStyle=flags[i%5]; ctx.beginPath(); ctx.moveTo(fx-14,fy); ctx.lineTo(fx+14,fy); ctx.lineTo(fx,fy+28); ctx.closePath(); ctx.fill();}
    ctx.fillStyle='#fff'; roundRect(VIEW_W/2-200,70,400,72,20); ctx.fill();
    ctx.strokeStyle='#ff8fb1'; ctx.lineWidth=6; roundRect(VIEW_W/2-200,70,400,72,20); ctx.stroke();
    ctx.fillStyle='#ef4e6b'; ctx.font='bold 44px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('生日快乐!',VIEW_W/2,107);
    ctx.fillStyle='#b07d46'; roundRect(VIEW_W/2-320,VIEW_H-250,640,80,16); ctx.fill();
    ctx.fillStyle='#c99560'; roundRect(VIEW_W/2-320,VIEW_H-258,640,24,10); ctx.fill();
    var cx=VIEW_W/2, cy=VIEW_H-300;
    ellipse(cx,cy+34,110,20,'rgba(0,0,0,0.12)');
    ctx.fillStyle='#ffd9e8'; roundRect(cx-90,cy-30,180,66,14); ctx.fill();
    ctx.fillStyle='#fff0f6'; roundRect(cx-90,cy-44,180,24,12); ctx.fill();
    ctx.fillStyle='#fff'; for(var d=0;d<6;d++) ellipse(cx-78+d*31,cy-30,12,14,'#fff');
    for(var c=0;c<5;c++){var lx=cx-60+c*30, ly=cy-88;
      ctx.fillStyle=['#ff5b8a','#ffd23f','#4aa3df','#59c38b','#c9a7f5'][c]; roundRect(lx-4,ly,8,44,3); ctx.fill();
      if(!candlesBlown){ctx.fillStyle='#ffb400';ctx.beginPath();ctx.ellipse(lx,ly-8,5,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffe98a';ctx.beginPath();ctx.ellipse(lx,ly-6,2.5,5,0,0,Math.PI*2);ctx.fill();}
      else{ctx.strokeStyle='#999';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(lx-3,ly-1);ctx.lineTo(lx+3,ly-1);ctx.stroke();}
    }
    var seatX=[cx-300,cx-200,cx+200,cx+300];
    for(var k=0;k<4;k++){var pal=[[255,158,196],[255,212,94],[201,167,245],[127,215,196]][k];
      drawPig(seatX[k],VIEW_H-180,0.85,{body:'rgb('+pal.join(',')+')',cloth:['#ef4e6b','#4aa3df','#59c38b','#f08a3c'][k],dir:k<2?1:-1,walk:worldTime*3,walking:false,waving:candlesBlown});}
    for(var gft=0;gft<3;gft++){var gx=cx-260+gft*40,gy=VIEW_H-250;
      ctx.fillStyle=['#4aa3df','#59c38b','#c9a7f5'][gft]; roundRect(gx-18,gy-34,36,34,4); ctx.fill();
      ctx.fillStyle='#ffd23f'; ctx.fillRect(gx-4,gy-34,8,34); ctx.fillRect(gx-18,gy-20,36,8);}
    for(var p=0;p<particles.length;p++){var pt=particles[p];if(!pt.screen)continue;ctx.save();ctx.globalAlpha=Math.min(1,pt.life);ellipse(pt.x,pt.y,pt.r,pt.r,pt.color);ctx.restore();}
    btnAct.show=true; btnAct.label=candlesBlown?'再吹一次':'吹蜡烛';
    drawActionBtn(btnAct,'#ff5b8a');
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(btnExit.x,btnExit.y,btnExit.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#4a90d9'; ctx.font='bold 20px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('出屋',btnExit.x,btnExit.y+1);
    if(toast)drawToast();
    ctx.restore();
  }

  // ---------- 家庭乐园菜单 ----------
  function drawCourtyard(){
    ctx.setTransform(scale,0,0,scale,offsetX,offsetY);
    ctx.clearRect(0,0,VIEW_W,VIEW_H);
    var g=ctx.createLinearGradient(0,0,0,VIEW_H); g.addColorStop(0,'#fff0c9'); g.addColorStop(1,'#ffd9e8'); ctx.fillStyle=g; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.fillStyle='#ef4e6b'; ctx.font='bold 42px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🎪 家庭乐园 · 12 个小游戏',VIEW_W/2,54);
    var emos=['🚜','🍓','📺','✂️','🍪','🚗','🧱','🐥','🎣','🛒','🎨','🧸'];
    var cols4=['#59c38b','#ef6a8b','#4a90d9','#ff9f43','#c9a7f5','#e0557f','#3f8fd0','#f0b429','#39b3a0','#e07c3c','#8b5ae0','#59a35a'];
    var cols=4, gx=60, gy=130, cw=218, ch=148, gap=12;
    for(var i=0;i<12;i++){
      var c=i%cols, r=Math.floor(i/cols), x=gx+c*(cw+gap), y=gy+r*(ch+gap);
      ctx.fillStyle='rgba(255,255,255,0.92)'; roundRect(x,y,cw,ch,16); ctx.fill();
      ctx.fillStyle=cols4[i]; roundRect(x,y,cw,42,16); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 19px "Comic Sans MS",sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText((i+1)+'. '+MGAMES[i].name,x+14,y+21);
      ctx.font='52px sans-serif'; ctx.textAlign='center'; ctx.fillText(emos[i],x+cw/2,y+92);
      if(completed[i]){ ctx.fillStyle='#59c38b'; ctx.font='bold 18px "Comic Sans MS",sans-serif'; ctx.fillText('✓ 已完成',x+cw/2,y+132); }
      else { ctx.fillStyle='#aaa'; ctx.font='16px "Comic Sans MS",sans-serif'; ctx.fillText('点这里玩',x+cw/2,y+132); }
    }
    ctx.fillStyle='#4a90d9'; ctx.beginPath(); ctx.arc(COURT_BACK.x,COURT_BACK.y,COURT_BACK.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 17px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('返回',COURT_BACK.x,COURT_BACK.y);
    if(toast)drawToast();
  }

  // ---------- 单个小游戏画面 ----------
  function drawMini(){
    if(!mg) return;
    ctx.setTransform(scale,0,0,scale,offsetX,offsetY);
    ctx.clearRect(0,0,VIEW_W,VIEW_H);
    var g=ctx.createLinearGradient(0,0,0,VIEW_H); g.addColorStop(0,'#fff8e6'); g.addColorStop(1,'#ffe3ef'); ctx.fillStyle=g; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.fillStyle='rgba(255,255,255,0.94)'; roundRect(VIEW_W/2-250,12,500,54,24); ctx.fill();
    ctx.fillStyle='#ef4e6b'; ctx.font='bold 27px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(mg.def.name,VIEW_W/2,39);
    ctx.fillStyle='#4a90d9'; ctx.beginPath(); ctx.arc(46,44,30,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 26px sans-serif'; ctx.fillText('←',46,46);
    mg.def.draw(mg.data);
    ctx.fillStyle='rgba(0,0,0,0.55)'; roundRect(VIEW_W/2-330,VIEW_H-44,660,34,16); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='18px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(mg.def.hint,VIEW_W/2,VIEW_H-27);
    for(var p=0;p<particles.length;p++){var pt=particles[p];if(!pt.screen)continue;ctx.save();ctx.globalAlpha=Math.min(1,pt.life);ellipse(pt.x,pt.y,pt.r,pt.r,pt.color);ctx.restore();}
    if(state==='miniDone'){
      ctx.fillStyle='rgba(0,0,0,0.42)'; ctx.fillRect(0,0,VIEW_W,VIEW_H);
      ctx.fillStyle='#fff'; roundRect(VIEW_W/2-260,VIEW_H/2-140,520,280,28); ctx.fill();
      ctx.fillStyle='#ef4e6b'; ctx.font='bold 50px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('太棒啦! 🎉',VIEW_W/2,VIEW_H/2-70);
      ctx.fillStyle='#ffb23f'; ctx.font='bold 34px "Comic Sans MS",sans-serif'; ctx.fillText('+3 分',VIEW_W/2,VIEW_H/2-10);
      var pulse=1+Math.sin(mg.doneT*5)*0.04; ctx.save(); ctx.translate(VIEW_W/2,VIEW_H/2+80); ctx.scale(pulse,pulse);
      ctx.fillStyle='#59c38b'; roundRect(-130,-34,260,68,34); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 25px "Comic Sans MS",sans-serif'; ctx.fillText('点这里继续',0,0); ctx.restore();
    }
  }

  function drawTitle(){
    ctx.setTransform(scale,0,0,scale,offsetX,offsetY);
    var g=ctx.createLinearGradient(0,0,0,VIEW_H); g.addColorStop(0,'#8ed6ff'); g.addColorStop(1,'#c9f0a0'); ctx.fillStyle=g; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.globalAlpha=0.85; drawCloud(150,110,1.2); drawCloud(820,150,1); drawCloud(500,70,0.8); ctx.globalAlpha=1;
    ctx.fillStyle='#8fd45f'; ctx.fillRect(0,VIEW_H-150,VIEW_W,150);
    ctx.fillStyle='#7cc851'; ctx.beginPath(); ctx.ellipse(VIEW_W/2,VIEW_H-130,460,60,0,0,Math.PI*2); ctx.fill();
    drawPig(VIEW_W/2-190,VIEW_H-120,1.6,{body:'#ff9ec4',cloth:'#ef4e6b',dir:1,walk:worldTime*3,waving:true});
    drawPig(VIEW_W/2+190,VIEW_H-120,1.6,{body:'#ffd45e',cloth:'#4aa3df',dir:-1,walk:worldTime*3});
    drawPig(VIEW_W/2,VIEW_H-105,1.9,{body:'#c9a7f5',cloth:'#59c38b',dir:1,walk:worldTime*3,waving:true});
    ctx.save(); ctx.translate(VIEW_W/2,180); ctx.rotate(Math.sin(worldTime)*0.02);
    ctx.fillStyle='rgba(255,255,255,0.92)'; roundRect(-300,-68,600,138,30); ctx.fill();
    ctx.strokeStyle='#ff9ec4'; ctx.lineWidth=8; roundRect(-300,-68,600,138,30); ctx.stroke();
    ctx.fillStyle='#ef4e6b'; ctx.font='bold 62px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('小猪欢乐世界',0,-14);
    ctx.fillStyle='#7a7a7a'; ctx.font='bold 20px "Comic Sans MS",sans-serif'; ctx.fillText('泥坑 · 生日会 · 开车郊游 · 家庭乐园 12 个小游戏',0,36); ctx.restore();
    var pulse=1+Math.sin(worldTime*4)*0.04; ctx.save(); ctx.translate(VIEW_W/2,350); ctx.scale(pulse,pulse);
    ctx.fillStyle='rgba(0,0,0,0.15)'; roundRect(-130,-36,260,76,38); ctx.fill();
    ctx.fillStyle='#ef4e6b'; roundRect(-130,-42,260,76,38); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 34px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('开始玩耍 ▶',0,0); ctx.restore();
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.font='17px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.fillText('轻点开始 · 左半屏滑动移动 · 找到彩虹门进家庭乐园',VIEW_W/2,VIEW_H-28);
  }
  function drawWin(){
    drawScene();
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.translate(VIEW_W/2,VIEW_H/2);
    ctx.fillStyle='#fff'; roundRect(-290,-190,580,380,30); ctx.fill();
    ctx.fillStyle='#ef4e6b'; ctx.font='bold 52px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('太棒啦! 🎉',0,-130);
    ctx.fillStyle='#4a4a4a'; ctx.font='bold 24px "Comic Sans MS",sans-serif'; ctx.fillText('今天玩得真开心!',0,-72);
    ctx.fillStyle='#ffd23f'; ctx.font='bold 40px "Comic Sans MS",sans-serif'; ctx.fillText('得分 '+score,0,-18);
    var done=[ach.mud,ach.party,ach.drive].filter(Boolean).length;
    ctx.fillStyle='#59c38b'; ctx.font='bold 20px "Comic Sans MS",sans-serif'; ctx.fillText('体验: '+done+' / 3（泥坑·生日会·郊游）',0,32);
    var miniDoneN = completed.filter(Boolean).length;
    ctx.fillStyle='#ff9f43'; ctx.font='bold 20px "Comic Sans MS",sans-serif'; ctx.fillText('家庭小游戏: '+miniDoneN+' / 12',0,64);
    var pulse=1+Math.sin(worldTime*4)*0.05; ctx.save(); ctx.scale(pulse,pulse);
    ctx.fillStyle='#59c38b'; roundRect(-130,92,260,64,32); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 27px "Comic Sans MS",sans-serif'; ctx.fillText('再玩一次 ↻',0,125); ctx.restore(); ctx.restore();
  }
  function drawPause(){
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.fillStyle='#fff'; roundRect(VIEW_W/2-170,VIEW_H/2-70,340,140,24); ctx.fill();
    ctx.fillStyle='#4a90d9'; ctx.font='bold 40px "Comic Sans MS",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('休息一下',VIEW_W/2,VIEW_H/2-20);
    ctx.fillStyle='#888'; ctx.font='20px "Comic Sans MS",sans-serif'; ctx.fillText('点右上角 ⟞ 继续',VIEW_W/2,VIEW_H/2+30); ctx.restore();
  }

  // ---------- 主循环 ----------
  var last=0;
  function loop(ts){
    var dt=last?Math.min((ts-last)/1000,0.05):0; last=ts;
    worldTime+=dt;
    if(toast){ toast.life-=dt; if(toast.life<=0) toast=null; }
    if(state==='title'||state==='win'||state==='miniDone'||state==='mini'){
      for(var c=0;c<clouds.length;c++){clouds[c].x+=clouds[c].sp*dt*0.2;if(clouds[c].x>WORLD_W+120)clouds[c].x=-120;}
      for(var p=particles.length-1;p>=0;p--){var pt=particles[p];pt.life-=dt;pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.vy+=120*dt;if(pt.life<=0)particles.splice(p,1);}
    }
    if(state==='mini'||state==='miniDone') updateMini(dt);
    else if(state==='party'){ if(input.action){blowCandles();input.action=false;} updateParticles(dt); musicTick(dt,true); }
    else if(state==='play'&&!paused) updatePlay(dt);
    if(state==='title')drawTitle();
    else if(state==='win')drawWin();
    else if(state==='party')drawParty();
    else if(state==='courtyard')drawCourtyard();
    else if(state==='mini'||state==='miniDone')drawMini();
    else drawScene();
    requestAnimationFrame(loop);
  }

  makeWorld();
  state='title';
  requestAnimationFrame(loop);
})();
