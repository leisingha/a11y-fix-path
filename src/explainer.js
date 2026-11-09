// Explainer: one button, followed from the code you write to what a screen reader says.
//
// How the page is organised (read this first):
//   1. STEPS      - the tour, as a plain list. The step number is the main state.
//   2. Machines   - three small state machines (see shared/machine.js):
//                     view   : loading -> ready | unavailable   (could WebGL start?)
//                     motion : animated <-> reduced             (camera and ring animation)
//                     travel : resting <-> traveling            (is the 3D button moving?)
//   3. The scene  - four stops along a track. A 3D button rides the track.
//                     Stop 1 code card, Stop 2 DOM tree of boxes,
//                     Stop 3 accessibility tree of spheres, Stop 4 a speaker with sound rings.
//   4. go(i)      - moves to step i: updates the words, then tells the scene what to show.
//
// Every word lives in the DOM panel. The canvas is a picture of the same steps
// and is hidden from screen readers.
import * as THREE from 'three';
import { makePanelTexture } from './panel.js';

var RED = '#b3261e', GREEN = '#1e6b3a', MUTED = '#55555c', INK = '#1d1d1f';

// ---------------------------------------------------------------------------
// 1. The tour
// ---------------------------------------------------------------------------
var STATIONS = [
  { key: 'jsx', label: '1 · The JSX you write' },
  { key: 'dom', label: '2 · The DOM the browser builds' },
  { key: 'tree', label: '3 · The accessibility tree' },
  { key: 'sr', label: '4 · What a screen reader says' }
];

var CONTENT = {
  before: {
    jsx: [
      { text: '<button', mono: true },
      { text: 'onClick={subscribe}>', mono: true, indent: 1 },
      { text: '<SendIcon />', mono: true, indent: 1 },
      { text: '</button>', mono: true },
      { text: 'No text. No label.', color: RED, bold: true }
    ],
    dom: [
      { text: '<button>', mono: true },
      { text: '<svg>…paths…</svg>', mono: true, indent: 1 },
      { text: '</button>', mono: true },
      { text: 'Looks fine on screen:', color: MUTED },
      { text: 'a paper-plane icon.', color: MUTED }
    ],
    tree: [
      { text: 'role:  button', mono: true },
      { text: 'name:  ""', mono: true, color: RED, bold: true },
      { text: 'focusable: yes', mono: true },
      { text: 'The name is empty.', color: RED, bold: true }
    ],
    sr: [
      { text: '"button"', size: 40, bold: true, color: RED },
      { text: '' },
      { text: 'Which button? What does', color: MUTED },
      { text: 'it do? The user has to guess.', color: MUTED }
    ]
  },
  after: {
    jsx: [
      { text: '<button', mono: true },
      { text: 'aria-label="Subscribe"', mono: true, indent: 1, color: GREEN, bold: true },
      { text: 'onClick={subscribe}>', mono: true, indent: 1 },
      { text: '<SendIcon />', mono: true, indent: 1 },
      { text: '</button>', mono: true }
    ],
    dom: [
      { text: '<button', mono: true },
      { text: 'aria-label="Subscribe">', mono: true, indent: 1, color: GREEN, bold: true },
      { text: '<svg>…paths…</svg>', mono: true, indent: 1 },
      { text: '</button>', mono: true },
      { text: 'Same icon on screen.', color: MUTED }
    ],
    tree: [
      { text: 'role:  button', mono: true },
      { text: 'name:  "Subscribe"', mono: true, color: GREEN, bold: true },
      { text: 'focusable: yes', mono: true },
      { text: 'Name comes from aria-label.', color: GREEN, bold: true }
    ],
    sr: [
      { text: '"Subscribe, button"', size: 40, bold: true, color: GREEN },
      { text: '' },
      { text: 'The user knows what it is', color: MUTED },
      { text: 'and what pressing it does.', color: MUTED }
    ]
  }
};

// at: which stop the camera looks at (-1 means all four).
// phase: a short name for this part of the tour, written onto <body> as data-phase.
var STEPS = [
  { phase: 'intro', mode: 'before', at: -1, title: 'One button, four stops',
    body: 'This is the subscribe button from the fixer. It shows a paper-plane icon and nothing else. Follow it through four stops on the way to a screen reader user, first broken, then fixed.' },
  { phase: 'before', mode: 'before', at: 0, title: 'Stop 1: the JSX',
    body: 'The developer wrote a button that holds only an icon component. Sighted users see the icon, so nothing looks wrong in review.' },
  { phase: 'before', mode: 'before', at: 1, title: 'Stop 2: the DOM',
    body: 'React turns the JSX into real elements: a card with an image, a heading, an input, a button and a link. The button holds an SVG and no text, so the browser has nothing to call it.' },
  { phase: 'before', mode: 'before', at: 2, title: 'Stop 3: the accessibility tree',
    body: 'The browser builds a second tree for assistive technology. Each node gets a role and a name. The button node has the role button and an empty name, shown here as a hollow red node.' },
  { phase: 'before', mode: 'before', at: 3, title: 'Stop 4: the screen reader',
    body: 'The screen reader reads the role and the name aloud. With no name, the user hears only "button". This fails WCAG 4.1.2, Name, Role, Value.' },
  { phase: 'fixing', mode: 'after', at: -1, title: 'Apply the fix',
    body: 'The fixer proposed one attribute: aria-label="Subscribe". It is a Tier 2 fix because a person has to confirm the word is right. The button goes back to the start to make the trip again.' },
  { phase: 'after', mode: 'after', at: 0, title: 'Stop 1: the JSX, fixed',
    body: 'One attribute was added. The icon and the click handler are unchanged, so the button looks exactly the same.' },
  { phase: 'after', mode: 'after', at: 1, title: 'Stop 2: the DOM, fixed',
    body: 'The aria-label attribute is carried into the DOM unchanged. The tree of elements is the same shape as before.' },
  { phase: 'after', mode: 'after', at: 2, title: 'Stop 3: the tree, fixed',
    body: 'The browser now has a name to use. The button node is filled in: role button, name "Subscribe".' },
  { phase: 'done', mode: 'after', at: 3, title: 'Stop 4: the screen reader, fixed',
    body: 'The user hears "Subscribe, button". Same pixels, different experience. The fixer re-ran its check and the warning is gone.' }
];

var current = 0; // the step number: the main piece of state on this page

// ---------------------------------------------------------------------------
// 2. State machines
// ---------------------------------------------------------------------------
var view = createMachine('view', 'loading', {
  loading: { READY: 'ready', FAIL: 'unavailable' }
});

var systemReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
var motion = createMachine('motion', systemReduce && systemReduce.matches ? 'reduced' : 'animated', {
  animated: { REDUCE: 'reduced' },
  reduced: { ANIMATE: 'animated' }
});

var travel = createMachine('travel', 'resting', {
  resting: { GO: 'traveling' },
  traveling: { GO: 'traveling', ARRIVE: 'resting' }
});

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------
var stepTitle = document.getElementById('stepTitle');
var stepBody = document.getElementById('stepBody');
var stepCount = document.getElementById('stepCount');
var prevBtn = document.getElementById('prev');
var nextBtn = document.getElementById('next');
var modeBefore = document.getElementById('modeBefore');
var modeAfter = document.getElementById('modeAfter');
var motionBox = document.getElementById('motion');
var stage = document.getElementById('stage');

motionBox.checked = motion.state === 'animated';
motionBox.onchange = function () { motion.send(motionBox.checked ? 'ANIMATE' : 'REDUCE'); };
if (systemReduce && systemReduce.addEventListener) {
  // Follow the system setting if it changes while the page is open.
  systemReduce.addEventListener('change', function () {
    motion.send(systemReduce.matches ? 'REDUCE' : 'ANIMATE');
    motionBox.checked = motion.state === 'animated';
  });
}

// ---------------------------------------------------------------------------
// 3. The scene
// ---------------------------------------------------------------------------
var SPACING = 7;
var TRACK_Z = 1.9;
var STOP_OFFSET = 2.5; // the tile parks to the right of each stop's prop, so it doesn't block it
function stationX(i) { return (i - 1.5) * SPACING; }
function stopX(i) { return stationX(i) + STOP_OFFSET; }

var renderer, scene, camera;
var camGoalPos = new THREE.Vector3(), camGoalLook = new THREE.Vector3(), camLook = new THREE.Vector3();
var cards = [], gates = [], cardTextures = { before: [], after: [] };
var tile, tileLight;
var tileFrom = 0, tileTo = 0, tileT = 1;
var domButtonBox, treeButtonNode, treeButtonWire, treeLabelBefore, treeLabelAfter;
var rings = [], srLabelBefore, srLabelAfter;
var currentMode = null;
var lastTime = performance.now(), elapsed = 0; // seconds, for animation

function canvasTexture(w, h, draw) {
  var c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  var g = c.getContext('2d');
  g.scale(2, 2);
  draw(g, w, h);
  var t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A text label that always faces the camera.
function makeLabel(text, color, height) {
  var g0 = document.createElement('canvas').getContext('2d');
  g0.font = '700 34px ui-monospace, Menlo, Consolas, monospace';
  var w = Math.ceil(g0.measureText(text).width) + 32;
  var tex = canvasTexture(w, 52, function (g, cw, ch) {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = color;
    g.font = '700 34px ui-monospace, Menlo, Consolas, monospace';
    g.textBaseline = 'middle';
    g.fillText(text, 16, ch / 2 + 1);
  });
  var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  var hgt = height || 0.32;
  sprite.scale.set(hgt * w / 52, hgt, 1);
  return sprite;
}

function std(color, extra) {
  var opts = { color: color, roughness: 0.55, metalness: 0.05 };
  for (var k in extra) opts[k] = extra[k];
  return new THREE.MeshStandardMaterial(opts);
}

function shadowed(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

function initScene() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    view.send('FAIL');
    stage.innerHTML = '<p style="padding:20px">The 3D view is not available on this machine. The steps on the right carry the full explanation.</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf6f4ef);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf6f4ef, 30, 70);
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d5cc, 1.6));
  var sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-6, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Floor and track.
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), std(0xefece4));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  var track = shadowed(new THREE.Mesh(new THREE.BoxGeometry(SPACING * 3 + 4, 0.08, 1.0), std(0xffffff)));
  track.position.set(STOP_OFFSET / 2, 0.04, TRACK_Z);
  scene.add(track);
  for (var d = -10; d <= 14; d += 1) {
    var dash = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.08), std(0xd9d5cc));
    dash.position.set(d, 0.09, TRACK_Z);
    scene.add(dash);
  }

  for (var i = 0; i < STATIONS.length; i++) {
    var x = stationX(i);

    // Info card on a post. Its texture carries the same words as the DOM panel.
    cardTextures.before.push(makeCardTexture('before', i));
    cardTextures.after.push(makeCardTexture('after', i));
    var face = new THREE.MeshBasicMaterial({ color: 0xffffff }); // unlit, so the text stays crisp
    var edge = std(0x1d1d1f);
    var card = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.92, 0.1), [edge, edge, edge, edge, face, edge]));
    card.position.set(x, 4.1, -0.6);
    scene.add(card);
    cards.push({ mesh: card, face: face });
    var post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.7), std(0x1d1d1f)));
    post.position.set(x, 1.35, -0.6);
    scene.add(post);

    // Arch over the track at each stop.
    var gate = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 12, 48, Math.PI), std(0x1d1d1f, { emissive: 0x000000 })));
    gate.position.set(x + STOP_OFFSET, 0, TRACK_Z);
    scene.add(gate);
    gates.push(gate);
  }

  buildCodeProp(stationX(0));
  buildDomProp(stationX(1));
  buildTreeProp(stationX(2));
  buildSpeakerProp(stationX(3));

  // The button that rides the track: a blue tile with a paper-plane icon.
  var iconTex = canvasTexture(128, 128, function (g, w, h) {
    g.fillStyle = '#1f5fbf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.beginPath();
    g.moveTo(24, h / 2); g.lineTo(w - 22, 24); g.lineTo(w / 2 + 6, h - 22); g.lineTo(w / 2 - 6, h / 2 + 6); g.closePath(); g.fill();
  });
  var blue = std(0x1f5fbf);
  var front = std(0xffffff, { map: iconTex });
  tile = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.22), [blue, blue, blue, blue, front, blue]));
  tile.position.set(stopX(0), 0.75, TRACK_Z);
  scene.add(tile);
  tileLight = new THREE.PointLight(0xb3261e, 6, 3.5, 1.5);
  scene.add(tileLight);

  window.addEventListener('resize', resize);
  resize();
  view.send('READY');
  requestAnimationFrame(loop);
}

function makeCardTexture(mode, i) {
  var st = STATIONS[i];
  var problem = i >= 2;
  var border = problem ? (mode === 'before' ? RED : GREEN) : INK;
  var bg = i === 3 ? (mode === 'before' ? '#fbe9e7' : '#e6f4ea') : '#ffffff';
  return makePanelTexture(st.label, CONTENT[mode][st.key], { border: border, titleColor: INK, bg: bg });
}

// Stop 1: a small code file standing on the floor.
function buildCodeProp(x) {
  var tex = canvasTexture(256, 180, function (g, w, h) {
    g.fillStyle = '#1d1d1f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3a3f'; g.fillRect(0, 0, w, 26);
    ['#ff5f57', '#febc2e', '#28c840'].forEach(function (c, k) { g.fillStyle = c; g.beginPath(); g.arc(16 + k * 16, 13, 5, 0, 7); g.fill(); });
    g.fillStyle = '#ffffff'; g.font = '600 13px ui-monospace, Menlo, monospace'; g.fillText('NewsletterCard.jsx', 70, 18);
    var lines = [['#9cdcfe', '<button'], ['#ce9178', '  onClick={subscribe}>'], ['#4ec9b0', '  <SendIcon />'], ['#9cdcfe', '</button>']];
    g.font = '400 17px ui-monospace, Menlo, monospace';
    lines.forEach(function (ln, k) { g.fillStyle = ln[0]; g.fillText(ln[1], 14, 58 + k * 28); });
  });
  var dark = std(0x1d1d1f);
  var slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 0.12), [dark, dark, dark, dark, std(0xffffff, { map: tex }), dark]));
  slab.position.set(x, 1.0, 0.2);
  slab.rotation.x = -0.12;
  scene.add(slab);
}

// Stop 2: the DOM as a small tree of boxes. The button box is blue and holds an svg box.
function buildDomProp(x) {
  var names = ['img', 'h2', 'input', 'button', 'a'];
  var root = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.42), std(0xffffff)));
  root.position.set(x, 2.05, 0.2);
  scene.add(root);
  var rl = makeLabel('div.card', INK, 0.26); rl.position.set(x, 2.55, 0.45); scene.add(rl);
  var linePts = [];
  for (var k = 0; k < names.length; k++) {
    var cx = x + (k - 2) * 0.85;
    var isBtn = names[k] === 'button';
    var box = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), std(isBtn ? 0x1f5fbf : 0xffffff)));
    box.position.set(cx, 1.0, 0.2);
    scene.add(box);
    var lab = makeLabel(names[k], isBtn ? '#1f5fbf' : INK, 0.24); lab.position.set(cx, 0.55, 0.55); scene.add(lab);
    linePts.push(x, 1.84, 0.2, cx, 1.25, 0.2);
    if (isBtn) {
      domButtonBox = box;
      var svg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), std(0xffe2a8)));
      svg.position.set(cx + 0.7, 0.35, 0.6);
      scene.add(svg);
      var sl = makeLabel('svg', INK, 0.22); sl.position.set(cx + 0.7, 0.72, 0.75); scene.add(sl);
      linePts.push(cx, 0.75, 0.2, cx + 0.7, 0.49, 0.6);
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x55555c })));
}

// Stop 3: the accessibility tree as spheres. The button node changes with the fix.
function buildTreeProp(x) {
  var roles = ['image', 'heading', 'textbox', 'button', 'link'];
  var root = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), std(0xffffff)));
  root.position.set(x, 2.1, 0.2);
  scene.add(root);
  var rl = makeLabel('group', INK, 0.26); rl.position.set(x, 2.6, 0.45); scene.add(rl);
  var pts = [];
  for (var k = 0; k < roles.length; k++) {
    var cx = x + (k - 2) * 0.85;
    var isBtn = roles[k] === 'button';
    pts.push(x, 1.85, 0.2, cx, 1.22, 0.2);
    if (isBtn) {
      treeButtonNode = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), std(0x1e6b3a)));
      treeButtonNode.position.set(cx, 1.0, 0.2);
      scene.add(treeButtonNode);
      treeButtonWire = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8), new THREE.MeshBasicMaterial({ color: 0xb3261e, wireframe: true }));
      treeButtonWire.position.copy(treeButtonNode.position);
      scene.add(treeButtonWire);
      treeLabelBefore = makeLabel('button  name: ""', RED, 0.26);
      treeLabelAfter = makeLabel('button "Subscribe"', GREEN, 0.26);
      treeLabelBefore.position.set(cx + 0.25, 0.45, 0.7);
      treeLabelAfter.position.set(cx + 0.25, 0.45, 0.7);
      scene.add(treeLabelBefore); scene.add(treeLabelAfter);
    } else {
      var node = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12), std(0xffffff)));
      node.position.set(cx, 1.0, 0.2);
      scene.add(node);
      var lab = makeLabel(roles[k], MUTED, 0.2); lab.position.set(cx, 0.6, 0.5); scene.add(lab);
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x55555c })));
}

// Stop 4: a speaker. Sound rings come out of it: one weak red ring before, three green after.
function buildSpeakerProp(x) {
  var body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.8), std(0x2a2a2e)));
  body.position.set(x - 0.9, 0.75, 0.0);
  scene.add(body);
  var cone = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.18, 0.2, 32), std(0x55555c)));
  cone.rotation.x = Math.PI / 2;
  cone.position.set(x - 0.9, 0.95, 0.45);
  scene.add(cone);
  for (var k = 0; k < 3; k++) {
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: 0x1e6b3a, transparent: true, opacity: 0.8 }));
    ring.position.set(x - 0.9, 0.95, 0.6);
    scene.add(ring);
    rings.push(ring);
  }
  srLabelBefore = makeLabel('"button"', RED, 0.36);
  srLabelAfter = makeLabel('"Subscribe, button"', GREEN, 0.36);
  srLabelBefore.position.set(x + 0.9, 1.9, 0.6);
  srLabelAfter.position.set(x + 0.9, 1.9, 0.6);
  scene.add(srLabelBefore); scene.add(srLabelAfter);
}

// Switch every part of the scene that depends on before/after.
function setMode(mode) {
  currentMode = mode;
  for (var i = 0; i < cards.length; i++) {
    cards[i].face.map = cardTextures[mode][i];
    cards[i].face.needsUpdate = true;
  }
  var broken = mode === 'before';
  tileLight.color.set(broken ? 0xb3261e : 0x1e6b3a);
  treeButtonNode.visible = !broken;
  treeButtonWire.visible = broken;
  treeLabelBefore.visible = broken; treeLabelAfter.visible = !broken;
  srLabelBefore.visible = broken; srLabelAfter.visible = !broken;
  for (var k = 0; k < rings.length; k++) {
    rings[k].material.color.set(broken ? 0xb3261e : 0x1e6b3a);
    rings[k].visible = broken ? k === 0 : true;
  }
}

function resize() {
  if (!renderer) return;
  var w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  aimCamera(STEPS[current].at, true);
}

function aimCamera(at, jump) {
  var aspect = camera.aspect || 1.6;
  if (at < 0) {
    var dist = Math.max(27, 40 / aspect);
    camGoalPos.set(STOP_OFFSET / 2, dist * 0.28, dist);
    camGoalLook.set(STOP_OFFSET / 2, 2.3, 0);
  } else {
    var d = Math.max(10, 14.5 / aspect);
    camGoalPos.set(stationX(at) + 1.6, 4.4, d);
    camGoalLook.set(stationX(at) + 0.9, 2.5, 0);
  }
  if (jump || motion.state === 'reduced') {
    camera.position.copy(camGoalPos);
    camLook.copy(camGoalLook);
  }
}

// Send the tile to a stop. The travel machine records that it is moving.
function sendTile(from, to) {
  tileFrom = from; tileTo = to; tileT = 0;
  travel.send('GO');
}

function loop() {
  requestAnimationFrame(loop);
  var now = performance.now();
  var dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += dt;
  var time = elapsed;
  var animated = motion.state === 'animated';

  // Camera eases toward its goal (or jumps there with reduced motion).
  var k = animated ? 1 - Math.pow(0.02, dt) : 1;
  camera.position.lerp(camGoalPos, k);
  camLook.lerp(camGoalLook, k);
  camera.lookAt(camLook);

  // Tile travel.
  if (travel.state === 'traveling') {
    tileT = animated ? Math.min(1, tileT + dt * 0.9) : 1;
    if (tileT >= 1) travel.send('ARRIVE');
  }
  var e = tileT < 0.5 ? 2 * tileT * tileT : 1 - Math.pow(-2 * tileT + 2, 2) / 2;
  tile.position.x = stopX(tileFrom) + (stopX(tileTo) - stopX(tileFrom)) * e;
  tile.position.y = 0.75 + (animated ? Math.sin(time * 2.5) * 0.06 + Math.sin(e * Math.PI) * 0.5 : 0);
  tile.rotation.y = animated && travel.state === 'traveling' ? Math.sin(e * Math.PI) * 0.6 : 0;
  tileLight.position.set(tile.position.x, tile.position.y + 0.3, TRACK_Z + 0.8);

  // Gates: the one at the tile's stop glows.
  for (var g = 0; g < gates.length; g++) {
    var active = g === tileTo && travel.state === 'resting' && STEPS[current].at >= 0;
    gates[g].material.emissive.set(active ? (currentMode === 'before' ? 0x7a1510 : 0x0f4a26) : 0x000000);
  }

  // Sound rings: expand and fade on a loop, or sit still with reduced motion.
  for (var r = 0; r < rings.length; r++) {
    var p = animated ? ((time * 0.6 + r / 3) % 1) : (r + 1) / 4;
    var reach = currentMode === 'before' ? 1.2 : 3.2;
    var s = 0.6 + p * reach;
    rings[r].scale.set(s, s, s);
    rings[r].material.opacity = (1 - p) * 0.85;
  }

  // The tree's button node pulses gently so the eye finds it.
  var pulse = animated ? 1 + Math.sin(time * 3) * 0.08 : 1;
  treeButtonNode.scale.setScalar(pulse);
  treeButtonWire.scale.setScalar(pulse);
  domButtonBox.rotation.y = animated ? Math.sin(time * 1.5) * 0.25 : 0;

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// 4. Moving between steps
// ---------------------------------------------------------------------------

function go(i) {
  var prev = current;
  current = Math.max(0, Math.min(STEPS.length - 1, i));
  var s = STEPS[current];
  document.body.setAttribute('data-step', String(current));
  document.body.setAttribute('data-phase', s.phase);

  stepTitle.textContent = s.title;
  stepBody.textContent = s.body;
  stepCount.textContent = 'Step ' + (current + 1) + ' of ' + STEPS.length + ' · ' + (s.mode === 'before' ? 'Before the fix' : 'After the fix');
  prevBtn.disabled = current === 0;
  nextBtn.textContent = current === STEPS.length - 1 ? 'Start over' : 'Next step →';
  modeBefore.setAttribute('aria-pressed', String(s.mode === 'before'));
  modeAfter.setAttribute('aria-pressed', String(s.mode === 'after'));
  document.getElementById('nextPiece').hidden = current !== STEPS.length - 1;

  if (view.state !== 'ready') return;
  if (s.mode !== currentMode) {
    setMode(s.mode);
    sendTile(tileTo, Math.max(0, s.at)); // a new trip starts from wherever the tile is
  } else if (s.at >= 0) {
    sendTile(tileTo, s.at);
  }
  aimCamera(s.at, false);
}

prevBtn.onclick = function () { go(current - 1); };
nextBtn.onclick = function () { go(current === STEPS.length - 1 ? 0 : current + 1); };
modeBefore.onclick = function () { go(0); };
modeAfter.onclick = function () { go(5); };
document.addEventListener('keydown', function (e) {
  var tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === 'ArrowRight') go(current + 1);
  if (e.key === 'ArrowLeft') go(current - 1);
});

// Show the words first, then build the 3D scene on the next tick, so the text never waits for WebGL.
go(0);
setTimeout(function () {
  initScene();
  if (view.state === 'ready') {
    setMode(STEPS[current].mode);
    aimCamera(STEPS[current].at, true);
    go(current);
  }
}, 0);
