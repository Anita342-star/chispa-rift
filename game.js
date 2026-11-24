const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

const levelNumEl = document.getElementById("level-num");
const nodesLeftEl = document.getElementById("nodes-left");
const fieldsLeftEl = document.getElementById("fields-left");
const shotsLeftEl = document.getElementById("shots-left");

const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayDescEl = document.getElementById("overlay-desc");
const overlayBtnEl = document.getElementById("overlay-btn");

canvas.style.touchAction = "none";
document.body.style.overscrollBehavior = "none";

let width = (canvas.width = window.innerWidth);
let height = (canvas.height = window.innerHeight);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq = 320, type = "sine", duration = 0.16) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.45, audioCtx.currentTime + duration);

  gain.gain.setValueAtTime(0.09, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const COLORS = {
  attract: "#00f5d4",
  repel: "#ff2a85",
  vortex: "#9b5de5",
  core: "#ffbe0b",
  nodeOff: "#475569",
  nodeOn: "#00f5d4",
  barrier: "#ff4d6d",
};

const LEVELS = [
  {
    name: "Primer Contacto",
    maxFields: 2,
    maxShots: 3,
    emitter: { x: 0.2, y: 0.5 },
    nodes: [
      { x: 0.55, y: 0.32 },
      { x: 0.78, y: 0.55 },
    ],
    barriers: [],
  },
  {
    name: "Órbita Curva",
    maxFields: 2,
    maxShots: 3,
    emitter: { x: 0.18, y: 0.72 },
    nodes: [
      { x: 0.48, y: 0.25 },
      { x: 0.76, y: 0.35 },
      { x: 0.82, y: 0.72 },
    ],
    barriers: [{ x: 0.48, y: 0.52, w: 30, h: 240 }],
  },
  {
    name: "Doble Vórtice",
    maxFields: 3,
    maxShots: 3,
    emitter: { x: 0.5, y: 0.82 },
    nodes: [
      { x: 0.22, y: 0.3 },
      { x: 0.5, y: 0.22 },
      { x: 0.78, y: 0.3 },
      { x: 0.35, y: 0.55 },
    ],
    barriers: [{ x: 0.5, y: 0.52, w: 220, h: 24 }],
  },
  {
    name: "Reacción en Cadena",
    maxFields: 3,
    maxShots: 2,
    emitter: { x: 0.16, y: 0.5 },
    nodes: [
      { x: 0.42, y: 0.25 },
      { x: 0.42, y: 0.75 },
      { x: 0.68, y: 0.25 },
      { x: 0.68, y: 0.75 },
      { x: 0.86, y: 0.5 },
    ],
    barriers: [{ x: 0.55, y: 0.5, w: 26, h: 190 }],
  },
  {
    name: "Núcleo Maestro",
    maxFields: 4,
    maxShots: 3,
    emitter: { x: 0.5, y: 0.5 },
    nodes: [
      { x: 0.2, y: 0.22 },
      { x: 0.8, y: 0.22 },
      { x: 0.2, y: 0.78 },
      { x: 0.8, y: 0.78 },
      { x: 0.5, y: 0.18 },
      { x: 0.5, y: 0.82 },
    ],
    barriers: [
      { x: 0.34, y: 0.5, w: 24, h: 180 },
      { x: 0.66, y: 0.5, w: 24, h: 180 },
    ],
  },
];

let currentLevelIndex = 0;
let currentMode = "attract";
let mobileShootMode = false;
let remainingFields = 0;
let remainingShots = 0;
let levelState = "playing";
let shakeTime = 0;

let emitterPos = { x: 200, y: 350 };
let isAiming = false;
let aimInputType = null;
let mousePos = { x: 0, y: 0 };

// Botón táctil visible en pantalla para apuntar y disparar fácil en celular
const shootToggleBtn = document.createElement("button");
shootToggleBtn.id = "mobile-shoot-toggle";
shootToggleBtn.type = "button";
shootToggleBtn.textContent = "🎯 Modo Disparo: OFF";
Object.assign(shootToggleBtn.style, {
  position: "fixed",
  bottom: "16px",
  right: "16px",
  zIndex: "999",
  padding: "12px 16px",
  borderRadius: "999px",
  border: "2px solid #ffbe0b",
  background: "rgba(15, 23, 42, 0.9)",
  color: "#ffbe0b",
  fontWeight: "700",
  fontSize: "14px",
  cursor: "pointer",
  touchAction: "manipulation",
});
document.body.appendChild(shootToggleBtn);

function updateShootToggleUI() {
  shootToggleBtn.textContent = mobileShootMode ? "🎯 Modo Disparo: ON" : "🎯 Modo Disparo: OFF";
  shootToggleBtn.style.background = mobileShootMode ? "#ffbe0b" : "rgba(15, 23, 42, 0.9)";
  shootToggleBtn.style.color = mobileShootMode ? "#080a12" : "#ffbe0b";
}

shootToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  mobileShootMode = !mobileShootMode;
  updateShootToggleUI();
  playTone(mobileShootMode ? 480 : 300, "sine", 0.1);
});

const fields = [];
const cores = [];
const targetNodes = [];
const barriers = [];
const particles = [];
const shockwaves = [];

class TargetNode {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 22;
    this.activated = false;
    this.rotation = Math.random() * Math.PI;
    this.pulse = 0;
  }

  activate() {
    if (this.activated) return;
    this.activated = true;
    this.pulse = 1;
    shakeTime = 0.09;
    spawnBurst(this.x, this.y, COLORS.nodeOn, 26);
    shockwaves.push(new Shockwave(this.x, this.y, COLORS.nodeOn, 150));

    const litCount = targetNodes.filter((n) => n.activated).length;
    playTone(340 + litCount * 95, "triangle", 0.24);
    updateHUD();
    checkLevelStatus();
  }

  update(dt) {
    this.rotation += (this.activated ? 2.2 : 0.6) * dt;
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 2);
  }

  draw() {
    const color = this.activated ? COLORS.nodeOn : COLORS.nodeOff;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.activated) {
      ctx.shadowColor = COLORS.nodeOn;
      ctx.shadowBlur = 22;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = this.activated ? 3.5 : 2.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const r = this.radius + this.pulse * 6;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    if (this.activated) {
      ctx.fillStyle = "rgba(0, 245, 212, 0.25)";
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }
}

class ForceField {
  constructor(x, y, mode) {
    this.x = x;
    this.y = y;
    this.mode = mode;
    this.radius = 235;
    this.strength = 720;
    this.phase = 0;
  }

  apply(core, dt) {
    const dx = this.x - core.x;
    const dy = this.y - core.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 14 && dist < this.radius) {
      const nx = dx / dist;
      const ny = dy / dist;
      const falloff = 1 - dist / this.radius;

      if (this.mode === "attract") {
        core.vx += nx * this.strength * falloff * dt;
        core.vy += ny * this.strength * falloff * dt;
      } else if (this.mode === "repel") {
        core.vx -= nx * this.strength * 1.2 * falloff * dt;
        core.vy -= ny * this.strength * 1.2 * falloff * dt;
      } else if (this.mode === "vortex") {
        core.vx += (-ny * 1.15 + nx * 0.35) * this.strength * falloff * dt;
        core.vy += (nx * 1.15 + ny * 0.35) * this.strength * falloff * dt;
      }
    }
  }

  update(dt) {
    this.phase += dt * 4;
  }

  draw() {
    const color = COLORS[this.mode];
    const pulse = Math.sin(this.phase) * 4;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(this.x, this.y, 14 + pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class EnergyCore {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 9;
    this.trail = [];
    this.life = 9.5;
  }

  update(dt) {
    this.life -= dt;

    for (const field of fields) {
      field.apply(this, dt);
    }

    const speed = Math.hypot(this.vx, this.vy);
    const maxSpeed = 760;
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 18) this.trail.shift();

    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx);
    } else if (this.x + this.radius > width) {
      this.x = width - this.radius;
      this.vx = -Math.abs(this.vx);
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    } else if (this.y + this.radius > height) {
      this.y = height - this.radius;
      this.vy = -Math.abs(this.vy);
    }

    for (const b of barriers) {
      const left = b.x - b.w / 2;
      const right = b.x + b.w / 2;
      const top = b.y - b.h / 2;
      const bottom = b.y + b.h / 2;

      if (
        this.x + this.radius > left &&
        this.x - this.radius < right &&
        this.y + this.radius > top &&
        this.y - this.radius < bottom
      ) {
        const overlapLeft = this.x + this.radius - left;
        const overlapRight = right - (this.x - this.radius);
        const overlapTop = this.y + this.radius - top;
        const overlapBottom = bottom - (this.y - this.radius);
        const minOverlap = Math.
