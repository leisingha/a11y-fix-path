// Draws a flat card with a title and lines of text onto a canvas, for use as a Three.js texture.
import * as THREE from 'three';

export function makePanelTexture(title, lines, opts) {
  opts = opts || {};
  var w = opts.width || 512;
  var h = opts.height || 384;
  var c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  var g = c.getContext('2d');
  g.scale(2, 2);
  drawPanel(g, w, h, title, lines, opts);
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function drawPanel(g, w, h, title, lines, opts) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = opts.bg || '#ffffff';
  roundRect(g, 0, 0, w, h, 22); g.fill();
  g.lineWidth = 6;
  g.strokeStyle = opts.border || '#1d1d1f';
  roundRect(g, 3, 3, w - 6, h - 6, 20); g.stroke();
  g.fillStyle = opts.titleColor || '#1d1d1f';
  g.font = '700 30px system-ui, sans-serif';
  g.fillText(title, 26, 52);
  g.fillStyle = '#d9d5cc';
  g.fillRect(26, 68, w - 52, 3);
  var y = 112;
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    g.fillStyle = ln.color || '#1d1d1f';
    g.font = (ln.bold ? '700 ' : '400 ') + (ln.size || 24) + 'px ' + (ln.mono ? 'ui-monospace, Menlo, Consolas, monospace' : 'system-ui, sans-serif');
    g.fillText(ln.text, 26 + (ln.indent || 0) * 22, y);
    y += (ln.size || 24) + 16;
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
