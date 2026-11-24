import Phaser from 'phaser';
import ArenaScene from './ArenaScene.js';
import { SPELLS, audioFX, fuseCards } from './spells.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const home = $('home-screen'), hud = $('arena-hud'), gameOver = $('game-over'), handRoot = $('card-hand'), gameMount = $('game');
let selectedSkin = { name: 'Arcane Cyan', color: '#36e7f2', hex: 0x36e7f2 };
let phaserGame;
let drag = null;

function showToast(text, color) {
  const toast = $('toast'); toast.textContent = text; toast.style.borderColor = color || '#36e7f2'; toast.classList.remove('hidden');
  window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.add('hidden'), 1450);
}

function renderHand(cards = []) {
  handRoot.innerHTML = cards.map((key, slot) => {
    if (!key) return `<div class="spell-card empty" data-slot="${slot}"><span>REFILLING</span></div>`;
    const card = SPELLS[key];
    return `<div class="spell-card" data-slot="${slot}" data-card="${key}" style="--card-color:${card.css}"><span class="card-icon">${card.icon}</span><b class="card-name">${card.name.toUpperCase()}</b><span class="card-meta">${card.short}</span></div>`;
  }).join('');
  handRoot.querySelectorAll('.spell-card[data-card]').forEach(el => el.addEventListener('pointerenter', () => audioFX.hover(), { once: true }));
}

function pointToWorld(clientX, clientY) {
  const scene = phaserGame?.scene.getScene('ArenaScene');
  const canvas = phaserGame?.canvas;
  if (!scene || !canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const sx = (clientX - rect.left) * (scene.scale.width / rect.width);
  const sy = (clientY - rect.top) * (scene.scale.height / rect.height);
  return scene.cameras.main.getWorldPoint(sx, sy);
}

function onPointerDown(event) {
  const cardEl = event.target.closest('.spell-card[data-card]');
  if (!cardEl) return;
  event.preventDefault();
  const slot = Number(cardEl.dataset.slot);
  drag = { slot, key: cardEl.dataset.card, pointerId: event.pointerId, moved: false, startX: event.clientX, startY: event.clientY };
  cardEl.classList.add('dragging');
  $('cast-ghost').textContent = 'DRAG INTO ARENA TO AIM · DROP ON ANOTHER CARD TO FUSE';
  $('cast-ghost').classList.remove('hidden');
  try { cardEl.setPointerCapture(event.pointerId); } catch { /* document listeners remain available */ }
}

function onPointerMove(event) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const travel = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
  if (travel > 10) drag.moved = true;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  handRoot.querySelectorAll('.spell-card').forEach(el => el.classList.toggle('fusion-pop', Boolean(target?.closest('.spell-card') && target.closest('.spell-card') !== el)));
  if (event.clientY < window.innerHeight - 125) {
    const worldPoint = pointToWorld(event.clientX, event.clientY);
    if (worldPoint) phaserGame.events.emit('ui:aim', { worldPoint, card: drag.key });
  } else {
    phaserGame.events.emit('ui:aim-cancel');
  }
}

function onPointerUp(event) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const from = drag.slot;
  const source = drag;
  drag = null;
  document.querySelectorAll('.spell-card').forEach(el => el.classList.remove('dragging', 'fusion-pop'));
  $('cast-ghost').classList.add('hidden');
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.spell-card[data-card]');
  if (target && Number(target.dataset.slot) !== from) {
    phaserGame.events.emit('ui:fuse', { from, to: Number(target.dataset.slot) });
    phaserGame.events.emit('ui:aim-cancel');
    return;
  }
  if (source.moved && event.clientY < window.innerHeight - 125) {
    const scene = phaserGame.scene.getScene('ArenaScene');
    const point = pointToWorld(event.clientX, event.clientY);
    if (point && scene.player) {
      const dx = point.x - scene.player.x, dy = point.y - scene.player.y, length = Math.max(1, Math.hypot(dx, dy));
      phaserGame.events.emit('ui:cast', { card: source.key, direction: { x: dx / length, y: dy / length } });
      scene.startCooldown(from);
      renderHand(scene.hand);
    }
  } else {
    phaserGame.events.emit('ui:aim-cancel');
  }
}

handRoot.addEventListener('pointerdown', onPointerDown);
document.addEventListener('pointermove', onPointerMove, { passive: false });
document.addEventListener('pointerup', onPointerUp);
document.addEventListener('pointercancel', onPointerUp);

const moveStick = $('move-stick');
const stickBase = moveStick.querySelector('.stick-base');
const stickKnob = $('stick-knob');
let stickPointerId = null;

function moveJoystick(event) {
  const rect = stickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  const radius = rect.width * 0.34;
  const scale = distance > radius ? radius / distance : 1;
  const offsetX = dx * scale;
  const offsetY = dy * scale;
  stickKnob.style.left = `calc(50% + ${offsetX}px)`;
  stickKnob.style.top = `calc(50% + ${offsetY}px)`;

  const deadZone = 8;
  const strength = distance <= deadZone ? 0 : Math.min(1, (distance - deadZone) / (radius - deadZone));
  const length = Math.max(1, distance);
  phaserGame.events.emit('ui:move', { x: (dx / length) * strength, y: (dy / length) * strength });
}

moveStick.addEventListener('pointerdown', event => {
  if (stickPointerId !== null) return;
  event.preventDefault();
  event.stopPropagation();
  stickPointerId = event.pointerId;
  moveStick.classList.add('active');
  stickKnob.style.left = '50%';
  stickKnob.style.top = '50%';
  moveStick.setPointerCapture(event.pointerId);
  moveJoystick(event);
});
moveStick.addEventListener('pointermove', event => {
  if (event.pointerId !== stickPointerId) return;
  event.preventDefault();
  moveJoystick(event);
});
function releaseJoystick(event) {
  if (event.pointerId !== stickPointerId) return;
  stickPointerId = null;
  moveStick.classList.remove('active');
  stickKnob.style.left = '50%';
  stickKnob.style.top = '50%';
  phaserGame.events.emit('ui:move-end');
}
moveStick.addEventListener('pointerup', releaseJoystick);
moveStick.addEventListener('pointercancel', releaseJoystick);

function enterArena() {
  audioFX.ensure();
  const name = $('player-name').value.trim().slice(0, 14) || 'Player';
  home.classList.add('hidden'); gameOver.classList.add('hidden'); hud.classList.remove('hidden');
  phaserGame.events.emit('ui:start', { name, skin: selectedSkin });
}
function showHome() {
  gameOver.classList.add('hidden'); hud.classList.add('hidden'); home.classList.remove('hidden');
  phaserGame.events.emit('ui:home');
}

$('enter-arena').addEventListener('click', enterArena);
$('home-button').addEventListener('click', showHome);
$('gameover-home').addEventListener('click', showHome);
$('play-again').addEventListener('click', enterArena);
$('player-name').addEventListener('keydown', event => { if (event.key === 'Enter') enterArena(); });

document.querySelectorAll('.skin-option').forEach(button => button.addEventListener('click', () => {
  selectedSkin = { name: button.dataset.skin, color: button.dataset.color, hex: Number.parseInt(button.dataset.color.slice(1),16) };
  document.querySelectorAll('.skin-option').forEach(s => s.classList.toggle('active', s === button));
  $('skin-title').textContent = selectedSkin.name.toUpperCase();
  document.querySelector('.showcase').style.setProperty('--aura', selectedSkin.color);
  document.querySelector('.showcase').style.setProperty('--cyan', selectedSkin.color);
  document.documentElement.style.setProperty('--cyan', selectedSkin.color);
}));

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#090d19',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, pixelArt: false, roundPixels: true },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scene: [ArenaScene],
};
phaserGame = new Phaser.Game(config);
phaserGame.events.on('arena:hand', renderHand);
phaserGame.events.on('arena:started', ({ hand }) => renderHand(hand));
phaserGame.events.on('arena:toast', ({ text, color }) => showToast(text, color));
phaserGame.events.on('arena:home', () => { hud.classList.add('hidden'); home.classList.remove('hidden'); });
phaserGame.events.on('arena:over', ({ kills, score, rank }) => {
  hud.classList.add('hidden'); $('final-kills').textContent = kills; $('final-score').textContent = score; $('final-rank').textContent = `#${rank}`;
  gameOver.classList.remove('hidden');
});

window.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('keydown', event => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key)) event.preventDefault(); }, { passive: false });
