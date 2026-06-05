'use strict';

// ──────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────
const CFG = {
  roundTime: 180,       // seconds per round
  maxRounds: 3,
  gravity: 0.55,
  groundY: 0,           // set after canvas resize
  canvasW: 0,
  canvasH: 0,

  moves: {
    jab:      { damage: [6,10],  stamina: 8,  duration: 18, range: 95,  knockback: 2,  stun: 5 },
    cross:    { damage: [12,18], stamina: 14, duration: 28, range: 95,  knockback: 5,  stun: 10 },
    hook:     { damage: [14,20], stamina: 16, duration: 30, range: 90,  knockback: 6,  stun: 12 },
    uppercut: { damage: [16,22], stamina: 18, duration: 32, range: 75,  knockback: 4,  stun: 14 },
    kick:     { damage: [18,26], stamina: 20, duration: 36, range: 120, knockback: 8,  stun: 8 },
    takedown: { damage: [20,30], stamina: 25, duration: 50, range: 85,  knockback: 0,  stun: 40 },
  },

  colors: {
    p1: { body: '#2266ff', skin: '#ffcc99', shorts: '#1144cc', accent: '#66aaff' },
    ai: { body: '#cc2211', skin: '#cc9966', shorts: '#881100', accent: '#ff6644' },
  },
};

// ──────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────
let canvas, ctx;
let gameRunning = false;
let round = 1;
let timerSecs = CFG.roundTime;
let timerInterval = null;
let comboTimer = 0;
let comboCount = 0;
let lastComboMove = '';
let animFrame = null;
let particles = [];

const keys = {};

// ──────────────────────────────────────────────
//  FIGHTER CLASS
// ──────────────────────────────────────────────
class Fighter {
  constructor(x, isAI, cfg) {
    this.x = x;
    this.y = 0;
    this.vy = 0;
    this.facing = isAI ? -1 : 1;
    this.isAI = isAI;
    this.colors = cfg;

    this.hp = 100;
    this.maxHp = 100;
    this.stamina = 100;
    this.maxStamina = 100;

    this.w = 48;
    this.h = 100;

    this.state = 'idle';   // idle | attack | hurt | down | duck | jump
    this.stateTimer = 0;
    this.attackMove = null;
    this.attackHit = false;

    this.stunTimer = 0;
    this.blockTimer = 0;
    this.groundTimer = 0; // time lying on ground after takedown

    // stats
    this.totalDmgDealt = 0;
    this.hitLanded = 0;
    this.hitTaken = 0;

    // AI
    this.aiCooldown = 0;
    this.aiReactDelay = 0;
  }

  get onGround() { return this.y >= CFG.groundY; }
  get centerX() { return this.x + this.w / 2; }
  get feetY() { return this.y + this.h; }
}

let p1, ai;

// ──────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────
function initCanvas() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const gs = document.getElementById('game-screen');
  canvas.width = gs.clientWidth || window.innerWidth;
  canvas.height = gs.clientHeight || window.innerHeight;
  CFG.canvasW = canvas.width;
  CFG.canvasH = canvas.height;
  CFG.groundY = canvas.height * 0.72;
  if (p1) { p1.y = CFG.groundY - p1.h; if (p1.y < 0) p1.y = 0; }
  if (ai) { ai.y = CFG.groundY - ai.h; if (ai.y < 0) ai.y = 0; }
}

// ──────────────────────────────────────────────
//  SCREENS
// ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = ''; });
  const el = document.getElementById(id);
  el.classList.add('active');
  if (id === 'game-screen') el.style.display = 'block';
}

function showControls() {
  document.getElementById('controls-panel').classList.toggle('hidden');
}

function startGame() {
  showScreen('game-screen');
  initCanvas();
  resetRound(true);
  setupKeys();
  showBanner('fight-banner', 'FIGHT!', 1800);
  gameRunning = true;
  startTimer();
  loop();
}

function resetRound(fullReset) {
  if (fullReset) {
    round = 1;
    p1 = new Fighter(CFG.canvasW * 0.25, false, CFG.colors.p1);
    ai = new Fighter(CFG.canvasW * 0.70, true,  CFG.colors.ai);
    ai.facing = -1;
    p1.facing = 1;
  } else {
    p1.x = CFG.canvasW * 0.25;
    ai.x = CFG.canvasW * 0.70;
    p1.hp = 100; ai.hp = 100;
    p1.stamina = 100; ai.stamina = 100;
    p1.state = 'idle'; ai.state = 'idle';
    p1.stunTimer = 0; ai.stunTimer = 0;
    p1.groundTimer = 0; ai.groundTimer = 0;
  }
  p1.y = CFG.groundY - p1.h;
  ai.y = CFG.groundY - ai.h;
  timerSecs = CFG.roundTime;
  particles = [];
  updateHUD();
}

// ──────────────────────────────────────────────
//  INPUT
// ──────────────────────────────────────────────
function setupKeys() {
  document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
}

function mobileMove(dir, down) {
  if (dir === 'left')  { keys['a'] = down; }
  if (dir === 'right') { keys['d'] = down; }
}
function mobileAction(act, down) {
  if (act === 'duck') keys['s'] = down;
  if (act === 'jump') triggerJump(p1);
}
function mobileAttack(move) { triggerAttack(p1, move); }

// ──────────────────────────────────────────────
//  TIMER
// ──────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    timerSecs--;
    updateTimerDisplay();
    if (timerSecs <= 0) endRound('time');
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(timerSecs / 60);
  const s = timerSecs % 60;
  document.getElementById('timer').textContent = `${m}:${s.toString().padStart(2,'0')}`;
}

// ──────────────────────────────────────────────
//  MAIN LOOP
// ──────────────────────────────────────────────
function loop() {
  if (!gameRunning) return;
  update();
  render();
  animFrame = requestAnimationFrame(loop);
}

function update() {
  processInput();
  updateFighter(p1);
  updateFighter(ai);
  runAI();
  checkHitboxes();
  updateParticles();
  updateHUD();
  updateCombo();

  // face each other
  if (p1.state !== 'down' && ai.state !== 'down') {
    p1.facing = p1.centerX < ai.centerX ? 1 : -1;
    ai.facing = ai.centerX < p1.centerX ? 1 : -1;
  }
}

// ──────────────────────────────────────────────
//  PLAYER INPUT
// ──────────────────────────────────────────────
function processInput() {
  if (p1.stunTimer > 0 || p1.groundTimer > 0) return;
  if (p1.state === 'attack') return;

  const speed = 3.5;
  if (keys['a'] || keys['arrowleft']) p1.x -= speed;
  if (keys['d'] || keys['arrowright']) p1.x += speed;

  if ((keys['w'] || keys['arrowup']) && p1.onGround) triggerJump(p1);

  p1.state = 'idle';
  if (keys['s']) { p1.state = 'duck'; return; }

  // attacks
  if (keys['j']) triggerAttack(p1, 'jab');
  else if (keys['k']) triggerAttack(p1, 'cross');
  else if (keys['l']) triggerAttack(p1, 'kick');
  else if (keys['u']) triggerAttack(p1, 'hook');
  else if (keys['i']) triggerAttack(p1, 'uppercut');
  else if (keys['o']) triggerAttack(p1, 'takedown');

  // clamp
  p1.x = clamp(p1.x, 0, CFG.canvasW - p1.w);
}

// ──────────────────────────────────────────────
//  FIGHTER PHYSICS
// ──────────────────────────────────────────────
function updateFighter(f) {
  // gravity
  if (!f.onGround) {
    f.vy += CFG.gravity;
    f.y += f.vy;
    if (f.y >= CFG.groundY - f.h) {
      f.y = CFG.groundY - f.h;
      f.vy = 0;
      if (f.state === 'jump') f.state = 'idle';
    }
  }

  // timers
  if (f.stateTimer > 0) { f.stateTimer--; if (f.stateTimer === 0 && f.state === 'attack') f.state = 'idle'; }
  if (f.stunTimer > 0)  { f.stunTimer--;  if (f.stunTimer === 0) f.state = 'idle'; }
  if (f.groundTimer > 0){ f.groundTimer--; if (f.groundTimer === 0) f.state = 'idle'; }

  // stamina regen
  if (f.stamina < f.maxStamina) f.stamina = Math.min(f.maxStamina, f.stamina + 0.15);
}

function triggerJump(f) {
  if (!f.onGround || f.groundTimer > 0) return;
  f.vy = -13;
  f.state = 'jump';
}

function triggerAttack(f, moveName) {
  if (f.state === 'attack' || f.stunTimer > 0 || f.groundTimer > 0) return;
  const mv = CFG.moves[moveName];
  if (!mv) return;
  if (f.stamina < mv.stamina) return; // too tired
  f.state = 'attack';
  f.attackMove = moveName;
  f.attackHit = false;
  f.stateTimer = mv.duration;
  f.stamina -= mv.stamina;
}

// ──────────────────────────────────────────────
//  HITBOX CHECK
// ──────────────────────────────────────────────
function checkHitboxes() {
  tryHit(p1, ai);
  tryHit(ai, p1);
}

function tryHit(attacker, defender) {
  if (attacker.state !== 'attack' || attacker.attackHit) return;
  if (attacker.stateTimer > CFG.moves[attacker.attackMove].duration - 6) return; // startup frames
  const mv = CFG.moves[attacker.attackMove];
  const dist = Math.abs(attacker.centerX - defender.centerX);
  if (dist > mv.range) return;

  attacker.attackHit = true;

  // block check
  const isBlocking = defender.state === 'duck';
  if (isBlocking) {
    spawnParticles(defender.centerX, defender.y + 30, '#aaaaff', 8);
    defender.stamina = Math.max(0, defender.stamina - 10);
    return;
  }

  const dmg = rand(mv.damage[0], mv.damage[1]);
  const actual = Math.round(dmg);
  defender.hp = Math.max(0, defender.hp - actual);
  attacker.totalDmgDealt += actual;
  attacker.hitLanded++;
  defender.hitTaken++;

  // knockback
  const dir = attacker.centerX < defender.centerX ? 1 : -1;
  if (attacker.attackMove === 'takedown') {
    defender.groundTimer = 90;
    defender.state = 'down';
    defender.stunTimer = 0;
  } else {
    defender.stunTimer = mv.stun;
    defender.state = 'hurt';
    defender.x += dir * mv.knockback * 3;
    defender.x = clamp(defender.x, 0, CFG.canvasW - defender.w);
  }

  // hit particles
  const col = attacker.attackMove === 'kick' ? '#ffaa00' :
              attacker.attackMove === 'takedown' ? '#aa66ff' : '#ff4422';
  spawnParticles(defender.centerX, defender.y + 40, col, 14);
  if (!attacker.isAI) trackCombo(attacker.attackMove);

  if (defender.hp <= 0) { endRound('ko', attacker); }
}

// ──────────────────────────────────────────────
//  COMBO TRACKER
// ──────────────────────────────────────────────
function trackCombo(moveName) {
  comboCount++;
  lastComboMove = moveName;
  comboTimer = 90; // frames
  if (comboCount >= 2) {
    const labels = { jab:'JAB', cross:'CROSS', hook:'HOOK', uppercut:'UPPER', kick:'KICK', takedown:'TAKEDOWN' };
    document.getElementById('combo-display').textContent = `${comboCount}x COMBO — ${labels[moveName] || moveName}`;
  }
}

function updateCombo() {
  if (comboTimer > 0) { comboTimer--; if (comboTimer === 0) { comboCount = 0; document.getElementById('combo-display').textContent = ''; } }
}

// ──────────────────────────────────────────────
//  AI
// ──────────────────────────────────────────────
function runAI() {
  if (!gameRunning) return;
  if (ai.stunTimer > 0 || ai.groundTimer > 0 || ai.state === 'attack') return;

  const dist = Math.abs(ai.centerX - p1.centerX);
  ai.aiCooldown = Math.max(0, ai.aiCooldown - 1);
  ai.aiReactDelay = Math.max(0, ai.aiReactDelay - 1);
  if (ai.aiReactDelay > 0) return;

  const difficulty = Math.min(1, (CFG.maxRounds - round + 1) * 0.33 + 0.2);
  const speed = 2.8 * difficulty + 1.2;

  // approach or back off
  if (dist > 100) {
    ai.x += ai.facing * speed;
  } else if (dist < 50 && Math.random() < 0.03) {
    ai.x -= ai.facing * speed * 2;
  }
  ai.x = clamp(ai.x, 0, CFG.canvasW - ai.w);

  if (ai.aiCooldown > 0) return;

  // block if player is attacking
  if (p1.state === 'attack' && dist < 110 && Math.random() < 0.35 * difficulty) {
    ai.state = 'duck';
    ai.stateTimer = 25;
    ai.aiReactDelay = 20;
    ai.aiCooldown = 30;
    return;
  }

  if (dist < 110 && Math.random() < 0.04 * (difficulty + 0.5)) {
    // pick move weighted by difficulty
    const pool = ['jab','jab','cross','hook','kick','uppercut'];
    if (difficulty > 0.5) pool.push('kick','hook','takedown');
    const move = pool[Math.floor(Math.random() * pool.length)];
    triggerAttack(ai, move);
    ai.aiCooldown = 30 + Math.floor(Math.random() * 30 * (1 - difficulty));
    ai.aiReactDelay = 8;
  }
}

// ──────────────────────────────────────────────
//  PARTICLES
// ──────────────────────────────────────────────
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - .5) * 6,
      vy: (Math.random() - 1) * 5 - 2,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color, size: 3 + Math.random() * 4,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.2;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ──────────────────────────────────────────────
//  HUD UPDATE
// ──────────────────────────────────────────────
function updateHUD() {
  const p1hp = Math.max(0, p1.hp);
  const aihp = Math.max(0, ai.hp);
  document.getElementById('p1-health-bar').style.width = p1hp + '%';
  document.getElementById('p2-health-bar').style.width = aihp + '%';
  document.getElementById('p1-stamina-bar').style.width = p1.stamina + '%';
  document.getElementById('p2-stamina-bar').style.width = ai.stamina + '%';
  document.getElementById('p1-hp-text').textContent = Math.ceil(p1hp);
  document.getElementById('p2-hp-text').textContent = Math.ceil(aihp);
  document.getElementById('round-text').textContent = `RUNDE ${round}/${CFG.maxRounds}`;

  // color health bar red when low
  const p1bar = document.getElementById('p1-health-bar');
  const p2bar = document.getElementById('p2-health-bar');
  p1bar.style.background = p1hp < 30 ? 'linear-gradient(90deg,#cc2200,#ff4422)' : 'linear-gradient(90deg,#22cc44,#88ff44)';
  p2bar.style.background = aihp < 30 ? 'linear-gradient(90deg,#cc2200,#ff4422)' : 'linear-gradient(90deg,#22cc44,#88ff44)';
}

// ──────────────────────────────────────────────
//  ROUND / GAME END
// ──────────────────────────────────────────────
function endRound(reason, winner) {
  gameRunning = false;
  clearInterval(timerInterval);

  let msg = '';
  if (reason === 'ko') {
    msg = winner.isAI ? 'KO!' : 'KO!';
    showBanner('ko-banner', msg, 2500);
  } else {
    showBanner('ko-banner', 'TIME!', 2000);
  }

  setTimeout(() => {
    const p1Won = reason === 'ko' ? !winner.isAI : p1.hp >= ai.hp;
    if (round < CFG.maxRounds && reason !== 'ko') {
      round++;
      resetRound(false);
      gameRunning = true;
      startTimer();
      showBanner('fight-banner', `RUNDE ${round}!`, 1800);
      loop();
    } else {
      showResult(p1Won, reason);
    }
  }, 2600);
}

function showResult(p1Won, reason) {
  const title = p1Won ? '🏆 SIEG!' : '💀 NIEDERLAGE';
  const sub = reason === 'ko' ? 'K.O.' : reason === 'time' ? 'Zeitentscheidung' : '';
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-subtitle').textContent = sub;
  document.getElementById('result-stats').innerHTML = `
    Schaden verursacht: ${p1.totalDmgDealt}<br>
    Treffer gelandet: ${p1.hitLanded}<br>
    Treffer erhalten: ${p1.hitTaken}
  `;
  showScreen('result-screen');
}

function restartGame() { round = 1; startGame(); }
function goHome() { cancelAnimationFrame(animFrame); clearInterval(timerInterval); showScreen('start-screen'); }

// ──────────────────────────────────────────────
//  RENDER
// ──────────────────────────────────────────────
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  drawBackground(W, H);
  drawShadow(p1);
  drawShadow(ai);
  drawFighter(p1);
  drawFighter(ai);
  drawParticles();
  drawHitEffect(p1);
  drawHitEffect(ai);
}

function drawBackground(W, H) {
  // gradient floor
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0e1020');
  grad.addColorStop(0.5, '#12141a');
  grad.addColorStop(1, '#1a1010');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // octagon cage lines (simplified)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,80,0,0.12)';
  ctx.lineWidth = 2;
  const cx = W / 2, cy = H * 0.5, r = Math.min(W, H) * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.45;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // ground
  const gGrad = ctx.createLinearGradient(0, CFG.groundY - 10, 0, CFG.groundY + 40);
  gGrad.addColorStop(0, '#2a1a0a');
  gGrad.addColorStop(1, '#110a04');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, CFG.groundY, W, H - CFG.groundY);

  // ground line
  ctx.strokeStyle = '#ff440033';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, CFG.groundY);
  ctx.lineTo(W, CFG.groundY);
  ctx.stroke();

  // crowd dots
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 120; i++) {
    const bx = (i * 47) % W;
    const by = (i * 31) % (CFG.groundY * 0.55) + H * 0.04;
    ctx.fillStyle = i % 3 === 0 ? '#ff4422' : '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShadow(f) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(f.centerX, CFG.groundY + 4, f.w * 0.45, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFighter(f) {
  ctx.save();
  ctx.translate(f.centerX, f.y);
  if (f.facing < 0) ctx.scale(-1, 1);

  const c = f.colors;
  const h = f.h;
  const w = f.w;

  const isDown  = f.groundTimer > 0;
  const isDuck  = f.state === 'duck';
  const isHurt  = f.stunTimer > 0;
  const isAtk   = f.state === 'attack';
  const move    = f.attackMove;

  // flash when hurt
  if (isHurt && Math.floor(Date.now() / 80) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  if (isDown) {
    drawFighterDown(f, c, w, h);
  } else if (isDuck) {
    drawFighterDuck(f, c, w, h);
  } else if (isAtk) {
    drawFighterAttack(f, c, w, h, move);
  } else {
    drawFighterIdle(f, c, w, h);
  }

  ctx.restore();
}

// ── Idle stance ──
function drawFighterIdle(f, c, w, h) {
  const bob = Math.sin(Date.now() * 0.004) * 2;
  ctx.translate(0, bob);

  // legs
  ctx.fillStyle = c.shorts;
  ctx.fillRect(-w*0.22, h*0.55, w*0.2, h*0.3);
  ctx.fillRect( w*0.02, h*0.55, w*0.2, h*0.3);
  // feet
  ctx.fillStyle = '#333';
  ctx.fillRect(-w*0.25, h*0.84, w*0.22, h*0.1);
  ctx.fillRect( w*0.02, h*0.84, w*0.22, h*0.1);
  // torso
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.roundRect(-w*0.25, h*0.3, w*0.5, h*0.3, 6);
  ctx.fill();
  // belt
  ctx.fillStyle = c.shorts;
  ctx.fillRect(-w*0.25, h*0.54, w*0.5, h*0.06);
  // arms — guard position
  ctx.fillStyle = c.skin;
  // left arm up guard
  ctx.beginPath(); ctx.roundRect(-w*0.42, h*0.15, w*0.17, h*0.28, 5); ctx.fill();
  // right arm
  ctx.beginPath(); ctx.roundRect( w*0.24, h*0.25, w*0.17, h*0.22, 5); ctx.fill();
  // gloves
  ctx.fillStyle = c.accent;
  ctx.beginPath(); ctx.arc(-w*0.34, h*0.12, w*0.13, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( w*0.32, h*0.24, w*0.12, 0, Math.PI*2); ctx.fill();
  // head
  ctx.fillStyle = c.skin;
  ctx.beginPath(); ctx.arc(0, h*0.14, w*0.24, 0, Math.PI*2); ctx.fill();
  // eyes
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-w*0.08, h*0.12, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( w*0.08, h*0.12, 3, 0, Math.PI*2); ctx.fill();
}

// ── Duck/block ──
function drawFighterDuck(f, c, w, h) {
  ctx.translate(0, h*0.2);
  // legs spread
  ctx.fillStyle = c.shorts;
  ctx.fillRect(-w*0.3, h*0.4, w*0.55, h*0.22);
  ctx.fillStyle = '#333';
  ctx.fillRect(-w*0.32, h*0.61, w*0.25, h*0.08);
  ctx.fillRect( w*0.08, h*0.61, w*0.25, h*0.08);
  // torso low
  ctx.fillStyle = c.body;
  ctx.beginPath(); ctx.roundRect(-w*0.22, h*0.18, w*0.44, h*0.24, 6); ctx.fill();
  // arms crossed block
  ctx.fillStyle = c.accent;
  ctx.beginPath(); ctx.roundRect(-w*0.32, h*0.08, w*0.64, h*0.14, 8); ctx.fill();
  // head low
  ctx.fillStyle = c.skin;
  ctx.beginPath(); ctx.arc(0, h*0.06, w*0.2, 0, Math.PI*2); ctx.fill();
}

// ── Attack ──
function drawFighterAttack(f, c, w, h, move) {
  const t = 1 - f.stateTimer / CFG.moves[move].duration;
  // base idle
  drawFighterIdle(f, c, w, h);

  ctx.save();
  ctx.translate(0, -Math.sin(Date.now() * 0.004) * 2); // cancel bob offset

  const extendX = w * 0.55 * Math.sin(t * Math.PI);

  if (move === 'jab' || move === 'cross') {
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.arc(w*0.18 + extendX, h*0.22, w*0.14, 0, Math.PI*2); ctx.fill();
  } else if (move === 'hook') {
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.arc(-w*0.22 + extendX * 0.8, h*0.15, w*0.14, 0, Math.PI*2); ctx.fill();
  } else if (move === 'uppercut') {
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.arc(w*0.1 + extendX*0.5, h*0.05 - h*0.15*Math.sin(t*Math.PI), w*0.14, 0, Math.PI*2); ctx.fill();
  } else if (move === 'kick') {
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.roundRect(w*0.02 + extendX, h*0.5, w*0.28, h*0.15, 8); ctx.fill();
  } else if (move === 'takedown') {
    ctx.fillStyle = c.body;
    ctx.save(); ctx.translate(extendX * 0.7, h*0.1); ctx.rotate(-0.4);
    ctx.beginPath(); ctx.roundRect(-w*0.12, -h*0.12, w*0.45, h*0.24, 8); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ── Down ──
function drawFighterDown(f, c, w, h) {
  ctx.save();
  ctx.translate(-w*0.1, h*0.55);
  ctx.rotate(Math.PI / 2);
  // body
  ctx.fillStyle = c.body;
  ctx.beginPath(); ctx.roundRect(-h*0.2, -w*0.22, h*0.55, w*0.44, 8); ctx.fill();
  ctx.fillStyle = c.shorts;
  ctx.fillRect(h*0.25, -w*0.22, h*0.2, w*0.44);
  // head
  ctx.fillStyle = c.skin;
  ctx.beginPath(); ctx.arc(-h*0.26, 0, w*0.22, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawHitEffect(f) {
  if (f.stunTimer > 10) {
    ctx.save();
    ctx.globalAlpha = (f.stunTimer / 30) * 0.35;
    ctx.fillStyle = '#ff4422';
    ctx.beginPath();
    ctx.arc(f.centerX, f.y + f.h * 0.3, f.w * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ──────────────────────────────────────────────
//  BANNER HELPER
// ──────────────────────────────────────────────
function showBanner(id, text, duration) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth; // reflow
  el.style.animation = `banner-pop ${duration}ms ease-out forwards`;
  setTimeout(() => { el.classList.add('hidden'); }, duration);
}

// ──────────────────────────────────────────────
//  UTILS
// ──────────────────────────────────────────────
function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
