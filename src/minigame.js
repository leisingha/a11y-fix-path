// Minigame: a card that looks fine but sounds broken. Inspect each part, hear what a screen reader says, pick the fix.
// No timer. Each round breaks a different 3 of the 5 parts, so it can be played again.
import * as THREE from 'three';
import { LEVELS } from './levels.js';

var level = 0;
function parts() { return LEVELS[level].parts; }

// ---------- state ----------
// The round as a state machine:
//
//   intro ----------HEAR_FINE / HEAR_BROKEN----------> hearing-fine / hearing-broken
//   hearing-broken --WRONG--> hearing-broken   (a wrong fix: try another)
//   hearing-broken --FIX----> hearing-fine     (that part is fixed now)
//   hearing-broken --WIN----> won              (that was the last broken part)
//   won ------------NEW_ROUND-> intro
//
// In "won" nothing can be selected, so the Play again panel can't be replaced by accident.
var game = createMachine('game', 'intro', {
  'intro':          { HEAR_FINE: 'hearing-fine', HEAR_BROKEN: 'hearing-broken' },
  'hearing-fine':   { HEAR_FINE: 'hearing-fine', HEAR_BROKEN: 'hearing-broken' },
  'hearing-broken': { HEAR_FINE: 'hearing-fine', HEAR_BROKEN: 'hearing-broken', WRONG: 'hearing-broken', FIX: 'hearing-fine', WIN: 'won' },
  'won':            { NEW_ROUND: 'intro' }
});

// Each part also has its own small lifecycle for the round:
//   fine:   unheard -> heard
//   broken: unheard -> heard -> fixed
var round = { broken: {}, fixed: {}, heard: {}, wrongTried: {}, tries: 0, number: 1, selected: null };

var listBox = document.getElementById('parts');
var inspect = document.getElementById('inspect');
var status = document.getElementById('status');
var scoreBox = document.getElementById('score');
var stage = document.getElementById('stage');
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pickBroken() {
  var ids = parts().map(function (p) { return p.id; });
  // Shuffle with plain swaps, then keep the first three.
  for (var i = ids.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
  }
  var out = {};
  for (var k = 0; k < 3; k++) out[ids[k]] = true;
  // Round 1 always includes the button, so the first play matches the explainer.
  if (round.number === 1 && !out.button) { delete out[ids[2]]; out.button = true; }
  return out;
}

function brokenLeft() {
  var n = 0;
  for (var id in round.broken) if (!round.fixed[id]) n++;
  return n;
}

function partById(id) {
  var list = parts();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

// ---------- DOM ----------
function renderList() {
  listBox.innerHTML = '';
  parts().forEach(function (p, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    var mark = round.fixed[p.id] ? ' ✓ fixed' : (round.heard[p.id] && !round.broken[p.id] ? ' ✓ fine' : '');
    b.textContent = p.label + mark;
    b.setAttribute('aria-pressed', String(round.selected === p.id));
    b.setAttribute('data-part', p.id);
    b.onclick = function () { select(p.id); };
    b.onkeydown = function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var n = (i + (e.key === 'ArrowDown' ? 1 : parts().length - 1)) % parts().length;
        listBox.querySelectorAll('button')[n].focus();
      }
    };
    li.appendChild(b);
    listBox.appendChild(li);
  });
  scoreBox.textContent = 'Round ' + round.number + ' · ' + brokenLeft() + ' of 3 problems left · wrong tries: ' + round.tries;
  document.body.setAttribute('data-left', String(brokenLeft()));
}

function select(id) {
  if (game.state === 'won') return;
  var p = partById(id);
  var isBroken = round.broken[id] && !round.fixed[id];
  game.send(isBroken ? 'HEAR_BROKEN' : 'HEAR_FINE');
  round.selected = id;
  round.heard[id] = true;
  showPart(p, isBroken, null);
  renderList();
  highlight(id, isBroken);
  ripple(id, isBroken);
  status.textContent = p.label + '. A screen reader says ' + (isBroken ? p.badSays : p.okSays);
}

function showPart(p, isBroken, note) {
  var html = '<h2 tabindex="-1" id="partTitle">' + p.label + '</h2>';
  html += '<p><strong>A screen reader says:</strong> <span class="' + (isBroken ? 'bad' : 'good') + '">' + (isBroken ? p.badSays : p.okSays) + '</span></p>';
  if (isBroken) {
    html += '<p><strong>Code:</strong> <code>' + esc(p.badCode) + '</code></p><p>Which change fixes it?</p><div class="opts" role="group" aria-label="Fix options"></div><p id="feedback" role="status"></p>';
  } else if (round.fixed[p.id]) {
    html += '<p class="good">Fixed.</p>';
  } else {
    html += '<p>This part is fine. Check the others.</p>';
  }
  if (note) html += '<p>' + note + '</p>';
  inspect.innerHTML = html;
  if (!isBroken) return;
  var opts = inspect.querySelector('.opts');
  var tried = round.wrongTried[p.id] || {};
  p.options.forEach(function (o, k) {
    var b = document.createElement('button');
    b.innerHTML = '<code>' + esc(o.code) + '</code>';
    if (tried[k]) {
      // Stays focusable (so focus is never lost) but can't be counted twice.
      b.setAttribute('aria-disabled', 'true');
      b.className = 'tried';
    }
    b.onclick = function () { choose(p, o, k, b); };
    opts.appendChild(b);
  });
}

function choose(p, o, k, btn) {
  if (game.state !== 'hearing-broken') return;
  if (btn.getAttribute('aria-disabled') === 'true') return;
  if (o.ok) {
    round.fixed[p.id] = true;
    pulse(p.id);
    if (brokenLeft() === 0) { game.send('WIN'); win(); return; }
    game.send('FIX');
    showPart(p, false, o.why);
    renderList();
    highlight(p.id, false);
    status.textContent = 'Correct. ' + o.why;
    document.getElementById('partTitle').focus();
  } else {
    game.send('WRONG');
    round.tries++;
    if (!round.wrongTried[p.id]) round.wrongTried[p.id] = {};
    round.wrongTried[p.id][k] = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.className = 'tried';
    var fb = document.getElementById('feedback');
    fb.textContent = 'Not this one. ' + o.why;
    fb.className = 'bad';
    renderList();
  }
}

function win() {
  inspect.innerHTML = '<h2>The card passes</h2><p>All three problems fixed with ' + round.tries + ' wrong ' + (round.tries === 1 ? 'try' : 'tries') + '. On screen, nothing changed. To a screen reader user, the card now makes sense.</p>' +
    '<p><button class="primary" id="again">Play again with new problems</button></p>' +
    '<p><a href="../START_HERE.html">Back to the start</a></p>';
  document.getElementById('again').onclick = function () { round.number++; newRound(); };
  document.getElementById('again').focus();
  status.textContent = 'Round complete. The card passes.';
  round.selected = null;
  renderList();
  highlight(null);
  celebrate();
}

function newRound() {
  game.send('NEW_ROUND');
  round.broken = pickBroken();
  round.fixed = {}; round.heard = {}; round.wrongTried = {}; round.tries = 0; round.selected = null;
  document.body.setAttribute('data-round', String(round.number));
  inspect.innerHTML = '<h2 tabindex="-1" id="partTitle">Find the three problems</h2><p>The card looks finished. Three parts of it are broken for screen reader users. Choose a part to hear what a screen reader says, then pick the fix.</p>';
  renderList();
  refreshBadges();
  highlight(null);
  if (round.number > 1) listBox.querySelector('button').focus();
}

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---------- Three.js: the card is a group of flat planes, seen through a perspective camera ----------
// Everything that belongs to the card (parts, badges, ring, ripples, confetti) goes in cardGroup,
// so the whole card can later be turned over as one object.
var renderer, scene, camera, cardGroup, meshes = {}, badges = {}, ring, pulses = [];
var FOV = 20, HALF = 260; // HALF: half the height of the area the camera must fit, in card units

function tex(draw, w, h) {
  var c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  var g = c.getContext('2d');
  g.scale(2, 2);
  draw(g, w, h);
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function plane(w, h, texture, color) {
  var m = new THREE.MeshBasicMaterial(texture ? { map: texture, transparent: true } : { color: color });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

var DRAW = {
  img: function (g, w, h) {
    g.fillStyle = '#ffe2a8'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#1d1d1f'; g.lineWidth = 4;
    g.fillRect(22, 36, w - 44, h - 72); g.strokeRect(22, 36, w - 44, h - 72);
    g.beginPath(); g.moveTo(22, 36); g.lineTo(w / 2, h / 2 + 6); g.lineTo(w - 22, 36); g.stroke();
  },
  heading: function (g, w, h) {
    g.fillStyle = '#1d1d1f'; g.font = '700 26px system-ui, sans-serif'; g.textBaseline = 'middle';
    g.fillText('Weekly accessibility tips', 4, h / 2);
  },
  input: function (g, w, h) {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#55555c'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = '#76767d'; g.font = '400 20px system-ui, sans-serif'; g.textBaseline = 'middle';
    g.fillText('Email address', 14, h / 2);
  },
  button: function (g, w, h) {
    g.fillStyle = '#1f5fbf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.beginPath();
    g.moveTo(12, h / 2); g.lineTo(w - 12, 13); g.lineTo(w / 2 + 2, h - 12); g.lineTo(w / 2 - 3, h / 2 + 3); g.closePath(); g.fill();
  },
  link: function (g, w, h) {
    g.strokeStyle = '#1f5fbf'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1f5fbf'; g.font = '700 24px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('i', w / 2, h / 2 + 1);
  }
};

function badgeTex(kind) {
  return tex(function (g, w, h) {
    g.fillStyle = kind === 'fixed' ? '#1e6b3a' : '#9a9aa0';
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(9, h / 2 + 1); g.lineTo(w / 2 - 2, h - 10); g.lineTo(w - 8, 10); g.stroke();
  }, 32, 32);
}
var BADGE_FIXED, BADGE_FINE;

// Empty the card group and draw the parts of one level into it.
function buildCard(levelIndex) {
  while (cardGroup.children.length) cardGroup.remove(cardGroup.children[0]);
  meshes = {}; badges = {};

  var shadow = plane(392, 452, null, 0xd9d5cc); shadow.position.set(6, -6, -2); cardGroup.add(shadow);
  var card = plane(392, 452, null, 0xffffff); card.position.set(0, 0, -1); cardGroup.add(card);

  LEVELS[levelIndex].parts.forEach(function (p) {
    var draw = DRAW[p.draw] || function (g, w, h) { g.fillStyle = '#d0d0d4'; g.fillRect(0, 0, w, h); };
    var m = plane(p.w, p.h, tex(draw, p.w, p.h));
    m.position.set(p.x || 0, p.y, 0);
    m.userData.id = p.id;
    cardGroup.add(m);
    meshes[p.id] = m;
    var b = plane(28, 28, BADGE_FIXED);
    b.position.set((p.x || 0) + p.w / 2 + 2, p.y + p.h / 2 + 2, 1);
    b.visible = false;
    cardGroup.add(b);
    badges[p.id] = b;
  });

  // Selection ring: four thin bars around the selected part.
  ring = new THREE.Group();
  for (var i = 0; i < 4; i++) ring.add(plane(1, 1, null, 0x1f5fbf));
  ring.visible = false;
  cardGroup.add(ring);
}

function initScene() {
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
  catch (e) { stage.innerHTML = '<p style="padding:20px">The picture of the card needs WebGL. The list of parts on the left plays the whole game without it.</p>'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf6f4ef);
  stage.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 1, 10, 5000);
  cardGroup = new THREE.Group();
  scene.add(cardGroup);
  BADGE_FIXED = badgeTex('fixed'); BADGE_FINE = badgeTex('fine');
  buildCard(level);

  renderer.domElement.addEventListener('click', onClick);
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
}

function resize() {
  if (!renderer) return;
  var w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h);
  var aspect = w / h;
  camera.aspect = aspect;
  // Move the camera back until HALF fits: tan(fov/2) = HALF / distance.
  var dist = HALF / Math.tan((FOV / 2) * Math.PI / 180);
  if (aspect < 1) dist = dist / aspect; // narrow screen: fit the width instead
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function onClick(e) {
  var r = renderer.domElement.getBoundingClientRect();
  var v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  var ray = new THREE.Raycaster();
  ray.setFromCamera(v, camera);
  var hits = ray.intersectObjects(Object.keys(meshes).map(function (k) { return meshes[k]; }));
  if (hits.length) select(hits[0].object.userData.id);
}

function highlight(id, isBroken) {
  if (!renderer) return;
  if (!id) { ring.visible = false; return; }
  var p = parts().filter(function (x) { return x.id === id; })[0];
  var x = p.x || 0, y = p.y, w = p.w + 16, h = p.h + 16, t = 4;
  var bars = ring.children;
  bars[0].scale.set(w + t, t, 1); bars[0].position.set(x, y + h / 2, 2);
  bars[1].scale.set(w + t, t, 1); bars[1].position.set(x, y - h / 2, 2);
  bars[2].scale.set(t, h, 1); bars[2].position.set(x - w / 2, y, 2);
  bars[3].scale.set(t, h, 1); bars[3].position.set(x + w / 2, y, 2);
  bars.forEach(function (b) { b.material.color.set(isBroken ? 0xb3261e : 0x1f5fbf); });
  ring.visible = true;
  refreshBadges();
}

function refreshBadges() {
  if (!renderer) return;
  parts().forEach(function (p) {
    var b = badges[p.id];
    if (round.fixed[p.id]) { b.material.map = BADGE_FIXED; b.visible = true; }
    else if (round.heard[p.id] && !round.broken[p.id]) { b.material.map = BADGE_FINE; b.visible = true; }
    else b.visible = false;
    b.material.needsUpdate = true;
  });
}

function pulse(id) {
  refreshBadges();
  if (!renderer || reduceMotion) return;
  pulses.push({ id: id, t: 0 });
}

// Sound ripple: a ring spreads out from the part you inspect (red if broken, green if fine).
var ripples = [];
function ripple(id, isBroken) {
  if (!renderer) return;
  var p = partById(id);
  var count = reduceMotion ? 1 : 3;
  for (var i = 0; i < count; i++) {
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: isBroken ? 0xb3261e : 0x1e6b3a, transparent: true, opacity: 0.8 }));
    ring.position.set(p.x || 0, p.y, 3);
    cardGroup.add(ring);
    ripples.push({ mesh: ring, t: -i * 0.25, base: Math.max(p.w, p.h) / 2 + 8 });
  }
}

// Win burst: small flat squares fly out of the card and fall.
var confetti = [];
function celebrate() {
  if (!renderer || reduceMotion) return;
  var colors = [0x1f5fbf, 0x1e6b3a, 0xffe2a8, 0xb3261e, 0x1d1d1f];
  for (var i = 0; i < 70; i++) {
    var m = plane(10, 10, null, colors[i % colors.length]);
    m.position.set((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 4);
    cardGroup.add(m);
    var angle = Math.random() * Math.PI * 2;
    var speed = 4 + Math.random() * 7;
    confetti.push({ mesh: m, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed + 4, spin: (Math.random() - 0.5) * 0.3, life: 1 });
  }
}

function loop() {
  requestAnimationFrame(loop);
  for (var r = ripples.length - 1; r >= 0; r--) {
    var rp = ripples[r];
    rp.t += 0.02;
    if (rp.t < 0) { rp.mesh.visible = false; continue; }
    rp.mesh.visible = true;
    var sc = rp.base * (reduceMotion ? 1.3 : 1 + rp.t * 1.6);
    rp.mesh.scale.set(sc, sc, 1);
    rp.mesh.material.opacity = 0.8 * (1 - rp.t);
    if (rp.t >= 1) { cardGroup.remove(rp.mesh); rp.mesh.geometry.dispose(); ripples.splice(r, 1); }
  }
  for (var c = confetti.length - 1; c >= 0; c--) {
    var cf = confetti[c];
    cf.mesh.position.x += cf.vx; cf.mesh.position.y += cf.vy;
    cf.vy -= 0.25; cf.mesh.rotation.z += cf.spin; cf.life -= 0.008;
    if (cf.life <= 0 || cf.mesh.position.y < -400) { cardGroup.remove(cf.mesh); confetti.splice(c, 1); }
  }
  for (var i = pulses.length - 1; i >= 0; i--) {
    var pu = pulses[i];
    pu.t += 0.05;
    var s = 1 + Math.sin(Math.min(pu.t, 1) * Math.PI) * 0.12;
    meshes[pu.id].scale.set(s, s, 1);
    badges[pu.id].scale.set(s * 1.3, s * 1.3, 1);
    if (pu.t >= 1) { meshes[pu.id].scale.set(1, 1, 1); badges[pu.id].scale.set(1, 1, 1); pulses.splice(i, 1); }
  }
  renderer.render(scene, camera);
}

initScene();
newRound();
