export const SPELLS = {
  fireball: { name: 'Fireball', icon: '✹', color: 0xff655a, css: '#ff655a', damage: 35, short: '35 DMG · SPLASH' },
  frost: { name: 'Frost Shard', icon: '❄', color: 0x53e9f2, css: '#53e9f2', damage: 25, short: '25 DMG · SLOW' },
  volt: { name: 'Volt Bolt', icon: 'ϟ', color: 0xffdb62, css: '#ffdb62', damage: 30, short: '30 DMG · BOUNCE' },
  blink: { name: 'Blink Dash', icon: '➤', color: 0xb48aff, css: '#b48aff', damage: 15, short: '15 DMG · DASH' },
  nova: { name: 'Shock Nova', icon: '◉', color: 0x8cff86, css: '#8cff86', damage: 30, short: '30 DMG · KNOCKBACK' },
  plasma: { name: 'Plasma Beam', icon: 'ϟ', color: 0xe8fbff, css: '#a5f8ff', damage: 60, short: '60 DMG · PIERCING' },
  thermal: { name: 'Thermal Shatter', icon: '✹', color: 0xffad7d, css: '#ffad7d', damage: 50, short: '50 DMG · FREEZE' },
  meteor: { name: 'Meteor Charge', icon: '☄', color: 0xff9a56, css: '#ff9a56', damage: 55, short: '55 DMG · IMPACT' },
  storm: { name: 'Storm Ring', icon: 'ϟ', color: 0xc4f1ff, css: '#c4f1ff', damage: 45, short: '45 × 3 · FAN' },
  shadow: { name: 'Shadow Step', icon: '◈', color: 0xc797ff, css: '#c797ff', damage: 0, short: 'TELEPORT · DECOY' },
  overdrive: { name: 'Arcane Overdrive', icon: '✦', color: 0xf1aaff, css: '#f1aaff', damage: 42, short: '42 DMG · ARCANE' },
};

const recipes = new Map([
  ['fireball+volt', 'plasma'], ['fireball+frost', 'thermal'], ['blink+fireball', 'meteor'],
  ['nova+volt', 'storm'], ['blink+frost', 'shadow'],
]);

export function fuseCards(a, b) {
  return recipes.get([a, b].sort().join('+')) ?? 'overdrive';
}

export class AudioFX {
  constructor() { this.context = null; this.master = null; }
  ensure() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume();
    return this.context;
  }
  tone({ frequency = 440, end = frequency, duration = 0.12, type = 'sine', volume = 0.18, delay = 0 }) {
    const c = this.ensure(); if (!c) return;
    const osc = c.createOscillator(), gain = c.createGain(), start = c.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(frequency, start); osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), start + duration);
    gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(start); osc.stop(start + duration + 0.02);
  }
  noise(duration = 0.18, volume = 0.12) {
    const c = this.ensure(); if (!c) return;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 1500;
    gain.gain.setValueAtTime(volume, c.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start();
  }
  hover() { this.tone({ frequency: 680, end: 920, duration: 0.055, volume: 0.055 }); }
  fuse() { [330, 495, 660, 990].forEach((frequency, i) => this.tone({ frequency, end: frequency * 1.4, duration: 0.22, type: 'triangle', volume: 0.12, delay: i * 0.055 })); }
  launch() { this.noise(0.16, 0.11); this.tone({ frequency: 210, end: 70, duration: 0.22, type: 'sawtooth', volume: 0.09 }); }
  impact() { this.noise(0.11, 0.15); this.tone({ frequency: 155, end: 50, duration: 0.12, type: 'square', volume: 0.08 }); }
  defeat() { this.noise(0.9, 0.25); [220, 165, 110, 55].forEach((frequency, i) => this.tone({ frequency, end: frequency * 0.5, duration: 0.8, type: 'sawtooth', volume: 0.13, delay: i * 0.12 })); }
}

export const audioFX = new AudioFX();
