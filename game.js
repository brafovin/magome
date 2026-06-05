'use strict';
/* ============================================================
   STREET BRAWL — 1v1 Weapon Fight
   ============================================================ */

/* ---------- WEAPONS ---------- */
const WEAPONS = {
  fists:   { name:'FISTS',        icon:'✊', dmg:1.0, reach:0,   speed:1.0, bleedChance:0,    special:'combo',    desc:'Bare Hands'     },
  knife:   { name:'MESSER',       icon:'🔪', dmg:1.3, reach:20,  speed:1.1, bleedChance:0.55, special:'stab',     desc:'Stab + Bleed'   },
  bat:     { name:'BASEBALLSCHL', icon:'🪃', dmg:1.7, reach:55,  speed:0.8, bleedChance:0,    special:'homerun',  desc:'Slow + Hard Hit' },
  chain:   { name:'KETTE',        icon:'⛓', dmg:1.4, reach:70,  speed:0.9, bleedChance:0.2,  special:'whip',     desc:'Long Range Whip' },
  bottle:  { name:'FLASCHE',      icon:'🍾', dmg:1.5, reach:10,  speed:1.0, bleedChance:0.35, special:'shatter',  desc:'First Hit Bonus' },
  pipe:    { name:'ROHR',         icon:'🔧', dmg:1.6, reach:40,  speed:0.85,bleedChance:0,    special:'sweep',    desc:'Leg Sweep'      },
};

/* ---------- ROSTER ---------- */
const ROSTER = [
  { name:'TOMMY K.',   style:'BRAWLER',          ai:'brawler',  skin:'#c4886a', hair:'buzz',    cloth:'hoodie', clothCol:'#1a1a2a', tattoo:true  },
  { name:'RAZOR',      style:'KNIFE SPECIALIST', ai:'knife',    skin:'#b07040', hair:'shaved',  cloth:'vest',   clothCol:'#222230', tattoo:true  },
  { name:'BIG DINO',   style:'POWERHOUSE',       ai:'power',    skin:'#a06040', hair:'bald',    cloth:'tanktop',clothCol:'#1c1c26', tattoo:false },
  { name:'SNAKE',      style:'STREET STRIKER',   ai:'striker',  skin:'#8a6040', hair:'short',   cloth:'jacket', clothCol:'#282030', tattoo:false },
  { name:'LENA V.',    style:'COUNTER',          ai:'counter',  skin:'#d4a478', hair:'ponytail',cloth:'hoodie', clothCol:'#201828', tattoo:false },
  { name:'IRONSIDE',   style:'CHAIN MASTER',     ai:'chain',    skin:'#5a4030', hair:'dreads',  cloth:'jacket', clothCol:'#181820', tattoo:true  },
];

/* ---------- MOVES ---------- */
const BASE_MOVES = {
  jab:    { dur:14, hit:5,  range:130, baseDmg:5,  stam:3,  knock:0.0, type:'punch', label:'JAB'     },
  cross:  { dur:20, hit:8,  range:145, baseDmg:9,  stam:6,  knock:0.12,type:'punch', label:'CROSS'   },
  hook:   { dur:22, hit:9,  range:120, baseDmg:10, stam:7,  knock:0.18,type:'punch', label:'HOOK'    },
  upper:  { dur:24, hit:10, range:100, baseDmg:12, stam:8,  knock:0.22,type:'punch', label:'UPPER'   },
  kick:   { dur:28, hit:12, range:170, baseDmg:13, stam:9,  knock:0.2, type:'kick',  label:'KICK'    },
  special:{ dur:34, hit:14, range:160, baseDmg:18, stam:14, knock:0.4, type:'special',label:'SPECIAL' },
  wide:   { dur:26, hit:10, range:155, baseDmg:11, stam:8,  knock:0.15,type:'punch', label:'WIDE'    },
  upper2: { dur:26, hit:11, range:105, baseDmg:13, stam:9,  knock:0.25,type:'punch', label:'UPPER'   },
};

/* AI combo pools per style */
const COMBOS = {
  brawler:  [['jab','cross'],['cross','hook'],['jab','cross','hook'],['hook','upper']],
  striker:  [['jab','cross'],['cross','kick'],['jab','jab','cross'],['hook','kick']],
  power:    [['cross','hook'],['hook','upper'],['cross','special']],
  counter:  [['jab','cross'],['cross','upper'],['hook','kick']],
  knife:    [['jab','cross'],['jab','jab','special'],['cross','special']],
  chain:    [['wide','kick'],['jab','wide'],['special','hook']],
};

/* AI config */
const AI_CFG = {
  brawler: { aggro:0.7,  reactionMs:280, comboFreq:0.5 },
  striker: { aggro:0.6,  reactionMs:220, comboFreq:0.55 },
  power:   { aggro:0.5,  reactionMs:350, comboFreq:0.35 },
  counter: { aggro:0.35, reactionMs:180, comboFreq:0.45 },
  knife:   { aggro:0.65, reactionMs:240, comboFreq:0.55 },
  chain:   { aggro:0.55, reactionMs:260, comboFreq:0.4  },
};

/* ---------- STATE ---------- */
const ST = { STAND:'stand', STAGGER:'stagger', DOWN:'down', GETUP:'getup' };

/* ---------- AUDIO ---------- */
let _actx = null;
function getAudio() {
  if (!_actx) {
    try { _actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  }
  return _actx;
}
function playHit(heavy) {
  const ac = getAudio(); if (!ac) return;
  const buf = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, heavy ? 1.5 : 2.5);
  }
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  const filt = ac.createBiquadFilter();
  src.buffer = buf;
  filt.type = 'lowpass'; filt.frequency.value = heavy ? 600 : 1800;
  gain.gain.value = heavy ? 0.55 : 0.35;
  src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
  src.start();
}
function playSwing() {
  const ac = getAudio(); if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(600, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.07);
  gain.gain.setValueAtTime(0.15, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
  osc.connect(gain); gain.connect(ac.destination);
  osc.start(); osc.stop(ac.currentTime + 0.07);
}

/* ---------- FIGHTER CLASS ---------- */
class Fighter {
  constructor(data, weaponKey, side) {
    this.data      = data;
    this.weaponKey = weaponKey;
    this.weapon    = WEAPONS[weaponKey] || WEAPONS.fists;
    this.side      = side; // -1=player(left), 1=ai(right)
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.hp = 100; this.maxHp = 100;
    this.stam = 100; this.maxStam = 100;
    this.bleed = 0; this.bleedTimer = 0;
    this.state = ST.STAND;
    this.facing = 1; // 1=right, -1=left
    this.attackTimer = 0;
    this.recovery    = 0;
    this.staggerTimer = 0;
    this.downTimer   = 0;
    this.getupTimer  = 0;
    this._nextMove   = null;
    this._activeMove = null;
    this._hitRegistered = false;
    this.comboCount  = 0;
    this.comboLast   = 0;
    this.wins        = 0;
    this.weaponDropped  = false;
    this.weaponOnGround = null;
    this._bottleBroken  = false;
    this.animArm  = 0;
    this.legPhase = 0;
    this.hitFlash  = 0;
    this.blockFlash = 0;
    this._aiBlocking = false;
    this._aiTimer    = 0;
    this._aiCfg      = null;
    this._aiCombo    = null;
    this._aiComboIdx = 0;
  }
  reset(W, H) {
    const FLOOR = H * 0.72;
    this.x = this.side === -1 ? W * 0.25 : W * 0.75;
    this.y = FLOOR;
    this.vx = 0; this.vy = 0;
    this.hp = 100; this.stam = 100;
    this.bleed = 0; this.bleedTimer = 0;
    this.state = ST.STAND;
    this.attackTimer = 0; this.recovery = 0;
    this.staggerTimer = 0; this.downTimer = 0; this.getupTimer = 0;
    this._nextMove = null; this._activeMove = null; this._hitRegistered = false;
    this.comboCount = 0; this.comboLast = 0;
    this.weaponDropped = false; this.weaponOnGround = null; this._bottleBroken = false;
    this.animArm = 0; this.legPhase = 0; this.hitFlash = 0; this.blockFlash = 0;
    this._aiBlocking = false;
    // restore original weapon
    this.weapon = WEAPONS[this.weaponKey] || WEAPONS.fists;
  }
  canAct() {
    return this.attackTimer <= 0 && this.recovery <= 0 &&
           this.state !== ST.STAGGER && this.state !== ST.DOWN && this.state !== ST.GETUP;
  }
}

/* ---------- PARTICLES ---------- */
class Particle {
  constructor(x, y, col, size, vx, vy, life) {
    Object.assign(this, {x, y, col, size, vx, vy, life, maxLife: life});
  }
  update() { this.x += this.vx; this.y += this.vy; this.vy += 0.18; this.life--; }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.col;
    ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

/* ---------- MAIN GAME CLASS ---------- */
class Game {
  constructor() {
    /* DOM refs */
    this.screens = {
      title:  document.getElementById('screen-title'),
      select: document.getElementById('screen-select'),
      fight:  document.getElementById('screen-fight'),
      round:  document.getElementById('screen-round'),
      result: document.getElementById('screen-result'),
    };
    this.canvas     = document.getElementById('game-canvas');
    this.ctx        = this.canvas.getContext('2d');
    this.rosterP    = document.getElementById('roster-player');
    this.rosterA    = document.getElementById('roster-ai');
    this.wpnP       = document.getElementById('weapons-player');
    this.wpnA       = document.getElementById('weapons-ai');
    this.prevCanvas = document.getElementById('preview-canvas');
    this.prevCtx    = this.prevCanvas.getContext('2d');
    this.prevPname  = document.getElementById('prev-pname');
    this.prevAname  = document.getElementById('prev-aname');
    this.hudNameP   = document.getElementById('hud-name-p');
    this.hudNameA   = document.getElementById('hud-name-a');
    this.hudWpnP    = document.getElementById('hud-weapon-p');
    this.hudWpnA    = document.getElementById('hud-weapon-a');
    this.barHpP     = document.getElementById('bar-hp-p');
    this.barHpA     = document.getElementById('bar-hp-a');
    this.barStP     = document.getElementById('bar-st-p');
    this.barStA     = document.getElementById('bar-st-a');
    this.bleedP     = document.getElementById('bleed-p');
    this.bleedA     = document.getElementById('bleed-a');
    this.portP      = document.getElementById('portrait-p');
    this.portA      = document.getElementById('portrait-a');
    this.hudRound   = document.getElementById('hud-round');
    this.hudClock   = document.getElementById('hud-clock');
    this.roundDots  = document.getElementById('round-dots');
    this.techLabel  = document.getElementById('tech-label');
    this.bigBanner  = document.getElementById('big-banner');
    this.comboDisp  = document.getElementById('combo-display');
    this.rcNum      = document.getElementById('rc-num');
    this.rcScores   = document.getElementById('rc-scores');
    this.rcAdvice   = document.getElementById('rc-advice');
    this.rcCountdown= document.getElementById('rc-countdown');
    this.resMethod  = document.getElementById('res-method');
    this.resWinner  = document.getElementById('res-winner');
    this.resDetail  = document.getElementById('res-detail');
    this.resReel    = document.getElementById('res-reel');

    /* game state */
    this.playerIdx  = 0;
    this.aiIdx      = 1;
    this.playerWpn  = 'fists';
    this.aiWpn      = 'knife';
    this.round      = 1;
    this.maxRounds  = 3;
    this.roundTime  = 180;
    this.frameTime  = 0;
    this.frameCount = 0;
    this.paused     = false;
    this.over       = false;
    this.scores     = [];
    this.particles  = [];
    this.keys       = {};
    this._raf       = null;
    this._shakeFrames = 0;
    this._shakeAmt  = 0;
    this._techTO    = null;
    this._banTO     = null;
    this._comboTO   = null;
    this.player     = null;
    this.ai         = null;

    this._buildUI();
    this._bindEvents();
    this._showScreen('title');
  }

  /* ===== UI BUILD ===== */
  _buildUI() {
    this._buildRoster(this.rosterP, this.wpnP, 'player');
    this._buildRoster(this.rosterA, this.wpnA, 'ai');
  }

  _buildRoster(container, wpnContainer, side) {
    container.innerHTML = '';
    ROSTER.forEach((f, i) => {
      const div = document.createElement('div');
      div.className = 'roster-item';
      div.dataset.idx = i;
      const thumb = document.createElement('canvas');
      thumb.className = 'ri-thumb'; thumb.width = 42; thumb.height = 42;
      this._drawThumb(thumb.getContext('2d'), f, 42, 42);
      const info = document.createElement('div'); info.className = 'ri-info';
      info.innerHTML = `<div class="ri-name">${f.name}</div>
        <div class="ri-style">${f.style}</div>
        <div class="ri-rec">STIL: ${f.ai.toUpperCase()}</div>`;
      div.appendChild(thumb); div.appendChild(info);
      div.addEventListener('click', () => this._selectFighter(side, i));
      container.appendChild(div);
    });

    wpnContainer.innerHTML = '';
    Object.entries(WEAPONS).forEach(([key, w]) => {
      const btn = document.createElement('div');
      btn.className = 'wpn-btn';
      btn.dataset.key = key;
      btn.innerHTML = `<div style="font-size:16px">${w.icon}</div><div>${w.name}</div>`;
      btn.addEventListener('click', () => this._selectWeapon(side, key));
      wpnContainer.appendChild(btn);
    });

    if (side === 'player') { this._selectFighter('player', 0); this._selectWeapon('player', 'fists'); }
    else                   { this._selectFighter('ai', 1);     this._selectWeapon('ai', 'knife'); }
  }

  _selectFighter(side, idx) {
    const c = side === 'player' ? this.rosterP : this.rosterA;
    c.querySelectorAll('.roster-item').forEach(el => el.classList.remove('selected'));
    const item = c.querySelector(`[data-idx="${idx}"]`);
    if (item) item.classList.add('selected');
    if (side === 'player') this.playerIdx = idx;
    else this.aiIdx = idx;
    this._updatePreview();
  }

  _selectWeapon(side, key) {
    const c = side === 'player' ? this.wpnP : this.wpnA;
    c.querySelectorAll('.wpn-btn').forEach(el => el.classList.remove('selected'));
    const btn = c.querySelector(`[data-key="${key}"]`);
    if (btn) btn.classList.add('selected');
    if (side === 'player') this.playerWpn = key;
    else this.aiWpn = key;
    this._updatePreview();
  }

  _updatePreview() {
    const pw = this.prevCanvas.width, ph = this.prevCanvas.height;
    const pctx = this.prevCtx;
    pctx.clearRect(0, 0, pw, ph);
    const bg = pctx.createLinearGradient(0, 0, 0, ph);
    bg.addColorStop(0, '#12121e'); bg.addColorStop(1, '#07070e');
    pctx.fillStyle = bg; pctx.fillRect(0, 0, pw, ph);
    pctx.strokeStyle = 'rgba(255,69,0,0.3)'; pctx.lineWidth = 1;
    pctx.beginPath(); pctx.moveTo(0, ph*0.78); pctx.lineTo(pw, ph*0.78); pctx.stroke();

    const pf = ROSTER[this.playerIdx], af = ROSTER[this.aiIdx];
    const pw2 = WEAPONS[this.playerWpn], aw2 = WEAPONS[this.aiWpn];
    this._drawFighter(pctx, pf, pw2, pw*0.28, ph*0.78, -1, null);
    this._drawFighter(pctx, af, aw2, pw*0.72, ph*0.78,  1, null);

    this.prevPname.textContent = pf.name;
    this.prevAname.textContent = af.name;
  }

  /* ===== EVENTS ===== */
  _bindEvents() {
    document.getElementById('btn-start').addEventListener('click', () => this._showScreen('select'));
    document.getElementById('btn-fight').addEventListener('click', () => this._startFight());
    document.getElementById('btn-rematch').addEventListener('click', () => this._startFight());
    document.getElementById('btn-menu').addEventListener('click', () => {
      cancelAnimationFrame(this._raf);
      this._showScreen('select');
    });
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.key] = true;
      if (this.screens.fight.classList.contains('active') && !this.over && !this.paused) {
        this._handleInput(e.key);
      }
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.key] = false;
    });
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _handleInput(key) {
    const p = this.player; if (!p) return;
    const lk = key.toLowerCase();
    // special = Shift+L
    if (lk === 'l' && (this.keys['Shift'] || this.keys['shift'])) {
      this._startMove(p, this.ai, 'special'); return;
    }
    const map = { j:'jab', k:'cross', l:'hook', u:'wide', i:'upper' };
    if (map[lk]) { this._startMove(p, this.ai, map[lk]); return; }
    // kick
    if (lk === ';' || lk === 'semicolon') { this._startMove(p, this.ai, 'kick'); return; }
    // disarm
    if (lk === 'o') { this._tryDisarm(p, this.ai); return; }
    // pickup
    if (lk === 'n') { this._tryPickup(p); return; }
  }

  /* ===== FIGHT INIT ===== */
  _startFight() {
    this.round = 1; this.scores = []; this.over = false; this.particles = []; this.keys = {};
    this._resizeCanvas();
    const W = this.canvas.width, H = this.canvas.height;
    this.player = new Fighter(ROSTER[this.playerIdx], this.playerWpn, -1);
    this.ai     = new Fighter(ROSTER[this.aiIdx],     this.aiWpn,      1);
    this.player.reset(W, H);
    this.ai.reset(W, H);
    this._setupAI(this.ai);
    this.hudNameP.textContent = ROSTER[this.playerIdx].name;
    this.hudNameA.textContent = ROSTER[this.aiIdx].name;
    this._updateHUD();
    this._drawRoundDots();
    this._showScreen('fight');
    this.frameCount = 0;
    this.frameTime  = this.roundTime * 60;
    this.paused = false; this.over = false;
    cancelAnimationFrame(this._raf);
    this.banner('FIGHT!', 1200);
    this._loop();
  }

  _startRound() {
    this.over = false; this.paused = false;
    const W = this.canvas.width, H = this.canvas.height;
    this.player.reset(W, H);
    this.ai.reset(W, H);
    this._setupAI(this.ai);
    this.particles = [];
    this.frameTime = this.roundTime * 60;
    this.frameCount = 0;
    this._updateHUD();
    this._showScreen('fight');
    this.banner('RUNDE ' + this.round, 1400);
    cancelAnimationFrame(this._raf);
    this._loop();
  }

  _setupAI(f) {
    const style = f.data.ai;
    f._aiCfg = AI_CFG[style] || AI_CFG.brawler;
    f._aiTimer = 0; f._aiCombo = null; f._aiComboIdx = 0;
  }

  _resizeCanvas() {
    const c = this.canvas;
    c.width  = c.offsetWidth  || window.innerWidth;
    c.height = c.offsetHeight || window.innerHeight;
  }

  /* ===== MAIN LOOP ===== */
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (this.paused || this.over) return;
    this.frameCount++;
    this._tick();
    this._render();
  }

  _tick() {
    const p = this.player, a = this.ai;
    if (!p || !a) return;
    const W = this.canvas.width, H = this.canvas.height;
    const FLOOR = H * 0.72;

    this.frameTime--;
    if (this.frameTime <= 0) { this.frameTime = 0; this._endRound('TIME'); return; }

    this._playerMove(p, FLOOR, W);
    this._runAI(a, p);
    this._updateFighter(p, a, FLOOR, W, H);
    this._updateFighter(a, p, FLOOR, W, H);

    // bleed DoT
    [p, a].forEach(f => {
      if (f.bleed > 0) {
        f.bleedTimer++;
        if (f.bleedTimer >= 60) {
          f.bleedTimer = 0;
          f.hp = Math.max(0, f.hp - f.bleed * 0.8);
          this._spawnBlood(f.x, f.y - 60);
          if (f.hp <= 0) { this._endRound('BLEED'); return; }
        }
      }
    });

    // stam regen
    if (p.stam < 100) p.stam = Math.min(100, p.stam + 0.12);
    if (a.stam < 100) a.stam = Math.min(100, a.stam + 0.12);

    this._updateHUD();
  }

  _playerMove(p, FLOOR, W) {
    if (p.state === ST.DOWN || p.state === ST.GETUP) return;
    const spd = 3.2;
    if (this.keys['a']) p.vx -= spd * 0.5;
    if (this.keys['d']) p.vx += spd * 0.5;
    p.vx = Math.max(-spd, Math.min(spd, p.vx));
  }

  _updateFighter(f, opp, FLOOR, W, H) {
    if (f.attackTimer > 0) {
      f.attackTimer--;
      if (f.attackTimer === 0 && f._nextMove) {
        const nm = f._nextMove; f._nextMove = null;
        f.recovery = 2;
        this._startMove(f, opp, nm);
      }
    }
    if (f.recovery > 0) f.recovery--;
    if (f.hitFlash > 0) f.hitFlash--;
    if (f.blockFlash > 0) f.blockFlash--;
    if (f.animArm > 0) f.animArm = Math.max(0, f.animArm - 0.1);

    if (f.state === ST.STAGGER) {
      f.staggerTimer--;
      if (f.staggerTimer <= 0) f.state = ST.STAND;
    }
    if (f.state === ST.DOWN) {
      f.downTimer--;
      if (f.downTimer <= 0) { f.state = ST.GETUP; f.getupTimer = 50; }
    }
    if (f.state === ST.GETUP) {
      f.getupTimer--;
      if (f.getupTimer <= 0) f.state = ST.STAND;
    }

    f.vx *= 0.70;
    if (Math.abs(f.vx) < 0.1) f.vx = 0;
    if (f.y < FLOOR) f.vy += 0.6;
    f.y += f.vy;
    if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; }
    f.x += f.vx;
    f.x = Math.max(30, Math.min(W - 30, f.x));

    // push-apart
    const dist = Math.abs(f.x - opp.x);
    if (dist < 62 && f.state === ST.STAND && opp.state === ST.STAND) {
      f.x += (f.x < opp.x ? -1 : 1) * 1.5;
    }

    if (Math.abs(f.vx) > 0.3 && f.state === ST.STAND) f.legPhase += 0.18;
    f.facing = opp.x > f.x ? 1 : -1;

    // hit registration
    if (f.attackTimer > 0 && f._activeMove && !f._hitRegistered) {
      const mv = f._activeMove;
      if (f.attackTimer === mv._hitFrame) {
        f._hitRegistered = true;
        this._resolveHit(f, opp, mv);
      }
    }
  }

  /* ===== ATTACKS ===== */
  _startMove(f, opp, moveName) {
    if (!f.canAct()) {
      if (f.attackTimer > 0 && f.attackTimer <= 10) f._nextMove = moveName;
      return;
    }
    if (f.stam < 2) return;
    const base = BASE_MOVES[moveName]; if (!base) return;
    const wpn = f.weapon;
    const speedMult = wpn.speed;
    const dur      = Math.round(base.dur / speedMult);
    const hitFrame = Math.round(base.hit / speedMult);
    const mv = {
      ...base, dur, hitFrame, _hitFrame: hitFrame,
      reach: base.range + wpn.reach,
      dmg:   base.baseDmg * wpn.dmg,
    };
    f._activeMove = mv; f._hitRegistered = false;
    f.attackTimer = dur;
    f.stam = Math.max(0, f.stam - base.stam);
    f.animArm = 1;
    playSwing();
    this.techLabel.textContent = (wpn.name !== 'FISTS' ? wpn.name + ' ' : '') + mv.label;
    this.techLabel.classList.add('show');
    clearTimeout(this._techTO);
    this._techTO = setTimeout(() => this.techLabel.classList.remove('show'), 700);
  }

  _resolveHit(attacker, defender, mv) {
    const dist = Math.abs(attacker.x - defender.x);
    if (dist > mv.reach) return;

    const isPlayerBlocking = (this.keys['s'] || this.keys['S']) && defender === this.player;
    if (isPlayerBlocking || defender._aiBlocking) {
      defender.blockFlash = 8; playHit(false);
      attacker.comboCount = 0; return;
    }

    if (this.frameCount - attacker.comboLast < 52) attacker.comboCount++;
    else attacker.comboCount = 1;
    attacker.comboLast = this.frameCount;
    const bonus = Math.min(1.6, 1 + attacker.comboCount * 0.1);

    this._damage(defender, attacker, mv.dmg * bonus, mv);
    if (attacker.comboCount >= 2) this._showCombo(attacker.comboCount, mv.label);
  }

  _damage(defender, attacker, dmg, mv) {
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.hitFlash = 10;

    const wpn = attacker.weapon;
    if (wpn.bleedChance > 0 && Math.random() < wpn.bleedChance && !attacker.weaponDropped) {
      defender.bleed = Math.min(5, defender.bleed + 1);
    }
    if (attacker.weaponKey === 'bottle' && !attacker._bottleBroken) {
      attacker._bottleBroken = true;
      defender.hp = Math.max(0, defender.hp - 8);
      this.banner('GEBROCHEN!', 800);
    }

    const kbDir = defender.x > attacker.x ? 1 : -1;
    defender.vx += kbDir * mv.knock * 6;
    if (mv.type === 'kick' || mv.type === 'special') defender.vy -= mv.knock * 4;

    if (mv.knock >= 0.35 || dmg >= 16) {
      if (Math.random() < 0.5) {
        defender.state = ST.DOWN;
        defender.downTimer = 80 + Math.floor(Math.random() * 40);
        defender.vx += kbDir * 4;
        this.banner('DOWN!', 900);
        this._shakeScreen(12, 8);
        playHit(true);
      } else {
        defender.state = ST.STAGGER;
        defender.staggerTimer = 28 + Math.floor(Math.random() * 20);
        this._shakeScreen(6, 4);
        playHit(true);
      }
    } else {
      this._shakeScreen(3, 2);
      playHit(dmg > 10);
    }
    this._spawnBlood(defender.x, defender.y - 70);
    if (defender.hp <= 0) this._endRound('KO');
  }

  /* ===== DISARM / PICKUP ===== */
  _tryDisarm(attacker, defender) {
    const dist = Math.abs(attacker.x - defender.x);
    if (dist > 120 || defender.weaponDropped || defender.weaponKey === 'fists') return;
    if (Math.random() < 0.38) {
      defender.weaponOnGround = { x: defender.x + defender.facing * 50, y: defender.y, key: defender.weaponKey };
      defender.weaponDropped = true;
      const prev = defender.weapon;
      defender.weapon = WEAPONS.fists; defender.weaponKey = 'fists';
      this.banner('ENTWAFFNET!', 900);
      (defender === this.ai ? this.hudWpnA : this.hudWpnP).textContent = 'FISTS';
    }
  }

  _tryPickup(f) {
    [this.player, this.ai].forEach(other => {
      if (other.weaponOnGround) {
        const dist = Math.abs(f.x - other.weaponOnGround.x);
        if (dist < 80) {
          f.weapon = WEAPONS[other.weaponOnGround.key];
          f.weaponKey = other.weaponOnGround.key;
          f.weaponDropped = false;
          other.weaponOnGround = null;
          this.banner('AUFGEHOBEN!', 800);
          (f === this.player ? this.hudWpnP : this.hudWpnA).textContent = f.weapon.name;
        }
      }
    });
  }

  /* ===== AI ===== */
  _runAI(ai, player) {
    if (ai.state === ST.DOWN || ai.state === ST.GETUP) return;

    ai._aiBlocking = player.attackTimer > 0 && Math.abs(ai.x - player.x) < 160 && Math.random() < 0.28;

    if (!ai.canAct()) return;
    ai._aiTimer--;
    if (ai._aiTimer > 0) return;

    const cfg = ai._aiCfg;
    ai._aiTimer = Math.max(1, Math.floor(cfg.reactionMs / 16.67));

    const dist = Math.abs(ai.x - player.x);
    const reach = ai.weapon.reach + 150;
    const dir = player.x > ai.x ? 1 : -1;

    if (dist > reach + 30) ai.vx += dir * 2.8 * cfg.aggro;
    else if (dist < 75)    ai.vx -= dir * 1.5;

    if (dist <= reach && Math.random() < cfg.aggro) {
      const pool = COMBOS[ai.data.ai] || COMBOS.brawler;
      if (ai._aiCombo && ai._aiComboIdx < ai._aiCombo.length) {
        this._startMove(ai, player, ai._aiCombo[ai._aiComboIdx++]);
        if (ai._aiComboIdx >= ai._aiCombo.length) { ai._aiCombo = null; ai._aiComboIdx = 0; }
      } else if (Math.random() < cfg.comboFreq) {
        ai._aiCombo = pool[Math.floor(Math.random() * pool.length)].slice();
        ai._aiComboIdx = 0;
        this._startMove(ai, player, ai._aiCombo[ai._aiComboIdx++]);
      } else {
        const singles = ['jab','cross','hook','wide'];
        this._startMove(ai, player, singles[Math.floor(Math.random()*singles.length)]);
      }
    }

    // AI pickup if disarmed
    if (ai.weaponDropped) {
      if (this.player.weaponOnGround) {
        const d = Math.abs(ai.x - this.player.weaponOnGround.x);
        if (d < 80) this._tryPickup(ai);
        else ai.vx += (this.player.weaponOnGround.x > ai.x ? 1 : -1) * 2;
      }
    }
  }

  /* ===== ROUND END ===== */
  _endRound(method) {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this._raf);

    const p = this.player, a = this.ai;
    const winnerSide = p.hp >= a.hp ? 'p' : 'a';
    this.scores.push({ p: p.hp, a: a.hp, winner: winnerSide, method });
    if (winnerSide === 'p') p.wins++; else a.wins++;

    const pWins = this.scores.filter(s => s.winner === 'p').length;
    const aWins = this.scores.filter(s => s.winner === 'a').length;
    const needed = Math.ceil(this.maxRounds / 2);

    if (method === 'KO' || method === 'BLEED' || pWins >= needed || aWins >= needed || this.round >= this.maxRounds) {
      setTimeout(() => this._showResult(method, winnerSide), 1400);
    } else {
      this.round++;
      setTimeout(() => this._showRoundCard(method, winnerSide), 1000);
    }
  }

  _showRoundCard(method, winnerSide) {
    this._showScreen('round');
    this.rcNum.textContent = this.round - 1;
    const last = this.scores[this.scores.length - 1];
    this.rcScores.innerHTML = `
      <div class="score-line">
        <span>${ROSTER[this.playerIdx].name}</span><span>${Math.round(last.p)} HP</span>
      </div>
      <div class="score-line">
        <span>${ROSTER[this.aiIdx].name}</span><span>${Math.round(last.a)} HP</span>
      </div>`;
    const tips = [
      'Bleib in Bewegung — steh nie still.',
      'Block (S) reduziert Schaden deutlich.',
      'Combos (J K L) machen mehr Schaden.',
      'Entwaffne den Gegner mit O wenn du nah dran bist.',
      'Aufgehobene Waffen mit N auflesen.',
    ];
    this.rcAdvice.textContent = tips[Math.floor(Math.random() * tips.length)];
    let cd = 5;
    this.rcCountdown.textContent = `Nächste Runde in ${cd}...`;
    const iv = setInterval(() => {
      cd--;
      if (cd <= 0) { clearInterval(iv); this._startRound(); }
      else this.rcCountdown.textContent = `Nächste Runde in ${cd}...`;
    }, 1000);
  }

  _showResult(method, winnerSide) {
    this._showScreen('result');
    const wn = winnerSide === 'p' ? ROSTER[this.playerIdx].name : ROSTER[this.aiIdx].name;
    const ml = { KO:'K.O.', BLEED:'VERBLUTET', TIME:'PUNKTE-ENTSCHEIDUNG' };
    this.resMethod.textContent = ml[method] || method;
    this.resWinner.textContent = wn;
    const pW = this.scores.filter(s => s.winner === 'p').length;
    const aW = this.scores.filter(s => s.winner === 'a').length;
    this.resDetail.textContent = `${pW} — ${aW} RUNDEN`;
    this.resReel.innerHTML = '<div style="color:#d4a030;letter-spacing:3px;font-size:11px;margin-bottom:6px">KAMPF-LOG</div>' +
      this.scores.map((s, i) =>
        `Runde ${i+1}: ${s.winner === 'p' ? ROSTER[this.playerIdx].name : ROSTER[this.aiIdx].name} (${s.method}) HP: ${Math.round(s.p)} vs ${Math.round(s.a)}`
      ).join('<br>');
  }

  /* ===== HUD ===== */
  _updateHUD() {
    const p = this.player, a = this.ai;
    if (!p || !a) return;
    this.barHpP.style.width  = Math.max(0, p.hp) + '%';
    this.barHpA.style.width  = Math.max(0, a.hp) + '%';
    this.barStP.style.width  = Math.max(0, p.stam) + '%';
    this.barStA.style.width  = Math.max(0, a.stam) + '%';
    this.bleedP.textContent  = p.bleed > 0 ? '🩸 BLUTEND x' + p.bleed : '';
    this.bleedA.textContent  = a.bleed > 0 ? '🩸 BLUTEND x' + a.bleed : '';
    this.hudWpnP.textContent = p.weapon.name;
    this.hudWpnA.textContent = a.weapon.name;
    const secs = Math.max(0, Math.floor(this.frameTime / 60));
    this.hudClock.textContent = `${Math.floor(secs/60)}:${(secs%60).toString().padStart(2,'0')}`;
    this.hudRound.textContent = this.round;
  }

  _drawRoundDots() {
    this.roundDots.innerHTML = '';
    const pW = this.scores.filter(s => s.winner === 'p').length;
    const aW = this.scores.filter(s => s.winner === 'a').length;
    for (let i = 0; i < this.maxRounds; i++) {
      const dot = document.createElement('div');
      dot.className = 'rd-dot';
      if (i < pW) dot.classList.add('win-p');
      else if (i < pW + aW) dot.classList.add('win-a');
      this.roundDots.appendChild(dot);
    }
  }

  /* ===== BANNERS ===== */
  banner(txt, ms) {
    this.bigBanner.textContent = txt;
    this.bigBanner.classList.add('show');
    clearTimeout(this._banTO);
    this._banTO = setTimeout(() => this.bigBanner.classList.remove('show'), ms || 1000);
  }
  _showCombo(count, label) {
    this.comboDisp.textContent = `${count}x COMBO — ${label}!`;
    this.comboDisp.classList.add('show');
    clearTimeout(this._comboTO);
    this._comboTO = setTimeout(() => this.comboDisp.classList.remove('show'), 800);
  }

  /* ===== SHAKE / PARTICLES ===== */
  _shakeScreen(amt, frames) { this._shakeAmt = amt; this._shakeFrames = frames; }
  _spawnBlood(x, y) {
    for (let i = 0; i < 7; i++) {
      this.particles.push(new Particle(
        x, y, '#aa0010', 2 + Math.random()*3,
        (Math.random()-0.5)*5, -Math.random()*4-1, 22 + Math.random()*18
      ));
    }
  }

  /* ===== RENDER ===== */
  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const FLOOR = H * 0.72;

    let sx = 0, sy = 0;
    if (this._shakeFrames > 0) {
      sx = (Math.random()-0.5)*this._shakeAmt;
      sy = (Math.random()-0.5)*this._shakeAmt*0.4;
      this._shakeFrames--;
    }
    ctx.save(); ctx.translate(sx, sy);

    this._drawArena(ctx, W, H, FLOOR);

    // dropped weapons
    [this.player, this.ai].forEach(f => {
      if (f && f.weaponOnGround) this._drawGroundWeapon(ctx, f.weaponOnGround, FLOOR);
    });

    // fighters
    if (this.player) this._drawFighter(ctx, this.player.data, this.player.weapon, this.player.x, this.player.y, this.player.side, this.player);
    if (this.ai)     this._drawFighter(ctx, this.ai.data,     this.ai.weapon,     this.ai.x,     this.ai.y,     this.ai.side,     this.ai);

    // particles
    this.particles = this.particles.filter(pt => pt.life > 0);
    this.particles.forEach(pt => { pt.update(); pt.draw(ctx); });

    ctx.restore();

    // portraits
    this._drawPortrait(this.portP, this.player ? this.player.data : null, this.player ? this.player.weapon : null);
    this._drawPortrait(this.portA, this.ai     ? this.ai.data     : null, this.ai     ? this.ai.weapon     : null);
  }

  /* ===== ARENA ===== */
  _drawArena(ctx, W, H, FLOOR) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04040a'); bg.addColorStop(1, '#0a0a14');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // brick wall tiles
    const bW = 58, bH = 22;
    const brickCols = ['rgba(32,18,12,0.9)','rgba(28,15,10,0.9)','rgba(36,20,14,0.9)','rgba(24,13,9,0.9)'];
    for (let row = 0; row < Math.ceil(FLOOR * 0.75 / bH); row++) {
      const off = (row % 2) * (bW/2);
      for (let col = -1; col <= W/bW + 1; col++) {
        ctx.fillStyle = brickCols[(row+col) % brickCols.length];
        ctx.fillRect(col*bW - off, row*bH, bW-1, bH-1);
      }
    }

    // graffiti
    ctx.save(); ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#ff4500'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(W*0.6, 20); ctx.lineTo(W*0.78, FLOOR*0.6); ctx.stroke();
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(W*0.15, 10); ctx.lineTo(W*0.35, FLOOR*0.5); ctx.stroke();
    ctx.restore();

    // orange street-lamp glow
    const lamp = ctx.createRadialGradient(W/2, 0, 5, W/2, H*0.12, H*0.9);
    lamp.addColorStop(0, 'rgba(255,140,30,0.22)');
    lamp.addColorStop(0.5,'rgba(255,80,10,0.07)');
    lamp.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);

    // floor
    const floorG = ctx.createLinearGradient(0, FLOOR, 0, H);
    floorG.addColorStop(0, '#141418'); floorG.addColorStop(1, '#080810');
    ctx.fillStyle = floorG; ctx.fillRect(0, FLOOR, W, H - FLOOR);

    // puddle reflection
    ctx.save(); ctx.globalAlpha = 0.15;
    const pud = ctx.createRadialGradient(W/2, FLOOR+5, 2, W/2, FLOOR+5, W*0.2);
    pud.addColorStop(0, '#5577aa'); pud.addColorStop(1, 'transparent');
    ctx.fillStyle = pud;
    ctx.beginPath(); ctx.ellipse(W/2, FLOOR+5, W*0.18, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // floor line
    ctx.strokeStyle = 'rgba(255,69,0,0.28)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.stroke();

    // shadows
    if (this.player && this.ai) {
      [this.player, this.ai].forEach(f => {
        ctx.save(); ctx.globalAlpha = 0.3;
        const sg = ctx.createRadialGradient(f.x, FLOOR, 0, f.x, FLOOR, 52);
        sg.addColorStop(0, '#000'); sg.addColorStop(1, 'transparent');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.ellipse(f.x, FLOOR+4, 50, 12, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      });
    }
  }

  /* ===== FIGHTER DRAW ===== */
  _drawFighter(ctx, data, weapon, x, y, side, fighterObj) {
    const f = fighterObj;
    const facing   = f ? f.facing   : (side === -1 ? 1 : -1);
    const state    = f ? f.state    : ST.STAND;
    const animArm  = f ? f.animArm  : 0;
    const legPhase = f ? f.legPhase : 0;
    const isDown   = state === ST.DOWN;
    const isStagger= state === ST.STAGGER;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    if (isDown) {
      this._drawDown(ctx, data, weapon);
    } else {
      this._drawStand(ctx, data, weapon, animArm, legPhase, isStagger);
    }

    // hit flash
    if (f && f.hitFlash > 0) {
      ctx.globalAlpha = f.hitFlash / 10 * 0.55;
      ctx.fillStyle = '#ff0000';
      ctx.beginPath(); ctx.ellipse(0, -80, 30, 65, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (f && f.blockFlash > 0) {
      ctx.globalAlpha = f.blockFlash / 8 * 0.5;
      ctx.fillStyle = '#4488ff';
      ctx.beginPath(); ctx.ellipse(0, -80, 30, 65, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  _drawStand(ctx, data, weapon, animArm, legPhase, stagger) {
    const sk = data.skin;
    const cc = data.clothCol || '#1a1a2a';
    const stX = stagger ? Math.sin(Date.now() * 0.025) * 5 : 0;
    ctx.translate(stX, 0);

    // -- LEGS --
    const lsw = Math.sin(legPhase) * 14;
    ctx.fillStyle = '#191924';
    ctx.beginPath(); ctx.moveTo(-10, -38); ctx.lineTo(-20, 0); ctx.lineTo(-10+lsw, 0); ctx.lineTo(-3, -38); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3,  -38); ctx.lineTo(10-lsw, 0); ctx.lineTo(20, 0); ctx.lineTo(10,  -38); ctx.closePath(); ctx.fill();
    // boots
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-22, -6, 18, 9);
    ctx.fillRect(6,   -6, 18, 9);

    // -- TORSO --
    ctx.fillStyle = cc;
    ctx.beginPath();
    ctx.moveTo(-22, -38); ctx.lineTo(22, -38); ctx.lineTo(20, -95); ctx.lineTo(-20, -95); ctx.closePath();
    ctx.fill();
    // clothing detail
    if (data.cloth === 'hoodie') {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-10, -64); ctx.lineTo(10, -64); ctx.stroke();
    }
    if (data.cloth === 'jacket') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.moveTo(-5, -95); ctx.lineTo(0, -87); ctx.lineTo(5, -95); ctx.fill();
    }
    // tattoo
    if (data.tattoo) {
      ctx.save(); ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#6677bb'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-24, -80); ctx.bezierCurveTo(-32, -70, -30, -55, -23, -44);
      ctx.stroke(); ctx.restore();
    }

    // -- LEFT ARM (weapon arm) --
    const armAng = (-18 - animArm * 28) * Math.PI / 180;
    ctx.fillStyle = cc;
    ctx.save(); ctx.translate(-20, -88); ctx.rotate(armAng);
    ctx.fillRect(-7, 0, 12, 46);
    ctx.fillStyle = sk; ctx.fillRect(-6, 42, 10, 28);
    // weapon or fist
    if (!weapon || weapon.name === 'FISTS') {
      ctx.fillStyle = sk;
      ctx.beginPath(); ctx.arc(0, 72, 7, 0, Math.PI*2); ctx.fill();
    } else {
      this._drawWpnHand(ctx, weapon);
    }
    ctx.restore();

    // -- RIGHT ARM (guard) --
    ctx.fillStyle = cc;
    ctx.save(); ctx.translate(20, -88); ctx.rotate((28 + Math.sin(legPhase)*4) * Math.PI/180);
    ctx.fillRect(-5, 0, 10, 44);
    ctx.fillStyle = sk; ctx.fillRect(-5, 40, 9, 26);
    ctx.beginPath(); ctx.arc(2, 68, 6, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // -- NECK --
    ctx.fillStyle = sk; ctx.fillRect(-8, -110, 14, 17);

    // -- HEAD --
    ctx.fillStyle = sk;
    ctx.beginPath(); ctx.ellipse(0, -128, 20, 24, 0, 0, Math.PI*2); ctx.fill();

    // hair
    if (data.hair !== 'bald') {
      ctx.fillStyle = '#0e0e0e';
      if (data.hair === 'buzz' || data.hair === 'shaved') {
        ctx.beginPath(); ctx.ellipse(0, -137, 20, 13, 0, Math.PI, Math.PI*2); ctx.fill();
      } else if (data.hair === 'short') {
        ctx.beginPath(); ctx.ellipse(0, -139, 21, 14, 0, Math.PI, Math.PI*2); ctx.fill();
      } else if (data.hair === 'ponytail') {
        ctx.beginPath(); ctx.ellipse(0, -138, 20, 13, 0, Math.PI, Math.PI*2); ctx.fill();
        ctx.save(); ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-2, -150); ctx.bezierCurveTo(-18, -158, -22, -138, -20, -128); ctx.stroke();
        ctx.restore();
      } else if (data.hair === 'dreads') {
        ctx.strokeStyle = '#1e0e0e'; ctx.lineWidth = 4;
        for (let d = -3; d <= 3; d++) {
          ctx.beginPath(); ctx.moveTo(d*6, -150); ctx.bezierCurveTo(d*6-4, -138, d*6-2, -126, d*6, -118); ctx.stroke();
        }
      }
    }

    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-7, -130, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(7,  -130, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#181830';
    ctx.beginPath(); ctx.arc(-7, -130, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(7,  -130, 2, 0, Math.PI*2); ctx.fill();
    // angry brows
    ctx.strokeStyle = '#181818'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-12, -122); ctx.lineTo(-3, -120); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12,  -122); ctx.lineTo(3,  -120); ctx.stroke();
    // mouth
    ctx.strokeStyle = '#7a2828'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -118); ctx.lineTo(6, -118); ctx.stroke();
  }

  _drawDown(ctx, data, weapon) {
    ctx.save(); ctx.rotate(Math.PI/2 * 0.92); ctx.translate(0, -28);
    ctx.fillStyle = data.clothCol || '#1a1a2a';
    ctx.fillRect(-58, -22, 112, 44);
    ctx.fillStyle = data.skin;
    ctx.beginPath(); ctx.ellipse(70, 0, 22, 18, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  _drawWpnHand(ctx, weapon) {
    ctx.save(); ctx.translate(0, 62);
    const key = Object.keys(WEAPONS).find(k => WEAPONS[k] === weapon);
    if (key === 'knife') {
      ctx.fillStyle = '#d0d0d8'; ctx.fillRect(-2, 0, 4, 26);
      ctx.fillStyle = '#888'; ctx.fillRect(-1, 26, 2, 10);
      ctx.fillStyle = '#e8e8f0';
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.lineTo(0, -18); ctx.closePath(); ctx.fill();
    } else if (key === 'bat') {
      ctx.save(); ctx.rotate(0.3);
      ctx.fillStyle = '#7B3F00'; ctx.fillRect(-5, -8, 10, 52);
      ctx.fillStyle = '#5a2e00';
      ctx.beginPath(); ctx.ellipse(0, -8, 10, 8, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    } else if (key === 'chain') {
      ctx.strokeStyle = '#999'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(Math.sin(i*1.2)*8, i*10, 5, 0, Math.PI*2); ctx.stroke();
      }
    } else if (key === 'bottle') {
      ctx.fillStyle = '#2a5a2a'; ctx.fillRect(-5, 0, 10, 30);
      ctx.fillStyle = '#1a3a1a'; ctx.fillRect(-3, -12, 6, 14);
    } else if (key === 'pipe') {
      ctx.save(); ctx.rotate(0.2);
      ctx.fillStyle = '#666670'; ctx.fillRect(-4, -8, 8, 52);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawGroundWeapon(ctx, wnd, FLOOR) {
    ctx.save(); ctx.translate(wnd.x, FLOOR - 10);
    const wpn = WEAPONS[wnd.key];
    ctx.font = '20px serif'; ctx.textAlign = 'center';
    ctx.fillText(wpn ? wpn.icon : '?', 0, 0);
    ctx.restore();
  }

  _drawThumb(ctx, data, w, h) {
    ctx.fillStyle = '#10101a'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w/2, h);
    ctx.scale(0.55, 0.55);
    this._drawStand(ctx, data, WEAPONS.fists, 0, 0, false);
    ctx.restore();
  }

  _drawPortrait(el, data, weapon) {
    if (!el || !data) return;
    let cvs = el.querySelector('canvas');
    if (!cvs) {
      cvs = document.createElement('canvas'); cvs.width = 52; cvs.height = 52;
      cvs.style.cssText = 'width:100%;height:100%;border-radius:5px;';
      el.innerHTML = ''; el.appendChild(cvs);
    }
    const pctx = cvs.getContext('2d');
    pctx.fillStyle = '#0e0e18'; pctx.fillRect(0, 0, 52, 52);
    pctx.save(); pctx.translate(26, 52); pctx.scale(0.32, 0.32);
    this._drawStand(pctx, data, weapon || WEAPONS.fists, 0, 0, false);
    pctx.restore();
  }

  /* ===== SCREEN SWITCH ===== */
  _showScreen(name) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    if (this.screens[name]) this.screens[name].classList.add('active');
  }
}

/* ---------- BOOT ---------- */
window.addEventListener('DOMContentLoaded', () => { window._game = new Game(); });
