// ChallengeSpawnDirector
// Deterministic, level-driven spawn director for Campaign/Challenge runs.
// Supports timed events, wave scripts, coin routes, side attacks, warnings,
// panic surges and simple boss hooks. Uses seeded RNG (window.campaignRandom)
// for small variation while keeping main layout deterministic.
(function(){
  'use strict';
  if (typeof window === 'undefined') return;

  const Director = {};
  let _lvl = null;
  let _events = [];
  let _idx = 0;
  let _elapsed = 0;
  let _subs = []; // scheduled sub-actions {t:absTime, fn}
  let _rng = null;

  function seeded() { return (_rng && typeof _rng === 'function') ? _rng() : Math.random(); }

  // Safe wrappers for globals used by spawn code
  function lanes() { try { return (typeof getLaneCenters === 'function') ? getLaneCenters() : []; } catch(_) { return []; } }
  function numLanes() { return (typeof NUM_LANES === 'number') ? NUM_LANES : lanes().length; }
  function laneX(i) { const L = lanes(); return L[Math.max(0, Math.min(L.length-1, i))] || 0; }
  function phaseMaxObstacles() { try { return getPhaseMaxObstacles(); } catch(_) { return 64; } }

  // Build a tick function that campaign.js can assign to window._campaignPatternTick
  Director.loadLevel = function(lvl, opts) {
    try {
      _lvl = lvl || null;
      _events = [];
      _idx = 0; _elapsed = 0; _subs = [];
      const seed = (opts && opts.seed) ? opts.seed : ((lvl && lvl.id) ? (lvl.id * 1009 + 7) : Date.now());
      try { _rng = seededRng(seed); } catch (_) { _rng = null; }

      // Accept either explicit `spawnScript` or simple fallback generator
      if (Array.isArray(lvl && lvl.spawnScript) && lvl.spawnScript.length > 0) {
        _events = lvl.spawnScript.map(e => Object.assign({}, e));
      } else {
        _events = _defaultScriptForLevel(lvl);
      }
      _events.sort((a,b) => (a.time || 0) - (b.time || 0));
    } catch (e) { console.error('[SpawnDirector] loadLevel error', e); }

    return function(dt) { Director._tick(dt); };
  };

  Director.stop = function() {
    _lvl = null; _events = []; _idx = 0; _elapsed = 0; _subs = []; _rng = null;
  };

  Director._tick = function(dt) {
    if (!_lvl) return;
    _elapsed += dt;
    // main events
    while (_idx < _events.length && (_events[_idx].time || 0) <= _elapsed) {
      const ev = _events[_idx++];
      try { _handleEvent(ev); } catch (e) { console.error('[SpawnDirector] event handler', e); }
    }
    // subs
    for (let i = _subs.length - 1; i >= 0; i--) {
      if (_subs[i].t <= _elapsed) {
        try { _subs[i].fn(); } catch (e) { console.error('[SpawnDirector] sub action', e); }
        _subs.splice(i,1);
      }
    }
  };

  function _schedule(delay, fn) { _subs.push({ t: _elapsed + delay, fn }); }

  function _handleEvent(ev) {
    if (!ev || !ev.type) return;
    const type = ev.type;
    switch (type) {
      case 'warning': _ev_warning(ev); break;
      case 'fallingWave': _ev_fallingWave(ev); break;
      case 'coinTrail': _ev_coinTrail(ev); break;
      case 'pressureWave': _ev_pressureWave(ev); break;
      case 'sideAttack': _ev_sideAttack(ev); break;
      case 'panicWave': _ev_panicWave(ev); break;
      case 'bossAttack': _ev_bossAttack(ev); break;
      case 'safeGap': _ev_safeGap(ev); break;
      default:
        // custom handler if provided
        if (typeof ev.handler === 'function') try { ev.handler(ev); } catch(_) {}
        break;
    }
  }

  function _ev_warning(ev) {
    try {
      // support specifying lanes (array) or automatic lane near player
      const dur = (ev.duration != null) ? ev.duration : 2.8;
      let lanesIdx = [];
      if (Array.isArray(ev.lanes) && ev.lanes.length) lanesIdx = ev.lanes.slice();
      else {
        // choose 1-2 lanes away from player deterministically
        try {
          const pLane = (typeof getPlayerLane === 'function') ? getPlayerLane() : Math.floor(numLanes()/2);
          const r = Math.floor(seeded() * 2) || 0;
          lanesIdx = [ Math.max(0, Math.min(numLanes()-1, pLane + (r===0?1:-1))) ];
        } catch(_) { lanesIdx = [0]; }
      }
      window._campaignWarningLanes = window._campaignWarningLanes || [];
      for (const li of lanesIdx) {
        window._campaignWarningLanes.push({ lane: li, t: dur });
      }
    } catch (e) { console.error('[SpawnDirector] warning', e); }
  }

  function _ev_fallingWave(ev) {
    try {
      // pattern controls how many gaps and overall density
      const pattern = ev.pattern || 'default';
      const duration = ev.duration || 0.6;
      const gapCount = (pattern === 'wideGaps') ? 2 : (pattern === 'tight' ? 0 : 1);
      const laneCount = numLanes();
      // choose gap lanes deterministically (avoid player's lane)
      const pLane = (typeof getPlayerLane === 'function') ? getPlayerLane() : Math.floor(laneCount/2);
      const gaps = [];
      for (let g=0; g<gapCount; g++) {
        let off = Math.floor(seeded() * (laneCount-1)) + (g%2===0? -1:1);
        let gap = Math.max(0, Math.min(laneCount-1, pLane + off));
        if (gaps.indexOf(gap) === -1) gaps.push(gap);
      }
      // spawn obstacles in all lanes except gaps
      const blocked = [];
      for (let li=0; li<laneCount; li++) if (gaps.indexOf(li) === -1) blocked.push(li);
      // schedule a small burst across the duration
      const burst = Math.max(1, Math.round(duration / 0.18));
      for (let b=0; b<burst; b++) {
        _schedule(b * (duration / Math.max(1, burst)), () => {
          for (let i=0;i<blocked.length;i++) {
            _createObstacleAtLane(blocked[i], { staggerIndex: i, burstIndex: b });
          }
        });
      }
    } catch (e) { console.error('[SpawnDirector] fallingWave', e); }
  }

  function _ev_coinTrail(ev) {
    try {
      // pattern: leftToRightArc | straight
      const pattern = ev.pattern || 'straight';
      const count = ev.count || 4;
      const startLane = (ev.lane != null) ? ev.lane : Math.max(0, Math.floor(seeded() * numLanes()));
      const dir = (ev.dir === 'ltr') ? 1 : ((ev.dir === 'rtl') ? -1 : (seeded() < 0.5 ? 1 : -1));
      for (let i=0;i<count;i++) {
        _schedule(i * 0.12, () => _createCoinAtLane(startLane + (i * dir), { idx: i, pattern, orb: !!ev.orb, count }));
      }
    } catch (e) { console.error('[SpawnDirector] coinTrail', e); }
  }

  function _ev_pressureWave(ev) {
    try {
      const dur = (ev.duration != null) ? ev.duration : 4.5;
      const cadence = 0.28;
      const steps = Math.max(1, Math.round(dur / cadence));
      for (let s=0;s<steps;s++) {
        _schedule(s * cadence, () => {
          // spawn focused waves near player-adjacent lanes
          const pLane = (typeof getPlayerLane === 'function') ? getPlayerLane() : Math.floor(numLanes()/2);
          const lanesToSpawn = [pLane, Math.max(0,pLane-1), Math.min(numLanes()-1,pLane+1)];
          for (const li of lanesToSpawn) _createObstacleAtLane(li, { pressure:true });
        });
      }
      // optional HUD message
      if (ev.text) {
        _schedule(0, () => { try { const dtEl = document.getElementById('cmp-hud-dt'); if (dtEl) { dtEl.textContent = ev.text; dtEl.hidden = false; dtEl.classList.remove('cmp-dt-pop'); void dtEl.offsetWidth; dtEl.classList.add('cmp-dt-pop'); setTimeout(()=>{ try{ dtEl.hidden=true }catch(_){} }, 2600); } } catch(_){} });
      }
    } catch (e) { console.error('[SpawnDirector] pressureWave', e); }
  }

  function _ev_sideAttack(ev) {
    try {
      const side = (ev.side === 'right') ? 'right' : 'left';
      const count = Math.max(1, ev.count || Math.min(6, numLanes()));
      const lanesArr = [];
      for (let i=0;i<count;i++) lanesArr.push(side === 'left' ? i % numLanes() : (numLanes()-1 - (i % numLanes())));
      for (let j=0;j<lanesArr.length;j++) _schedule(j * 0.08, () => _createObstacleAtLane(lanesArr[j], { side, idx:j }));
    } catch (e) { console.error('[SpawnDirector] sideAttack', e); }
  }

  function _ev_panicWave(ev) {
    try {
      const dur = (ev.duration != null) ? ev.duration : 6.0;
      const density = (ev.intensity != null) ? ev.intensity : 0.22; // smaller = denser
      const announce = (ev.announce != null) ? ev.announce : 3.0;
      const label = ev.text || ev.label || 'PANIC WAVE';

      // Trigger campaign-level visual/audio/difficulty panic event if available
      try {
        if (typeof window !== 'undefined' && typeof window.triggerPanicWave === 'function') {
          window.triggerPanicWave({ announce: announce, duration: dur, label: label, text: label, speedMult: ev.speedMult, forbiddenInterval: ev.forbiddenInterval, spawnInterval: ev.spawnInterval, force: !!ev.force });
        }
      } catch(_){}

      // Optional HUD message (matches pressureWave behavior)
      if (ev.text) {
        _schedule(0, () => { try { const dtEl = document.getElementById('cmp-hud-dt'); if (dtEl) { dtEl.textContent = ev.text; dtEl.hidden = false; dtEl.classList.remove('cmp-dt-pop'); void dtEl.offsetWidth; dtEl.classList.add('cmp-dt-pop'); setTimeout(()=>{ try{ dtEl.hidden=true }catch(_){} }, Math.max(2600, announce*1000 + 200)); } } catch(_){} });
      }

      const steps = Math.max(8, Math.round(dur / Math.max(0.06, density)));
      for (let s=0;s<steps;s++) _schedule(s * (dur/steps), () => {
        // spawn multiple quick obstacles across lanes
        const pick = Math.max(2, Math.min(numLanes(), 1 + Math.floor(seeded() * (numLanes()))));
        for (let i=0;i<pick;i++) _createObstacleAtLane(Math.floor(seeded() * numLanes()), { panic:true });
      });
    } catch (e) { console.error('[SpawnDirector] panicWave', e); }
  }

  function _ev_bossAttack(ev) {
    try {
      // Boss-specific attack: optional hooks into BossManager when available
      if (typeof BossManager !== 'undefined' && typeof BossManager.triggerAttack === 'function') {
        try { BossManager.triggerAttack(ev); } catch(_) {}
      } else {
        // fallback: spawn a half-row of heavy hazards
        const laneCount = numLanes();
        const half = Math.max(1, Math.floor(laneCount/2));
        for (let i=0;i<half;i++) _schedule(i * 0.12, () => _createObstacleAtLane(i, { type:2 }));
      }
    } catch (e) { console.error('[SpawnDirector] bossAttack', e); }
  }

  function _ev_safeGap(ev) {
    try {
      // Mark safe zone(s) where obstacles should not spawn for the next t seconds
      const t = (ev.duration != null) ? ev.duration : 3.0;
      const cx = (ev.x != null) ? ev.x : (typeof player !== 'undefined' ? player.x : (canvas ? canvas.width/2 : 0));
      const r = (ev.radius != null) ? ev.radius : 60;
      window._campaignSafeZones = window._campaignSafeZones || [];
      window._campaignSafeZones.push({ x: cx, y: (canvas?canvas.height*0.6:240), r: r, t: t });
    } catch (_) {}
  }

  // Low-level creators
  function _createObstacleAtLane(laneIdx, opts) {
    try {
      if (typeof obstacles === 'undefined') return;
      if (obstacles.length >= phaseMaxObstacles()) return;
      const L = lanes(); if (!L || L.length === 0) return;
      const cx = laneX(laneIdx);
      // base size strategy using seeded jitter
      const typeRoll = seeded();
      let type = (opts && opts.type != null) ? opts.type : (typeRoll < 0.06 ? 2 : (typeRoll < 0.38 ? 3 : (typeRoll < 0.78 ? 0 : 4)));
      if (type === 2 && obstacles.filter(o => o.type === 2).length >= 2) type = 0;
      let w, h;
      switch (type) {
        case 2: w = 52 + Math.floor(seeded() * 18); h = 36 + Math.floor(seeded() * 14); break;
        case 3: w = 12 + Math.floor(seeded() * 10); h = 48 + Math.floor(seeded() * 28); break;
        case 4: w = 10 + Math.floor(seeded() * 8); h = 10 + Math.floor(seeded() * 8); break;
        default: w = 22 + Math.floor(seeded() * 18); h = w; break;
      }
      const base = GAME_CONFIG.baseSpeed * (typeof speedMultiplier === 'number' ? speedMultiplier : 1.0) * panicSpeedMult();
      const speedMult = (DIFFICULTY_CONFIG.typeSpeedMults && DIFFICULTY_CONFIG.typeSpeedMults[type]) || 1.0;
      const speedRand = (DIFFICULTY_CONFIG.typeSpeedRand && DIFFICULTY_CONFIG.typeSpeedRand[type]) || 20;
      const vy = base * speedMult + Math.floor(seeded() * speedRand);
      const originX = Math.max(0, Math.min((canvas?canvas.width:800) - w, cx));
      const cy0 = -40 - (opts && opts.staggerIndex ? (opts.staggerIndex * 8) : 0);
      const colorIndex = (typeof pickObstacleColorIndex === 'function') ? pickObstacleColorIndex() : Math.floor(seeded() * GAME_COLORS.length);
      obstacles.push({
        x: originX - w/2,
        originX: originX,
        y: cy0,
        cy: cy0,
        w: w,
        h: h,
        baseW: w,
        baseH: h,
        baseVy: vy,
        vy: (typeof activePowerupKey !== 'undefined' && activePowerupKey === 'SLOW') ? vy * 0.4 : vy,
        colorIndex: colorIndex,
        swayAmp: 0,
        swayFreq: 0.6 + seeded() * 0.6,
        swayPhase: seeded() * Math.PI * 2,
        pulseAmp: 0,
        pulseFreq: 2,
        pulsePhase: seeded() * Math.PI * 2,
        trickType: null,
        nearMissIdx: -1,
      });
    } catch (e) { console.error('[SpawnDirector] createObstacleAtLane', e); }
  }

  function _createCoinAtLane(laneIdx, opts) {
    try {
      window.coinItems = window.coinItems || [];
      const L = lanes(); if (!L || L.length === 0) return;
      const cx = laneX(Math.max(0, Math.min(numLanes()-1, laneIdx)));
      const sz = 22;
      const spacing = 64;
      const count = (opts && opts.count) ? opts.count : 1;
      const speed = 100 + Math.floor(seeded() * 22);
      const colId = Date.now() + Math.floor(seeded() * 1000);
      for (let i=0;i<count;i++) {
        coinItems.push({ x: cx + (seeded()-0.5)*6, y: -sz - 10 - i*spacing, size: sz, vy: speed, vx: 0, value: 1, colId, orb: !!(opts && opts.orb) });
      }
    } catch (e) { console.error('[SpawnDirector] createCoinAtLane', e); }
  }

  function _defaultScriptForLevel(lvl) {
    // Small deterministic fallback so levels without scripts still behave intentionally
    const id = lvl && lvl.id ? lvl.id : 0;
    const base = [];
    if (id === 1) {
      base.push({ time: 0.5, type: 'fallingWave', pattern: 'wideGaps' });
      base.push({ time: 6.5, type: 'fallingWave', pattern: 'default' });
    } else if (id === 2) {
      base.push({ time: 0.6, type: 'coinTrail', pattern: 'straight', lane: 2, count:4 });
      base.push({ time: 8, type: 'fallingWave', pattern: 'tight' });
    } else {
      base.push({ time: 0.8, type: 'fallingWave' });
      base.push({ time: 12.0, type: 'pressureWave', duration: 4 });
    }
    return base;
  }

  // Expose
  window.ChallengeSpawnDirector = Director;
})();
