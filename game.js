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
let remainingFields = 0;
let remainingShots = 0;
let levelState = "playing";
let shakeTime = 0;

let emitterPos = { x: 200, y: 350 };
let isAiming = false;
let mousePos = { x: 0, y: 0 };

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
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapLeft || minOverlap === overlapRight) {
          this.vx *= -1;
          this.x += minOverlap === overlapLeft ? -overlapLeft : overlapRight;
        } else {
          this.vy *= -1;
          this.y += minOverlap === overlapTop ? -overlapTop : overlapBottom;
        }
        spawnBurst(this.x, this.y, COLORS.barrier, 8);
        playTone(180, "sawtooth", 0.08);
      }
    }

    for (const node of targetNodes) {
      const dist = Math.hypot(this.x - node.x, this.y - node.y);
      if (dist < this.radius + node.radius) {
        node.activate();
      }
    }
  }

  draw() {
    ctx.save();
    for (let i = 1; i < this.trail.length; i++) {
      const ratio = i / this.trail.length;
      ctx.strokeStyle = `rgba(255, 190, 11, ${ratio * 0.75})`;
      ctx.lineWidth = ratio * 6;
      ctx.beginPath();
      ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
      ctx.lineTo(this.trail[i].x, this.trail[i].y);
      ctx.stroke();
    }

    ctx.shadowColor = COLORS.core;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 240;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.life = 0.45 + Math.random() * 0.35;
    this.maxLife = this.life;
    this.size = 2.5 + Math.random() * 3;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.life -= dt;
  }

  draw() {
    const ratio = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = ratio;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * ratio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Shockwave {
  constructor(x, y, color, maxRadius = 130) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = 8;
    this.maxRadius = maxRadius;
  }

  update(dt) {
    this.radius += 340 * dt;
  }

  draw() {
    const alpha = Math.max(0, 1 - this.radius / this.maxRadius);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function spawnBurst(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function loadLevel(index) {
  currentLevelIndex = index;
  const lvl = LEVELS[index];

  fields.length = 0;
  cores.length = 0;
  targetNodes.length = 0;
  barriers.length = 0;
  particles.length = 0;
  shockwaves.length = 0;

  remainingFields = lvl.maxFields;
  remainingShots = lvl.maxShots;
  levelState = "playing";
  overlayEl.classList.add("hidden");

  emitterPos = { x: lvl.emitter.x * width, y: lvl.emitter.y * height };

  lvl.nodes.forEach((n) => {
    targetNodes.push(new TargetNode(n.x * width, n.y * height));
  });

  lvl.barriers.forEach((b) => {
    barriers.push({ x: b.x * width, y: b.y * height, w: b.w, h: b.h });
  });

  updateHUD();
}

function updateHUD() {
  levelNumEl.textContent = currentLevelIndex + 1;
  const lit = targetNodes.filter((n) => n.activated).length;
  nodesLeftEl.textContent = `${lit}/${targetNodes.length}`;
  fieldsLeftEl.textContent = remainingFields;
  shotsLeftEl.textContent = remainingShots;
}

function checkLevelStatus() {
  if (levelState !== "playing") return;

  const allLit = targetNodes.every((n) => n.activated);
  if (allLit) {
    levelState = "won";
    setTimeout(() => {
      if (currentLevelIndex < LEVELS.length - 1) {
        overlayTitleEl.textContent = `¡NIVEL ${currentLevelIndex + 1} COMPLETADO!`;
        overlayDescEl.textContent = `Siguiente reto: ${LEVELS[currentLevelIndex + 1].name}`;
        overlayBtnEl.textContent = "Siguiente Nivel";
      } else {
        overlayTitleEl.textContent = "¡MAESTRO DE CHISPA // RIFT!";
        overlayDescEl.textContent = "Has energizado todos los sistemas del laboratorio.";
        overlayBtnEl.textContent = "Jugar de Nuevo";
      }
      overlayEl.classList.remove("hidden");
    }, 550);
    return;
  }

  if (remainingShots === 0 && cores.length === 0) {
    levelState = "lost";
    overlayTitleEl.textContent = "SIN ENERGÍA";
    overlayDescEl.textContent = "Faltaron cristales por encender. Ajusta tus campos e inténtalo de nuevo.";
    overlayBtnEl.textContent = "Reintentar Nivel";
    overlayEl.classList.remove("hidden");
  }
}

overlayBtnEl.addEventListener("click", () => {
  if (levelState === "won") {
    const next = currentLevelIndex < LEVELS.length - 1 ? currentLevelIndex + 1 : 0;
    loadLevel(next);
  } else {
    loadLevel(currentLevelIndex);
  }
});

function shootFromEmitter(targetX, targetY) {
  if (levelState !== "playing" || remainingShots <= 0) return;

  const dx = targetX - emitterPos.x;
  const dy = targetY - emitterPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 10) return;

  const speed = 430;
  const vx = (dx / dist) * speed;
  const vy = (dy / dist) * speed;

  cores.push(new EnergyCore(emitterPos.x, emitterPos.y, vx, vy));
  shockwaves.push(new Shockwave(emitterPos.x, emitterPos.y, COLORS.core, 85));
  remainingShots--;
  updateHUD();
  playTone(270, "triangle", 0.14);
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
  });
});

document.getElementById("btn-retry").addEventListener("click", () => loadLevel(currentLevelIndex));

canvas.addEventListener("mousemove", (e) => {
  mousePos = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("mousedown", (e) => {
  if (levelState !== "playing") return;

  if (e.button === 0) {
    if (remainingFields <= 0) {
      playTone(130, "sawtooth", 0.1);
      return;
    }
    fields.push(new ForceField(e.clientX, e.clientY, currentMode));
    shockwaves.push(new Shockwave(e.clientX, e.clientY, COLORS[currentMode], 95));
    remainingFields--;
    updateHUD();
    playTone(currentMode === "attract" ? 420 : currentMode === "repel" ? 190 : 330, "sine", 0.15);
  } else if (e.button === 2) {
    isAiming = true;
    mousePos = { x: e.clientX, y: e.clientY };
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 2 && isAiming) {
    isAiming = false;
    shootFromEmitter(e.clientX, e.clientY);
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.key === "1") document.getElementById("btn-attract").click();
  if (e.key === "2") document.getElementById("btn-repel").click();
  if (e.key === "3") document.getElementById("btn-vortex").click();
  if (e.key.toLowerCase() === "r") loadLevel(currentLevelIndex);
});

window.addEventListener("resize", () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  loadLevel(currentLevelIndex);
});

function drawGrid() {
  const step = 44;
  ctx.strokeStyle = "rgba(30, 41, 59, 0.45)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawEmitter() {
  ctx.save();
  ctx.strokeStyle = COLORS.core;
  ctx.shadowColor = COLORS.core;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.arc(emitterPos.x, emitterPos.y, 16, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = remainingShots > 0 ? COLORS.core : "#475569";
  ctx.beginPath();
  ctx.arc(emitterPos.x, emitterPos.y, 6, 0, Math.PI * 2);
  ctx.fill();

  if (isAiming && remainingShots > 0) {
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255, 190, 11, 0.75)";
    ctx.beginPath();
    ctx.moveTo(emitterPos.x, emitterPos.y);
    ctx.lineTo(mousePos.x, mousePos.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBarriers() {
  ctx.save();
  for (const b of barriers) {
    ctx.fillStyle = "rgba(255, 77, 109, 0.16)";
    ctx.strokeStyle = COLORS.barrier;
    ctx.shadowColor = COLORS.barrier;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  ctx.restore();
}

loadLevel(0);
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  ctx.save();
  if (shakeTime > 0) {
    shakeTime -= dt;
    ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  }

  ctx.fillStyle = "#080a12";
  ctx.fillRect(0, 0, width, height);
  drawGrid();
  drawBarriers();
  drawEmitter();

  targetNodes.forEach((n) => {
    n.update(dt);
    n.draw();
  });

  fields.forEach((f) => {
    f.update(dt);
    f.draw();
  });

  cores.forEach((c) => c.update(dt));

  for (let i = 0; i < cores.length; i++) {
    for (let j = i + 1; j < cores.length; j++) {
      const a = cores[i];
      const b = cores[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius;

      if (dist > 0 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        [a.vx, b.vx] = [b.vx, a.vx];
        [a.vy, b.vy] = [b.vy, a.vy];

        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;

        shakeTime = 0.1;
        spawnBurst(midX, midY, COLORS.attract, 22);
        shockwaves.push(new Shockwave(midX, midY, COLORS.attract, 165));
        playTone(520, "sine", 0.18);

        for (const node of targetNodes) {
          if (Math.hypot(midX - node.x, midY - node.y) < 165) {
            node.activate();
          }
        }
      }
    }
  }

  let coresExpired = false;
  for (let i = cores.length - 1; i >= 0; i--) {
    if (cores[i].life <= 0) {
      cores.splice(i, 1);
      coresExpired = true;
    } else {
      cores[i].draw();
    }
  }

  if (coresExpired) checkLevelStatus();

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (particles[i].life <= 0) particles.splice(i, 1);
    else particles[i].draw();
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    shockwaves[i].update(dt);
    if (shockwaves[i].radius >= shockwaves[i].maxRadius) shockwaves.splice(i, 1);
    else shockwaves[i].draw();
  }

  ctx.restore();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);