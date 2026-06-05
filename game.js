'use strict';
/* =====================================================================
   OCTAGON — UFC 5 style MMA browser game
   Single-file engine: fighter select, standing/clinch/ground game,
   stagger system, procedural audio, canvas fighter art, particles.
   ===================================================================== */

/* ---------------------------------------------------------------------
   ROSTER
   --------------------------------------------------------------------- */
const ROSTER = [
  { name:'VIKTOR STONE',  style:'BRAWLER',        ai:'brawler',
    record:'24-3-0', strike:92, grapple:55, stamina:78, chin:88,
    skin:'#c89678', shorts:'#d4232c', trim:'#ffd34d' },
  { name:'KAI NAKAMURA',  style:'STRIKER',        ai:'striker',
    record:'19-1-0', strike:95, grapple:62, stamina:85, chin:74,
    skin:'#e0b48c', shorts:'#101018', trim:'#d4232c' },
  { name:'BORIS VOLKOV',  style:'WRESTLER',       ai:'wrestler',
    record:'27-5-0', strike:70, grapple:96, stamina:90, chin:82,
    skin:'#d2a07a', shorts:'#1f6fb2', trim:'#ffffff' },
  { name:'DIEGO CRUZ',    style:'COUNTER-PUNCHER',ai:'counter',
    record:'21-2-0', strike:88, grapple:74, stamina:80, chin:90,
    skin:'#a06b46', shorts:'#0f8a4d', trim:'#ffd34d' },
  { name:'MARCUS HALE',   style:'BRAWLER',        ai:'brawler',
    record:'18-6-0', strike:84, grapple:60, stamina:72, chin:94,
    skin:'#7a5230', shorts:'#6a1b9a', trim:'#e7c66a' },
  { name:'YUSUF ADESANYA',style:'STRIKER',        ai:'striker',
    record:'23-0-0', strike:97, grapple:58, stamina:88, chin:78,
    skin:'#5a3c24', shorts:'#202028', trim:'#ff3b44' },
];

/* ---------------------------------------------------------------------
   AUDIO ENGINE — procedural sounds via Web Audio API
   --------------------------------------------------------------------- */
class AudioEngine {
  constructor(){
    this.ctx = null;
    this.enabled = true;
  }
  ensure(){
    if(!this.ctx){
      try { this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }
      catch(e){ this.enabled = false; }
    }
    if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, type, gain, slideTo){
    if(!this.enabled) return;
    this.ensure();
    if(!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo), t+dur);
    g.gain.setValueAtTime(gain||0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t+dur+0.02);
  }
  noise(dur, gain, filterFreq){
    if(!this.enabled) return;
    this.ensure();
    if(!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate*dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=filterFreq||800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain||0.3,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }
  punch(power){
    // short thud: noise + low tone
    this.noise(0.08, 0.28*(power||1), 1400);
    this.tone(160, 0.10, 'triangle', 0.25*(power||1), 60);
  }
  kick(power){
    this.noise(0.13, 0.35*(power||1), 700);
    this.tone(90, 0.16, 'sine', 0.32*(power||1), 40);
  }
  block(){
    this.noise(0.05, 0.18, 2500);
    this.tone(300,0.05,'square',0.12,200);
  }
  takedown(){
    this.noise(0.25, 0.4, 500);
    this.tone(70,0.3,'sine',0.3,30);
  }
  crowdRoar(intensity){
    if(!this.enabled) return; this.ensure(); if(!this.ctx) return;
    const dur = 0.6 + (intensity||0.5)*0.8;
    this.noise(dur, 0.12+(intensity||0.5)*0.18, 1200);
    // layered swelling tone
    const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type='sawtooth'; o.frequency.value=180;
    g.gain.setValueAtTime(0.001,t);
    g.gain.linearRampToValueAtTime(0.06,t+dur*0.4);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=600;
    o.connect(f).connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t+dur+0.05);
  }
  bell(){
    this.tone(880,0.5,'sine',0.3,820);
    setTimeout(()=>this.tone(880,0.5,'sine',0.25,820),120);
  }
}
const Audio = new AudioEngine();

/* ---------------------------------------------------------------------
   PARTICLE
   --------------------------------------------------------------------- */
class Particle {
  constructor(x,y,color,kind){
    this.x=x; this.y=y; this.kind=kind||'blood';
    const a = Math.random()*Math.PI*2;
    const sp = kind==='sweat' ? 1+Math.random()*3 : 2+Math.random()*5;
    this.vx = Math.cos(a)*sp;
    this.vy = Math.sin(a)*sp - 2;
    this.life = 1;
    this.decay = 0.02+Math.random()*0.03;
    this.size = (kind==='sweat'?1.5:2)+Math.random()*3;
    this.color = color || '#b5121b';
    this.grav = 0.35;
  }
  update(){
    this.x+=this.vx; this.y+=this.vy; this.vy+=this.grav;
    this.vx*=0.98; this.life-=this.decay;
  }
  draw(ctx){
    ctx.globalAlpha = Math.max(0,this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.size*this.life,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
  }
}

/* ---------------------------------------------------------------------
   FIGHTER
   --------------------------------------------------------------------- */
const STATE = { STAND:'stand', CLINCH:'clinch', SHOOTING:'shooting',
                GROUND_TOP:'top', GROUND_BOT:'bottom', STAGGER:'stagger',
                DOWN:'down', GETUP:'getup' };

class Fighter {
  constructor(data, side){
    this.data = data;
    this.name = data.name;
    this.side = side;                 // -1 = faces right (left side), 1 = faces left (right side)
    this.facing = side===-1 ? 1 : -1; // 1 = facing right
    this.x = side===-1 ? 440 : 840;
    this.y = 540;                     // feet baseline
    this.vx = 0;
    this.health = 100;
    this.stamina = 100;
    this.flash = 0;                   // flash KO meter (stagger)
    this.maxHealth = 100;
    this.state = STATE.STAND;
    // attribute-derived
    this.strike = data.strike/100;
    this.grapple = data.grapple/100;
    this.staminaRate = data.stamina/100;
    this.chin = data.chin/100;
    // timers
    this.attackTimer = 0;             // frames remaining in current attack anim
    this.currentMove = null;
    this.recovery = 0;
    this.blocking = false;
    this.staggerTimer = 0;
    this.downTimer = 0;
    this.getupHold = 0;
    this.shootTimer = 0;
    this.hitFlash = 0;
    this.invuln = 0;
    // cosmetic damage
    this.cuts = [];                   // {x,y,size}
    this.swelling = 0;
    // animation
    this.animFrame = 0;
    this.legPhase = 0;
    this.breathe = Math.random()*Math.PI*2;
    // round scoring
    this.roundsWon = 0;
    // ai
    this.aiTimer = 0;
    this.aiIntent = null;
    this.isPlayer = false;
    // stats for highlight reel
    this.stats = { strikes:0, takedowns:0, knockdowns:0, subs:0 };
  }

  get headX(){ return this.x; }
  get headY(){ return this.y - 150; }

  reset(side){
    this.health = this.maxHealth;
    this.stamina = 100;
    this.flash = 0;
    this.state = STATE.STAND;
    this.facing = side===-1 ? 1 : -1;
    this.x = side===-1 ? 440 : 840;
    this.attackTimer=0; this.recovery=0; this.staggerTimer=0;
    this.downTimer=0; this.getupHold=0; this.shootTimer=0;
    this.blocking=false; this.currentMove=null;
  }

  canAct(){
    return this.attackTimer<=0 && this.recovery<=0 &&
           this.state!==STATE.STAGGER && this.state!==STATE.DOWN &&
           this.state!==STATE.GETUP && this.state!==STATE.SHOOTING;
  }
}

/* ---------------------------------------------------------------------
   MOVE DEFINITIONS  (standing)
   dur = total anim frames, hit = frame the hit lands, range, dmg, flash,
   stam = stamina cost, type for sound, label
   --------------------------------------------------------------------- */
const MOVES = {
  jab:    {dur:16, hit:6,  range:130, dmg:5,  flash:3,  stam:4,  knock:0.0, type:'punch', label:'JAB'},
  cross:  {dur:22, hit:9,  range:140, dmg:9,  flash:7,  stam:7,  knock:0.15,type:'punch', label:'CROSS'},
  hook:   {dur:24, hit:10, range:120, dmg:11, flash:9,  stam:9,  knock:0.2, type:'punch', label:'HOOK'},
  uppercut:{dur:26,hit:11, range:110, dmg:12, flash:11, stam:10, knock:0.22,type:'punch', label:'UPPERCUT'},
  bodykick:{dur:30,hit:13, range:175, dmg:10, flash:5,  stam:12, knock:0.1, type:'kick',  label:'BODY KICK', body:true},
  headkick:{dur:38,hit:18, range:185, dmg:18, flash:16, stam:18, knock:0.4, type:'kick',  label:'HEAD KICK'},
  spinkick:{dur:42,hit:22, range:180, dmg:20, flash:18, stam:20, knock:0.45,type:'kick',  label:'SPINNING KICK'},
  knee:   {dur:20, hit:9,  range:90,  dmg:13, flash:10, stam:9,  knock:0.2, type:'kick',  label:'KNEE'},
  dirtybox:{dur:14,hit:6,  range:90,  dmg:6,  flash:4,  stam:5,  knock:0.05,type:'punch', label:'DIRTY BOXING'},
  gnp:    {dur:18, hit:8,  range:60,  dmg:7,  flash:6,  stam:6,  knock:0.12,type:'punch', label:'GROUND & POUND'},
};

/* ---------------------------------------------------------------------
   GAME
   --------------------------------------------------------------------- */
class Game {
  constructor(){
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.W = this.canvas.width; this.H = this.canvas.height;
    this.keys = {};
    this.particles = [];
    this.shake = 0;
    this.flashScreen = 0;
    this.running = false;
    this.round = 1;
    this.maxRounds = 3;
    this.roundTime = 5*60;            // seconds
    this.timeLeft = this.roundTime;
    this.frame = 0;
    this.tickCarry = 0;
    this.crowd = this.makeCrowd();
    this.spotlights = this.makeSpotlights();
    this.highlights = [];
    this.roundScores = [];            // {p1,p2}
    this.selPlayer = 0;
    this.selAI = 1;
    this.bindUI();
    this.bindKeys();
    this.buildSelect();
  }

  /* ---------- crowd & spotlight precompute ---------- */
  makeCrowd(){
    const arr=[];
    for(let i=0;i<260;i++){
      arr.push({
        x: Math.random()*this.W,
        y: 60 + Math.random()*120,
        s: 6+Math.random()*10,
        shade: 18+Math.floor(Math.random()*22),
        flick: Math.random()*Math.PI*2,
      });
    }
    return arr;
  }
  makeSpotlights(){
    return [
      {x:this.W*0.30, hue:'rgba(255,255,255,'}, {x:this.W*0.5, hue:'rgba(255,240,210,'},
      {x:this.W*0.70, hue:'rgba(255,255,255,'},
    ];
  }

  /* =================== UI / SELECT =================== */
  buildSelect(){
    const pr = document.getElementById('player-roster');
    const ar = document.getElementById('ai-roster');
    pr.innerHTML=''; ar.innerHTML='';
    ROSTER.forEach((f,i)=>{
      pr.appendChild(this.rosterItem(f,i,'player'));
      ar.appendChild(this.rosterItem(f,i,'ai'));
    });
    this.refreshSelect();
  }
  rosterItem(f,i,who){
    const el = document.createElement('div');
    el.className='roster-item'+(who==='player'&&i===this.selPlayer?' selected':'')
      +(who==='ai'&&i===this.selAI?' selected':'');
    el.innerHTML = `<div class="ri-thumb"></div>
      <div class="ri-info"><div class="ri-name">${f.name}</div>
      <div class="ri-style">${f.style}</div>
      <div class="ri-rec">${f.record}</div></div>`;
    // mini portrait
    const thumb = el.querySelector('.ri-thumb');
    const c = document.createElement('canvas'); c.width=46;c.height=46;
    thumb.appendChild(c); this.drawPortrait(c.getContext('2d'),f,46);
    el.onclick = ()=>{
      if(who==='player') this.selPlayer=i; else this.selAI=i;
      this.buildSelect();
    };
    return el;
  }
  refreshSelect(){
    this.fillCard('player-card', ROSTER[this.selPlayer], false);
    this.fillCard('ai-card', ROSTER[this.selAI], true);
  }
  fillCard(id, f, ai){
    const el = document.getElementById(id);
    el.innerHTML = `
      <canvas class="fcard-canvas" width="218" height="170"></canvas>
      <div class="fcard-name">${f.name}</div>
      <div class="fcard-style">${f.style}</div>
      <div class="fcard-rec">RECORD ${f.record}</div>
      ${this.statRow('STRIKE',f.strike)}
      ${this.statRow('GRAPPLE',f.grapple)}
      ${this.statRow('STAMINA',f.stamina)}
      ${this.statRow('CHIN',f.chin)}`;
    const cv = el.querySelector('.fcard-canvas');
    this.drawCardArt(cv.getContext('2d'), f, ai);
  }
  statRow(lbl,v){
    return `<div class="stat-row"><span class="lbl">${lbl}</span>
      <div class="stat-bar"><div class="sfill" style="width:${v}%"></div></div></div>`;
  }

  /* card art: full standing fighter portrait */
  drawCardArt(ctx,f,ai){
    ctx.clearRect(0,0,218,170);
    ctx.save();
    ctx.translate(109,168);
    ctx.scale(0.62,0.62);
    const dummy = new Fighter(f, ai?1:-1);
    dummy.facing = ai?-1:1;
    drawFighterBody(ctx, dummy, 0, false);
    ctx.restore();
  }
  drawPortrait(ctx,f,sz){
    ctx.clearRect(0,0,sz,sz);
    // head only
    ctx.fillStyle=f.skin; ctx.strokeStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sz/2,sz*0.5,sz*0.26,sz*0.32,0,0,Math.PI*2); ctx.fill();
    // hair
    ctx.fillStyle='#1a1310';
    ctx.beginPath(); ctx.ellipse(sz/2,sz*0.32,sz*0.27,sz*0.18,0,0,Math.PI*2); ctx.fill();
    // shorts color accent bar
    ctx.fillStyle=f.shorts;
    ctx.fillRect(0,sz*0.82,sz,sz*0.18);
  }

  /* =================== KEY / UI BIND =================== */
  bindUI(){
    document.getElementById('fight-btn').onclick = ()=>this.startFight();
    document.getElementById('rematch-btn').onclick = ()=>this.startFight();
    document.getElementById('menu-btn').onclick = ()=>this.show('select-screen');
  }
  bindKeys(){
    window.addEventListener('keydown',e=>{
      this.keys[e.key.toLowerCase()] = true;
      if(e.shiftKey) this.keys['shift']=true;
      if(this.running) this.handleInput(e);
    });
    window.addEventListener('keyup',e=>{
      this.keys[e.key.toLowerCase()] = false;
      if(!e.shiftKey) this.keys['shift']=false;
    });
  }
  show(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  /* =================== START FIGHT =================== */
  startFight(){
    Audio.ensure();
    this.p1 = new Fighter(ROSTER[this.selPlayer], -1);
    this.p2 = new Fighter(ROSTER[this.selAI], 1);
    this.p1.isPlayer = true;
    this.p1.facing = 1; this.p2.facing = -1;
    this.round = 1;
    this.roundScores = [];
    this.highlights = [];
    this.particles = [];
    this.setupRound();
    this.updateHUDStatic();
    this.show('game-screen');
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(t=>this.loop(t));
    Audio.bell();
    this.banner('ROUND '+this.round, 1500);
  }

  setupRound(){
    this.p1.reset(-1); this.p2.reset(1);
    this.p1.facing=1; this.p2.facing=-1;
    this.timeLeft = this.roundTime;
    this.frame = 0;
  }

  updateHUDStatic(){
    document.getElementById('p1-name').textContent = this.p1.name;
    document.getElementById('p2-name').textContent = this.p2.name;
    document.getElementById('round-num').textContent = this.round;
    this.drawPortrait(this.makeHudPortrait('p1-portrait'), this.p1.data, 58);
    this.drawPortrait(this.makeHudPortrait('p2-portrait'), this.p2.data, 58);
    // round dots
    const dots = document.getElementById('round-dots'); dots.innerHTML='';
    for(let i=0;i<this.maxRounds;i++){
      const d=document.createElement('div'); d.className='dot';
      const sc = this.roundScores[i];
      if(sc){ d.classList.add(sc.p1>sc.p2?'p1':'p2'); }
      dots.appendChild(d);
    }
  }
  makeHudPortrait(id){
    const wrap = document.getElementById(id);
    wrap.innerHTML='';
    const c=document.createElement('canvas'); c.width=58;c.height=58;
    c.style.width='100%';c.style.height='100%';
    wrap.appendChild(c); return c.getContext('2d');
  }

  /* =================== MAIN LOOP =================== */
  loop(t){
    if(!this.running) return;
    const dt = Math.min(50, t-this.last); this.last=t;
    this.tickCarry += dt;
    while(this.tickCarry >= 16.67){
      this.tick();
      this.tickCarry -= 16.67;
    }
    this.render();
    requestAnimationFrame(tt=>this.loop(tt));
  }

  tick(){
    this.frame++;
    // round clock
    if(this.frame % 60 === 0 && this.timeLeft>0){
      this.timeLeft--;
      if(this.timeLeft<=0) this.endRound('time');
    }
    this.updateFighter(this.p1, this.p2);
    this.updateFighter(this.p2, this.p1);
    this.runAI(this.p2, this.p1);
    this.resolveClinch();
    // particles
    for(const p of this.particles) p.update();
    this.particles = this.particles.filter(p=>p.life>0);
    if(this.shake>0) this.shake*=0.86;
    if(this.flashScreen>0) this.flashScreen-=0.06;
    // stamina regen
    this.regen(this.p1); this.regen(this.p2);
    this.updateHUDLive();
    // KO check
    if(this.p1.health<=0) this.finish(this.p2,this.p1,'KO');
    else if(this.p2.health<=0) this.finish(this.p1,this.p2,'KO');
  }

  regen(f){
    if(f.canAct() && !f.blocking){
      f.stamina = Math.min(100, f.stamina + 0.12*f.staminaRate);
    }
    f.flash = Math.max(0, f.flash - 0.15); // flash meter cools
  }

  /* =================== FIGHTER UPDATE =================== */
  updateFighter(f, opp){
    f.animFrame++;
    f.breathe += 0.05;
    // face opponent
    f.facing = (opp.x > f.x) ? 1 : -1;

    if(f.hitFlash>0) f.hitFlash--;
    if(f.invuln>0) f.invuln--;

    // timers
    if(f.recovery>0) f.recovery--;

    if(f.attackTimer>0){
      const move = f.currentMove;
      const elapsed = move.dur - f.attackTimer;
      if(elapsed === move.hit){
        this.resolveHit(f, opp, move);
      }
      f.attackTimer--;
      if(f.attackTimer<=0){
        f.currentMove=null;
        f.recovery = 4;
      }
    }

    // stagger
    if(f.state===STATE.STAGGER){
      f.staggerTimer--;
      f.x += f.facing * -1.4; // stumble backward
      if(f.staggerTimer<=0) f.state = STATE.STAND;
    }
    // down
    if(f.state===STATE.DOWN){
      f.downTimer--;
      if(f.downTimer<=0){
        // gets up if health remains
        if(f.health>0){ f.state=STATE.STAND; f.invuln=40; }
      }
    }
    // getup hold (ground)
    if(f.state===STATE.GETUP){
      f.getupHold++;
      if(f.getupHold>=60){
        f.state=STATE.STAND; opp.state=STATE.STAND; f.invuln=30;
        this.banner('UP!',600);
      }
    }

    // walking (player movement keys handled in handleInput continuous)
    if(f===this.p1 && this.running){
      this.playerMovement(f);
    }
    // clamp to octagon mat bounds
    f.x = Math.max(180, Math.min(this.W-180, f.x));
  }

  playerMovement(f){
    if(!f.canAct()) return;
    let mv=0;
    if(this.keys['a']) mv-=1;
    if(this.keys['d2']) mv+=1; // not used; d is pass guard
    if(this.keys['arrowleft']) mv-=1;
    if(this.keys['arrowright']) mv+=1;
    if(mv!==0 && f.state===STATE.STAND){
      f.x += mv*3.2;
      f.legPhase += 0.3;
    }
    f.blocking = !!this.keys['s'] && f.state===STATE.STAND;
  }

  /* =================== INPUT (player) =================== */
  handleInput(e){
    const f = this.p1, opp = this.p2;
    const k = e.key.toLowerCase();

    // GROUND game
    if(f.state===STATE.GROUND_TOP){
      if(k==='j'||k==='k'){ this.startMove(f,opp,'gnp'); }
      else if(k==='d'){ this.passGuard(f,opp); }
      else if(k==='v'){ this.subAttempt(f,opp); }
      return;
    }
    if(f.state===STATE.GROUND_BOT){
      if(k==='w'){ if(f.state!==STATE.GETUP){f.state=STATE.GETUP;f.getupHold=0;} }
      else if(k==='v'){ this.subAttempt(f,opp); }
      return;
    }
    // CLINCH
    if(f.state===STATE.CLINCH){
      if(k==='n') this.startMove(f,opp,'knee');
      else if(k==='j'||k==='k') this.startMove(f,opp,'dirtybox');
      else if(k==='o') this.clinchTakedown(f,opp);
      else if(k==='s') this.breakClinch();
      return;
    }
    // SHOOTING handled by AI/timer; player sprawl with S while opp shoots
    if(!f.canAct()) return;

    // STANDING strikes
    switch(k){
      case 'j': this.startMove(f,opp,'jab'); break;
      case 'k': this.startMove(f,opp,'cross'); break;
      case 'u': this.startMove(f,opp,'hook'); break;
      case 'i': this.startMove(f,opp,'uppercut'); break;
      case 'l':
        if(this.keys['shift']) this.startMove(f,opp,'headkick');
        else this.startMove(f,opp,'bodykick');
        break;
      case 'b': this.startMove(f,opp,'spinkick'); break;
      case 'o': this.startShoot(f,opp); break;
      case 'n':
        // attempt clinch if close
        if(Math.abs(f.x-opp.x)<110) this.enterClinch(f,opp);
        break;
    }
  }

  /* =================== MOVE EXECUTION =================== */
  startMove(f, opp, name){
    const move = MOVES[name];
    if(!move) return;
    if(f.attackTimer>0||f.recovery>0) return;
    if(f.stamina < move.stam*0.5) return; // too gassed
    f.currentMove = move;
    f.attackTimer = move.dur;
    f.stamina = Math.max(0, f.stamina - move.stam);
    f.legPhase=0;
  }

  startShoot(f, opp){
    if(!f.canAct()) return;
    if(f.stamina<15) return;
    f.state = STATE.SHOOTING;
    f.shootTimer = 30;
    f.stamina -= 15;
    this.technique(f,'TAKEDOWN ATTEMPT');
    Audio.takedown();
    // resolve after delay — check sprawl
    setTimeout(()=>this.resolveTakedown(f,opp), 480);
  }

  resolveTakedown(f, opp){
    if(f.state!==STATE.SHOOTING) return;
    f.state = STATE.STAND;
    // opponent sprawl if blocking (S) or AI defends, weighted by grapple
    const dist = Math.abs(f.x-opp.x);
    const sprawled = (opp.isPlayer ? this.keys['s'] : opp.aiIntent==='sprawl') ;
    const defChance = opp.grapple*0.5 + (sprawled?0.4:0);
    const offChance = f.grapple*0.6 + (dist<120?0.2:-0.3);
    if(offChance > defChance && Math.random()<0.7){
      // successful takedown
      this.completeTakedown(f,opp);
    } else {
      this.technique(opp,'SPRAWL!');
      opp.stamina = Math.max(0,opp.stamina-8);
    }
  }

  completeTakedown(f, opp){
    f.state = STATE.GROUND_TOP;
    opp.state = STATE.GROUND_BOT;
    // position both centrally
    const cx = (f.x+opp.x)/2;
    f.x = cx; opp.x = cx;
    f.stats.takedowns++;
    this.technique(f,'TAKEDOWN!');
    this.shake = 14; this.flashScreen=0.4;
    Audio.takedown(); Audio.crowdRoar(0.7);
    this.addHighlight(`${f.name} scores a takedown in R${this.round}`);
    this.damage(opp, f, 4, 6, false);
  }

  passGuard(f, opp){
    if(f.recovery>0) return;
    f.recovery=20;
    if(Math.random() < f.grapple*0.6){
      this.technique(f,'PASS GUARD');
      this.damage(opp,f,3,5,false);
    } else {
      this.technique(opp,'GUARD HELD');
    }
  }

  subAttempt(f, opp){
    if(f.recovery>0) return;
    f.recovery=40;
    this.technique(f, Math.random()<0.5?'ARMBAR':'REAR-NAKED CHOKE');
    Audio.crowdRoar(0.8);
    // chance based on grapple vs opp defense + opp health
    const chance = f.grapple*0.5 - opp.grapple*0.3 + (1-opp.health/100)*0.5;
    if(Math.random() < Math.max(0.05, chance)){
      f.stats.subs++;
      this.addHighlight(`${f.name} locks in the submission!`);
      this.finish(f, opp, 'SUBMISSION');
    } else {
      this.technique(opp,'DEFENDED');
      f.stamina = Math.max(0,f.stamina-12);
    }
  }

  /* =================== CLINCH =================== */
  enterClinch(f, opp){
    if(f.state!==STATE.STAND || opp.state!==STATE.STAND) return;
    f.state = STATE.CLINCH; opp.state = STATE.CLINCH;
    const cx=(f.x+opp.x)/2;
    f.x = cx - f.facing*40; opp.x = cx + f.facing*40;
    this.technique(f,'CLINCH');
  }
  breakClinch(){
    if(this.p1.state===STATE.CLINCH){
      this.p1.state=STATE.STAND; this.p2.state=STATE.STAND;
      this.p1.x -= this.p1.facing*30; this.p2.x += this.p1.facing*30;
    }
  }
  clinchTakedown(f, opp){
    if(f.recovery>0) return;
    f.recovery=24;
    if(Math.random() < f.grapple*0.6 + 0.1){
      this.completeTakedown(f,opp);
    } else {
      this.technique(opp,'DEFENDED TD');
    }
  }
  resolveClinch(){
    // auto-enter clinch on heavy overlap when both standing
    const a=this.p1,b=this.p2;
    if(a.state===STATE.STAND && b.state===STATE.STAND){
      if(Math.abs(a.x-b.x)<62 && a.attackTimer<=0 && b.attackTimer<=0){
        if(Math.random()<0.04) this.enterClinch(a,b);
      }
    }
  }

  /* =================== HIT RESOLUTION =================== */
  resolveHit(f, opp, move){
    f.stats.strikes++;
    const dist = Math.abs(f.x-opp.x);
    let reach = move.range;
    if(f.state===STATE.GROUND_TOP) reach = 80;
    if(f.state===STATE.CLINCH) reach = 110;
    if(dist > reach){
      // whiff
      if(move.type==='punch') Audio.tone(400,0.04,'sine',0.05,300);
      return;
    }
    // blocking
    if(opp.blocking && opp.state===STATE.STAND && !move.body){
      Audio.block();
      this.spawnParticles(opp.headX+opp.facing*-20, opp.headY, 4, '#cfd2da','sweat');
      opp.stamina = Math.max(0, opp.stamina - move.dmg*0.4);
      this.shake = 4;
      const px = (f.x+opp.x)/2;
      this.impact(px, opp.headY, 0.5);
      return;
    }
    if(opp.invuln>0) return;

    // landed
    const power = move.dmg * (0.7 + f.strike*0.5);
    const chinFactor = 2 - opp.chin;       // weaker chin -> more flash
    const flashGain = move.flash * chinFactor;
    this.damage(opp, f, power, flashGain, true, move);
  }

  damage(opp, f, dmg, flashGain, visual, move){
    opp.health = Math.max(0, opp.health - dmg);
    opp.flash += flashGain;
    opp.hitFlash = 8;
    opp.invuln = 6;
    // knockback
    if(move){
      opp.x += f.facing * (move.knock*40);
    }
    // sound
    if(move){
      if(move.type==='kick') Audio.kick(0.8+move.dmg/25);
      else Audio.punch(0.7+move.dmg/20);
    }
    // visuals
    if(visual){
      const hx = (move && move.body) ? opp.y-90 : opp.headY;
      const px = opp.x + opp.facing*-10;
      const heavy = dmg>9;
      this.impact(px, (move&&move.body)?opp.y-90:opp.headY, heavy?1:0.6);
      this.spawnParticles(px, (move&&move.body)?opp.y-90:opp.headY,
                          heavy?12:6, '#b5121b','blood');
      this.shake = Math.min(22, 6 + dmg);
      if(heavy){ this.flashScreen = 0.5; Audio.crowdRoar(Math.min(1,dmg/22)); }
      // accumulate cosmetic damage
      this.addCut(opp, dmg);
      opp.swelling = Math.min(1, opp.swelling + dmg*0.015);
    }
    // knockdown / stagger checks
    if(opp.health<=0){ return; } // KO handled in tick
    if(opp.flash >= 30 && opp.state===STATE.STAND){
      this.knockdownCheck(opp, f, dmg, move);
    } else if(opp.flash >= 18 && opp.state===STATE.STAND && Math.random()<0.5){
      this.stagger(opp);
    }
  }

  knockdownCheck(opp, f, dmg, move){
    // big shot -> knockdown
    const heavy = move && (move.knock>=0.2 || dmg>11);
    if(heavy && Math.random() < 0.6){
      opp.state = STATE.DOWN;
      opp.downTimer = 120;
      opp.flash = 0;
      f.stats.knockdowns++;
      this.banner('KNOCKDOWN!',1400);
      this.flashScreen=0.9; this.shake=24;
      Audio.crowdRoar(1);
      this.addHighlight(`${f.name} drops ${opp.name} with a ${move.label.toLowerCase()}!`);
      // possible TKO finish if low health
      if(opp.health < 22 && Math.random()<0.7){
        setTimeout(()=>{ if(opp.state===STATE.DOWN) this.finish(f,opp,'TKO'); }, 700);
      }
    } else {
      this.stagger(opp);
    }
  }

  stagger(opp){
    opp.state = STATE.STAGGER;
    opp.staggerTimer = 50;
    opp.flash = Math.max(0, opp.flash-8);
    this.banner('ROCKED!',900);
    this.flashScreen=0.5;
  }

  addCut(f, dmg){
    if(dmg<7) return;
    if(f.cuts.length>6) return;
    if(Math.random()<0.5){
      f.cuts.push({
        ox: (Math.random()-0.5)*30,
        oy: -150 + (Math.random()-0.5)*30,
        size: 2+Math.random()*3,
      });
    }
  }

  /* =================== EFFECTS =================== */
  impact(x,y,scale){
    this.impacts = this.impacts||[];
    this.impacts.push({x,y,life:1,scale:scale||1});
  }
  spawnParticles(x,y,n,color,kind){
    for(let i=0;i<n;i++) this.particles.push(new Particle(x,y,color,kind));
  }
  technique(f, text){
    const el = document.getElementById('technique-label');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._techTO);
    this._techTO = setTimeout(()=>el.classList.remove('show'), 650);
  }
  banner(text, ms){
    const el = document.getElementById('state-banner');
    el.textContent = text; el.classList.add('show');
    clearTimeout(this._bannerTO);
    this._bannerTO = setTimeout(()=>el.classList.remove('show'), ms||1000);
  }
  addHighlight(t){ this.highlights.push(`R${this.round} ${this.fmtClock()} — ${t}`); }

  /* =================== AI =================== */
  runAI(ai, opp){
    if(!this.running) return;
    if(ai.aiTimer>0){ ai.aiTimer--; }
    const dist = Math.abs(ai.x-opp.x);
    const style = ai.data.ai;

    // GROUND AI
    if(ai.state===STATE.GROUND_TOP){
      if(ai.recovery<=0 && ai.aiTimer<=0){
        const r=Math.random();
        if(r<0.5) this.startMove(ai,opp,'gnp');
        else if(r<0.75) this.passGuard(ai,opp);
        else this.subAttempt(ai,opp);
        ai.aiTimer=40;
      }
      return;
    }
    if(ai.state===STATE.GROUND_BOT){
      if(ai.aiTimer<=0){
        if(Math.random()<0.4){ if(ai.state!==STATE.GETUP){ai.state=STATE.GETUP;ai.getupHold=0;} }
        else this.subAttempt(ai,opp);
        ai.aiTimer=70;
      }
      return;
    }
    // CLINCH AI
    if(ai.state===STATE.CLINCH){
      if(ai.recovery<=0 && ai.aiTimer<=0){
        const r=Math.random();
        if(style==='wrestler' && r<0.5) this.clinchTakedown(ai,opp);
        else if(r<0.6) this.startMove(ai,opp,'knee');
        else if(r<0.9) this.startMove(ai,opp,'dirtybox');
        else this.breakClinchAI(ai,opp);
        ai.aiTimer=30;
      }
      return;
    }
    if(!ai.canAct()) return;

    // movement + decision by personality
    let desiredDist, aggression, shootBias=0;
    switch(style){
      case 'striker':  desiredDist=150; aggression=0.55; break;
      case 'wrestler': desiredDist=120; aggression=0.5; shootBias=0.5; break;
      case 'counter':  desiredDist=160; aggression=0.3; break;
      case 'brawler':  desiredDist=90;  aggression=0.8; break;
      default:         desiredDist=140; aggression=0.5;
    }

    // sprawl readiness if opponent shooting
    ai.aiIntent = (opp.state===STATE.SHOOTING && Math.random()<ai.grapple) ? 'sprawl' : null;

    // move toward/away from desired range
    ai.blocking=false;
    if(Math.abs(dist-desiredDist) > 18){
      const dir = dist>desiredDist ? ai.facing : -ai.facing;
      ai.x += dir * (1.8 + aggression);
      ai.legPhase += 0.25;
    }

    // counter-puncher blocks when opponent attacks
    if(style==='counter' && opp.attackTimer>0 && dist<170 && Math.random()<0.6){
      ai.blocking=true;
    }

    // gassed -> back off
    if(ai.stamina<20){ ai.aiTimer = Math.max(ai.aiTimer,20); return; }

    if(ai.aiTimer>0) return;

    // attack decision
    const r = Math.random();
    if(r > aggression){ ai.aiTimer = 18 + Math.floor(Math.random()*30); return; }

    // shoot for takedown (wrestler)
    if(shootBias>0 && dist<140 && Math.random()<shootBias && opp.health<90){
      this.startShoot(ai,opp); ai.aiTimer=70; return;
    }
    // clinch attempt for wrestler when very close
    if(style==='wrestler' && dist<90 && Math.random()<0.4){
      this.enterClinch(ai,opp); ai.aiTimer=40; return;
    }

    // pick a strike appropriate to range
    let pick;
    if(dist>165){
      pick = Math.random()<0.5?'bodykick':(Math.random()<0.4?'headkick':'spinkick');
    } else if(dist>120){
      pick = ['jab','cross','bodykick'][Math.floor(Math.random()*3)];
    } else {
      pick = ['jab','cross','hook','uppercut'][Math.floor(Math.random()*4)];
    }
    // brawlers throw combos
    this.startMove(ai,opp,pick);
    if(style==='brawler' && Math.random()<0.6){
      const combo = ['cross','hook'][Math.floor(Math.random()*2)];
      ai.aiTimer = MOVES[pick].dur + 2;
      setTimeout(()=>{ if(ai.canAct()&&ai.state===STATE.STAND) this.startMove(ai,opp,combo); }, MOVES[pick].dur*16);
    } else {
      ai.aiTimer = MOVES[pick].dur + 12 + Math.floor(Math.random()*20);
    }
  }
  breakClinchAI(ai,opp){
    ai.state=STATE.STAND; opp.state=STATE.STAND;
    ai.x -= ai.facing*30;
  }

  /* =================== ROUND / FINISH =================== */
  endRound(reason){
    if(!this.running) return;
    // score round (10-9): more health + activity wins
    const p1 = this.p1, p2 = this.p2;
    const p1score = p1.health + p1.stats.strikes*0.5 + p1.stats.takedowns*4 + p1.stats.knockdowns*8;
    const p2score = p2.health + p2.stats.strikes*0.5 + p2.stats.takedowns*4 + p2.stats.knockdowns*8;
    const sc = p1score>=p2score ? {p1:10,p2:9} : {p1:9,p2:10};
    if(p1.stats.knockdowns>p2.stats.knockdowns+0 && sc.p1===10) sc.p2=8;
    if(p2.stats.knockdowns>p1.stats.knockdowns+0 && sc.p2===10) sc.p1=8;
    this.roundScores[this.round-1] = sc;
    if(sc.p1>sc.p2) p1.roundsWon++; else p2.roundsWon++;

    Audio.bell();
    if(this.round >= this.maxRounds){
      this.decision();
      return;
    }
    this.running=false;
    this.showRoundCard();
  }

  showRoundCard(){
    document.getElementById('rc-round').textContent = this.round;
    const sc = document.getElementById('scorecards'); sc.innerHTML='';
    this.roundScores.forEach((s,i)=>{
      const el=document.createElement('div'); el.className='score-line';
      el.innerHTML=`<span>${this.p1.name} <b>${s.p1}</b></span>
        <span class="sc-r">ROUND ${i+1}</span>
        <span><b>${s.p2}</b> ${this.p2.name}</span>`;
      sc.appendChild(el);
    });
    document.getElementById('corner-advice').textContent = this.cornerAdvice();
    this.show('round-screen');
    let n=5;
    const cd=document.getElementById('round-countdown');
    cd.textContent=`Next round in ${n}...`;
    const iv=setInterval(()=>{
      n--; cd.textContent=`Next round in ${n}...`;
      if(n<=0){ clearInterval(iv); this.nextRound(); }
    },1000);
  }
  cornerAdvice(){
    const p=this.p1;
    const advice=[];
    if(p.health<40) advice.push("You're getting tagged — keep your hands up and circle out.");
    if(p.stamina<35) advice.push("Pace yourself, you're gassing. Pick your shots.");
    if(p.stats.takedowns===0 && p.data.ai==='wrestler') advice.push("Get this fight to the mat, that's where you win.");
    if(advice.length===0) advice.push("Beautiful work out there. Stay sharp and finish strong!");
    return advice.join(' ');
  }
  nextRound(){
    this.round++;
    this.setupRound();
    this.updateHUDStatic();
    this.show('game-screen');
    this.running=true; this.last=performance.now();
    requestAnimationFrame(t=>this.loop(t));
    Audio.bell();
    this.banner('ROUND '+this.round,1300);
  }

  finish(winner, loser, method){
    if(!this.running) return;
    this.running=false;
    Audio.crowdRoar(1); Audio.bell();
    this.flashScreen=1;
    winner.roundsWon = 99; // mark winner
    this.showResult(winner, loser, method);
  }
  decision(){
    this.running=false;
    const p1=this.p1,p2=this.p2;
    const winner = p1.roundsWon>=p2.roundsWon ? p1 : p2;
    const loser  = winner===p1 ? p2 : p1;
    const method = p1.roundsWon===p2.roundsWon ? 'DRAW' : 'DECISION';
    this.showResult(winner, loser, method);
  }
  showResult(winner, loser, method){
    document.getElementById('result-method').textContent =
      ({KO:'KNOCKOUT',TKO:'TECHNICAL KNOCKOUT',SUBMISSION:'SUBMISSION',
        DECISION:'UNANIMOUS DECISION',DRAW:'DRAW'})[method]||method;
    document.getElementById('result-winner').textContent =
      method==='DRAW' ? 'DRAW' : winner.name;
    let detail = `Round ${this.round} of ${this.maxRounds}`;
    if(method==='DECISION'||method==='DRAW'){
      detail = `${this.p1.name} ${this.p1.roundsWon} — ${this.p2.roundsWon} ${this.p2.name}`;
    } else {
      detail += ` · ${this.fmtClock()}`;
    }
    document.getElementById('result-detail').textContent = detail;
    // highlight reel
    const hr = document.getElementById('highlight-reel');
    const items = this.highlights.slice(-6);
    hr.innerHTML = `<div class="hr-title">HIGHLIGHT REEL</div>` +
      (items.length ? items.map(h=>`<div>• ${h}</div>`).join('')
                    : '<div>• A back-and-forth war that went the distance.</div>');
    this.show('result-screen');
  }

  /* =================== HUD LIVE =================== */
  updateHUDLive(){
    document.getElementById('p1-health').style.width = Math.max(0,this.p1.health)+'%';
    document.getElementById('p2-health').style.width = Math.max(0,this.p2.health)+'%';
    document.getElementById('p1-stamina').style.width = Math.max(0,this.p1.stamina)+'%';
    document.getElementById('p2-stamina').style.width = Math.max(0,this.p2.stamina)+'%';
    document.getElementById('clock').textContent = this.fmtClock();
  }
  fmtClock(){
    const m=Math.floor(this.timeLeft/60), s=this.timeLeft%60;
    return `${m}:${s<10?'0':''}${s}`;
  }

  /* =================== RENDER =================== */
  render(){
    const ctx=this.ctx;
    ctx.save();
    // screen shake
    if(this.shake>0.5){
      ctx.translate((Math.random()-0.5)*this.shake, (Math.random()-0.5)*this.shake);
    }
    this.drawArena(ctx);
    // shadows
    this.drawShadow(ctx,this.p1); this.drawShadow(ctx,this.p2);
    // draw fighters (back-to-front by y)
    const order = [this.p1,this.p2].sort((a,b)=>a.y-b.y);
    for(const f of order) this.drawFighter(ctx,f);
    // impacts
    this.drawImpacts(ctx);
    // particles
    for(const p of this.particles) p.draw(ctx);
    ctx.restore();
    // white flash overlay
    if(this.flashScreen>0.02){
      ctx.fillStyle=`rgba(255,255,255,${this.flashScreen*0.6})`;
      ctx.fillRect(0,0,this.W,this.H);
    }
  }

  drawArena(ctx){
    // background
    const g=ctx.createLinearGradient(0,0,0,this.H);
    g.addColorStop(0,'#0a0a12'); g.addColorStop(1,'#050508');
    ctx.fillStyle=g; ctx.fillRect(0,0,this.W,this.H);

    // crowd silhouettes
    for(const c of this.crowd){
      const fl = 0.5+0.5*Math.sin(this.frame*0.05+c.flick);
      ctx.fillStyle=`rgb(${c.shade},${c.shade},${c.shade+6})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.s*0.45, 0, Math.PI*2); // head
      ctx.fill();
      ctx.fillRect(c.x-c.s*0.4, c.y, c.s*0.8, c.s*1.1); // body
      if(fl>0.92){ ctx.fillStyle='rgba(255,240,200,0.05)'; ctx.fillRect(c.x-c.s,c.y-c.s,c.s*2,c.s*2);}
    }
    // spotlights from above
    for(const s of this.spotlights){
      const grad=ctx.createRadialGradient(s.x,-50,10,s.x,this.H*0.5,this.H*0.9);
      grad.addColorStop(0, s.hue+'0.10)');
      grad.addColorStop(1, s.hue+'0)');
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.moveTo(s.x,-20);
      ctx.lineTo(s.x-260,this.H);
      ctx.lineTo(s.x+260,this.H);
      ctx.closePath(); ctx.fill();
    }

    // cage mesh band
    ctx.save();
    ctx.globalAlpha=0.25; ctx.strokeStyle='#3a3e46'; ctx.lineWidth=1;
    const top=150, bot=300;
    for(let x=0;x<this.W+40;x+=26){
      ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x-26,bot); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x+26,bot); ctx.stroke();
    }
    ctx.restore();
    // cage posts
    ctx.fillStyle='#22252b';
    ctx.fillRect(120,140,16,180); ctx.fillRect(this.W-136,140,16,180);

    // OCTAGON MAT
    this.drawMat(ctx);
  }

  drawMat(ctx){
    const cx=this.W/2, cy=560, rx=560, ry=180;
    ctx.save();
    // octagon points
    const pts=[];
    for(let i=0;i<8;i++){
      const a = Math.PI/8 + i*Math.PI/4;
      pts.push([cx+Math.cos(a)*rx, cy+Math.sin(a)*ry]);
    }
    ctx.beginPath();
    pts.forEach((p,i)=> i? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]));
    ctx.closePath();
    // mat fill
    const mg=ctx.createRadialGradient(cx,cy-40,40,cx,cy,rx);
    mg.addColorStop(0,'#d8b97e'); mg.addColorStop(0.7,'#c8a96e'); mg.addColorStop(1,'#9c824f');
    ctx.fillStyle=mg; ctx.fill();
    // mat border
    ctx.lineWidth=10; ctx.strokeStyle='#5a4a2e'; ctx.stroke();
    ctx.clip();
    // radiating lines
    ctx.strokeStyle='rgba(120,98,58,0.5)'; ctx.lineWidth=2;
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.lineTo(cx+Math.cos(a)*rx*1.1, cy+Math.sin(a)*ry*1.4); ctx.stroke();
    }
    // center logo circle
    ctx.beginPath(); ctx.ellipse(cx,cy,90,32,0,0,Math.PI*2);
    ctx.strokeStyle='rgba(90,74,46,0.8)'; ctx.lineWidth=4; ctx.stroke();
    ctx.fillStyle='rgba(212,35,44,0.18)'; ctx.fill();
    ctx.fillStyle='rgba(90,74,46,0.7)';
    ctx.font='bold 26px Trebuchet MS'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('OCTAGON', cx, cy);
    ctx.restore();
  }

  drawShadow(ctx,f){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y+6, 54, 14, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  drawFighter(ctx,f){
    ctx.save();
    ctx.translate(f.x, f.y);
    // hit flash tint
    drawFighterBody(ctx, f, this.frame, true);
    ctx.restore();
  }

  drawImpacts(ctx){
    if(!this.impacts) return;
    for(const im of this.impacts){
      ctx.save();
      ctx.globalAlpha=im.life;
      ctx.translate(im.x,im.y);
      const r = (1-im.life)*30*im.scale + 6;
      ctx.strokeStyle='#fff'; ctx.lineWidth=3*im.life;
      // starburst
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*r*0.4,Math.sin(a)*r*0.4);
        ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
        ctx.stroke();
      }
      ctx.fillStyle=`rgba(255,220,150,${im.life*0.6})`;
      ctx.beginPath(); ctx.arc(0,0,r*0.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
      im.life-=0.08;
    }
    this.impacts = this.impacts.filter(i=>i.life>0);
  }
}

/* =====================================================================
   FIGHTER BODY DRAWING  (profile / 3-quarter MMA stance)
   Drawn around local origin at the FEET (0,0), body extends upward.
   ===================================================================== */
function drawFighterBody(ctx, f, frame, inGame){
  const d = f.data;
  const face = f.facing;                 // 1 = facing right
  ctx.save();
  ctx.scale(face, 1);                    // flip horizontally to face direction

  const skin = d.skin;
  const skinDark = shade(skin,-30);
  const skinLight = shade(skin,25);
  const shorts = d.shorts;
  const shortsDark = shade(shorts,-40);
  const trim = d.trim;

  // pose offsets driven by state/anim
  let leanFwd=0, crouch=0, armEx=0, kickUp=0, spin=0;
  const move = f.currentMove;
  let prog = 0;
  if(move && f.attackTimer>0){
    prog = (move.dur - f.attackTimer)/move.dur;
  }

  // ground / down poses change everything
  const grounded = (f.state===STATE.GROUND_TOP||f.state===STATE.GROUND_BOT||
                    f.state===STATE.DOWN||f.state===STATE.GETUP);

  if(grounded){
    drawGroundFighter(ctx, f, frame, {skin,skinDark,skinLight,shorts,shortsDark,trim});
    ctx.restore();
    if(inGame) drawDamageOverlay(ctx,f,face);
    return;
  }

  // stagger wobble
  let wob=0;
  if(f.state===STATE.STAGGER){ wob = Math.sin(frame*0.5)*6; crouch=10; }

  // breathing
  const breath = Math.sin(f.breathe)*2;

  // attack-specific posing
  if(move){
    const p = Math.sin(prog*Math.PI);    // 0..1..0
    switch(move.label){
      case 'JAB': case 'CROSS': case 'DIRTY BOXING': armEx = p* (move.label==='CROSS'?70:55); leanFwd=p*8; break;
      case 'HOOK': armEx=p*40; leanFwd=p*6; spin=p*0.1; break;
      case 'UPPERCUT': armEx=p*35; crouch=p*14; break;
      case 'BODY KICK': kickUp=p*55; leanFwd=-p*6; break;
      case 'HEAD KICK': kickUp=p*120; leanFwd=-p*10; break;
      case 'SPINNING KICK': spin=prog*Math.PI*2; kickUp=p*90; break;
      case 'KNEE': kickUp=p*70; leanFwd=p*10; break;
    }
  }

  ctx.translate(wob,0);
  if(spin && move && move.label==='SPINNING KICK'){
    // rough spin: squash horizontally
    ctx.scale(Math.cos(spin)>=0?1:-1,1);
  }

  // ---- LEGS (stance: knees bent, staggered) ----
  const hipY = -100 - crouch + breath*0.5;
  const legGait = Math.sin(f.legPhase)*8;
  // rear leg
  drawLeg(ctx, 14, hipY, -8+legGait, skin, skinDark, shorts);
  // lead leg (front)
  if(kickUp>0){
    drawKickLeg(ctx, -6, hipY, kickUp, skin, skinDark, shorts, trim);
  } else {
    drawLeg(ctx, -16, hipY, 6-legGait, skin, skinDark, shorts);
  }

  // ---- SHORTS / HIPS ----
  ctx.save();
  const sg=ctx.createLinearGradient(-26,hipY-6,26,hipY+40);
  sg.addColorStop(0,shade(shorts,20)); sg.addColorStop(0.5,shorts); sg.addColorStop(1,shortsDark);
  ctx.fillStyle=sg;
  roundRectPath(ctx, -26, hipY-8, 50, 46, 8); ctx.fill();
  // trim stripe
  ctx.fillStyle=trim; ctx.fillRect(-26, hipY+30, 50, 5);
  ctx.fillStyle=trim; ctx.fillRect(8, hipY-6, 5, 40);
  ctx.restore();

  // ---- TORSO (muscular, leaning) ----
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(leanFwd*0.01);
  const torsoH = 76;
  const tg=ctx.createLinearGradient(-30,0,34,-torsoH);
  tg.addColorStop(0,skinDark); tg.addColorStop(0.45,skin); tg.addColorStop(1,skinLight);
  ctx.fillStyle=tg;
  ctx.beginPath();
  ctx.moveTo(-22,0);
  ctx.quadraticCurveTo(-30,-torsoH*0.5, -20,-torsoH);   // back
  ctx.quadraticCurveTo(0,-torsoH-6, 22,-torsoH+4);       // shoulders
  ctx.quadraticCurveTo(34,-torsoH*0.45, 24,2);           // chest/abs front
  ctx.closePath(); ctx.fill();
  // ab/pec definition
  ctx.strokeStyle=`rgba(0,0,0,0.18)`; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(6,-torsoH+18); ctx.quadraticCurveTo(20,-torsoH*0.6,14,-torsoH*0.4); ctx.stroke();
  for(let i=0;i<3;i++){ const ay=-torsoH*0.4+i*12;
    ctx.beginPath(); ctx.moveTo(2,ay); ctx.lineTo(18,ay-2); ctx.stroke(); }
  // pec highlight
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.ellipse(14,-torsoH+22,10,7,0.3,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // ---- REAR ARM (at chin / guard) ----
  const shoulderY = hipY - torsoH + 8;
  drawArm(ctx, 16, shoulderY, /*rear*/ true, armEx*0.3, move, skin, skinDark, trim, true);

  // ---- HEAD ----
  drawHead(ctx, 6, shoulderY-8, skin, skinDark, skinLight, d, f, leanFwd);

  // ---- LEAD ARM (jab/punch extends) ----
  const isPunch = move && (move.type==='punch');
  drawArm(ctx, -8, shoulderY+4, /*rear*/ false, armEx, move, skin, skinDark, trim, !isPunch);

  ctx.restore();

  if(inGame) drawDamageOverlay(ctx,f,face);
}

function drawHead(ctx,x,y,skin,skinDark,skinLight,d,f,lean){
  ctx.save();
  ctx.translate(x + (lean?lean*0.2:0), y);
  // neck
  ctx.fillStyle=skinDark;
  ctx.fillRect(-8,-2,16,16);
  // head shape (3/4 profile)
  const hg=ctx.createLinearGradient(-18,-30,18,0);
  hg.addColorStop(0,skinDark); hg.addColorStop(0.5,skin); hg.addColorStop(1,skinLight);
  ctx.fillStyle=hg;
  ctx.beginPath();
  ctx.moveTo(-14,-14);
  ctx.quadraticCurveTo(-16,-38,4,-42);       // back/top of skull
  ctx.quadraticCurveTo(20,-40,20,-22);       // forehead/brow forward
  ctx.quadraticCurveTo(22,-10,12,-2);        // nose/jaw
  ctx.quadraticCurveTo(2,4,-10,0);           // chin/jaw back
  ctx.closePath(); ctx.fill();
  // hair
  ctx.fillStyle='#15100c';
  ctx.beginPath();
  ctx.moveTo(-14,-16);
  ctx.quadraticCurveTo(-17,-40,4,-44);
  ctx.quadraticCurveTo(18,-43,18,-30);
  ctx.quadraticCurveTo(6,-36,-6,-30);
  ctx.quadraticCurveTo(-12,-26,-14,-16);
  ctx.closePath(); ctx.fill();
  // ear
  ctx.fillStyle=skinDark;
  ctx.beginPath(); ctx.ellipse(-2,-16,4,6,0,0,Math.PI*2); ctx.fill();
  // brow
  ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(8,-26); ctx.lineTo(18,-24); ctx.stroke();
  // eye
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(13,-22,2.6,2,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#241a12'; ctx.beginPath(); ctx.arc(14,-22,1.3,0,Math.PI*2); ctx.fill();
  // nose shadow
  ctx.strokeStyle='rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.moveTo(19,-20); ctx.lineTo(15,-12); ctx.stroke();
  // mouth / mouthguard hint
  ctx.strokeStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.moveTo(8,-8); ctx.lineTo(14,-7); ctx.stroke();
  // swelling
  if(f.swelling>0.3){
    ctx.fillStyle=`rgba(120,40,40,${Math.min(0.5,f.swelling*0.5)})`;
    ctx.beginPath(); ctx.ellipse(15,-24,4,3,0,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawArm(ctx, sx, sy, rear, extend, move, skin, skinDark, trim, guard){
  ctx.save();
  ctx.translate(sx, sy);
  const col = rear ? skinDark : skin;
  ctx.strokeStyle = col; ctx.lineCap='round';
  ctx.lineWidth = rear ? 13 : 14;

  let ex=0, ey=0, fistX, fistY;
  if(extend>2){
    // extended punch toward facing dir (right, since context already flipped)
    ex = 18 + extend; ey = -6;
    fistX = ex + 14; fistY = ey;
    // upper arm
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ex*0.55, ey-4); ctx.stroke();
    // forearm
    ctx.lineWidth = rear?11:12;
    ctx.beginPath(); ctx.moveTo(ex*0.55, ey-4); ctx.lineTo(ex, ey); ctx.stroke();
  } else {
    // guard position: hand near chin
    ex = guard ? 10 : 6; ey = guard ? -20 : -8;
    fistX = ex; fistY = ey;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ex-6, ey+12); ctx.stroke();
    ctx.lineWidth = rear?11:12;
    ctx.beginPath(); ctx.moveTo(ex-6, ey+12); ctx.lineTo(ex, ey); ctx.stroke();
  }
  // muscle highlight
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(2,-2); ctx.lineTo(ex*0.4,ey-2); ctx.stroke();

  // GLOVE (open-finger MMA)
  drawGlove(ctx, fistX, fistY, trim);
  ctx.restore();
}

function drawGlove(ctx,x,y,trim){
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle='#1c1c22';
  ctx.beginPath(); ctx.ellipse(0,0,9,8,0,0,Math.PI*2); ctx.fill();
  // padded knuckle
  ctx.fillStyle='#2a2a32';
  ctx.beginPath(); ctx.ellipse(3,-2,6,5,0,0,Math.PI*2); ctx.fill();
  // open fingers (small nubs)
  ctx.fillStyle='#1c1c22';
  for(let i=0;i<3;i++){ ctx.beginPath(); ctx.ellipse(7,-4+i*3,2.4,1.8,0,0,Math.PI*2); ctx.fill(); }
  // trim
  ctx.strokeStyle=trim; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(-3,2,6,-0.4,2.4); ctx.stroke();
  ctx.restore();
}

function drawLeg(ctx, hx, hipY, kneeOff, skin, skinDark, shorts){
  ctx.save();
  ctx.strokeStyle=skinDark; ctx.lineCap='round';
  // thigh (covered by shorts top)
  const kneeY = hipY + 52;
  const ankleY = 8;
  const kneeX = hx + kneeOff*0.5;
  const footX = hx + kneeOff;
  // thigh
  ctx.lineWidth=18; ctx.strokeStyle=shade(skin,-10);
  ctx.beginPath(); ctx.moveTo(hx, hipY+30); ctx.lineTo(kneeX, kneeY); ctx.stroke();
  // shin
  ctx.lineWidth=13; ctx.strokeStyle=skin;
  ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, ankleY); ctx.stroke();
  // muscle highlight
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(hx,hipY+34); ctx.lineTo(kneeX-2,kneeY-6); ctx.stroke();
  // foot
  ctx.fillStyle=skinDark;
  ctx.beginPath(); ctx.ellipse(footX+4, ankleY+4, 12, 6, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawKickLeg(ctx, hx, hipY, height, skin, skinDark, shorts, trim){
  ctx.save();
  ctx.strokeStyle=skin; ctx.lineCap='round';
  const ang = -height*0.012;            // raise toward horizontal
  const kneeX = hx + 30 + height*0.2;
  const kneeY = hipY + 30 - height*0.4;
  const footX = kneeX + 36 + height*0.2;
  const footY = kneeY - height*0.3;
  ctx.lineWidth=18; ctx.strokeStyle=shade(skin,-10);
  ctx.beginPath(); ctx.moveTo(hx, hipY+28); ctx.lineTo(kneeX, kneeY); ctx.stroke();
  ctx.lineWidth=13; ctx.strokeStyle=skin;
  ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
  // shin pad highlight
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(kneeX,kneeY); ctx.lineTo(footX-4,footY+2); ctx.stroke();
  // foot
  ctx.fillStyle=skinDark;
  ctx.beginPath(); ctx.ellipse(footX, footY, 11, 6, 0.4, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawGroundFighter(ctx, f, frame, c){
  // simplified horizontal body for ground game
  ctx.save();
  const top = (f.state===STATE.GROUND_TOP);
  const yOff = top ? -70 : -40;
  ctx.translate(0, yOff);
  // torso lying / hunched
  ctx.fillStyle=c.skin;
  ctx.save();
  ctx.rotate(top ? -0.15 : 0.1);
  roundRectPath(ctx, -50, -30, 100, 50, 16); ctx.fill();
  ctx.restore();
  // shorts
  ctx.fillStyle=c.shorts;
  roundRectPath(ctx, -54, 0, 50, 30, 8); ctx.fill();
  ctx.fillStyle=c.trim; ctx.fillRect(-54,26,50,4);
  // legs
  ctx.strokeStyle=c.skin; ctx.lineWidth=14; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-40,18); ctx.lineTo(-78,30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-40,22); ctx.lineTo(-72,46); ctx.stroke();
  // head
  ctx.fillStyle=c.skinLight;
  ctx.beginPath(); ctx.arc(40,-20,16,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#15100c';
  ctx.beginPath(); ctx.arc(44,-26,14,Math.PI,Math.PI*2); ctx.fill();
  // arm (GnP punching motion if top + attacking)
  let punch = 0;
  if(top && f.currentMove && f.attackTimer>0){
    punch = Math.sin((f.currentMove.dur-f.attackTimer)/f.currentMove.dur*Math.PI)*30;
  }
  ctx.strokeStyle=c.skinDark; ctx.lineWidth=12;
  ctx.beginPath(); ctx.moveTo(20,-20); ctx.lineTo(46, -28 + (top?-punch:0)); ctx.stroke();
  drawGlove(ctx, 50, -30+(top?-punch:0), c.trim);
  // getup progress ring
  if(f.state===STATE.GETUP){
    ctx.strokeStyle='#ffd34d'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(0,-50,26,-Math.PI/2, -Math.PI/2 + (f.getupHold/60)*Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawDamageOverlay(ctx,f,face){
  // cuts drawn in screen space (un-flipped) around head area
  ctx.save();
  for(const cut of f.cuts){
    ctx.fillStyle='rgba(150,20,20,0.85)';
    ctx.beginPath();
    ctx.ellipse(cut.ox*face, cut.oy, cut.size, cut.size*0.5, 0.5, 0, Math.PI*2);
    ctx.fill();
    // drip
    ctx.fillRect(cut.ox*face, cut.oy, 1.5, cut.size*2);
  }
  // hit flash white tint
  if(f.hitFlash>0){
    ctx.globalAlpha = f.hitFlash/14;
    ctx.fillStyle='rgba(255,80,80,0.5)';
    ctx.beginPath(); ctx.ellipse(0,-100,40,90,0,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* =====================================================================
   HELPERS
   ===================================================================== */
function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function shade(hex, amt){
  // hex like #rrggbb
  let h = hex.replace('#','');
  if(h.length===3) h = h.split('').map(c=>c+c).join('');
  let r=parseInt(h.substr(0,2),16),
      g=parseInt(h.substr(2,2),16),
      b=parseInt(h.substr(4,2),16);
  r=Math.max(0,Math.min(255,r+amt));
  g=Math.max(0,Math.min(255,g+amt));
  b=Math.max(0,Math.min(255,b+amt));
  return `rgb(${r|0},${g|0},${b|0})`;
}

/* =====================================================================
   BOOT
   ===================================================================== */
window.addEventListener('DOMContentLoaded', ()=>{
  window.GAME = new Game();
});
