// ============================================================
// SHIFTPANIC - CAMPAIGN MODE v1
// Clean, scalable campaign system. No regressions to Endless Mode.
// ============================================================
'use strict';

// ============================================================
// SECTION 1: LEVEL CONFIG
// All 10 levels defined here. Add more by pushing to this array.
// ============================================================
const CAMPAIGN_LEVELS = [
  {
    id: 1,
    name: 'First Shift',
    subtitle: 'Learn to survive the panic.',
    difficulty: 'Easy',
    difficultyColor: '#22c55e',
    objectiveType: 'survive_seconds',
    objectiveTarget: 20,
    timeLimit: null,
    rewardCoins: 50,
    replayReward: 5,
    starConditions: [
      { stars: 3, label: 'No hits', check: (data) => data.hitsReceived === 0 },
      { stars: 2, label: 'At most 1 hit', check: (data) => data.hitsReceived <= 1 },
      { stars: 1, label: 'Complete level', check: (data) => true },
    ],
    settings: {
      speedMult: 0.70,
      spawnInterval: 0.75,
      forbiddenInterval: 4.5,
      coinsEnabled: false,
      coinItemInterval: null,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 0.85, minSpawnInterval: 0.65, minForbiddenInterval: 3.8 },
      doubleTroubleAt: [],
      shrinkingArena: false,
      bossMode: false,
    },
  },
  {
    id: 2,
    name: 'Coin Collector',
    subtitle: 'Collect coins before time runs out.',
    difficulty: 'Easy',
    difficultyColor: '#22c55e',
    objectiveType: 'collect_coins',
    objectiveTarget: 15,
    timeLimit: 35,
    rewardCoins: 75,
    replayReward: 8,
    starConditions: [
      { stars: 3, label: '12+ seconds left', check: (data) => data.timeRemaining >= 12 },
      { stars: 2, label: '5+ seconds left',  check: (data) => data.timeRemaining >= 5 },
      { stars: 1, label: 'Complete level',   check: (data) => true },
    ],
    settings: {
      speedMult: 0.75,
      spawnInterval: 0.65,
      forbiddenInterval: 4.0,
      coinsEnabled: true,
      coinItemInterval: 3.5,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 0.90, minSpawnInterval: 0.55, minForbiddenInterval: 3.5 },
      doubleTroubleAt: [],
      shrinkingArena: false,
      bossMode: false,
    },
  },
  {
    id: 3,
    name: 'Dodge School',
    subtitle: 'Dodge blocks and prove your reflexes.',
    difficulty: 'Medium',
    difficultyColor: '#f59e0b',
    objectiveType: 'dodge_blocks',
    objectiveTarget: 35,
    timeLimit: null,
    rewardCoins: 90,
    replayReward: 9,
    starConditions: [
      { stars: 3, label: 'No hits',        check: (data) => data.hitsReceived === 0 },
      { stars: 2, label: 'At most 1 hit',  check: (data) => data.hitsReceived <= 1 },
      { stars: 1, label: 'Complete level', check: (data) => true },
    ],
    settings: {
      speedMult: 0.85,
      spawnInterval: 0.55,
      forbiddenInterval: 3.5,
      coinsEnabled: false,
      coinItemInterval: null,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 1.0, minSpawnInterval: 0.45, minForbiddenInterval: 3.0 },
      doubleTroubleAt: [],
      shrinkingArena: false,
      bossMode: false,
    },
  },
  {
    id: 4,
    name: 'Fast Switch',
    subtitle: 'Colors change fast - stay sharp.',
    difficulty: 'Medium',
    difficultyColor: '#f59e0b',
    objectiveType: 'survive_seconds',
    objectiveTarget: 35,
    timeLimit: null,
    rewardCoins: 100,
    replayReward: 10,
    starConditions: [
      { stars: 3, label: 'No hits',        check: (data) => data.hitsReceived === 0 },
      { stars: 2, label: 'At most 1 hit',  check: (data) => data.hitsReceived <= 1 },
      { stars: 1, label: 'Complete level', check: (data) => true },
    ],
    settings: {
      speedMult: 0.90,
      spawnInterval: 0.50,
      forbiddenInterval: 2.5,
      coinsEnabled: false,
      coinItemInterval: null,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 1.05, minSpawnInterval: 0.42, minForbiddenInterval: 2.0 },
      doubleTroubleAt: [],
      shrinkingArena: false,
      bossMode: false,
    },
  },
  {
    id: 5,
    name: 'Tight Gaps',
    subtitle: 'Navigate narrow paths without breaking.',
    difficulty: 'Medium',
    difficultyColor: '#f59e0b',
    objectiveType: 'survive_seconds',
    objectiveTarget: 45,
    timeLimit: null,
    rewardCoins: 125,
    replayReward: 13,
    starConditions: [
      { stars: 3, label: 'No hits',        check: (data) => data.hitsReceived === 0 },
      { stars: 2, label: 'At most 1 hit',  check: (data) => data.hitsReceived <= 1 },
      { stars: 1, label: 'Complete level', check: (data) => true },
    ],
    settings: {
      speedMult: 0.90,
      spawnInterval: 0.44,
      forbiddenInterval: 3.0,
      coinsEnabled: false,
      coinItemInterval: null,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 1.05, minSpawnInterval: 0.38, minForbiddenInterval: 2.5 },
      doubleTroubleAt: [],
      shrinkingArena: false,
      bossMode: false,
    },
  },
  {
    id: 6,
    name: 'Coin Panic',
    subtitle: 'Grab coins while danger closes in.',
    difficulty: 'Hard',
    difficultyColor: '#ef4444',
    objectiveType: 'collect_coins',
    objectiveTarget: 25,
    timeLimit: 50,
    rewardCoins: 150,
    replayReward: 15,
    starConditions: [
      { stars: 3, label: '15+ seconds left', check: (data) => data.timeRemaining >= 15 },
      { stars: 2, label: '6+ seconds left',  check: (data) => data.timeRemaining >= 6 },
      { stars: 1, label: 'Complete level',   check: (data) => true },
    ],
    settings: {
      speedMult: 0.95,
      spawnInterval: 0.40,
      forbiddenInterval: 2.5,
      coinsEnabled: true,
      coinItemInterval: 3.0,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 1.10, minSpawnInterval: 0.35, minForbiddenInterval: 2.0 },
      doubleTroubleAt: [],
      shrinkingArena: false,
      bossMode: false,
    },
  },
  {
    id: 7,
    name: 'Double Trouble',
    subtitle: 'Survive waves of chaos every 15 seconds.',
    difficulty: 'Hard',
    difficultyColor: '#ef4444',
    objectiveType: 'survive_seconds',
    objectiveTarget: 60,
    timeLimit: null,
    rewardCoins: 175,
    replayReward: 18,
    starConditions: [
      { stars: 3, label: 'No hits',        check: (data) => data.hitsReceived === 0 },
      { stars: 2, label: 'At most 1 hit',  check: (data) => data.hitsReceived <= 1 },
      { stars: 1, label: 'Complete level', check: (data) => true },
    ],
    settings: {
      speedMult: 1.0,
      spawnInterval: 0.42,
      forbiddenInterval: 2.8,
      coinsEnabled: false,
      coinItemInterval: null,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 1.15, minSpawnInterval: 0.35, minForbiddenInterval: 2.3 },
      doubleTroubleAt: [15, 30, 45],
      shrinkingArena: false,
      bossMode: false,
    },
  },
  {
    id: 8,
    name: 'Shrinking Arena',
    subtitle: 'The walls are closing in. Stay alive.',
    difficulty: 'Hard',
    difficultyColor: '#ef4444',
    objectiveType: 'survive_seconds',
    objectiveTarget: 50,
    timeLimit: null,
    rewardCoins: 200,
    replayReward: 20,
    starConditions: [
      { stars: 3, label: 'No hits',        check: (data) => data.hitsReceived === 0 },
      { stars: 2, label: 'At most 1 hit',  check: (data) => data.hitsReceived <= 1 },
      { stars: 1, label: 'Complete level', check: (data) => true },
    ],
    settings: {
      speedMult: 1.0,
      spawnInterval: 0.38,
      forbiddenInterval: 2.8,
      coinsEnabled: false,
      coinItemInterval: null,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 1.10, minSpawnInterval: 0.32, minForbiddenInterval: 2.3 },
      doubleTroubleAt: [],
      shrinkingArena: true,
      bossMode: false,
    },
  },
  {
    id: 9,
    name: 'Final Trial',
    subtitle: 'Three objectives. One chance. No mercy.',
    difficulty: 'Expert',
    difficultyColor: '#a855f7',
    objectiveType: 'hybrid',
    objectiveTarget: { seconds: 75, coins: 20, dodges: 60 },
    timeLimit: null,
    rewardCoins: 250,
    replayReward: 25,
    starConditions: [
      { stars: 3, label: 'No hits',        check: (data) => data.hitsReceived === 0 },
      { stars: 2, label: 'At most 1 hit',  check: (data) => data.hitsReceived <= 1 },
      { stars: 1, label: 'Complete level', check: (data) => true },
    ],
    settings: {
      speedMult: 1.05,
      spawnInterval: 0.35,
      forbiddenInterval: 2.3,
      coinsEnabled: true,
      coinItemInterval: 4.0,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 1.20, minSpawnInterval: 0.28, minForbiddenInterval: 1.8 },
      doubleTroubleAt: [25, 55],
      shrinkingArena: false,
      bossMode: false,
    },
  },
  {
    id: 10,
    name: 'The Panic Boss',
    subtitle: 'Face the Panic Core. Collect orbs to deal damage.',
    difficulty: 'Boss',
    difficultyColor: '#ec4899',
    objectiveType: 'boss_defeat',
    objectiveTarget: 10,
    timeLimit: 120,
    rewardCoins: 500,
    replayReward: 50,
    starConditions: [
      { stars: 3, label: 'Defeated with no hits',   check: (data) => data.hitsReceived === 0 },
      { stars: 2, label: 'Defeated boss',            check: (data) => data.bossDefeated === true },
      { stars: 1, label: 'Defeated boss',            check: (data) => data.bossDefeated === true },
    ],
    settings: {
      speedMult: 0.90,
      spawnInterval: 0.48,
      forbiddenInterval: 3.0,
      coinsEnabled: true,
      coinItemInterval: 4.5,
      powerupsEnabled: false,
      diffCap: { maxSpeedMult: 1.10, minSpawnInterval: 0.38, minForbiddenInterval: 2.5 },
      doubleTroubleAt: [],
      shrinkingArena: false,
      bossMode: true,
    },
  },
];

// ============================================================
// SECTION 2: CAMPAIGN SAVE MANAGER
// Versioned progress stored in localStorage.
// Key: 'shiftPanicCampaign' - separate from all existing save keys.
// ============================================================
const CampaignSave = (() => {
  const LS_KEY  = 'shiftPanicCampaign';
  const VERSION = 1;

  const _default = () => ({
    version: VERSION,
    highestUnlockedLevel: 1,
    completedLevels: {},
    starsByLevel: {},
    bestScoresByLevel: {},
    bestTimesByLevel: {},
    totalStars: 0,
    campaignCoinsEarned: 0,
  });

  let _data = null;

  function load() {
    if (_data) return _data;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { _data = _default(); return _data; }
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) { _data = _default(); return _data; }
      // Merge with defaults for forward compatibility
      _data = Object.assign(_default(), parsed);
      // Recompute totalStars
      _data.totalStars = _countTotalStars(_data.starsByLevel);
    } catch (_) {
      _data = _default();
    }
    return _data;
  }

  function _countTotalStars(starsByLevel) {
    return Object.values(starsByLevel).reduce((s, n) => s + (n || 0), 0);
  }

  function save() {
    if (!_data) return;
    _data.totalStars = _countTotalStars(_data.starsByLevel);
    try { localStorage.setItem(LS_KEY, JSON.stringify(_data)); } catch (_) {}
  }

  function get() { return load(); }

  function isUnlocked(levelId) {
    const d = load();
    return levelId <= d.highestUnlockedLevel;
  }

  function isCompleted(levelId) {
    const d = load();
    return !!(d.completedLevels[levelId]);
  }

  function getStars(levelId) {
    const d = load();
    return d.starsByLevel[levelId] || 0;
  }

  function completeLevelResult(levelId, stars, score, timeMs, coinsEarned, isFirstTime) {
    const d = load();
    d.completedLevels[levelId] = true;
    d.starsByLevel[levelId]    = Math.max(d.starsByLevel[levelId] || 0, stars);
    d.bestScoresByLevel[levelId] = Math.max(d.bestScoresByLevel[levelId] || 0, score);
    if (timeMs > 0) {
      const prevBest = d.bestTimesByLevel[levelId] || Infinity;
      d.bestTimesByLevel[levelId] = Math.min(prevBest, timeMs);
    }
    if (isFirstTime) d.campaignCoinsEarned += coinsEarned;
    // Unlock next level
    const nextLevel = levelId + 1;
    if (nextLevel <= CAMPAIGN_LEVELS.length && nextLevel > d.highestUnlockedLevel) {
      d.highestUnlockedLevel = nextLevel;
    }
    save();
  }

  return { load, save, get, isUnlocked, isCompleted, getStars, completeLevelResult };
})();

// ============================================================
// SECTION 3: OBJECTIVE TRACKER
// Tracks objective progress for the current level during play.
// ============================================================
const ObjectiveTracker = (() => {
  let _level      = null;
  let _startCoins = 0;
  let _startDodge = 0;
  let _elapsed    = 0;
  let _hitsReceived = 0;
  let _shieldAbsorbed = 0;
  let _prevRoundCoins = 0;

  // Hybrid sub-objective progress
  let _hybridSeconds = 0;
  let _hybridCoins   = 0;
  let _hybridDodges  = 0;

  function reset(level) {
    _level          = level;
    _startCoins     = 0;
    _startDodge     = 0;
    _elapsed        = 0;
    _hitsReceived   = 0;
    _shieldAbsorbed = 0;
    _prevRoundCoins = 0;
    _hybridSeconds  = 0;
    _hybridCoins    = 0;
    _hybridDodges   = 0;
  }

  function onCoinCollected() {
    if (!_level) return;
    if (_level.objectiveType === 'hybrid') _hybridCoins++;
  }

  function onBlockDodged() {
    if (!_level) return;
    if (_level.objectiveType === 'hybrid') _hybridDodges++;
  }

  function onHit() { _hitsReceived++; }

  function getProgress(elapsed, roundCoins, dodgeCount) {
    if (!_level) return null;
    const type = _level.objectiveType;
    const target = _level.objectiveTarget;

    if (type === 'survive_seconds') {
      return { current: Math.min(elapsed, target), target, pct: Math.min(1, elapsed / target) };
    }
    if (type === 'collect_coins') {
      return { current: Math.min(roundCoins, target), target, pct: Math.min(1, roundCoins / target) };
    }
    if (type === 'dodge_blocks') {
      return { current: Math.min(dodgeCount, target), target, pct: Math.min(1, dodgeCount / target) };
    }
    if (type === 'boss_defeat') {
      const orbsNeeded = target; // 10 orbs
      return { current: Math.min(roundCoins, orbsNeeded), target: orbsNeeded, pct: Math.min(1, roundCoins / orbsNeeded) };
    }
    if (type === 'hybrid') {
      const s  = _level.objectiveTarget.seconds;
      const c  = _level.objectiveTarget.coins;
      const d  = _level.objectiveTarget.dodges;
      const pc = Math.min(1, elapsed / s);
      const cc = Math.min(1, roundCoins / c);
      const dc = Math.min(1, dodgeCount / d);
      return {
        hybrid: true,
        seconds:  { current: Math.min(elapsed, s),   target: s, done: elapsed >= s },
        coins:    { current: Math.min(roundCoins, c), target: c, done: roundCoins >= c },
        dodges:   { current: Math.min(dodgeCount, d), target: d, done: dodgeCount >= d },
        overall:  (pc + cc + dc) / 3,
      };
    }
    return null;
  }

  function isComplete(elapsed, roundCoins, dodgeCount, bossDefeated) {
    if (!_level) return false;
    const type = _level.objectiveType;
    const target = _level.objectiveTarget;

    if (type === 'survive_seconds') return elapsed >= target;
    if (type === 'collect_coins')   return roundCoins >= target;
    if (type === 'dodge_blocks')    return dodgeCount >= target;
    if (type === 'boss_defeat')     return bossDefeated === true;
    if (type === 'hybrid') {
      return elapsed >= target.seconds && roundCoins >= target.coins && dodgeCount >= target.dodges;
    }
    return false;
  }

  function calcStars(levelDef, data) {
    for (const cond of levelDef.starConditions) {
      if (cond.check(data)) return cond.stars;
    }
    return 1;
  }

  function getHitsReceived() { return _hitsReceived; }

  return { reset, onHit, onCoinCollected, onBlockDodged, getProgress, isComplete, calcStars, getHitsReceived };
})();

// ============================================================
// SECTION 4: BOSS MANAGER
// Handles boss rendering, projectiles, phases, health.
// Uses a canvas overlay (#boss-canvas) drawn above the game.
// ============================================================
const BossManager = (() => {
  let _canvas      = null;
  let _ctx         = null;
  let _gameCanvas  = null;
  let _active      = false;
  let _hp          = 100;
  let _phase       = 1;      // 1, 2, 3
  let _bossX       = 0;
  let _bossY       = 0;
  let _bossRadius  = 42;
  let _bossAngle   = 0;
  let _pulseTimer  = 0;
  let _attackTimer = 0;
  let _attackRate  = 3.5;    // seconds between attacks
  let _projectiles = [];
  let _warnings    = [];
  let _defeated    = false;
  let _defeatTimer = 0;
  let _entryTimer  = 1.5;    // boss flies in from top
  let _shakeTimer  = 0;
  let _onDefeated  = null;
  let _onPlayerHit = null;

  const BOSS_COLORS = {
    phase1: { body: '#7c3aed', glow: '#a855f7', ring: '#c084fc' },
    phase2: { body: '#b91c1c', glow: '#ef4444', ring: '#fca5a5' },
    phase3: { body: '#7c3aed', glow: '#ec4899', ring: '#f9a8d4' },
  };

  function init(gameCanvasEl, onDefeated, onPlayerHit) {
    _gameCanvas  = gameCanvasEl;
    _onDefeated  = onDefeated;
    _onPlayerHit = onPlayerHit;
    _canvas = document.getElementById('boss-canvas');
    if (!_canvas) return;
    _ctx = _canvas.getContext('2d');
    _active      = true;
    _hp          = 100;
    _phase       = 1;
    _bossAngle   = 0;
    _pulseTimer  = 0;
    _attackTimer = _attackRate;
    _projectiles = [];
    _warnings    = [];
    _defeated    = false;
    _defeatTimer = 0;
    _entryTimer  = 1.5;
    _shakeTimer  = 0;
    _attackRate  = 3.5;
    _syncCanvas();
    _canvas.hidden = false;
  }

  function _syncCanvas() {
    if (!_canvas || !_gameCanvas) return;
    _canvas.width  = _gameCanvas.width  || window.innerWidth;
    _canvas.height = _gameCanvas.height || window.innerHeight;
    _canvas.style.width  = _gameCanvas.style.width  || '';
    _canvas.style.height = _gameCanvas.style.height || '';
  }

  function _getPhaseColors() {
    const key = 'phase' + _phase;
    return BOSS_COLORS[key] || BOSS_COLORS.phase1;
  }

  function _getPhaseAttackRate() {
    if (_phase === 1) return 3.2;
    if (_phase === 2) return 2.2;
    return 1.4;
  }

  function _getProjectileSpeed() {
    if (_phase === 1) return 180;
    if (_phase === 2) return 260;
    return 340;
  }

  function _spawnWarning(targetX, targetY, delay, pattern) {
    _warnings.push({ targetX, targetY, delay, maxDelay: delay, pattern });
  }

  function _fireAtTarget(targetX, targetY) {
    const dx = targetX - _bossX;
    const dy = targetY - _bossY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd  = _getProjectileSpeed();
    _projectiles.push({
      x: _bossX, y: _bossY,
      vx: (dx / dist) * spd,
      vy: (dy / dist) * spd,
      radius: 10,
      color: _getPhaseColors().ring,
    });
  }

  function _doAttack(playerX, playerY) {
    if (_phase === 1) {
      // Slow aimed shot toward player with slight offset
      const offset = (Math.random() - 0.5) * 120;
      _spawnWarning(playerX + offset, playerY, 0.8, 'single');
      setTimeout(() => {
        if (!_active || _defeated) return;
        _fireAtTarget(playerX + offset, playerY);
      }, 800);
    } else if (_phase === 2) {
      // Spread shot of 3 bullets
      const angles = [-0.35, 0, 0.35];
      const dx = playerX - _bossX;
      const dy = playerY - _bossY;
      const baseAngle = Math.atan2(dy, dx);
      angles.forEach((offset, i) => {
        const delay = i * 120;
        setTimeout(() => {
          if (!_active || _defeated) return;
          const a = baseAngle + offset;
          const spd = _getProjectileSpeed();
          _projectiles.push({
            x: _bossX, y: _bossY,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            radius: 9,
            color: _getPhaseColors().ring,
          });
        }, delay);
      });
    } else {
      // Phase 3: aimed burst + random shot
      const offset = (Math.random() - 0.5) * 60;
      _spawnWarning(playerX + offset, playerY, 0.5, 'single');
      setTimeout(() => {
        if (!_active || _defeated) return;
        _fireAtTarget(playerX + offset, playerY);
        // Extra random directional shot
        setTimeout(() => {
          if (!_active || _defeated) return;
          const randomAngle = Math.random() * Math.PI * 2;
          const spd = _getProjectileSpeed();
          _projectiles.push({
            x: _bossX, y: _bossY,
            vx: Math.cos(randomAngle) * spd * 0.7,
            vy: Math.sin(randomAngle) * spd * 0.7,
            radius: 8,
            color: _getPhaseColors().glow,
          });
        }, 300);
      }, 500);
    }
  }

  function tick(dt, elapsed, playerX, playerY, playerRadius) {
    if (!_active || !_canvas || !_ctx) return;

    // Sync canvas size to game canvas
    if (_canvas.width !== _gameCanvas.width || _canvas.height !== _gameCanvas.height) {
      _syncCanvas();
    }

    const W = _canvas.width;
    const H = _canvas.height;

    // Boss target position: top-center, slightly in from top
    const targetX = W / 2;
    const targetY = 80 + _bossRadius;

    // Entry animation
    if (_entryTimer > 0) {
      _entryTimer -= dt;
      const t = 1 - Math.max(0, _entryTimer / 1.5);
      const easeT = t * t * (3 - 2 * t); // smoothstep
      _bossX = W / 2;
      _bossY = -_bossRadius + (targetY + _bossRadius) * easeT;
    } else {
      // Gentle side-to-side float
      _bossAngle += dt * 0.8;
      _bossX = targetX + Math.sin(_bossAngle) * 40;
      _bossY = targetY + Math.cos(_bossAngle * 0.5) * 12;
    }

    _pulseTimer += dt;
    _shakeTimer = Math.max(0, _shakeTimer - dt);

    // Update phase based on HP
    const newPhase = _hp > 70 ? 1 : _hp > 35 ? 2 : 3;
    if (newPhase !== _phase) {
      _phase = newPhase;
      _attackRate = _getPhaseAttackRate();
      _shakeTimer = 0.4; // boss shake on phase change
    }

    // Attack logic
    if (_entryTimer <= 0 && !_defeated) {
      _attackTimer -= dt;
      if (_attackTimer <= 0) {
        _attackTimer = _attackRate + (Math.random() - 0.5) * 0.6;
        _doAttack(playerX, playerY);
      }
    }

    // Update warnings
    for (let i = _warnings.length - 1; i >= 0; i--) {
      _warnings[i].delay -= dt;
      if (_warnings[i].delay <= 0) _warnings.splice(i, 1);
    }

    // Update projectiles
    for (let i = _projectiles.length - 1; i >= 0; i--) {
      const p = _projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Check bounds
      if (p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) {
        _projectiles.splice(i, 1);
        continue;
      }
      // Check collision with player
      if (!_defeated) {
        const dx = p.x - playerX;
        const dy = p.y - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < playerRadius + p.radius - 4) {
          _projectiles.splice(i, 1);
          if (typeof _onPlayerHit === 'function') _onPlayerHit();
          continue;
        }
      }
    }

    // Handle defeat animation
    if (_defeated) {
      _defeatTimer += dt;
      if (_defeatTimer > 2.0 && typeof _onDefeated === 'function') {
        const cb = _onDefeated;
        _onDefeated = null;
        cb();
      }
    }

    // Draw
    _draw();
  }

  function _draw() {
    if (!_ctx || !_canvas) return;
    const W = _canvas.width;
    const H = _canvas.height;

    _ctx.clearRect(0, 0, W, H);

    if (_defeated) {
      _drawDefeatExplosion();
      return;
    }

    const colors = _getPhaseColors();
    const pulse  = 0.5 + 0.5 * Math.sin(_pulseTimer * 4.0);
    const shakeX = _shakeTimer > 0 ? (Math.random() - 0.5) * 8 : 0;
    const shakeY = _shakeTimer > 0 ? (Math.random() - 0.5) * 8 : 0;
    const bx     = _bossX + shakeX;
    const by     = _bossY + shakeY;

    // Warning lines
    _warnings.forEach(w => {
      const alpha = (1 - w.delay / w.maxDelay) * 0.6;
      _ctx.save();
      _ctx.globalAlpha = alpha;
      _ctx.strokeStyle = '#ef4444';
      _ctx.lineWidth   = 2;
      _ctx.setLineDash([6, 6]);
      _ctx.beginPath();
      _ctx.moveTo(bx, by);
      _ctx.lineTo(w.targetX, w.targetY);
      _ctx.stroke();
      _ctx.setLineDash([]);
      // Target circle
      _ctx.strokeStyle = '#ef4444';
      _ctx.lineWidth = 2;
      _ctx.beginPath();
      _ctx.arc(w.targetX, w.targetY, 18, 0, Math.PI * 2);
      _ctx.stroke();
      _ctx.restore();
    });

    // Boss glow outer ring
    const grad = _ctx.createRadialGradient(bx, by, _bossRadius * 0.5, bx, by, _bossRadius * 2.2);
    grad.addColorStop(0, colors.glow + '66');
    grad.addColorStop(0.5, colors.body + '33');
    grad.addColorStop(1, 'transparent');
    _ctx.beginPath();
    _ctx.arc(bx, by, _bossRadius * 2.2, 0, Math.PI * 2);
    _ctx.fillStyle = grad;
    _ctx.fill();

    // Rotating outer ring
    _ctx.save();
    _ctx.translate(bx, by);
    _ctx.rotate(_bossAngle * 1.5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ox = Math.cos(a) * (_bossRadius + 18);
      const oy = Math.sin(a) * (_bossRadius + 18);
      _ctx.beginPath();
      _ctx.arc(ox, oy, 5, 0, Math.PI * 2);
      _ctx.fillStyle = colors.ring + 'cc';
      _ctx.fill();
    }
    _ctx.restore();

    // Boss body
    _ctx.save();
    _ctx.shadowColor = colors.glow;
    _ctx.shadowBlur  = 24 + pulse * 16;
    // Core square rotated 45deg (diamond shape)
    _ctx.translate(bx, by);
    _ctx.rotate(_bossAngle * 0.4 + Math.PI / 4);
    const r = _bossRadius;
    const bodyGrad = _ctx.createLinearGradient(-r, -r, r, r);
    bodyGrad.addColorStop(0, colors.ring);
    bodyGrad.addColorStop(0.5, colors.body);
    bodyGrad.addColorStop(1, '#1a0030');
    _ctx.beginPath();
    _ctx.moveTo(0, -r);
    _ctx.lineTo(r, 0);
    _ctx.lineTo(0, r);
    _ctx.lineTo(-r, 0);
    _ctx.closePath();
    _ctx.fillStyle = bodyGrad;
    _ctx.fill();
    _ctx.strokeStyle = colors.ring;
    _ctx.lineWidth = 3;
    _ctx.stroke();
    _ctx.restore();

    // Inner core glow
    _ctx.save();
    _ctx.beginPath();
    _ctx.arc(bx, by, _bossRadius * 0.55, 0, Math.PI * 2);
    const innerGrad = _ctx.createRadialGradient(bx, by, 0, bx, by, _bossRadius * 0.55);
    innerGrad.addColorStop(0, '#ffffff' + Math.round((0.6 + pulse * 0.4) * 255).toString(16).padStart(2, '0'));
    innerGrad.addColorStop(1, colors.glow + '00');
    _ctx.fillStyle = innerGrad;
    _ctx.fill();
    _ctx.restore();

    // Phase 3 angry particles
    if (_phase === 3) {
      for (let i = 0; i < 3; i++) {
        const a = (_pulseTimer * 3.0 + i * 2.1) % (Math.PI * 2);
        const dist = _bossRadius * (1.2 + Math.sin(_pulseTimer * 5 + i) * 0.4);
        const px = bx + Math.cos(a) * dist;
        const py = by + Math.sin(a) * dist;
        _ctx.beginPath();
        _ctx.arc(px, py, 4 + pulse * 4, 0, Math.PI * 2);
        _ctx.fillStyle = colors.ring + 'cc';
        _ctx.fill();
      }
    }

    // HP bar at top of screen
    _drawBossHPBar(colors);

    // Projectiles
    _projectiles.forEach(p => {
      _ctx.save();
      _ctx.shadowColor = p.color;
      _ctx.shadowBlur  = 12;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      const pg = _ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.5, p.color);
      pg.addColorStop(1, p.color + '00');
      _ctx.fillStyle = pg;
      _ctx.fill();
      _ctx.restore();
    });
  }

  function _drawBossHPBar(colors) {
    const W   = _canvas.width;
    const bw  = Math.min(W * 0.65, 400);
    const bh  = 14;
    const bx  = (W - bw) / 2;
    const by  = 16;
    const pct = Math.max(0, _hp / 100);

    // Background
    _ctx.fillStyle = '#1a0030cc';
    _ctx.beginPath();
    const br = 7;
    _ctx.roundRect ? _ctx.roundRect(bx - 6, by - 6, bw + 12, bh + 28, 10) : _ctx.rect(bx - 6, by - 6, bw + 12, bh + 28);
    _ctx.fill();

    // Track
    _ctx.fillStyle = '#33003388';
    _ctx.beginPath();
    _ctx.roundRect ? _ctx.roundRect(bx, by + 16, bw, bh, br) : _ctx.rect(bx, by + 16, bw, bh);
    _ctx.fill();

    // Fill
    if (pct > 0) {
      const hpGrad = _ctx.createLinearGradient(bx, 0, bx + bw, 0);
      if (pct > 0.7) { hpGrad.addColorStop(0, '#7c3aed'); hpGrad.addColorStop(1, '#a855f7'); }
      else if (pct > 0.35) { hpGrad.addColorStop(0, '#b91c1c'); hpGrad.addColorStop(1, '#ef4444'); }
      else { hpGrad.addColorStop(0, '#7c3aed'); hpGrad.addColorStop(1, '#ec4899'); }
      _ctx.fillStyle = hpGrad;
      _ctx.beginPath();
      _ctx.roundRect ? _ctx.roundRect(bx, by + 16, bw * pct, bh, br) : _ctx.rect(bx, by + 16, bw * pct, bh);
      _ctx.fill();
    }

    // Label
    _ctx.fillStyle = '#f8fafc';
    _ctx.font = 'bold 11px Inter, sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('PANIC CORE - HP: ' + _hp + ' / 100', W / 2, by + 12);
    _ctx.textAlign = 'left';
  }

  function _drawDefeatExplosion() {
    const t = Math.min(_defeatTimer / 1.2, 1);
    const W = _canvas.width;
    const H = _canvas.height;

    // Expanding bright ring
    const ringR = _bossRadius + t * 200;
    _ctx.save();
    _ctx.globalAlpha = 1 - t;
    _ctx.shadowColor = '#ec4899';
    _ctx.shadowBlur  = 40;
    _ctx.strokeStyle = '#ec4899';
    _ctx.lineWidth   = 8 * (1 - t) + 2;
    _ctx.beginPath();
    _ctx.arc(_bossX, _bossY, ringR, 0, Math.PI * 2);
    _ctx.stroke();
    _ctx.restore();

    // Second ring
    _ctx.save();
    _ctx.globalAlpha = (1 - t) * 0.6;
    _ctx.strokeStyle = '#ffffff';
    _ctx.lineWidth   = 3;
    _ctx.beginPath();
    _ctx.arc(_bossX, _bossY, ringR * 0.6, 0, Math.PI * 2);
    _ctx.stroke();
    _ctx.restore();
  }

  function damage(amount) {
    if (!_active || _defeated) return;
    _hp = Math.max(0, _hp - amount);
    _shakeTimer = 0.25;
    if (_hp <= 0) {
      _defeated    = true;
      _defeatTimer = 0;
      _projectiles = [];
      _warnings    = [];
    }
  }

  function isDefeated()   { return _defeated; }
  function getHp()        { return _hp; }
  function isActive()     { return _active; }

  function deactivate() {
    _active = false;
    _projectiles = [];
    _warnings    = [];
    if (_canvas) {
      _canvas.hidden = true;
      if (_ctx) _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    }
  }

  return { init, tick, damage, isDefeated, getHp, isActive, deactivate };
})();

// ============================================================
// SECTION 5: CAMPAIGN UI
// All HTML rendering for campaign screens.
// ============================================================
const CampaignUI = (() => {

  // ---- Level Select Screen ----
  function renderLevelSelect() {
    const el = document.getElementById('campaign-levelselect');
    if (!el) return;
    const saveData = CampaignSave.get();
    const total    = CAMPAIGN_LEVELS.length;
    const completed = Object.keys(saveData.completedLevels).length;
    const totalStars = saveData.totalStars;

    el.innerHTML = `
      <div class="cmp-ls-inner">
        <div class="cmp-ls-header">
          <h1 class="cmp-ls-title">Challenge Road</h1>
          <p class="cmp-ls-subtitle">Complete missions to unlock the final boss</p>
          <div class="cmp-ls-stats">
            <div class="cmp-ls-stat">
              <span class="cmp-stat-val">${completed} / ${total}</span>
              <span class="cmp-stat-lbl">Levels Complete</span>
            </div>
            <div class="cmp-ls-stat-sep"></div>
            <div class="cmp-ls-stat">
              <span class="cmp-stat-val">${totalStars} / ${total * 3}</span>
              <span class="cmp-stat-lbl">Stars Earned</span>
            </div>
          </div>
        </div>
        <div class="cmp-level-grid" id="cmp-level-grid">
          ${CAMPAIGN_LEVELS.map(lvl => _buildLevelCard(lvl, saveData)).join('')}
        </div>
        <button class="cmp-back-btn btn" id="cmp-btn-back">Back to Menu</button>
      </div>`;

    // Wire back button
    const backBtn = el.querySelector('#cmp-btn-back');
    if (backBtn) backBtn.addEventListener('click', () => {
      if (typeof AudioFn !== 'undefined') try { AudioFn.uiClick(); } catch (_) {}
      hideLevelSelect();
      if (typeof returnHome === 'function') returnHome();
    });

    // Wire level play buttons
    el.querySelectorAll('.cmp-level-play-btn[data-level-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.levelId, 10);
        const lvl = CAMPAIGN_LEVELS.find(l => l.id === id);
        if (lvl && CampaignSave.isUnlocked(id)) {
          if (typeof AudioFn !== 'undefined') try { AudioFn.uiClick(); } catch (_) {}
          window.CampaignManager.selectLevel(lvl);
        }
      });
    });
  }

  function _buildLevelCard(lvl, saveData) {
    const unlocked  = CampaignSave.isUnlocked(lvl.id);
    const completed = CampaignSave.isCompleted(lvl.id);
    const stars     = CampaignSave.getStars(lvl.id);
    const stateClass = !unlocked ? 'cmp-card-locked' : completed ? 'cmp-card-completed' : 'cmp-card-unlocked';

    const starsHtml = `<div class="cmp-card-stars" aria-label="${stars} of 3 stars">
      ${[1,2,3].map(i => `<span class="cmp-star ${i <= stars ? 'cmp-star-on' : ''}" aria-hidden="true">&#9733;</span>`).join('')}
    </div>`;

    const objSummary = _getObjectiveSummary(lvl);
    const diffBadge  = `<span class="cmp-diff-badge" style="color:${lvl.difficultyColor}">${lvl.difficulty}</span>`;
    const rewardBadge = `<span class="cmp-reward-badge"><span class="coin-icon coin-sm" aria-hidden="true"></span>${lvl.rewardCoins}</span>`;

    let actionHtml;
    if (!unlocked) {
      actionHtml = `<button class="cmp-level-play-btn cmp-btn-locked" disabled aria-label="Level ${lvl.id} locked">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        Locked</button>`;
    } else {
      const btnLabel = completed ? 'Replay' : 'Play';
      const btnClass = completed ? 'cmp-btn-replay' : 'cmp-btn-play';
      actionHtml = `<button class="cmp-level-play-btn ${btnClass}" data-level-id="${lvl.id}" aria-label="${btnLabel} Level ${lvl.id}: ${lvl.name}">
        ${completed ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg> Replay' : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> Play'}
      </button>`;
    }

    const checkmark = completed ? '<div class="cmp-card-check" aria-label="Completed">&#10003;</div>' : '';

    return `<div class="cmp-level-card ${stateClass}" role="listitem" aria-label="Level ${lvl.id}: ${lvl.name}, ${unlocked ? (completed ? 'completed' : 'unlocked') : 'locked'}">
      ${checkmark}
      <div class="cmp-card-top">
        <span class="cmp-card-num">${lvl.id}</span>
        ${diffBadge}
      </div>
      <div class="cmp-card-name">${lvl.name}</div>
      <div class="cmp-card-obj">${objSummary}</div>
      ${starsHtml}
      <div class="cmp-card-bottom">
        ${rewardBadge}
        ${actionHtml}
      </div>
    </div>`;
  }

  function _getObjectiveSummary(lvl) {
    const t = lvl.objectiveType;
    const tgt = lvl.objectiveTarget;
    if (t === 'survive_seconds') return `Survive ${tgt}s`;
    if (t === 'collect_coins')   return `Collect ${tgt} coins${lvl.timeLimit ? ' in ' + lvl.timeLimit + 's' : ''}`;
    if (t === 'dodge_blocks')    return `Dodge ${tgt} blocks`;
    if (t === 'boss_defeat')     return 'Defeat the Panic Core';
    if (t === 'hybrid')          return `${tgt.seconds}s + ${tgt.coins} coins + ${tgt.dodges} dodges`;
    return 'Complete objective';
  }

  // ---- Level Intro Screen ----
  function showLevelIntro(lvl, onStart) {
    const el = document.getElementById('campaign-intro');
    if (!el) { if (onStart) onStart(); return; }

    const objText = _getObjectiveSummary(lvl);

    el.innerHTML = `
      <div class="cmp-intro-box">
        <div class="cmp-intro-header">
          <span class="cmp-intro-num">Level ${lvl.id}</span>
          <span class="cmp-intro-diff" style="color:${lvl.difficultyColor}">${lvl.difficulty}</span>
        </div>
        <h2 class="cmp-intro-name">${lvl.name}</h2>
        <p class="cmp-intro-sub">${lvl.subtitle}</p>
        <div class="cmp-intro-objective">
          <div class="cmp-intro-obj-label">Objective</div>
          <div class="cmp-intro-obj-text">${objText}</div>
        </div>
        <div class="cmp-intro-reward">
          <span class="coin-icon" aria-hidden="true"></span>
          <span class="cmp-intro-reward-val">${lvl.rewardCoins} coins</span>
          <span class="cmp-intro-reward-lbl">on completion</span>
        </div>
        <button class="cmp-intro-start-btn btn btn-primary" id="cmp-intro-start">Start Level</button>
        <button class="cmp-intro-back-btn btn btn-secondary" id="cmp-intro-back">Level Select</button>
      </div>`;

    el.hidden = false;

    const startBtn = el.querySelector('#cmp-intro-start');
    const backBtn  = el.querySelector('#cmp-intro-back');

    if (backBtn) backBtn.addEventListener('click', () => {
      el.hidden = true;
      showLevelSelect();
    });

    if (startBtn) startBtn.addEventListener('click', () => {
      // Immediately hide the intro screen so it doesn't show during countdown
      el.hidden = true;
      // Run countdown on the dedicated full-screen overlay, then call onStart
      _runCountdown(3, () => {
        if (onStart) onStart();
      });
    });
  }

  function _runCountdown(count, onDone) {
    const overlay = document.getElementById('campaign-countdown-overlay');
    if (!overlay) { if (onDone) onDone(); return; }
    overlay.hidden = false;
    overlay.textContent = '';

    let current = count;
    function show() {
      overlay.textContent = current > 0 ? String(current) : 'GO!';
      overlay.classList.remove('cmp-cd-pop');
      void overlay.offsetWidth;
      overlay.classList.add('cmp-cd-pop');
      if (current <= 0) {
        setTimeout(() => {
          overlay.hidden = true;
          overlay.textContent = '';
          if (onDone) onDone();
        }, 500);
      } else {
        current--;
        setTimeout(show, 800);
      }
    }
    show();
  }

  // ---- Campaign HUD Overlay (during gameplay) ----
  function updateHUD(lvl, elapsed, roundCoins, dodgeCount, bossHp, timeLimit) {
    const el = document.getElementById('campaign-hud-overlay');
    if (!el || el.hidden) return;
    const prog   = document.getElementById('cmp-hud-progress');
    const timer  = document.getElementById('cmp-hud-timer');
    const bossEl = document.getElementById('cmp-hud-boss');

    if (!lvl) return;
    const type = lvl.objectiveType;

    // Update objective progress label
    if (prog) {
      if (type === 'survive_seconds') {
        const t   = lvl.objectiveTarget;
        const cur = Math.min(Math.floor(elapsed), t);
        prog.textContent = `Survive: ${cur} / ${t}s`;
        prog.style.setProperty('--obj-pct', Math.min(1, elapsed / t));
      } else if (type === 'collect_coins') {
        const t   = lvl.objectiveTarget;
        const cur = Math.min(roundCoins, t);
        prog.textContent = `Coins: ${cur} / ${t}`;
        prog.style.setProperty('--obj-pct', Math.min(1, cur / t));
      } else if (type === 'dodge_blocks') {
        const t   = lvl.objectiveTarget;
        const cur = Math.min(dodgeCount, t);
        prog.textContent = `Dodged: ${cur} / ${t}`;
        prog.style.setProperty('--obj-pct', Math.min(1, cur / t));
      } else if (type === 'boss_defeat') {
        const orbs = lvl.objectiveTarget;
        const cur  = Math.min(roundCoins, orbs);
        prog.textContent = `Orbs: ${cur} / ${orbs}`;
        prog.style.setProperty('--obj-pct', Math.min(1, cur / orbs));
      } else if (type === 'hybrid') {
        const tgt = lvl.objectiveTarget;
        prog.textContent = `${Math.min(Math.floor(elapsed), tgt.seconds)}/${tgt.seconds}s  |  ${Math.min(roundCoins, tgt.coins)}/${tgt.coins} coins  |  ${Math.min(dodgeCount, tgt.dodges)}/${tgt.dodges} dodged`;
      }
    }

    // Time limit countdown
    if (timer) {
      if (timeLimit !== null && timeLimit !== undefined) {
        const remaining = Math.max(0, timeLimit - elapsed);
        timer.textContent = remaining > 0 ? `Time: ${Math.ceil(remaining)}s` : 'Time: 0s';
        timer.hidden = false;
        timer.style.color = remaining < 8 ? '#ef4444' : '#f8fafc';
      } else {
        timer.hidden = true;
      }
    }

    // Boss HP bar is rendered on boss-canvas by BossManager
    if (bossEl) bossEl.hidden = (type !== 'boss_defeat');
  }

  function showHUD(lvl) {
    const el = document.getElementById('campaign-hud-overlay');
    if (!el) return;
    el.hidden = false;
    const nameEl = document.getElementById('cmp-hud-name');
    if (nameEl) nameEl.textContent = `Level ${lvl.id}: ${lvl.name}`;
  }

  function hideHUD() {
    const el = document.getElementById('campaign-hud-overlay');
    if (el) el.hidden = true;
  }

  // ---- Victory Screen ----
  function showVictory(lvl, stars, rewardCoins, isFirstTime, stateData) {
    const el = document.getElementById('campaign-victory');
    if (!el) return;

    const isLast = lvl.id === CAMPAIGN_LEVELS.length;
    const title  = isLast ? 'Chapter 1 Complete!' : 'Level Complete!';
    const nextLvl = CAMPAIGN_LEVELS.find(l => l.id === lvl.id + 1);

    const starsHtml = `<div class="cmp-v-stars" role="img" aria-label="${stars} of 3 stars">
      ${[1,2,3].map((i, idx) => `<span class="cmp-v-star ${i <= stars ? 'cmp-v-star-on' : ''}" style="--delay:${idx * 0.18}s">&#9733;</span>`).join('')}
    </div>`;

    const coinsHtml = isFirstTime
      ? `<div class="cmp-v-reward"><span class="cmp-v-reward-icon coin-icon" aria-hidden="true"></span><span class="cmp-v-reward-amt">+${rewardCoins}</span> coins earned</div>`
      : `<div class="cmp-v-reward cmp-v-replay-reward"><span class="coin-icon" aria-hidden="true"></span> Replay reward: +${Math.round(rewardCoins * 0.1)} coins</div>`;

    const nextBtnHtml = (!isLast && nextLvl)
      ? `<button class="cmp-v-btn btn btn-primary" id="cmp-v-next">Next Level<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>`
      : '';

    const celebrationClass = isLast ? 'cmp-victory-last' : '';

    el.innerHTML = `
      <div class="cmp-v-box ${celebrationClass}">
        <div class="cmp-v-confetti" aria-hidden="true" id="cmp-v-confetti"></div>
        <h2 class="cmp-v-title">${title}</h2>
        <div class="cmp-v-level-name">${lvl.name}</div>
        ${starsHtml}
        ${coinsHtml}
        <div class="cmp-v-btns">
          ${nextBtnHtml}
          <button class="cmp-v-btn btn ${!isLast && nextLvl ? 'btn-secondary' : 'btn-primary'}" id="cmp-v-replay">Retry Level</button>
          <button class="cmp-v-btn btn btn-secondary" id="cmp-v-select">Level Select</button>
        </div>
      </div>`;

    el.hidden = false;

    // Spawn confetti particles
    setTimeout(() => _spawnConfetti(el.querySelector('#cmp-v-confetti')), 100);

    // Wire buttons
    const nextBtn   = el.querySelector('#cmp-v-next');
    const replayBtn = el.querySelector('#cmp-v-replay');
    const selectBtn = el.querySelector('#cmp-v-select');

    if (nextBtn) nextBtn.addEventListener('click', () => {
      el.hidden = true;
      window.CampaignManager.selectLevel(nextLvl);
    });
    if (replayBtn) replayBtn.addEventListener('click', () => {
      el.hidden = true;
      window.CampaignManager.selectLevel(lvl);
    });
    if (selectBtn) selectBtn.addEventListener('click', () => {
      el.hidden = true;
      showLevelSelect();
    });
  }

  function _spawnConfetti(container) {
    if (!container) return;
    const colors = ['#7c3aed','#0ea5e9','#22c55e','#f59e0b','#ec4899','#f8fafc'];
    for (let i = 0; i < 48; i++) {
      const p = document.createElement('div');
      p.className = 'cmp-confetti-piece';
      p.style.left    = Math.random() * 100 + '%';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDelay = (Math.random() * 0.8) + 's';
      p.style.animationDuration = (1.2 + Math.random() * 0.8) + 's';
      p.style.width  = (6 + Math.random() * 8) + 'px';
      p.style.height = (6 + Math.random() * 8) + 'px';
      container.appendChild(p);
    }
  }

  // ---- Defeat Screen ----
  function showDefeat(lvl, reason) {
    const el = document.getElementById('campaign-defeat');
    if (!el) return;

    const reasonText = {
      hit_forbidden: 'You touched a forbidden color.',
      time_up:       'Time ran out.',
      boss_hit:      'The Panic Core got you.',
    }[reason] || 'Objective not completed.';

    el.innerHTML = `
      <div class="cmp-d-box">
        <div class="cmp-d-icon" aria-hidden="true">&#215;</div>
        <h2 class="cmp-d-title">Level Failed</h2>
        <p class="cmp-d-level">Level ${lvl.id}: ${lvl.name}</p>
        <p class="cmp-d-reason">${reasonText}</p>
        <div class="cmp-d-btns">
          <button class="cmp-d-btn btn btn-primary cmp-d-retry" id="cmp-d-retry">Retry</button>
          <button class="cmp-d-btn btn btn-secondary" id="cmp-d-select">Level Select</button>
        </div>
      </div>`;

    el.hidden = false;

    const retryBtn  = el.querySelector('#cmp-d-retry');
    const selectBtn = el.querySelector('#cmp-d-select');

    if (retryBtn) retryBtn.addEventListener('click', () => {
      el.hidden = true;
      window.CampaignManager.selectLevel(lvl);
    });
    if (selectBtn) selectBtn.addEventListener('click', () => {
      el.hidden = true;
      showLevelSelect();
    });
  }

  // ---- Double Trouble overlay flash ----
  function showDoubleTrouble() {
    const el = document.getElementById('campaign-hud-overlay');
    if (!el || el.hidden) return;
    const dt = document.getElementById('cmp-hud-dt');
    if (!dt) return;
    dt.hidden = false;
    dt.classList.remove('cmp-dt-pop');
    void dt.offsetWidth;
    dt.classList.add('cmp-dt-pop');
    setTimeout(() => { dt.hidden = true; }, 2500);
  }

  function showShrinkWarning(phase) {
    const el = document.getElementById('campaign-hud-overlay');
    if (!el || el.hidden) return;
    const w = document.getElementById('cmp-hud-shrink');
    if (!w) return;
    w.hidden = false;
    setTimeout(() => { w.hidden = true; }, 2000);
  }

  // ---- Level select show / hide helpers ----
  function showLevelSelect() {
    _hideAllGameScreens();
    const el = document.getElementById('campaign-levelselect');
    if (!el) return;
    el.hidden = false;
    renderLevelSelect();
  }

  function hideLevelSelect() {
    const el = document.getElementById('campaign-levelselect');
    if (el) el.hidden = true;
  }

  function _hideAllGameScreens() {
    ['home-screen', 'game-screen'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.hidden = true;
    });
    const gear = document.getElementById('btn-gear-settings');
    if (gear) gear.hidden = true;
    ['campaign-intro', 'campaign-victory', 'campaign-defeat'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.hidden = true;
    });
  }

  return {
    renderLevelSelect,
    showLevelIntro,
    showLevelSelect,
    hideLevelSelect,
    showHUD,
    hideHUD,
    updateHUD,
    showVictory,
    showDefeat,
    showDoubleTrouble,
    showShrinkWarning,
  };
})();

// ============================================================
// SECTION 6: CAMPAIGN MANAGER
// Main orchestrator. Exposed on window for script.js hooks.
// ============================================================
window.CampaignManager = (() => {
  let _active          = false;
  let _currentLevel    = null;
  let _isFirstTime     = false;
  let _victoryFired    = false;
  let _defeatFired     = false;
  let _startCoins      = 0;

  // Shrinking arena state
  let _arenaLeft     = 0;       // px from left  (0 = no restriction)
  let _arenaRight    = 0;       // px from right (0 = no restriction)
  let _arenaTimer    = 0;
  let _arenaShrinkInterval = 10; // seconds between each shrink step
  let _arenaShrinkStep     = 0;  // which step we're on
  const ARENA_SHRINK_STEPS = 4;  // 4 shrinks over 40s of a 50s level

  // Double trouble campaign state
  let _dtQueue       = [];       // [seconds] offsets for this level
  let _dtFired       = new Set();// which offsets have been triggered
  let _dtPhase       = 'idle';   // 'idle' | 'active'
  let _dtTimer       = 0;
  const DT_DURATION  = 5.0;

  // Wall overlay canvas for shrinking arena
  let _wallCanvas = null;
  let _wallCtx    = null;

  function isActive() { return _active; }

  function deactivate() {
    _active       = false;
    _currentLevel = null;
    _victoryFired = false;
    _defeatFired  = false;
    _dtFired      = new Set();
    _arenaLeft    = 0;
    _arenaRight   = 0;
    _arenaShrinkStep = 0;
    window._campaignSettings  = null;
    window._campaignDodgeCount = 0;
    BossManager.deactivate();
    _hideWallCanvas();
    CampaignUI.hideHUD();
  }

  function selectLevel(lvl) {
    _currentLevel = lvl;
    CampaignUI.showLevelIntro(lvl, () => _startLevel(lvl));
  }

  function _startLevel(lvl) {
    _active       = true;
    _victoryFired = false;
    _defeatFired  = false;
    _isFirstTime  = !CampaignSave.isCompleted(lvl.id);
    _startCoins   = 0;
    _arenaLeft    = 0;
    _arenaRight   = 0;
    _arenaShrinkStep = 0;
    _arenaTimer   = 0;
    _dtQueue      = (lvl.settings.doubleTroubleAt || []).slice();
    _dtFired      = new Set();
    _dtPhase      = 'idle';
    _dtTimer      = 0;

    ObjectiveTracker.reset(lvl);

    // Set campaign settings for script.js to pick up in startGame()
    window._campaignSettings = {
      speedMult:        lvl.settings.speedMult,
      spawnInterval:    lvl.settings.spawnInterval,
      forbiddenInterval: lvl.settings.forbiddenInterval,
      coinsEnabled:     lvl.settings.coinsEnabled,
      coinItemInterval: lvl.settings.coinItemInterval,
      powerupsEnabled:  lvl.settings.powerupsEnabled,
      diffCap:          lvl.settings.diffCap,
    };
    window._campaignDodgeCount = 0;

    // Hide all campaign overlays and show game screen
    ['campaign-levelselect', 'campaign-intro', 'campaign-victory', 'campaign-defeat'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.hidden = true;
    });

    // Start the actual game using the existing startGame() function
    if (typeof startGame === 'function') startGame();

    // After startGame, show campaign HUD
    setTimeout(() => {
      CampaignUI.showHUD(lvl);
      if (lvl.settings.bossMode) {
        const gameCanvas = document.getElementById('game-canvas');
        BossManager.init(
          gameCanvas,
          _onBossDefeated,
          _onBossHitPlayer
        );
      }
      if (lvl.settings.shrinkingArena) {
        _initWallCanvas();
      }
    }, 120);
  }

  function _onBossDefeated() {
    if (_victoryFired || _defeatFired) return;
    _victoryFired = true;
    _triggerVictory({ bossDefeated: true });
  }

  function _onBossHitPlayer() {
    if (_victoryFired || _defeatFired) return;
    // Trigger game over (game handles death normally, then our onDefeat hook fires)
    if (typeof triggerGameOver === 'function') triggerGameOver();
  }

  function tick(dt, elapsed, gameState) {
    if (!_active || !_currentLevel) return;
    const lvl        = _currentLevel;
    const roundCoins = gameState.roundCoins || 0;
    const dodgeCount = window._campaignDodgeCount || 0;

    // ---- Time limit check ----
    if (lvl.timeLimit !== null && lvl.timeLimit !== undefined) {
      if (elapsed >= lvl.timeLimit && !_victoryFired && !_defeatFired) {
        // For coin/boss levels: time limit means defeat if objective not met
        const completed = ObjectiveTracker.isComplete(elapsed, roundCoins, dodgeCount, BossManager.isDefeated && BossManager.isDefeated());
        if (!completed) {
          _defeatFired = true;
          if (typeof triggerGameOver === 'function') {
            window._campaignDefeatReason = 'time_up';
            triggerGameOver();
          }
          return;
        }
      }
    }

    // ---- Objective completion check ----
    const bossDefeated = lvl.settings.bossMode && BossManager.isDefeated && BossManager.isDefeated();
    if (!_victoryFired && !_defeatFired) {
      if (ObjectiveTracker.isComplete(elapsed, roundCoins, dodgeCount, bossDefeated)) {
        _victoryFired = true;
        const stateData = {
          hitsReceived:  ObjectiveTracker.getHitsReceived(),
          timeRemaining: lvl.timeLimit !== null && lvl.timeLimit !== undefined ? lvl.timeLimit - elapsed : 0,
          bossDefeated:  bossDefeated,
        };
        _triggerVictory(stateData);
        return;
      }
    }

    // ---- Double Trouble phases ----
    _tickDoubleTrouble(dt, elapsed, gameState);

    // ---- Shrinking arena ----
    if (lvl.settings.shrinkingArena) {
      _tickShrinkingArena(dt, elapsed, gameState);
    }

    // ---- Boss tick ----
    if (lvl.settings.bossMode && BossManager.isActive()) {
      const player = gameState.player;
      if (player) {
        BossManager.tick(dt, elapsed, player.x, player.y, player.radius);
        // Boss damage from orb collection
        const newOrbs = roundCoins - _startCoins;
        if (newOrbs > 0) {
          const bossHp = BossManager.getHp();
          // Each coin collected = 10 boss damage
          // But only apply once per coin collected
          const expectedHp = 100 - roundCoins * 10;
          const actualHp   = BossManager.getHp();
          if (actualHp > expectedHp) {
            BossManager.damage((actualHp - expectedHp));
          }
        }
      }
    }

    // ---- HUD update ----
    CampaignUI.updateHUD(
      lvl, elapsed, roundCoins, dodgeCount,
      lvl.settings.bossMode ? BossManager.getHp() : 100,
      lvl.timeLimit
    );
  }

  function _tickDoubleTrouble(dt, elapsed, gameState) {
    if (_dtQueue.length === 0) return;

    // Check if any queued time has been reached
    _dtQueue.forEach(t => {
      if (!_dtFired.has(t) && elapsed >= t) {
        _dtFired.add(t);
        _dtPhase = 'active';
        _dtTimer = DT_DURATION;
        CampaignUI.showDoubleTrouble();
        // Temporarily boost spawn rate via global (script.js checks this)
        window._campaignDoubleTrouble = true;
      }
    });

    // Deactivate DT phase after duration
    if (_dtPhase === 'active') {
      _dtTimer -= dt;
      if (_dtTimer <= 0) {
        _dtPhase = 'idle';
        window._campaignDoubleTrouble = false;
      }
    }
  }

  function _tickShrinkingArena(dt, elapsed, gameState) {
    _arenaTimer += dt;
    if (_arenaShrinkStep < ARENA_SHRINK_STEPS && _arenaTimer >= _arenaShrinkInterval) {
      _arenaTimer = 0;
      _arenaShrinkStep++;
      const canvas = gameState.canvas;
      if (canvas) {
        const maxShrink = canvas.width * 0.15; // max 15% per side
        const stepSize  = maxShrink / ARENA_SHRINK_STEPS;
        _arenaLeft  = _arenaShrinkStep * stepSize;
        _arenaRight = canvas.width - _arenaShrinkStep * stepSize;
        _drawWallOverlay(canvas, _arenaLeft, _arenaRight);
        CampaignUI.showShrinkWarning(_arenaShrinkStep);
      }
    } else if (_arenaShrinkStep > 0) {
      // Redraw walls every frame
      const canvas = gameState.canvas;
      if (canvas) _drawWallOverlay(canvas, _arenaLeft, _arenaRight);
    }

    // Check if player is in danger zone
    const player = gameState.player;
    const canvas  = gameState.canvas;
    if (player && canvas && _arenaShrinkStep > 0 && !_victoryFired && !_defeatFired) {
      if ((player.x - player.radius) < _arenaLeft || (player.x + player.radius) > _arenaRight) {
        _defeatFired = true;
        window._campaignDefeatReason = 'hit_forbidden';
        if (typeof triggerGameOver === 'function') triggerGameOver();
      }
    }
  }

  function _initWallCanvas() {
    _wallCanvas = document.getElementById('campaign-wall-canvas');
    if (!_wallCanvas) return;
    _wallCtx = _wallCanvas.getContext('2d');
    _wallCanvas.hidden = false;
  }

  function _hideWallCanvas() {
    const wc = document.getElementById('campaign-wall-canvas');
    if (wc) { wc.hidden = true; const c = wc.getContext('2d'); if (c) c.clearRect(0, 0, wc.width, wc.height); }
    _wallCanvas = null;
    _wallCtx    = null;
  }

  function _drawWallOverlay(gameCanvas, leftBound, rightBound) {
    const wc = document.getElementById('campaign-wall-canvas');
    if (!wc) return;
    const wctx = wc.getContext('2d');
    // Sync size
    if (wc.width !== gameCanvas.width || wc.height !== gameCanvas.height) {
      wc.width  = gameCanvas.width;
      wc.height = gameCanvas.height;
    }
    wctx.clearRect(0, 0, wc.width, wc.height);

    // Left wall
    if (leftBound > 0) {
      const grad = wctx.createLinearGradient(0, 0, leftBound, 0);
      grad.addColorStop(0, '#ef444488');
      grad.addColorStop(1, '#ef444400');
      wctx.fillStyle = grad;
      wctx.fillRect(0, 0, leftBound, wc.height);
      // Danger edge line
      wctx.strokeStyle = '#ef4444';
      wctx.lineWidth   = 3;
      wctx.setLineDash([10, 8]);
      wctx.beginPath();
      wctx.moveTo(leftBound, 0);
      wctx.lineTo(leftBound, wc.height);
      wctx.stroke();
      wctx.setLineDash([]);
    }

    // Right wall
    if (rightBound < gameCanvas.width) {
      const grad = wctx.createLinearGradient(rightBound, 0, wc.width, 0);
      grad.addColorStop(0, '#ef444400');
      grad.addColorStop(1, '#ef444488');
      wctx.fillStyle = grad;
      wctx.fillRect(rightBound, 0, wc.width - rightBound, wc.height);
      // Danger edge line
      wctx.strokeStyle = '#ef4444';
      wctx.lineWidth   = 3;
      wctx.setLineDash([10, 8]);
      wctx.beginPath();
      wctx.moveTo(rightBound, 0);
      wctx.lineTo(rightBound, wc.height);
      wctx.stroke();
      wctx.setLineDash([]);
    }
  }

  function _triggerVictory(stateData) {
    // Pause the game loop gracefully
    setTimeout(() => {
      if (typeof cancelAnimationFrame !== 'undefined' && typeof window.rafHandle !== 'undefined') {
        // Game loop stops via currentState check — triggerGameOver handles that
        // For a clean victory, we just need to stop the loop and show victory UI
      }
      // Stop the game loop without showing the gameover overlay
      if (typeof cleanupGameLoop === 'function') cleanupGameLoop();
      if (typeof AudioManager !== 'undefined') AudioManager.stopMusic();
      _playVictorySound();

      const lvl    = _currentLevel;
      const stars  = ObjectiveTracker.calcStars(lvl, stateData);
      const reward = _isFirstTime ? lvl.rewardCoins : Math.round(lvl.rewardCoins * 0.1);

      // Award coins
      if (typeof settings !== 'undefined' && typeof saveSettings === 'function') {
        settings.coins = (settings.coins || 0) + reward;
        saveSettings();
        if (typeof updateCoinUI === 'function') updateCoinUI(true);
      }

      // Save progress
      CampaignSave.completeLevelResult(lvl.id, stars, stateData.score || 0, 0, reward, _isFirstTime);

      CampaignUI.hideHUD();
      BossManager.deactivate();
      _hideWallCanvas();

      CampaignUI.showVictory(lvl, stars, reward, _isFirstTime, stateData);

      _active = false;
      window._campaignSettings = null;
    }, 400);
  }

  function onDefeat() {
    if (_victoryFired) return;
    if (_defeatFired) return; // already handled
    _defeatFired = true;
    const reason = window._campaignDefeatReason || 'hit_forbidden';
    window._campaignDefeatReason = null;

    const lvl = _currentLevel;
    _active = false;
    window._campaignSettings = null;
    BossManager.deactivate();
    _hideWallCanvas();
    CampaignUI.hideHUD();

    // Small delay so death animation plays first
    setTimeout(() => {
      document.getElementById('gameover-overlay').hidden = true;
      CampaignUI.showDefeat(lvl, reason);
    }, 300);
  }

  function _playVictorySound() {
    try {
      if (typeof Audio !== 'undefined' && Audio.uiClick) {
        // Chain 3 ascending tones as a victory jingle
        const ctx = Audio.getCtx ? Audio.getCtx() : null;
        if (ctx) {
          const t = ctx.currentTime;
          [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.50, 0.40]].forEach(([freq, delay]) => {
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            env.gain.setValueAtTime(0.0001, t + delay);
            env.gain.linearRampToValueAtTime(0.3, t + delay + 0.015);
            env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.25);
            osc.connect(env); env.connect(ctx.destination);
            osc.start(t + delay); osc.stop(t + delay + 0.28);
          });
        }
      }
    } catch (_) {}
  }

  return {
    isActive,
    deactivate,
    selectLevel,
    tick,
    onDefeat,
  };
})();
