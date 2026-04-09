// ============================================================
// FORBIDDEN COLOR — Game Logic v2
// ============================================================
'use strict';

// ============================================================
// SECTION 1: CONSTANTS & CONFIG
// ============================================================

const GAME_COLORS = [
  { name: 'Red',    hex: '#ef4444', symbol: 'X'  },
  { name: 'Blue',   hex: '#3b82f6', symbol: 'O'  },
  { name: 'Green',  hex: '#22c55e', symbol: '+'  },
  { name: 'Yellow', hex: '#eab308', symbol: '*'  },
  { name: 'Purple', hex: '#a855f7', symbol: 'V'  },
  { name: 'Orange', hex: '#f97316', symbol: 'S'  },
  { name: 'Cyan',   hex: '#06b6d4', symbol: '#'  },
];

const POWERUP_DEFS = {
  SHIELD: { label: 'Shield',    icon: '\uD83D\uDEE1', color: '#facc15', duration: 10 },
  SLOW:   { label: 'Slow Time', icon: '\u23F1',        color: '#38bdf8', duration: 6  },
  CLEAR:  { label: 'Clear',    icon: '\u2728',         color: '#e879f9', duration: 0  },
  BOOST:  { label: 'Score x2',  icon: '\u26A1',         color: '#fb923c', duration: 8  },
  SMALL:  { label: 'Small Mode',icon: '\uD83D\uDD35',  color: '#34d399', duration: 5  },
};
const POWERUP_KEYS = Object.keys(POWERUP_DEFS);

// Single built-in difficulty — ramps automatically via tickDifficulty()
const GAME_CONFIG = { playerSpeed: 255, spawnRate: 0.22, forbiddenInterval: 3.2, baseSpeed: 210 };

// Player skins — unlock thresholds are bestScore requirements (bestScore never decreases)
const SKIN_DEFS = [
  // ── Common ──
  { id: 'classic', name: 'Classic', unlock:    0, rarity: 'common', effect: 'none',    color1: '#ffffff', color2: '#c084fc', glow: '#a855f7', shape: 'circle', trail: false },
  { id: 'neon',    name: 'Neon',    unlock: 0, coinCost:  75, rarity: 'common', effect: 'pulse',   color1: '#ccfdf2', color2: '#06b6d4', glow: '#06b6d4', shape: 'circle', trail: true  },
  // ── Rare ──
  { id: 'ice',     name: 'Ice',     unlock: 0, coinCost: 150, rarity: 'rare',   effect: 'shimmer', color1: '#e0f2fe', color2: '#38bdf8', glow: '#7dd3fc', shape: 'circle', trail: true  },
  { id: 'lava',    name: 'Lava',    unlock: 0, coinCost: 175, rarity: 'rare',   effect: 'flicker', color1: '#fef08a', color2: '#ef4444', glow: '#f97316', shape: 'circle', trail: true  },
  { id: 'crimson',  name: 'Crimson',  unlock: 0, coinCost: 200, rarity: 'rare',      effect: 'flicker',  color1: '#ffe4e1', color2: '#dc2626', glow: '#ef4444', shape: 'circle', trail: true  },
  // ── Epic ──
  { id: 'gold',    name: 'Gold',    unlock: 0, coinCost: 300, rarity: 'epic',   effect: 'shimmer', color1: '#fefce8', color2: '#eab308', glow: '#fbbf24', shape: 'star',   trail: false },
  { id: 'void',     name: 'Void',     unlock: 0, coinCost: 425, rarity: 'epic',      effect: 'void',     color1: '#ddd6fe', color2: '#3b0764', glow: '#c084fc', shape: 'star',   trail: true  },
  { id: 'electric', name: 'Electric', unlock: 0, coinCost: 350, rarity: 'epic',      effect: 'electric', color1: '#e0f2fe', color2: '#0284c7', glow: '#38bdf8', shape: 'circle', trail: true  },
  { id: 'inferno',  name: 'Inferno',  unlock: 0, coinCost: 350, rarity: 'epic',      effect: 'inferno',  color1: '#fffbeb', color2: '#dc2626', glow: '#f97316', shape: 'circle', trail: true  },
  { id: 'prism',    name: 'Prism',    unlock: 0, coinCost: 350, rarity: 'epic',      effect: 'prism',    color1: '#ffffff', color2: '#a855f7', glow: '#e879f9', shape: 'circle', trail: true  },
  // ── Legendary ──
  { id: 'galaxy',   name: 'Galaxy',   unlock: 0, coinCost: 550, rarity: 'legendary', effect: 'galaxy',   color1: '#c4b5fd', color2: '#1e1b4b', glow: '#818cf8', shape: 'star',   trail: true  },
];

const STATE = { HOME: 'home', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

const WARNING_DURATION    = 0.8;  // short flash warning — just enough to react
const NEAR_MISS_DIST      = 65;   // px (from player center to nearest rect edge)
const NEAR_MISS_BONUS     = 40;
const COMBO_BONUS_PER         = 25;   // pts per combo level on each color change (combo×25: 25, 50, 75…)
const POWERUP_COLLECT_BONUS   = 50;   // flat pts for picking up any power-up
const POWERUP_INTERVAL    = 15;   // s between powerup spawns (more frequent to compensate)
const COIN_ITEM_INTERVAL  = 6.0;  // s between coin pickup spawns
const DIFF_SCALE_EVERY    = 9;    // s between difficulty bumps
const MAX_OBSTACLES       = 30;   // hard cap — dense but readable
const GRACE_PERIOD        = 1.0;  // s at start with no forbidden obstacles
const FORBIDDEN_MIN_RATIO = 0.65; // keep at least 65% of active obstacles forbidden — keeps screen readable
const CLUSTER_CHANCE      = 0.35; // structured wave patterns fire on 35% of spawn ticks
const MIN_CLEAR_GAP       = 72;   // px — minimum unblocked corridor guaranteed at player row
const NUM_LANES           = 6;    // play area divided into this many columns for controlled, fair spawning
// Wall / narrow-lane patterns removed — challenge comes from spawn rate and color cycling.

// ============================================================
// SECTION 2: MUTABLE STATE
// ============================================================

// ============================================================
// MISSIONS SYSTEM
// Each mission has: id, label, description, goal (numeric),
//   stat (which per-run counter to check), reward (skin id or null),
//   rewardLabel, repeatable (can be re-earned after reset).
// ============================================================
const MISSION_DEFS = [
  // ── Easy ──────────────────────────────────────────────────────
  {
    id: 'survive45',    difficulty: 'easy',
    label: 'Survivor I',
    description: 'Survive for 45 seconds in a single run.',
    stat: 'seconds',    goal: 45,   coinReward: 10,
  },
  {
    id: 'score500',     difficulty: 'easy',
    label: 'Score Seeker',
    description: 'Reach a score of 500 in a single run.',
    stat: 'score',      goal: 500,  coinReward: 10,
  },
  {
    id: 'nearmiss3',    difficulty: 'easy',
    label: 'Close Shave',
    description: 'Land 3 near misses in a single run.',
    stat: 'nearMissesThisRun', goal: 3, coinReward: 10,
  },
  // ── Medium ────────────────────────────────────────────────────
  {
    id: 'survive90',    difficulty: 'medium',
    label: 'Survivor II',
    description: 'Survive for 90 seconds in a single run.',
    stat: 'seconds',    goal: 90,   coinReward: 20,
  },
  {
    id: 'score1500',    difficulty: 'medium',
    label: 'High Scorer',
    description: 'Reach a score of 1500 in a single run.',
    stat: 'score',      goal: 1500, coinReward: 20,
  },
  {
    id: 'colorchange8', difficulty: 'medium',
    label: 'Color Veteran',
    description: 'Survive 8 color shifts in one run.',
    stat: 'colorChanges', goal: 8,  coinReward: 20,
  },
  {
    id: 'powerups10',   difficulty: 'medium',
    label: 'Power Hoarder',
    description: 'Collect 10 power-ups across all runs.',
    stat: 'powerupsThisRun', goal: 10, coinReward: 20, cumulative: true,
  },
  // ── Hard ──────────────────────────────────────────────────────
  {
    id: 'survive150',   difficulty: 'hard',
    label: 'Ironclad',
    description: 'Survive for 2 minutes 30 seconds in a single run.',
    stat: 'seconds',    goal: 150,  coinReward: 40,
  },
  {
    id: 'score3000',    difficulty: 'hard',
    label: 'Score Master',
    description: 'Reach a score of 3000 in a single run.',
    stat: 'score',      goal: 3000, coinReward: 40,
  },
  {
    id: 'panic3run',    difficulty: 'hard',
    label: 'Panic Proof',
    description: 'Survive 3 panic waves in a single run.',
    stat: 'panicWavesSurvived', goal: 3, coinReward: 40,
  },
  {
    id: 'combo15',      difficulty: 'hard',
    label: 'Combo King',
    description: 'Reach a 15× combo in a single run.',
    stat: 'maxCombo',   goal: 15,   coinReward: 40,
  },
];

// Persisted per-mission state: { [id]: { done: bool, progress: number } }
let missionState = {};

// Per-run in-memory counters (reset on startGame)
let missionRun = { seconds: 0, score: 0, colorChanges: 0, powerupsThisRun: 0, nearMissesThisRun: 0, panicWavesSurvived: 0, maxCombo: 0 };

// One-shot bonus awarded at the start of the next game after completing a mission
let pendingMissionBonus = 0;
let skinCarouselIdx = 0;       // index of the currently shown skin in the carousel
let skinCarouselAnimating = false; // true while a slide animation is in progress

function loadMissions() {
  try {
    const raw = localStorage.getItem('forbiddenColor_missions');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      MISSION_DEFS.forEach(m => {
        if (saved[m.id]) {
          missionState[m.id] = {
            done:     !!saved[m.id].done,
            claimed:  !!saved[m.id].claimed,
            progress: typeof saved[m.id].progress === 'number' ? saved[m.id].progress : 0,
          };
        }
      });
      if (typeof saved._pendingBonus === 'number') pendingMissionBonus = saved._pendingBonus;
    }
  } catch (_) {}
}

function saveMissions() {
  try {
    const out = { _pendingBonus: pendingMissionBonus };
    MISSION_DEFS.forEach(m => { out[m.id] = missionState[m.id] || { done: false, progress: 0 }; });
    localStorage.setItem('forbiddenColor_missions', JSON.stringify(out));
  } catch (_) {}
}

function getMissionProgress(m) {
  const s = missionState[m.id];
  return s ? s.progress : 0;
}

function isMissionDone(m) {
  return !!(missionState[m.id] && missionState[m.id].done);
}

function isMissionClaimed(m) {
  return !!(missionState[m.id] && missionState[m.id].claimed);
}

// Called every completed game to evaluate all missions against current run stats
function evaluateMissions() {
  let anyNewlyDone = false;
  MISSION_DEFS.forEach(m => {
    if (isMissionDone(m)) return;
    if (!missionState[m.id]) missionState[m.id] = { done: false, claimed: false, progress: 0 };
    const ms = missionState[m.id];

    if (m.cumulative) {
      ms.progress += (missionRun[m.stat] || 0);
    } else {
      ms.progress = Math.max(ms.progress, missionRun[m.stat] || 0);
    }

    if (ms.progress >= m.goal) {
      ms.done = true;
      pendingMissionBonus += 50;
      anyNewlyDone = true;
      showMissionCompleteToast(m);
    }
  });
  saveMissions();
  updateMissionUI();
  return anyNewlyDone;
}

// Brief on-screen toast shown on the home screen after game-over
function showMissionCompleteToast(m) {
  // Insert a temporary DOM element into the home screen
  const existing = document.getElementById('mission-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'mission-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.className = 'mission-toast';
  toast.innerHTML = '🎉 <strong>' + m.label + '</strong> complete!<br><small>Open Shop to claim <strong>+' + (m.coinReward || 20) + ' coins</strong></small>';
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('mission-toast-show'); }, 20);
  setTimeout(() => { toast.classList.remove('mission-toast-show'); setTimeout(() => toast.remove(), 400); }, 4500);
}

function claimMission(id) {
  const m = MISSION_DEFS.find(d => d.id === id);
  if (!m) return;
  const ms = missionState[m.id];
  if (!ms || !ms.done || ms.claimed) return;
  ms.claimed = true;
  saveMissions();
  awardCoins(m.coinReward || 20);
  updateMissionUI();
  // Flash animation on the card
  const card = document.querySelector('.mission-item[data-mission-id="' + id + '"]');
  if (card) {
    card.classList.add('mission-claim-flash');
    setTimeout(() => card.classList.remove('mission-claim-flash'), 700);
  }
}

function updateMissionUI() {
  const list = document.getElementById('missions-list');
  if (!list) return;
  list.innerHTML = '';
  MISSION_DEFS.forEach(m => {
    const done    = isMissionDone(m);
    const claimed = isMissionClaimed(m);
    const prog    = getMissionProgress(m);
    const pct     = Math.min(100, Math.round((prog / m.goal) * 100));

    const item = document.createElement('div');
    item.className = 'mission-item' +
      (done && claimed ? ' mission-done' : done ? ' mission-completed' : '');
    item.dataset.missionId = m.id;

    const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[m.difficulty] || '';
    const diffBadge = '<span class="mission-diff mission-diff-' + (m.difficulty || 'easy') + '">' + diffLabel + '</span>';
    const coinAmt   = m.coinReward || 20;
    const rewardBadge = (done && claimed) ? '' :
      '<span class="mission-reward"><span class="coin-icon coin-sm" aria-hidden="true"></span>' + coinAmt + '</span>';

    let footer;
    if (done && claimed) {
      footer = '<p class="mission-claimed-label">Claimed</p>';
    } else if (done) {
      footer = '<button class="mission-claim-btn" data-claim-id="' + m.id + '" ' +
        'aria-label="Claim ' + coinAmt + ' coins for ' + m.label + '">' +
        'Claim</button>';
    } else {
      footer = '<div class="mission-footer">' +
        '<span class="mission-progress">' + Math.min(prog, m.goal) + ' / ' + m.goal + '</span>' +
        '<div class="mission-bar-track" aria-hidden="true"><div class="mission-bar-fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    }

    item.innerHTML =
      '<div class="mission-row">' +
        '<span class="mission-label">' + m.label + '</span>' +
        '<span class="mission-meta">' + rewardBadge + diffBadge + '</span>' +
      '</div>' +
      '<p class="mission-desc">' + m.description + '</p>' +
      footer;

    list.appendChild(item);
  });

  // Wire claim buttons after DOM insertion
  list.querySelectorAll('.mission-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => claimMission(btn.dataset.claimId));
  });
}

let currentState = STATE.HOME;
let newBestThisGame = false; // tracks if a new best was set during the last game session

const ECONOMY_VERSION = 2; // increment to trigger a one-time coin balance reset
const SKIN_VERSION    = 1; // increment to trigger a one-time purchased-skins reset
let settings = {
  sound:          true,
  reducedMotion:  false,
  highContrast:   false,
  colorblind:     false,
  bestScore:      0,
  selectedSkin:   'classic',
  coins:          0,
  purchasedSkins: [],
};

let score         = 0;
let combo         = 0;
let maxCombo      = 0;
let gameStartTime = 0;
let pausedDuration  = 0; // total ms spent paused — excluded from all elapsed calculations
let pauseStartTime  = 0; // performance.now() at the moment pause began
let graceTimer    = 0;
let lastFrameTime = 0;

let obstacles     = [];
let particles     = [];
let powerups      = [];
let coinItems     = []; // collectable gold coin pickups
let floatingTexts = [];
let ringBursts    = []; // expanding ring effects for powerup pickups

// Milestone banner — one large centre-screen announcement at a time
let milestoneBanner = null; // { text, color, timer, totalTime, scale }
let _scoreMilestonesHit = new Set();
let _timeMilestonesHit  = new Set();
let _comboMilestonesHit = new Set();

const player = { x: 0, y: 0, radius: 24, baseRadius: 24, speed: 255, hasShield: false, vx: 0, vy: 0 };
let playerTrail = []; // recent positions for trail-producing skins

let spawnTimer        = 0;
let spawnRate         = 1.6;
let forbiddenTimer    = 0;
let forbiddenInterval = 3.2;
let warningActive     = false;
let nextForbiddenIdx  = -1;
let powerupTimer      = 0;
let coinItemTimer     = 0;

let difficultyBumps   = 0;
let difficultyTimer   = 0;
let speedMultiplier   = 1.0;
let forbiddenIndex    = 0;

let activePowerupKey   = null;
let activePowerupTimer = 0;
let activePowerupTotal = 0;
let playerRadiusTarget = 24; // lerp target for smooth SMALL powerup shrink/restore

let colorChangeGrace   = 0; // s remaining — brief invincibility on forbidden color change

let nearMissCooldownTimer = 0; // global cooldown (s) to prevent near-miss spam from multiple simultaneous blocks
let nearMissGlowTimer    = 0; // 0→1 — boosts player glow briefly on near miss
let coinPickupFlashTimer = 0; // 0→1 — brief gold screen pulse on coin collect

let shakeX = 0, shakeY = 0, shakeTimer = 0;

// Panic wave state
let panicCooldown  = 18;   // s until first wave (starts after grace)
let panicTimer     = 0;   // counts up during cooldown / down during wave / down during announce
let panicPhase     = 'cooldown'; // 'cooldown' | 'announce' | 'wave'
let panicDuration  = 0;   // chosen length of current wave (2–4 s)
let comboPulseTimer = 0;  // 0→1 flash on combo increase, decays over ~0.35s

// Double Danger state
let ddPhase        = 'idle';  // 'idle' | 'announce' | 'active'
let ddTimer        = 0;
let ddCooldown     = 35;      // first event ~35–53 s in
let ddDuration     = 0;
let dd2ndIndex     = -1;      // second forbidden color (-1 = none)
let ddBlockTimer   = 0;       // s remaining before DD can fire (post-panic buffer)
let panicBlockFromDD = 0;     // s remaining before panic wave can fire (post-DD buffer)

// Roaming safe-gap state — the open corridor wanders across the screen over time.
// Resets on startGame. Drives pickSafeLane() so the player must keep repositioning.
let _safeLaneDrift   = 2;   // which lane the open gap is currently biased toward
let _lastSafeLane    = -1;  // the safe lane chosen last wave — prevents same column repeat
let _wavesUntilDrift = 3;   // countdown: when 0, _safeLaneDrift shifts ±1

const PANIC_ANNOUNCE = 0.9; // s of banner before wave starts
const PANIC_COOLDOWN_BASE = 12; // s between waves
const PANIC_COOLDOWN_VAR  =  8; // randomised extra: 12–20 s gap

const DD_MIN_PLAYTIME   = 25;   // earliest Double Danger can fire (s into run)
const DD_COOLDOWN_BASE  = 30;   // s between DD events
const DD_COOLDOWN_VAR   = 18;   // randomised range: 30–48 s
const DD_ANNOUNCE       = 0.75; // warning banner duration (s)
const EVENT_POST_BUFFER = 5.0;  // buffer between any two special events (s)

const keys      = { left: false, right: false, up: false, down: false };
const touchDirs = { left: false, right: false, up: false, down: false };
let touchTarget = null; // canvas drag: {x,y} in canvas coords, or null

let canvas, ctx, rafHandle = null;

// ============================================================
// SECTION 3: SETTINGS & LOCAL STORAGE
// ============================================================

// ── Lifetime stats ───────────────────────────────────────
let gameStats = {
  totalRuns:         0,
  bestScore:         0,  // mirror of settings.bestScore for convenience
  longestSurvival:   0,  // seconds
  totalPowerups:     0,
  totalNearMisses:   0,
  totalPanicWaves:   0,
};

function loadStats() {
  try {
    const raw = localStorage.getItem('forbiddenColor_stats');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.totalRuns       === 'number') gameStats.totalRuns       = s.totalRuns;
    if (typeof s.longestSurvival === 'number') gameStats.longestSurvival = s.longestSurvival;
    if (typeof s.totalPowerups   === 'number') gameStats.totalPowerups   = s.totalPowerups;
    if (typeof s.totalNearMisses === 'number') gameStats.totalNearMisses = s.totalNearMisses;
    if (typeof s.totalPanicWaves === 'number') gameStats.totalPanicWaves = s.totalPanicWaves;
  } catch (_) {}
}

function saveStats() {
  try { localStorage.setItem('forbiddenColor_stats', JSON.stringify(gameStats)); } catch (_) {}
}

function updateStats(runSeconds) {
  gameStats.totalRuns++;
  gameStats.bestScore       = settings.bestScore; // already updated by triggerGameOver
  gameStats.longestSurvival = Math.max(gameStats.longestSurvival, runSeconds);
  gameStats.totalPowerups  += missionRun.powerupsThisRun;
  gameStats.totalNearMisses+= missionRun.nearMissesThisRun;
  gameStats.totalPanicWaves+= missionRun.panicWavesSurvived;
  saveStats();
}

function fmtTime(s) {
  if (s < 60) return s + 's';
  return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
}

function renderStatsUI() {
  const el = document.getElementById('stats-grid');
  if (!el) return;
  gameStats.bestScore = settings.bestScore; // keep in sync
  const rows = [
    { label: 'Best Score',           value: gameStats.bestScore                },
    { label: 'Total Runs',           value: gameStats.totalRuns                },
    { label: 'Longest Survival',     value: fmtTime(gameStats.longestSurvival) },
    { label: 'Power-ups Grabbed',    value: gameStats.totalPowerups            },
    { label: 'Near Misses',          value: gameStats.totalNearMisses          },
    { label: 'Panic Waves Survived', value: gameStats.totalPanicWaves          },
  ];
  el.innerHTML = rows.map(r =>
    `<div class="stat-item">
       <span class="stat-label">${r.label}</span>
       <span class="stat-value">${r.value}</span>
     </div>`
  ).join('');
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('forbiddenColor_settings');
    if (!raw) return;
    const s = JSON.parse(raw);
    if ((s.economyVersion || 0) < ECONOMY_VERSION) {
      // Economy/score reset — clear coins and best score once
      settings.economyVersion = ECONOMY_VERSION;
      settings.coins = 0;
      settings.bestScore = 0;
      saveSettings();
      return;
    }
    if ((s.skinVersion || 0) < SKIN_VERSION) {
      // Skin shop converted to coin-only — reset purchased skins once
      settings.skinVersion = SKIN_VERSION;
      settings.purchasedSkins = [];
      settings.selectedSkin = 'classic';
      saveSettings();
      return;
    }
    if (typeof s.sound         === 'boolean') settings.sound         = s.sound;
    if (typeof s.reducedMotion === 'boolean') settings.reducedMotion = s.reducedMotion;
    if (typeof s.highContrast  === 'boolean') settings.highContrast  = s.highContrast;
    if (typeof s.colorblind    === 'boolean') settings.colorblind    = s.colorblind;
    // Migrate old colorMode string format
    if (s.colorMode === 'high-contrast') settings.highContrast = true;
    if (s.colorMode === 'colorblind')    settings.colorblind   = true;
    if (typeof s.selectedSkin === 'string' && SKIN_DEFS.some(sk => sk.id === s.selectedSkin)) {
      settings.selectedSkin = s.selectedSkin;
    }
    if (typeof s.bestScore === 'number' && s.bestScore >= 0) settings.bestScore = s.bestScore;
    if (typeof s.coins === 'number' && s.coins >= 0) settings.coins = s.coins;
    if (Array.isArray(s.purchasedSkins)) {
      settings.purchasedSkins = s.purchasedSkins.filter(id => SKIN_DEFS.some(sk => sk.id === id));
    }
  } catch (_) {}
}

function saveSettings() {
  try { localStorage.setItem('forbiddenColor_settings', JSON.stringify(settings)); } catch (_) {}
}

function applyColorMode() {
  document.body.classList.toggle('mode-high-contrast', !!settings.highContrast);
  document.body.classList.toggle('mode-colorblind',    !!settings.colorblind);
  document.body.classList.toggle('reduced-motion',     !!settings.reducedMotion);
}

function applySettingsToUI() {
  const soundEl = document.getElementById('sound-toggle');
  const rmEl    = document.getElementById('reduced-motion-toggle');
  const hcEl    = document.getElementById('high-contrast-toggle');
  const cbEl    = document.getElementById('colorblind-toggle');
  const hsEl    = document.getElementById('home-highscore');
  if (soundEl) soundEl.checked = settings.sound;
  if (rmEl)    rmEl.checked    = settings.reducedMotion;
  if (hcEl)    hcEl.checked    = settings.highContrast;
  if (cbEl)    cbEl.checked    = settings.colorblind;
  if (hsEl)    hsEl.textContent = settings.bestScore;
  updateSkinsUI();
  updateCoinUI();
  applyColorMode();
}

// ============================================================
// SECTION 4: AUDIO SYSTEM (Web Audio API)
// ============================================================

const Audio = (() => {
  let _actx = null;
  function ctx_() {
    if (!_actx) {
      try { _actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_e) { return null; }
    }
    if (_actx.state === 'suspended') _actx.resume().catch(() => {});
    return _actx;
  }
  let _noiseBuf = null;
  function _noise() {
    const c = _actx; if (!c) return null;
    if (_noiseBuf) return _noiseBuf;
    const len = Math.ceil(c.sampleRate * 0.6);
    _noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return _noiseBuf;
  }

  function tone(freq, dur, type, vol) {
    if (!settings.sound) return;
    const c = ctx_(); if (!c) return;
    try {
      const osc = c.createOscillator();
      const g   = c.createGain();
      osc.connect(g); g.connect(c.destination);
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.22, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      osc.start(); osc.stop(c.currentTime + dur);
    } catch (_e) {}
  }

  return {
    init()    { ctx_(); },
    getCtx()  { return _actx; }, // shared by Music engine
    // Called on first user gesture — creates and resumes AudioContext on iOS/Android
    unlock() {
      if (_actx && _actx.state !== 'suspended') return; // already running
      ctx_(); // create if needed + call resume
    },

    // Soft pop: punchy sine blip with quick attack
    collect() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const t = c.currentTime;
      const osc = c.createOscillator(); const g = c.createGain();
      osc.connect(g); g.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(650, t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.26, t + 0.007);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      osc.start(t); osc.stop(t + 0.12);
    },

    // Quick whoosh: bandpass noise sweep
    nearMiss() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const nb = _noise(); if (!nb) return;
      const t  = c.currentTime;
      const src = c.createBufferSource(); src.buffer = nb;
      const bp  = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(3800, t);
      bp.frequency.exponentialRampToValueAtTime(700, t + 0.14);
      const g = c.createGain();
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.30, t + 0.010);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      src.start(t); src.stop(t + 0.16);
    },

    // Pulse: mid-freq thump + bright ring
    colorChange() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const t = c.currentTime;
      const osc = c.createOscillator(); const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(270, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.30, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + 0.21);
      // Bright ping on top
      const osc2 = c.createOscillator(); const g2 = c.createGain();
      osc2.type = 'sine'; osc2.frequency.value = 880;
      g2.gain.setValueAtTime(0.11, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
      osc2.connect(g2); g2.connect(c.destination);
      osc2.start(t + 0.02); osc2.stop(t + 0.21);
    },

    // Low bass impact: deep sine sweep + noise thud
    gameOver() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const t = c.currentTime;
      const osc = c.createOscillator(); const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.40);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.60, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + 0.50);
      // Low noise thud
      const nb = _noise();
      if (nb) {
        const src = c.createBufferSource(); src.buffer = nb;
        const lp  = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360;
        const gn  = c.createGain();
        src.connect(lp); lp.connect(gn); gn.connect(c.destination);
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.linearRampToValueAtTime(0.28, t + 0.005);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        src.start(t); src.stop(t + 0.25);
      }
    },

    warning()  { tone(880, .10, 'square',   .16); },
    comboUp(n) { tone(440 + n * 50, .14, 'sine', .20); },
    uiClick()  { tone(660, .06, 'sine',     .12); },
  };
})();

// ============================================================
// SECTION 4b: DYNAMIC MUSIC ENGINE
// ============================================================

const Music = (() => {
  let _actx       = null;
  let _masterGain = null;
  let _baseGain   = null;
  let _intGain    = null;
  let _isPlaying  = false;
  let _beat       = 0;
  let _nextBeat   = 0;
  let _schedTimer = null;
  let _bpm        = 130;
  let _intCurrent = 0;
  let _intTarget  = 0;

  const SCHEDULE_AHEAD = 0.14; // seconds of look-ahead
  const LOOKAHEAD_MS   = 55;   // poll interval
  const BEATS_PER_LOOP = 8;    // 2 bars of 4/4

  // Note tables
  const BASS_NOTES = [73.42, 98.00, 73.42, 110.00]; // D2 G2 D2 A2
  const STAB_NOTES = [349.23, 440.00, 523.25, 440.00]; // F4 A4 C5 A4

  function _ctx_() {
    _actx = Audio.getCtx();
    if (!_actx) return null;
    if (_actx.state === 'suspended') _actx.resume().catch(() => {});
    return _actx;
  }

  let _noiseBuf = null;
  function _noise() {
    if (_noiseBuf) return _noiseBuf;
    const len = _actx.sampleRate; // 1 s
    _noiseBuf = _actx.createBuffer(1, len, _actx.sampleRate);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return _noiseBuf;
  }

  function _ensureGraph() {
    if (_masterGain) return true;
    const c = _actx; if (!c) return false;
    _masterGain = c.createGain(); _masterGain.gain.value = 0;
    _masterGain.connect(c.destination);
    _baseGain = c.createGain(); _baseGain.gain.value = 0.60;
    _baseGain.connect(_masterGain);
    _intGain = c.createGain(); _intGain.gain.value = 0;
    _intGain.connect(_masterGain);
    return true;
  }

  // ---- Instruments ----

  function _kick(when) {
    const c = _actx;
    const osc = c.createOscillator(); const env = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, when);
    osc.frequency.exponentialRampToValueAtTime(44, when + 0.20);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.90, when + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
    osc.connect(env); env.connect(_baseGain);
    osc.start(when); osc.stop(when + 0.30);
  }

  function _snare(when) {
    const c = _actx; const nb = _noise();
    const src = c.createBufferSource(); src.buffer = nb;
    const hp  = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.42, when + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
    src.connect(hp); hp.connect(env); env.connect(_baseGain);
    src.start(when); src.stop(when + 0.16);
  }

  function _hihat(when, vol) {
    const c = _actx; const nb = _noise();
    const src = c.createBufferSource(); src.buffer = nb;
    const hp  = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(vol || 0.18, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.038);
    src.connect(hp); hp.connect(env); env.connect(_baseGain);
    src.start(when); src.stop(when + 0.045);
  }

  function _bass(when, freq, dur) {
    const c = _actx;
    const osc = c.createOscillator(); const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 290;
    const env = c.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.38, when + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(lp); lp.connect(env); env.connect(_baseGain);
    osc.start(when); osc.stop(when + dur + 0.01);
  }

  // Intensity layer instruments
  function _intHihat(when) {
    const c = _actx; const nb = _noise();
    const src = c.createBufferSource(); src.buffer = nb;
    const hp  = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 9000;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.14, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.028);
    src.connect(hp); hp.connect(env); env.connect(_intGain);
    src.start(when); src.stop(when + 0.035);
  }

  function _intStab(when, freq) {
    const c = _actx;
    const osc = c.createOscillator(); const env = c.createGain();
    osc.type = 'square'; osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.10, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
    osc.connect(env); env.connect(_intGain);
    osc.start(when); osc.stop(when + 0.09);
  }

  // ---- Scheduler ----

  function _scheduleOneBeat(when, beat) {
    const BEAT = 60 / _bpm;
    // Base pattern
    if (beat === 0 || beat === 4)   _kick(when);
    if (beat === 2 || beat === 6)   _snare(when);
    _hihat(when, beat % 2 === 0 ? 0.22 : 0.14);
    if (beat % 2 === 0) _bass(when, BASS_NOTES[beat >> 1], BEAT * 0.88);
    // Intensity layer (gated by _intGain)
    _intHihat(when + BEAT * 0.5);          // offbeat 8th hi-hat
    if (beat % 2 === 0) _intStab(when, STAB_NOTES[beat >> 1]);
  }

  function _scheduler() {
    if (!_isPlaying || !_actx) return;
    while (_nextBeat < _actx.currentTime + SCHEDULE_AHEAD) {
      _scheduleOneBeat(_nextBeat, _beat);
      _nextBeat += 60 / _bpm;
      _beat = (_beat + 1) % BEATS_PER_LOOP;
    }
    _schedTimer = setTimeout(_scheduler, LOOKAHEAD_MS);
  }

  // ---- Public API ----

  return {
    start() {
      if (!settings.sound) return;
      const c = _ctx_(); if (!c) return;
      // iOS: ensure context is running before scheduling
      if (c.state === 'suspended') {
        c.resume().then(() => this.start()).catch(() => {});
        return;
      }
      if (!_ensureGraph()) return;
      _noise(); // pre-generate noise buffer
      _isPlaying  = true;
      _beat       = 0;
      _nextBeat   = c.currentTime + 0.06;
      _intCurrent = 0;
      _intTarget  = 0;
      _intGain.gain.cancelScheduledValues(c.currentTime);
      _intGain.gain.setValueAtTime(0, c.currentTime);
      _masterGain.gain.cancelScheduledValues(c.currentTime);
      _masterGain.gain.setValueAtTime(0, c.currentTime);
      _masterGain.gain.linearRampToValueAtTime(0.50, c.currentTime + 0.30);
      _scheduler();
    },

    stop() {
      _isPlaying = false;
      clearTimeout(_schedTimer); _schedTimer = null;
      const c = _actx; if (!c || !_masterGain) return;
      _masterGain.gain.cancelScheduledValues(c.currentTime);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, c.currentTime);
      _masterGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.045);
    },

    pause() {
      _isPlaying = false;
      clearTimeout(_schedTimer); _schedTimer = null;
      const c = _actx; if (!c || !_masterGain) return;
      _masterGain.gain.cancelScheduledValues(c.currentTime);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, c.currentTime);
      _masterGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.18);
    },

    resume() {
      if (!settings.sound || _isPlaying) return;
      const c = _ctx_(); if (!c || !_masterGain) return;
      // iOS: must resume AudioContext before scheduling
      const doResume = () => {
        _isPlaying = true;
        _nextBeat  = c.currentTime + 0.06;
        _masterGain.gain.cancelScheduledValues(c.currentTime);
        _masterGain.gain.setValueAtTime(0, c.currentTime);
        _masterGain.gain.linearRampToValueAtTime(0.50, c.currentTime + 0.20);
        _scheduler();
      };
      if (c.state === 'suspended') {
        c.resume().then(doResume).catch(() => {});
      } else {
        doResume();
      }
    },

    // Called every frame from gameLoop — lerps intensity gain
    // threshold levels: combo>=3 → 0.3, combo>=5 → 0.6, panic → 1.0
    tick(dt) {
      if (!_isPlaying || !_actx || !_intGain) return;
      if (panicPhase === 'wave') {
        _intTarget = 1.0;
      } else if (combo >= 5) {
        _intTarget = 0.6;
      } else if (combo >= 3) {
        _intTarget = 0.3;
      } else {
        _intTarget = 0.0;
      }
      const rate  = dt / 0.30;
      const delta = _intTarget - _intCurrent;
      _intCurrent = Math.max(0, Math.min(1, _intCurrent + (delta > 0 ? rate : -rate)));
      _intGain.gain.setValueAtTime(_intCurrent * 0.42, _actx.currentTime);
    },

    // Directly set intensity level (0–1) — used by AudioManager
    setIntensity(level) {
      if (!_actx || !_intGain) return;
      _intTarget  = Math.max(0, Math.min(1, level));
    },

    // Called from tickDifficulty — speeds up BPM with speedMultiplier
    setTempo(multiplier) {
      // 1.0× → 130 BPM, 2.8× → 150 BPM
      _bpm = Math.round(130 + ((multiplier - 1.0) / 1.8) * 20);
      _bpm = Math.min(Math.max(_bpm, 130), 150);
    },
  };
})();

// ============================================================
// SECTION 4c: AUDIO MANAGER (central facade)
// ============================================================

const AudioManager = (() => {
  // Per-sound cooldowns (ms) to prevent spam
  const COOLDOWNS = { coin: 80, nearMiss: 200, colorChange: 150, death: 0, combo: 120 };
  const _lastPlayed = {};

  const _dispatch = {
    coin:        () => Audio.collect(),
    nearMiss:    () => Audio.nearMiss(),
    colorChange: () => Audio.colorChange(),
    death:       () => Audio.gameOver(),
    combo:       (n) => Audio.comboUp(n),
  };

  return {
    // Play a named sound with cooldown guard
    playSound(name, ...args) {
      if (!settings.sound) return;
      const fn = _dispatch[name]; if (!fn) return;
      const now   = performance.now();
      const cd    = COOLDOWNS[name] ?? 100;
      if (now - (_lastPlayed[name] || 0) < cd) return;
      _lastPlayed[name] = now;
      fn(...args);
    },

    // Set music intensity level (0–1). Called externally; Music.tick also drives it each frame.
    setMusicIntensity(level) { Music.setIntensity(level); },

    // Stop music immediately (called on death)
    stopMusic() { Music.stop(); },
  };
})();

// ============================================================
// SECTION 5: ARIA ANNOUNCER
// ============================================================

const Announce = (() => {
  let el = null;
  return {
    init() { el = document.getElementById('aria-live'); },
    say(msg) {
      if (!el) return;
      el.textContent = '';
      requestAnimationFrame(() => { el.textContent = msg; });
    },
  };
})();

// ============================================================
// SECTION 6: FOCUS TRAP
// ============================================================

function makeFocusTrap(container) {
  container.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(container.querySelectorAll(
      'button:not([disabled]),[href],input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.closest('[hidden]') && el.offsetParent !== null);
    if (focusable.length < 2) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

// ============================================================
// HOME BACKGROUND DECORATIVE BLOCKS
// ============================================================
const HomeBg = (() => {
  // Bright colours that contrast against the dark purple background
  const PALETTE = ['#c084fc','#f472b6','#67e8f9','#6ee7b7','#fde047','#fb923c','#a78bfa','#f9a8d4','#ffffff','#38bdf8'];
  const COUNT   = 30;
  let canvas = null, ctx = null, blocks = [], raf = null, running = false, lastTs = 0;

  function makeBlock(scatter) {
    const sz = 14 + Math.random() * 32;
    return {
      x:       Math.random() * (canvas.width - sz),
      y:       scatter ? Math.random() * canvas.height : -sz - Math.random() * canvas.height,
      sz,
      speed:   18 + Math.random() * 26,
      opacity: 0.22 + Math.random() * 0.18,
      color:   PALETTE[Math.floor(Math.random() * PALETTE.length)],
      r:       3 + Math.random() * 5,
    };
  }

  function tick(ts) {
    if (!running) return;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of blocks) {
      b.y += b.speed * dt;
      if (b.y > canvas.height + b.sz) Object.assign(b, makeBlock(false));
      ctx.globalAlpha  = b.opacity;
      ctx.fillStyle    = b.color;
      ctx.shadowColor  = b.color;
      ctx.shadowBlur   = 10;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.sz, b.sz, b.r);
      else               ctx.rect(b.x, b.y, b.sz, b.sz);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    raf = requestAnimationFrame(tick);
  }

  function resize() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  return {
    start() {
      if (settings.reducedMotion) return;
      if (!canvas) {
        canvas = document.getElementById('home-bg-canvas');
        ctx    = canvas.getContext('2d');
        window.addEventListener('resize', resize, { passive: true });
      }
      resize();
      if (!blocks.length) {
        for (let i = 0; i < COUNT; i++) blocks.push(makeBlock(true));
      }
      if (running) return;
      running = true;
      lastTs  = performance.now();
      raf     = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
})();

// ============================================================
// HOME SCREEN GAMEPLAY PREVIEW
// Ghost player steers between waypoints, avoids forbidden blocks.
// Rendered on #home-preview-canvas (blurred + faded via CSS).
// ============================================================
const HomePreview = (() => {
  const COLORS = ['#ef4444','#3b82f6','#22c55e','#eab308','#a855f7','#f97316','#06b6d4'];
  let pCanvas = null, pCtx = null, pRaf = null, pRunning = false, pLastTs = 0;

  // Ghost player state
  const ghost = { x: 200, y: 300, r: 22 };
  let gVx = 0, gVy = 0;
  let wpX = 0, wpY = 0, wpTimer = 0;

  // Block (obstacle) state
  let blocks     = [];   // { x, y, w, h, vy, color }
  let spawnT     = 0;

  // Forbidden color cycling
  let forbidden  = COLORS[0];
  let forbiddenT = 0;

  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    pCtx.beginPath();
    pCtx.moveTo(x + r, y);
    pCtx.lineTo(x + w - r, y);   pCtx.quadraticCurveTo(x + w, y,     x + w, y + r);
    pCtx.lineTo(x + w, y + h - r); pCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    pCtx.lineTo(x + r, y + h);   pCtx.quadraticCurveTo(x,     y + h, x,     y + h - r);
    pCtx.lineTo(x, y + r);       pCtx.quadraticCurveTo(x,     y,     x + r, y);
    pCtx.closePath();
  }

  function pickWaypoint(W, H) {
    wpX     = 60 + Math.random() * (W - 120);
    wpY     = 80 + Math.random() * (H - 160);
    wpTimer = 1.4 + Math.random() * 1.8;
  }

  function resize() {
    if (!pCanvas) return;
    pCanvas.width  = pCanvas.offsetWidth  || window.innerWidth;
    pCanvas.height = pCanvas.offsetHeight || window.innerHeight;
  }

  function tick(ts) {
    if (!pRunning) return;
    const dt = Math.min((ts - pLastTs) / 1000, 0.05);
    pLastTs = ts;
    const W = pCanvas.width, H = pCanvas.height;
    pCtx.clearRect(0, 0, W, H);

    // ── Cycle forbidden color ──────────────────────────────────
    forbiddenT -= dt;
    if (forbiddenT <= 0) {
      const cur  = COLORS.indexOf(forbidden);
      let   next = Math.floor(Math.random() * COLORS.length);
      if (next === cur) next = (next + 1) % COLORS.length;
      forbidden  = COLORS[next];
      forbiddenT = 4 + Math.random() * 3;
    }

    // ── Spawn blocks ───────────────────────────────────────────
    spawnT -= dt;
    if (spawnT <= 0) {
      const w = 24 + Math.random() * 28;
      const h = 22 + Math.random() * 26;
      blocks.push({
        x: Math.random() * (W - w),
        y: -h - 4,
        w, h,
        vy:    110 + Math.random() * 80,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
      spawnT = 0.25 + Math.random() * 0.25;
    }

    // ── Update blocks ──────────────────────────────────────────
    for (let i = blocks.length - 1; i >= 0; i--) {
      blocks[i].y += blocks[i].vy * dt;
      if (blocks[i].y > H + 20) blocks.splice(i, 1);
    }

    // ── Move ghost: steer toward waypoint, dodge forbidden ─────
    wpTimer -= dt;
    if (wpTimer <= 0) pickWaypoint(W, H);

    let avX = 0, avY = 0;
    for (const b of blocks) {
      if (b.color !== forbidden) continue;
      const bCx = b.x + b.w / 2, bCy = b.y + b.h / 2;
      const dx = ghost.x - bCx, dy = ghost.y - bCy;
      const d  = Math.hypot(dx, dy);
      if (d < 140 && d > 0) {
        const w = (140 - d) / 140;
        avX += (dx / d) * w * 2.2;
        avY += (dy / d) * w * 2.2;
      }
    }
    const toX = wpX - ghost.x, toY = wpY - ghost.y;
    const toD = Math.hypot(toX, toY) || 1;
    let dX = toX / toD + avX, dY = toY / toD + avY;
    const dLen = Math.hypot(dX, dY) || 1;
    dX /= dLen; dY /= dLen;
    gVx += (dX * 180 - gVx) * Math.min(1, dt * 5);
    gVy += (dY * 180 - gVy) * Math.min(1, dt * 5);
    ghost.x = Math.max(ghost.r, Math.min(W - ghost.r, ghost.x + gVx * dt));
    ghost.y = Math.max(ghost.r, Math.min(H - ghost.r, ghost.y + gVy * dt));

    // ── Draw blocks ────────────────────────────────────────────
    for (const b of blocks) {
      const isF = b.color === forbidden;
      pCtx.save();
      if (!isF) pCtx.globalAlpha = 0.65;
      rrect(b.x, b.y, b.w, b.h, 8);
      pCtx.fillStyle = b.color;
      if (isF) {
        const pulse = 18 + 14 * (0.5 + 0.5 * Math.sin(ts / 200));
        pCtx.shadowColor = b.color;
        pCtx.shadowBlur  = pulse;
      }
      pCtx.fill();
      pCtx.shadowBlur = 0;
      if (isF) {
        rrect(b.x, b.y, b.w, b.h, 8);
        pCtx.strokeStyle = 'rgba(255,255,255,0.90)';
        pCtx.lineWidth   = 3;
        pCtx.stroke();
      }
      pCtx.restore();
    }

    // ── Draw ghost player ──────────────────────────────────────
    const grd = pCtx.createRadialGradient(ghost.x - 5, ghost.y - 5, 2, ghost.x, ghost.y, ghost.r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(1, '#a855f7');
    pCtx.save();
    pCtx.beginPath();
    pCtx.arc(ghost.x, ghost.y, ghost.r, 0, Math.PI * 2);
    pCtx.fillStyle   = grd;
    pCtx.shadowColor = '#c084fc';
    pCtx.shadowBlur  = 20 + 7 * Math.sin(ts / 380);
    pCtx.fill();
    pCtx.shadowBlur  = 0;
    pCtx.strokeStyle = 'rgba(255,255,255,0.90)';
    pCtx.lineWidth   = 2;
    pCtx.stroke();
    pCtx.restore();

    pRaf = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (pRunning) return;
      if (settings && settings.reducedMotion) return;
      if (!pCanvas) {
        pCanvas = document.getElementById('home-preview-canvas');
        if (!pCanvas) return;
        pCtx = pCanvas.getContext('2d');
        window.addEventListener('resize', resize, { passive: true });
      }
      resize();
      ghost.x    = pCanvas.width / 2;
      ghost.y    = pCanvas.height * 0.55;
      gVx        = 0;
      gVy        = 0;
      blocks     = [];
      spawnT     = 0;
      forbidden  = COLORS[Math.floor(Math.random() * COLORS.length)];
      forbiddenT = 3;
      pickWaypoint(pCanvas.width, pCanvas.height);
      pRunning = true;
      pLastTs  = performance.now();
      pRaf     = requestAnimationFrame(tick);
    },
    stop() {
      pRunning = false;
      if (pRaf) { cancelAnimationFrame(pRaf); pRaf = null; }
      if (pCanvas && pCtx) pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    },
  };
})();

// ============================================================
// DAILY CHALLENGE SYSTEM
// One seeded challenge per calendar day. Persisted in localStorage.
// ============================================================
const DailyChallenge = (() => {
  // All possible challenge templates. Stat matches missionRun keys or 'elapsed'.
  const POOL = [
    { id: 'survive30',  label: 'Survive 30 seconds',           stat: 'elapsed',          goal: 30,  coins: 15 },
    { id: 'survive60',  label: 'Survive 60 seconds',           stat: 'elapsed',          goal: 60,  coins: 25 },
    { id: 'score300',   label: 'Reach a score of 300',         stat: 'score',            goal: 300, coins: 15 },
    { id: 'score600',   label: 'Reach a score of 600',         stat: 'score',            goal: 600, coins: 25 },
    { id: 'nearmiss2',  label: 'Land 2 near misses in one run', stat: 'nearMissesThisRun', goal: 2,  coins: 15 },
    { id: 'colorchange5', label: 'Survive 5 color shifts',   stat: 'colorChanges',     goal: 5,  coins: 20 },
    { id: 'combo8',     label: 'Reach an 8× combo',           stat: 'maxCombo',         goal: 8,  coins: 22 },
    { id: 'powerups3',  label: 'Collect 3 power-ups',         stat: 'powerupsThisRun',  goal: 3,  coins: 18 },
  ];

  const STORAGE_KEY = 'forbiddenColor_dailyChallenge';

  // Deterministic seeded pick: date string → numeric seed → index
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function seedFromKey(key) {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = Math.imul(31, h) + key.charCodeAt(i) | 0;
    }
    return Math.abs(h);
  }

  function getChallengeForDay(key) {
    return POOL[seedFromKey(key) % POOL.length];
  }

  // Seconds until next midnight (local time)
  function secsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.max(0, Math.floor((midnight - now) / 1000));
  }

  function fmtCountdown(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  let _state = null;     // { dateKey, completed, claimed, progress }
  let _ticker = null;    // setInterval handle

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) _state = JSON.parse(raw);
    } catch (_) {}
    const key = todayKey();
    // Reset if it's a new day
    if (!_state || _state.dateKey !== key) {
      _state = { dateKey: key, completed: false, claimed: false, progress: 0 };
      save();
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch (_) {}
  }

  function getChallenge() { return getChallengeForDay(_state ? _state.dateKey : todayKey()); }

  // Called from triggerGameOver with run stats
  function evaluateRun(runStats) {
    if (!_state || _state.completed) return;
    const ch   = getChallenge();
    const val  = runStats[ch.stat] || 0;
    // Track best progress across runs; single-run stats
    _state.progress = Math.max(_state.progress, val);
    if (_state.progress >= ch.goal) {
      _state.completed = true;
    }
    save();
    renderUI();
  }

  // Claim the reward — called from claim button click
  function claim() {
    if (!_state || !_state.completed || _state.claimed) return;
    _state.claimed = true;
    save();
    const ch = getChallenge();
    awardCoins(ch.coins);
    renderUI();
  }

  function renderUI() {
    const card        = document.getElementById('daily-challenge');
    const descEl      = document.getElementById('dc-desc');
    const rewardAmt   = document.getElementById('dc-reward-amt');
    const claimBtn    = document.getElementById('dc-claim-btn');
    const doneLabel   = document.getElementById('dc-done-label');
    const progressEl  = document.getElementById('dc-progress-label');
    if (!card || !descEl) return;

    const ch  = getChallenge();
    descEl.textContent    = ch.label;
    rewardAmt.textContent = ch.coins;

    if (_state.claimed) {
      card.classList.add('dc-completed');
      claimBtn.hidden    = true;
      doneLabel.hidden   = false;
      progressEl.textContent = '';
    } else if (_state.completed) {
      card.classList.remove('dc-completed');
      claimBtn.hidden  = false;
      doneLabel.hidden = true;
      progressEl.textContent = '';
    } else {
      card.classList.remove('dc-completed');
      claimBtn.hidden  = true;
      doneLabel.hidden = true;
      // Show progress if any
      progressEl.textContent = _state.progress > 0
        ? _state.progress + ' / ' + ch.goal
        : '';
    }
  }

  function startCountdown() {
    const timerEl = document.getElementById('dc-timer');
    if (!timerEl) return;
    if (_ticker) clearInterval(_ticker);
    function tick() {
      const secs = secsUntilMidnight();
      timerEl.textContent = fmtCountdown(secs) + ' left';
      timerEl.classList.toggle('dc-timer-urgent', secs < 3600);
    }
    tick();
    _ticker = setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (_ticker) { clearInterval(_ticker); _ticker = null; }
  }

  return {
    init() {
      load();
      renderUI();
      const claimBtn = document.getElementById('dc-claim-btn');
      if (claimBtn) claimBtn.addEventListener('click', () => { claim(); Audio.uiClick(); });
    },
    onRunEnd(runStats) { evaluateRun(runStats); },
    startCountdown,
    stopCountdown,
    renderUI,
  };
})();

// ============================================================
// SECTION 7: SCREEN / UI MANAGEMENT
// ============================================================

function showScreen(id) {
  document.getElementById('home-screen').hidden = (id !== 'home-screen');
  document.getElementById('game-screen').hidden = (id !== 'game-screen');

  if (id === 'home-screen') {
    const hs = document.getElementById('home-screen');
    hs.classList.remove('home-animate');
    requestAnimationFrame(() => hs.classList.add('home-animate'));
    HomeBg.start();
    HomePreview.start();
    DailyChallenge.startCountdown();
    DailyChallenge.renderUI();
    // Coin count-up visual effect
    const coinEl = document.getElementById('home-coins');
    if (coinEl && !settings.reducedMotion) {
      setTimeout(() => animateCounter(0, settings.coins, 700, coinEl), 380);
    }
  } else {
    HomeBg.stop();
    HomePreview.stop();
    DailyChallenge.stopCountdown();
  }
}

function updateHUD() {
  const sc = document.getElementById('score-display');
  const bs = document.getElementById('best-display');
  if (sc) sc.textContent = Math.floor(score);
  if (bs) bs.textContent = settings.bestScore;
}

function updateForbiddenDisplay() {
  const c      = GAME_COLORS[forbiddenIndex];
  const swatch = document.getElementById('forbidden-swatch');
  const nameEl = document.getElementById('forbidden-name');
  if (swatch) swatch.style.background = c.hex;

  const ddActive = ddPhase === 'active' || ddPhase === 'announce';
  const ddPlus   = document.getElementById('dd-plus');
  const ddSwatch = document.getElementById('dd-swatch');
  if (ddPlus)   ddPlus.hidden  = !ddActive;
  if (ddSwatch) ddSwatch.hidden = !ddActive;

  if (ddActive && dd2ndIndex >= 0) {
    if (ddSwatch) ddSwatch.style.background = GAME_COLORS[dd2ndIndex].hex;
    if (nameEl)   nameEl.textContent = c.name + ' + ' + GAME_COLORS[dd2ndIndex].name;
  } else {
    if (nameEl) nameEl.textContent = c.name;
  }
}

function showNextColorPreview(idx) {
  const c      = GAME_COLORS[idx];
  const swatch = document.getElementById('next-swatch');
  const arrow  = document.getElementById('forbidden-arrow');
  if (swatch) { swatch.style.background = c.hex; swatch.hidden = false; }
  if (arrow)  arrow.hidden = false;
}

function hideNextColorPreview() {
  const swatch = document.getElementById('next-swatch');
  const arrow  = document.getElementById('forbidden-arrow');
  if (swatch) swatch.hidden = true;
  if (arrow)  arrow.hidden  = true;
}

function setHudWarning(level) {
  // level: 0=none, 1=yellow (warn-2), 2=red (warn-1)
  const center = document.getElementById('hud-center');
  if (!center) return;
  center.classList.remove('warn-2', 'warn-1');
  if (level === 1) center.classList.add('warn-2');
  if (level === 2) center.classList.add('warn-1');
}

function updateTimerBar(elapsed, total) {
  const bar = document.getElementById('timer-bar-fill');
  if (!bar) return;
  const pct = Math.max(0, Math.min(100, (1 - elapsed / total) * 100));
  bar.style.width = pct.toFixed(1) + '%';
}

function updateComboDisplay() {
  const el  = document.getElementById('combo-display');
  const val = document.getElementById('combo-val');
  if (!el) return;
  el.hidden = (combo < 1);
  if (val) val.textContent = combo;
  // Visual tier based on combo level
  el.classList.remove('combo-t2', 'combo-t3', 'combo-t4');
  if      (combo >= 7) el.classList.add('combo-t4');
  else if (combo >= 4) el.classList.add('combo-t3');
  else if (combo >= 2) el.classList.add('combo-t2');
  // Pop animation on every increment
  el.classList.remove('combo-pop');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('combo-pop');
}

function updatePowerupDisplay() {
  const el       = document.getElementById('powerup-status');
  const iconEl   = document.getElementById('powerup-icon');
  const nameEl   = document.getElementById('powerup-name');
  const barWrap  = document.getElementById('powerup-duration-bar-wrap');
  const bar      = document.getElementById('powerup-duration-bar');
  if (!el) return;
  if (!activePowerupKey) { el.hidden = true; return; }
  el.hidden = false;
  const def = POWERUP_DEFS[activePowerupKey];
  if (iconEl) iconEl.textContent = def.icon;
  if (nameEl) nameEl.textContent = ' ' + def.label;
  if (def.duration > 0 && activePowerupTotal > 0) {
    if (barWrap) barWrap.hidden = false;
    if (bar) bar.style.width = ((activePowerupTimer / activePowerupTotal) * 100).toFixed(1) + '%';
  } else {
    if (barWrap) barWrap.hidden = true;
  }
}

function showModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.hidden = false;
  requestAnimationFrame(() => {
    const first = m.querySelector('button,[href],input,select,[tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  });
}

function hideModal(id) {
  const m = document.getElementById(id);
  if (m) m.hidden = true;
}

// ============================================================
// SKINS SYSTEM
// ============================================================

function isSkinAvailable(skin) {
  if (skin.coinCost) return settings.purchasedSkins.includes(skin.id);
  return settings.bestScore >= skin.unlock;
}

function getSkin() {
  const skin = SKIN_DEFS.find(s => s.id === settings.selectedSkin);
  if (!skin || !isSkinAvailable(skin)) return SKIN_DEFS[0];
  return skin;
}

function updateSkinsUI(direction) {
  const stage  = document.getElementById('skin-stage');
  const dotsEl = document.getElementById('skin-dots');
  if (!stage) return;

  skinCarouselIdx = ((skinCarouselIdx % SKIN_DEFS.length) + SKIN_DEFS.length) % SKIN_DEFS.length;
  const skin = SKIN_DEFS[skinCarouselIdx];

  const isCoinSkin = !!skin.coinCost;
  const available  = isSkinAvailable(skin);
  const locked     = !available;
  const selected   = settings.selectedSkin === skin.id && available;
  const canAfford  = isCoinSkin && settings.coins >= skin.coinCost;
  const coinSpan   = '<span class="coin-icon coin-sm" aria-hidden="true"></span>';

  // ── Action button ──────────────────────────────────────────
  let actionHTML = '';
  if (selected) {
    actionHTML = '<button class="btn btn-secondary sc-action" disabled type="button">Equipped</button>';
  } else if (available) {
    actionHTML = '<button class="btn btn-primary sc-action" data-action="equip" data-skin="' + skin.id + '" type="button">Equip</button>';
  } else if (isCoinSkin) {
    if (canAfford) {
      actionHTML = '<button class="btn btn-primary sc-action" data-action="buy" data-skin="' + skin.id + '" type="button">Buy &nbsp;' + coinSpan + ' ' + skin.coinCost + '</button>';
    } else {
      actionHTML = '<button class="btn btn-secondary sc-action" disabled type="button">' + coinSpan + ' ' + settings.coins + ' / ' + skin.coinCost + '</button>';
    }
  }

  // ── Progress bar for score-locked skins ───────────────────
  let progressHTML = '';
  let barHTML = '';
  if (!isCoinSkin && locked) {
    const pct = Math.min(100, Math.round((settings.bestScore / skin.unlock) * 100));
    progressHTML = '<span class="sc-progress-label">' + settings.bestScore + ' / ' + skin.unlock + ' to unlock</span>';
    barHTML = '<div class="skin-bar-track sc-bar"><div class="skin-bar-fill" style="width:' + pct + '%"></div></div>';
  }

  const cardClasses = [
    'sc-card skin-btn',
    locked     ? 'skin-locked'    : '',
    selected   ? 'skin-selected'  : '',
    isCoinSkin ? 'skin-coin-card' : '',
    (isCoinSkin && !available && !canAfford) ? 'skin-unaffordable' : '',
  ].filter(Boolean).join(' ');

  // Build new card element
  const newCard = document.createElement('div');
  newCard.className = cardClasses;
  newCard.dataset.skin   = skin.id;
  newCard.dataset.rarity = skin.rarity;
  newCard.innerHTML =
    '<span class="skin-preview" style="--skin-c1:' + skin.color1 + ';--skin-c2:' + skin.color2 + '" aria-hidden="true"></span>' +
    '<span class="skin-rarity" data-rarity="' + skin.rarity + '">' + skin.rarity + '</span>' +
    '<span class="skin-name sc-name">' + skin.name + '</span>' +
    progressHTML + barHTML + actionHTML;

  // Directional slide animation
  // Right arrow (next): current card exits LEFT, new card enters from RIGHT
  // Left  arrow (prev): current card exits RIGHT, new card enters from LEFT
  const oldCard = stage.firstElementChild;
  if (direction && oldCard && !skinCarouselAnimating) {
    skinCarouselAnimating = true;
    const prevBtn = document.getElementById('skin-prev');
    const nextBtn = document.getElementById('skin-next');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    const enterFrom = direction === 'next' ? '100%'  : '-100%';
    const exitTo    = direction === 'next' ? '-100%' : '100%';
    const DURATION  = 420; // ms — matches setTimeout below
    const EASING    = 'transform ' + DURATION + 'ms cubic-bezier(0.4,0,0.2,1)';

    // Lock stage height so it doesn't collapse while both cards are absolute
    const lockedH = oldCard.offsetHeight;
    if (lockedH > 0) stage.style.height = lockedH + 'px';

    // Both cards: absolutely stacked inside the relative stage
    [oldCard, newCard].forEach(c => {
      c.style.position   = 'absolute';
      c.style.top        = '0';
      c.style.left       = '0';
      c.style.width      = '100%';
      c.style.willChange = 'transform';
      c.style.transition = 'none';
    });
    newCard.style.transform = 'translateX(' + enterFrom + ')';
    oldCard.style.transform = 'translateX(0)';
    stage.appendChild(newCard);

    // Double rAF: first frame lets browser paint initial positions,
    // second frame starts the transition so it is always animated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        newCard.style.transition = EASING;
        oldCard.style.transition = EASING;
        newCard.style.transform  = 'translateX(0)';
        oldCard.style.transform  = 'translateX(' + exitTo + ')';

        setTimeout(() => {
          stage.innerHTML = '';
          // Strip all the inline animation styles from newCard
          newCard.style.position   = '';
          newCard.style.top        = '';
          newCard.style.left       = '';
          newCard.style.width      = '';
          newCard.style.willChange = '';
          newCard.style.transition = '';
          newCard.style.transform  = '';
          stage.style.height = '';
          stage.appendChild(newCard);
          if (prevBtn) prevBtn.disabled = false;
          if (nextBtn) nextBtn.disabled = false;
          skinCarouselAnimating = false;
        }, DURATION + 20);
      });
    });
  } else {
    stage.innerHTML = '';
    stage.appendChild(newCard);
  }

  // Wire action button
  const actionBtn = newCard.querySelector('[data-action]');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      const action = actionBtn.dataset.action;
      const skinId = actionBtn.dataset.skin;
      const sk = SKIN_DEFS.find(s => s.id === skinId);
      if (!sk) return;
      if (action === 'equip') {
        settings.selectedSkin = skinId;
        saveSettings();
        updateSkinsUI();
        Audio.uiClick();
      } else if (action === 'buy') {
        showBuyConfirm(skinId);
      }
    });
  }

  // ── Dot indicators ─────────────────────────────────────────
  if (dotsEl) {
    const RARITY_DOT = {
      common:    'rgba(255,255,255,.65)',
      rare:      'rgba(56,189,248,.85)',
      epic:      'rgba(251,191,36,.85)',
      legendary: 'rgba(168,85,247,.95)',
    };
    dotsEl.innerHTML = SKIN_DEFS.map((s, i) => {
      const active = i === skinCarouselIdx;
      const color  = RARITY_DOT[s.rarity] || 'rgba(255,255,255,.25)';
      return '<span class="sc-dot' + (active ? ' sc-dot-active' : '') +
             '" data-dot="' + i + '" tabindex="0" role="button" aria-label="' + s.name + '"' +
             (active ? ' style="--dot-c:' + color + '"' : '') + '></span>';
    }).join('');
    dotsEl.querySelectorAll('.sc-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const newIdx = +dot.dataset.dot;
        const dir = newIdx > skinCarouselIdx ? 'next' : newIdx < skinCarouselIdx ? 'prev' : null;
        skinCarouselIdx = newIdx;
        updateSkinsUI(dir);
        Audio.uiClick();
      });
      dot.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const newIdx = +dot.dataset.dot;
          const dir = newIdx > skinCarouselIdx ? 'next' : newIdx < skinCarouselIdx ? 'prev' : null;
          skinCarouselIdx = newIdx;
          updateSkinsUI(dir);
        }
      });
    });
  }
}

function updateCoinUI(animate) {
  const homeCoinEl     = document.getElementById('home-coins');
  const progressCoinEl = document.getElementById('progress-coins');
  if (homeCoinEl)     homeCoinEl.textContent     = settings.coins;
  if (progressCoinEl) progressCoinEl.textContent = settings.coins;
  if (animate && homeCoinEl) {
    const pill = homeCoinEl.closest('.home-coins');
    if (pill) {
      pill.classList.remove('coin-earn');
      void pill.offsetWidth;
      pill.classList.add('coin-earn');
      setTimeout(() => pill.classList.remove('coin-earn'), 400);
    }
  }
}

function awardCoins(amount, showFloat = false) {
  if (amount <= 0) return;
  settings.coins += amount;
  saveSettings();
  updateCoinUI(true);
  // Floating text only when explicitly requested (e.g. mission rewards shown at center)
  if (showFloat && currentState === STATE.PLAYING && player) {
    addFloating(player.x, player.y - 72, '+' + amount, '#fde047', 18);
  }
}

function awardRunCoins(finalScore, elapsedSecs) {
  const fromScore    = Math.floor(finalScore / 200);
  const fromSurvival = Math.floor(elapsedSecs / 60);
  const fromMisses   = Math.min(missionRun.nearMissesThisRun, 3);
  const fromPanic    = missionRun.panicWavesSurvived;
  const fromPowerups = Math.floor(missionRun.powerupsThisRun / 2);
  const total = fromScore + fromSurvival + fromMisses + fromPanic + fromPowerups;
  if (total > 0) awardCoins(total);
  return total;
}

let _pendingBuySkinId = null;

function showBuyConfirm(skinId) {
  const skin = SKIN_DEFS.find(s => s.id === skinId);
  if (!skin) return;
  _pendingBuySkinId = skinId;

  const overlay  = document.getElementById('skin-buy-overlay');
  const dialog   = document.getElementById('skin-buy-dialog');
  const title    = dialog.querySelector('.sbd-title');
  const balance  = dialog.querySelector('.sbd-balance');
  const noCoins  = dialog.querySelector('.sbd-nocoins');
  const shortage = dialog.querySelector('.sbd-shortage');
  const confirm  = document.getElementById('sbd-confirm');

  const canAfford = settings.coins >= skin.coinCost;
  const need      = skin.coinCost - settings.coins;

  const coinSpan = '<span class="coin-icon coin-sm" aria-hidden="true"></span>';
  title.innerHTML   = 'Unlock ' + skin.name + ' for ' + coinSpan + ' ' + skin.coinCost;
  balance.textContent = settings.coins;

  confirm.disabled = !canAfford;
  noCoins.hidden   = canAfford;
  if (!canAfford) {
    shortage.innerHTML = 'Need ' + coinSpan + ' ' + need + ' more to unlock this skin.';
  }

  dialog.dataset.state = canAfford ? 'afford' : 'broke';

  overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false');
  dialog.hidden  = false;
  (canAfford ? confirm : document.getElementById('sbd-cancel')).focus();
  Audio.uiClick();
}

function confirmBuySkin() {
  const skinId = _pendingBuySkinId;
  _pendingBuySkinId = null;
  _closeBuyDialog();
  if (!skinId) return;
  const skin = SKIN_DEFS.find(s => s.id === skinId);
  if (!skin || !skin.coinCost) return;
  if (settings.purchasedSkins.includes(skinId)) {
    settings.selectedSkin = skinId;
    saveSettings(); updateSkinsUI(); Audio.uiClick(); return;
  }
  if (settings.coins < skin.coinCost) return;
  settings.coins -= skin.coinCost;
  settings.purchasedSkins = settings.purchasedSkins.concat([skinId]);
  settings.selectedSkin   = skinId;
  saveSettings();
  updateCoinUI();
  updateSkinsUI();
  showSkinUnlockToast(skin);
  Audio.uiClick();
}

function cancelBuyConfirm() {
  _pendingBuySkinId = null;
  _closeBuyDialog();
  Audio.uiClick();
}

function _closeBuyDialog() {
  const overlay = document.getElementById('skin-buy-overlay');
  const dialog  = document.getElementById('skin-buy-dialog');
  if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
  if (dialog)  { dialog.hidden  = true; }
}

function checkSkinUnlocks(prevBest, newBest) {
  SKIN_DEFS.forEach(skin => {
    if (skin.unlock > 0 && prevBest < skin.unlock && newBest >= skin.unlock) {
      setTimeout(() => showSkinUnlockToast(skin), 1400);
    }
  });
}

function showSkinUnlockToast(skin) {
  const toast = document.getElementById('skin-unlock-toast');
  if (!toast) return;
  toast.innerHTML =
    '<span class="sut-text"><strong>' + skin.name + '</strong> unlocked</span>' +
    '<span class="sut-rarity" data-rarity="' + skin.rarity + '">' + skin.rarity + '</span>';
  toast.hidden = false;
  toast.classList.remove('sut-show');
  void toast.offsetWidth;
  toast.classList.add('sut-show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('sut-show');
    setTimeout(() => { toast.hidden = true; }, 400);
  }, 2800);
}

function drawTrail() {
  const skin = getSkin();
  if (!skin.trail || playerTrail.length < 2) return;
  const n   = playerTrail.length;
  const now = performance.now();
  playerTrail.forEach((pt, i) => {
    const t = (i + 1) / n;
    ctx.save();
    let alpha = t * 0.30;
    let radius = Math.max(2, player.radius * t * 0.58);

    if (skin.effect === 'aura') {
      // Legacy fallback halo trail
      radius = Math.max(2, player.radius * t * 0.75);
      alpha  = t * 0.22;
    } else if (skin.effect === 'galaxy') {
      // Ultra-wide misty space-dust trail
      radius = Math.max(2, player.radius * t * 0.90);
      alpha  = t * 0.16;
    } else if (skin.effect === 'void') {
      // Deep dark halo trail
      radius = Math.max(2, player.radius * t * 0.80);
      alpha  = t * 0.25;
    } else if (skin.effect === 'electric') {
      // Bright short spark segments
      alpha  = t * (0.45 + 0.30 * Math.sin(now / 60 + i * 1.5));
      radius = Math.max(1, player.radius * t * 0.35);
    } else if (skin.effect === 'inferno') {
      // Wide hot embers
      alpha  = t * (0.30 + 0.20 * Math.sin(now / 55 + i * 0.7));
      radius = Math.max(2, player.radius * t * 0.55);
    } else if (skin.effect === 'prism') {
      // Hue-shifted glow per segment
      alpha  = t * 0.32;
      radius = Math.max(2, player.radius * t * 0.50);
    } else if (skin.effect === 'flicker') {
      // Lava/Crimson: hot embers — small, bright, random flicker
      alpha  = t * (0.28 + 0.14 * Math.sin(now / 80 + i * 0.9));
      radius = Math.max(1.5, player.radius * t * 0.45);
    } else if (skin.effect === 'shimmer') {
      // Ice/Gold: icy sparkle — tapered and bright
      alpha  = t * 0.35;
      radius = Math.max(1.5, player.radius * t * 0.48);
    } else if (skin.effect === 'pulse') {
      // Neon: steady bright trail
      alpha  = t * 0.38;
    }

    const tc = skin.effect === 'prism'
      ? `hsl(${((i / n) * 180 + now / 20) % 360}, 100%, 70%)`
      : skin.glow;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fillStyle   = tc;
    ctx.shadowColor = tc;
    ctx.shadowBlur  = skin.rarity === 'legendary' ? 20 : skin.rarity === 'epic' ? 14 : skin.rarity === 'rare' ? 8 : 4;
    ctx.fill();
    ctx.restore();
  });
}

// ── Movement physics constants ───────────────────────────────────────
// Accel: reach max speed in ~6 frames @ 60 fps — responsive but not instant.
// Friction: velocity decays to ~10% in ~0.2s — snappy stop, no long slide.
const PLAYER_ACCEL   = 2200; // px/s² — how fast velocity builds
const PLAYER_FRICTION = 18;  // exponential decay factor (per-frame: 1-(1-e^-k*dt))

// ============================================================

function initPlayer() {
  player.x         = canvas.width  / 2;
  player.y         = canvas.height - 90;
  player.hasShield = false;
  player.speed     = GAME_CONFIG.playerSpeed;
  player.vx        = 0;
  player.vy        = 0;
}

function clampPlayer() {
  const r = player.radius;
  if (player.x < r)                    { player.x = r;                    player.vx = Math.abs(player.vx) * 0.25; }
  if (player.x > canvas.width  - r)   { player.x = canvas.width  - r;    player.vx = -Math.abs(player.vx) * 0.25; }
  if (player.y < r)                    { player.y = r;                    player.vy = Math.abs(player.vy) * 0.25; }
  if (player.y > canvas.height - r)   { player.y = canvas.height - r;    player.vy = -Math.abs(player.vy) * 0.25; }
}

function updatePlayer(dt) {
  // Trail — record before moving so the ghost lags visually behind the player.
  // Always record (all skins) — trail is drawn only for skins that opt-in via trail:true.
  playerTrail.push({ x: player.x, y: player.y });
  if (playerTrail.length > 14) playerTrail.shift();

  // ── Gather input direction ──────────────────────────────────────────────────
  const l = keys.left  || touchDirs.left;
  const r = keys.right || touchDirs.right;
  const u = keys.up    || touchDirs.up;
  const d = keys.down  || touchDirs.down;

  let inputX = (r ? 1 : 0) - (l ? 1 : 0);
  let inputY = (d ? 1 : 0) - (u ? 1 : 0);
  if (inputX !== 0 && inputY !== 0) { inputX *= 0.7071; inputY *= 0.7071; } // diagonal normalise

  // Canvas touch-drag: drive toward finger (overrides D-pad)
  let usingTouchDrag = false;
  if (touchTarget) {
    usingTouchDrag = true;
    const tdx  = touchTarget.x - player.x;
    const tdy  = touchTarget.y - player.y;
    const dist = Math.hypot(tdx, tdy);
    if (dist > 10) {          // 10 px dead-zone — ignore micro-jitter
      inputX = tdx / dist;
      inputY = tdy / dist;
      // Scale input 0→1 over 12–60 px so near-finger movement is gentler
      const proximity = Math.min(1, (dist - 10) / 50);
      inputX *= proximity;
      inputY *= proximity;
    } else {
      inputX = 0; inputY = 0;
    }
  }

  // ── Velocity physics ────────────────────────────────────────────────────
  const maxSpd = player.speed;
  const hasInput = inputX !== 0 || inputY !== 0;

  if (hasInput) {
    // Accelerate toward desired direction
    player.vx += inputX * PLAYER_ACCEL * dt;
    player.vy += inputY * PLAYER_ACCEL * dt;
  } else {
    // Friction decay — exponential so it always converges cleanly to zero
    const decay = Math.exp(-PLAYER_FRICTION * dt);
    player.vx *= decay;
    player.vy *= decay;
    // Dead-stop micro-velocities to avoid float drift
    if (Math.abs(player.vx) < 0.5) player.vx = 0;
    if (Math.abs(player.vy) < 0.5) player.vy = 0;
  }

  // Speed cap
  const spd = Math.hypot(player.vx, player.vy);
  if (spd > maxSpd) {
    player.vx = (player.vx / spd) * maxSpd;
    player.vy = (player.vy / spd) * maxSpd;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Smooth radius lerp — used by SMALL powerup (approx 80 px/s transition)
  if (Math.abs(player.radius - playerRadiusTarget) > 0.3) {
    player.radius += (playerRadiusTarget - player.radius) * Math.min(1, dt * 14);
  } else {
    player.radius = playerRadiusTarget;
  }

  clampPlayer();
}

function drawPlayer() {
  const skin = getSkin();
  const now  = performance.now();
  ctx.save();

  // ── Per-skin outer effect (drawn behind the player) ────────────────────
  if (skin.effect === 'aura') {
    // Void / Galaxy: pulsing coloured halo
    const pulse = 0.45 + 0.55 * Math.sin(now / 420);
    const r     = player.radius + 10 + pulse * 6;
    const ag    = ctx.createRadialGradient(player.x, player.y, player.radius, player.x, player.y, r);
    ag.addColorStop(0,   hexAlpha(skin.glow, 0.45 * pulse));
    ag.addColorStop(1,   hexAlpha(skin.glow, 0));
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fillStyle = ag;
    ctx.fill();
  } else if (skin.effect === 'flicker') {
    // Lava / Crimson: jittery ember ring
    const flick = 0.5 + 0.5 * Math.sin(now / 90 + 1.3);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 5 + flick * 4, 0, Math.PI * 2);
    ctx.strokeStyle = skin.glow;
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = 0.35 + flick * 0.35;
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur  = 12;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  } else if (skin.effect === 'shimmer') {
    // Ice / Gold: soft steady halo
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = skin.glow;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.30;
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur  = 16;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  } else if (skin.effect === 'pulse') {
    // Neon: rhythmic outer ring
    const pulse = 0.4 + 0.6 * Math.sin(now / 340);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 7 + pulse * 4, 0, Math.PI * 2);
    ctx.strokeStyle = skin.glow;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.25 + pulse * 0.35;
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur  = 10;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  } else if (skin.effect === 'electric') {
    // Double-ring flicker + occasional bright flash
    const fast  = 0.5 + 0.5 * Math.sin(now / 120);
    const flash = Math.sin(now / 400) > 0.85 ? 1 : 0;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 4 + fast * 3, 0, Math.PI * 2);
    ctx.strokeStyle = skin.glow;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.40 + fast * 0.30 + flash * 0.25;
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur  = 14 + flash * 20;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 9 + fast * 2, 0, Math.PI * 2);
    ctx.globalAlpha = 0.15 + fast * 0.15;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  } else if (skin.effect === 'inferno') {
    // Multi-layer fire flicker alternating red/orange
    const f1 = 0.5 + 0.5 * Math.sin(now / 70 + 0.5);
    const f2 = 0.5 + 0.5 * Math.sin(now / 45 + 1.8);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 5 + f1 * 5, 0, Math.PI * 2);
    ctx.strokeStyle = f1 > 0.6 ? '#fbbf24' : '#f97316';
    ctx.lineWidth   = 3;
    ctx.globalAlpha = 0.30 + f2 * 0.40;
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur  = 18;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  } else if (skin.effect === 'prism') {
    // Continuously hue-rotating outer ring
    const hue   = (now / 20) % 360;
    const pulse = 0.4 + 0.6 * Math.sin(now / 500);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 6 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `hsl(${hue}, 100%, 65%)`;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.50 + pulse * 0.30;
    ctx.shadowColor = `hsl(${hue}, 100%, 65%)`;
    ctx.shadowBlur  = 14;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  } else if (skin.effect === 'galaxy') {
    // Slow-pulse halo + 5 orbiting star particles
    const pulse = 0.45 + 0.55 * Math.sin(now / 700);
    const r     = player.radius + 12 + pulse * 7;
    const ag    = ctx.createRadialGradient(player.x, player.y, player.radius * 0.6, player.x, player.y, r);
    ag.addColorStop(0, hexAlpha(skin.glow, 0.50 * pulse));
    ag.addColorStop(1, hexAlpha(skin.glow, 0));
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fillStyle = ag;
    ctx.fill();
    for (let j = 0; j < 5; j++) {
      const angle = now / 900 + j * (Math.PI * 2 / 5);
      const orb   = player.radius + 15;
      const ox    = player.x + Math.cos(angle) * orb;
      const oy    = player.y + Math.sin(angle) * orb;
      ctx.beginPath();
      ctx.arc(ox, oy, 1.8, 0, Math.PI * 2);
      ctx.fillStyle   = skin.color1;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now / 300 + j);
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur  = 6;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }
  } else if (skin.effect === 'void') {
    // Dark inner center + strong breathing outer aura
    const pulse = 0.45 + 0.55 * Math.sin(now / 380);
    const r     = player.radius + 14 + pulse * 8;
    const ag    = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, r);
    ag.addColorStop(0,   'rgba(0,0,0,0.40)');
    ag.addColorStop(0.4, hexAlpha(skin.glow, 0.25 * pulse));
    ag.addColorStop(1,   hexAlpha(skin.glow, 0));
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fillStyle = ag;
    ctx.fill();
  }

  // ── Color-change grace ring ─────────────────────────────────────
  if (colorChangeGrace > 0) {
    const t = colorChangeGrace / 0.25;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 8 + (1 - t) * 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.globalAlpha = t * 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Small Mode ring — cyan pulsing ring shows shrunk state ────
  if (activePowerupKey === 'SMALL') {
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 7 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.55 + pulse * 0.35;
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur  = 10;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  // ── Shield ring ───────────────────────────────────────────────
  if (player.hasShield) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 200);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 10 + pulse * 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = 0.6 + pulse * 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Body ────────────────────────────────────────────────────
  // Glow intensity by rarity / effect — boosted by combo
  const comboGlowBoost = Math.min(combo * 3, 30); // up to +30px glow at combo 10
  const nearMissBoost  = nearMissGlowTimer > 0 ? 28 * nearMissGlowTimer : 0; // flare on near miss
  let shadowBlur = 20 + comboGlowBoost + nearMissBoost;
  let c1 = skin.color1, c2 = skin.color2;
  if (skin.effect === 'flicker') {
    const flick = 0.6 + 0.4 * Math.sin(now / 70 + 2.1);
    shadowBlur  = 16 + flick * 18;
    // Interpolate color toward orange at peak flicker
    c2 = flick > 0.75 ? '#f97316' : skin.color2;
  } else if (skin.effect === 'aura') {
    shadowBlur = 28 + 10 * Math.sin(now / 420);
  } else if (skin.effect === 'shimmer') {
    shadowBlur = 18 + 8 * Math.sin(now / 600);
  } else if (skin.effect === 'pulse') {
    shadowBlur = 18 + 14 * Math.sin(now / 340);
  } else if (skin.effect === 'electric') {
    shadowBlur = 20 + 20 * (0.5 + 0.5 * Math.sin(now / 180));
  } else if (skin.effect === 'inferno') {
    const fi = 0.5 + 0.5 * Math.sin(now / 65);
    shadowBlur = 22 + 16 * fi;
    c2 = fi > 0.70 ? '#fbbf24' : fi > 0.40 ? '#f97316' : skin.color2;
  } else if (skin.effect === 'prism') {
    const hue = (now / 20) % 360;
    shadowBlur = 18 + 8 * Math.sin(now / 500);
    c1 = `hsl(${hue}, 80%, 90%)`;
    c2 = `hsl(${(hue + 120) % 360}, 100%, 60%)`;
  } else if (skin.effect === 'galaxy') {
    shadowBlur = 24 + 14 * Math.sin(now / 700);
  } else if (skin.effect === 'void') {
    shadowBlur = 30 + 12 * Math.sin(now / 380);
  }

  if (skin.shape === 'star') {
    const g = ctx.createRadialGradient(player.x - 5, player.y - 5, 2, player.x, player.y, player.radius);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur  = shadowBlur;
    ctx.beginPath();
    drawStar(ctx, player.x, player.y, player.radius, player.radius * 0.44, 5);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur  = 0;
    drawPlayerInner(skin, now);
    ctx.strokeStyle = c1;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(player.x - 7, player.y - 7, 2, player.x, player.y, player.radius);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle   = g;
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur  = shadowBlur;
    ctx.fill();
    ctx.shadowBlur  = 0;
    drawPlayerInner(skin, now);
    ctx.strokeStyle = c1;
    ctx.lineWidth   = 2;
    ctx.stroke();
  }

  ctx.restore();
}

// hex color -> rgba string helper used by skin effects
function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
}

// ── Inner skin effects: rendered INSIDE the player shape via canvas clip ──
function drawPlayerInner(skin, now) {
  const pr = player.radius;
  const px = player.x, py = player.y;
  ctx.save();
  // Clip to the player shape boundary
  ctx.beginPath();
  if (skin.shape === 'star') {
    drawStar(ctx, px, py, pr - 1.5, (pr - 1.5) * 0.44, 5);
  } else {
    ctx.arc(px, py, pr - 1.0, 0, Math.PI * 2);
  }
  ctx.clip();

  if (skin.effect === 'shimmer') {
    // Sweeping highlight streak (Ice, Gold)
    const t  = (now / 2000) % 1;
    const sx = px - pr * 1.6 + t * pr * 3.2;
    const sg = ctx.createLinearGradient(sx - 10, 0, sx + 10, 0);
    sg.addColorStop(0,   'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.24)');
    sg.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

  } else if (skin.effect === 'pulse') {
    // Expanding concentric rings from center (Neon)
    for (let i = 0; i < 2; i++) {
      const phase = ((now / 900) + i * 0.5) % 1;
      const r     = phase * pr * 0.88;
      const alpha = (1 - phase) * 0.42;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(skin.glow, alpha);
      ctx.lineWidth   = 1.8;
      ctx.stroke();
    }

  } else if (skin.effect === 'flicker') {
    // Drifting magma hotspot (Lava, Crimson)
    const bx = px + Math.sin(now / 300) * pr * 0.30;
    const by = py + Math.cos(now / 250) * pr * 0.24;
    const lg = ctx.createRadialGradient(bx, by, 0, bx, by, pr * 0.90);
    lg.addColorStop(0,    'rgba(253,224,71,0.48)');
    lg.addColorStop(0.38, 'rgba(249,115,22,0.28)');
    lg.addColorStop(0.72, 'rgba(220,38,38,0.10)');
    lg.addColorStop(1,    'rgba(220,38,38,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

  } else if (skin.effect === 'electric') {
    // Radial flash + rotating spokes (Electric)
    const flash = Math.max(0, Math.sin(now / 130) - 0.45) / 0.55;
    const eg = ctx.createRadialGradient(px, py, 0, px, py, pr);
    eg.addColorStop(0,   hexAlpha('#e0f2fe', 0.14 + flash * 0.38));
    eg.addColorStop(0.5, hexAlpha('#38bdf8', 0.05 + flash * 0.12));
    eg.addColorStop(1,   'rgba(56,189,248,0)');
    ctx.fillStyle = eg;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    if (flash > 0.25) {
      for (let s = 0; s < 4; s++) {
        const a = now / 260 + s * (Math.PI * 0.5);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * pr * 0.82, py + Math.sin(a) * pr * 0.82);
        ctx.strokeStyle = hexAlpha('#e0f2fe', flash * 0.58);
        ctx.lineWidth   = 1.0;
        ctx.stroke();
      }
    }

  } else if (skin.effect === 'inferno') {
    // Orbiting hot-spot blob (Inferno)
    const fx = px + Math.sin(now / 280 + 0.5) * pr * 0.28;
    const fy = py + Math.cos(now / 210)        * pr * 0.22;
    const ig = ctx.createRadialGradient(fx, fy, 0, fx, fy, pr * 0.84);
    ig.addColorStop(0,    'rgba(254,240,138,0.52)');
    ig.addColorStop(0.33, 'rgba(249,115,22,0.32)');
    ig.addColorStop(0.68, 'rgba(220,38,38,0.12)');
    ig.addColorStop(1,    'rgba(220,38,38,0)');
    ctx.fillStyle = ig;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

  } else if (skin.effect === 'prism') {
    // Rotating rainbow linear gradient (Prism)
    const a   = now / 1100;
    const hue = (now / 15) % 360;
    const gx1 = px + Math.cos(a) * pr, gy1 = py + Math.sin(a) * pr;
    const gx2 = px - Math.cos(a) * pr, gy2 = py - Math.sin(a) * pr;
    const pg  = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
    pg.addColorStop(0,   `hsla(${hue}, 100%, 72%, 0.30)`);
    pg.addColorStop(0.5, `hsla(${(hue + 90) % 360}, 100%, 72%, 0.06)`);
    pg.addColorStop(1,   `hsla(${(hue + 180) % 360}, 100%, 72%, 0.30)`);
    ctx.fillStyle = pg;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

  } else if (skin.effect === 'void') {
    // Swirling dark vortex (Void)
    const va = now / 1400;
    const vx = px + Math.cos(va) * pr * 0.28;
    const vy = py + Math.sin(va) * pr * 0.28;
    const vg = ctx.createRadialGradient(vx, vy, 0, px, py, pr * 0.80);
    vg.addColorStop(0,    'rgba(0,0,0,0.72)');
    vg.addColorStop(0.38, 'rgba(59,7,100,0.40)');
    vg.addColorStop(0.72, 'rgba(107,33,168,0.14)');
    vg.addColorStop(1,    'rgba(107,33,168,0)');
    ctx.fillStyle = vg;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

  } else if (skin.effect === 'galaxy') {
    // Nebula glow + twinkling inner star dots (Galaxy)
    const ng = ctx.createRadialGradient(px, py, 0, px, py, pr * 0.75);
    ng.addColorStop(0,   'rgba(129,140,248,0.18)');
    ng.addColorStop(0.6, 'rgba(99,102,241,0.06)');
    ng.addColorStop(1,   'rgba(99,102,241,0)');
    ctx.fillStyle = ng;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + now / 5000;
      const dist  = (0.18 + (i % 4) * 0.16) * pr;
      const gx    = px + Math.cos(angle) * dist;
      const gy    = py + Math.sin(angle) * dist;
      const alpha = 0.38 + 0.42 * Math.sin(now / (160 + i * 65) + i * 1.3);
      ctx.beginPath();
      ctx.arc(gx, gy, 1.0, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha('#c4b5fd', alpha);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ============================================================
// SECTION 9: OBSTACLE SYSTEM
// ============================================================
// Types: 0=NORMAL (straight), 2=BIG (large+slow)

function spawnObstacle() {
  if (obstacles.length >= MAX_OBSTACLES) return;

  // Color: 60/40 forbidden/neutral post-grace, but drops to 30/70 while the warning
  // phase is active so new spawns don't pile up forbidden blocks during color transitions.
  let colorIndex;
  if (graceTimer < GRACE_PERIOD) {
    colorIndex = Math.floor(Math.random() * GAME_COLORS.length);
    if (colorIndex === forbiddenIndex) colorIndex = (colorIndex + 1) % GAME_COLORS.length;
  } else {
    const forbRatio = warningActive ? 0.30 : 0.60;
    if (Math.random() < forbRatio) {
      colorIndex = forbiddenIndex;
    } else {
      colorIndex = Math.floor(Math.random() * GAME_COLORS.length);
      if (colorIndex === forbiddenIndex) colorIndex = (colorIndex + 1) % GAME_COLORS.length;
    }
  }

  // ── Type selection ────────────────────────────────────────────────
  // 0=straight square  2=big slow hazard
  // 3=bullet (tall thin, fast)  4=dart (tiny, superfast)
  // Weights: 0→50% | 2→10% | 3→25% | 4→15%
  // Type 2 is also hard-capped at 2 on-screen; surplus becomes type 0.
  const rnd  = Math.random();
  let   type = rnd < 0.50 ? 0 : (rnd < 0.60 ? 2 : (rnd < 0.85 ? 3 : 4));
  // Cap big obstacles — if 2 already on screen, demote to type 0
  if (type === 2 && obstacles.filter(o => o.type === 2).length >= 2) type = 0;
  const base = GAME_CONFIG.baseSpeed * speedMultiplier * panicSpeedMult();

  let w, h, vy;
  switch (type) {
    case 0: w = 28 + Math.random()*16;  h = w;                         vy = base + Math.random()*80;       break;
    case 1: w = 26 + Math.random()*14;  h = w;                         vy = base*0.85 + Math.random()*50;  break;
    case 2: w = 52 + Math.random()*20;  h = 38 + Math.random()*14;     vy = base*0.60 + Math.random()*28;  break; // medium-large, not room-filling
    case 3: w = 14 + Math.random()*10;  h = 52 + Math.random()*28;     vy = base*1.55 + Math.random()*85;  break;
    case 4: w = 12 + Math.random()*8;   h = 12 + Math.random()*8;      vy = base*1.85 + Math.random()*100; break;
  }

  if (activePowerupKey === 'SLOW') vy *= 0.4;

  // Spawn position — avoid the player's current lane and safe radius.
  // Prefers lanes on the opposite side from the player for balanced pressure.
  const _spawnLanes = getLaneCenters();
  const _playerLane = getPlayerLane();
  const _laneW      = canvas.width / NUM_LANES;
  const spawnSafeR  = player.radius + 50;
  // Build a shuffled list of non-player lanes as candidates
  const _candidates = [];
  for (let _i = 0; _i < NUM_LANES; _i++) {
    if (_i !== _playerLane) _candidates.push(_i);
  }
  // Shuffle
  for (let _i = _candidates.length - 1; _i > 0; _i--) {
    const _j = Math.floor(Math.random() * (_i + 1));
    [_candidates[_i], _candidates[_j]] = [_candidates[_j], _candidates[_i]];
  }
  let ox = _spawnLanes[_candidates[0] ?? Math.floor(Math.random() * NUM_LANES)];
  for (const _ci of _candidates) {
    const _cx = _spawnLanes[_ci];
    if (Math.abs(_cx - player.x) >= spawnSafeR) { ox = _cx; break; }
  }
  // Sub-lane jitter — breaks perfect vertical-column appearance
  ox += (Math.random() - 0.5) * (_laneW * 0.45);
  // Clamp so block stays fully on screen regardless of its width
  ox = Math.max(w / 2 + 2, Math.min(canvas.width - w / 2 - 2, ox));

  const isForbiddenSpawn = graceTimer >= GRACE_PERIOD;

  // Behaviors: mutually exclusive — 13% sway on straight blocks, 9% pulse on straight/big
  const behRoll = Math.random();
  const doSway  = behRoll < 0.13 && type === 0;
  const doPulse = behRoll >= 0.13 && behRoll < 0.22 && (type === 0 || type === 2);

  obstacles.push({
    x: ox - w / 2, y: -h - 12, w, h, vy, baseVy: vy, type,
    colorIndex,
    originX: ox, nearMissIdx: -1,
    gravityPull: false,
    // Side-to-side sway (slow sine sweep — only type 0, ~13%)
    swayAmp:   doSway ? 25 + Math.random() * 22 : 0,
    swayFreq:  doSway ? 0.65 + Math.random() * 0.50 : 0,
    swayPhase: doSway ? Math.random() * Math.PI * 2 : 0,
    swayTime:  0,
    // Size pulse (smooth grow/shrink — ~9%, not fast bullet types)
    pulseAmp:   doPulse ? 0.17 : 0,
    pulseFreq:  doPulse ? 1.4 + Math.random() * 1.0 : 0,
    pulsePhase: doPulse ? Math.random() * Math.PI * 2 : 0,
    pulseTime:  0,
    baseW: w, baseH: h,
    cy: -h / 2 - 12, // tracked center-Y for pulse height scaling
  });

  // Path safety check: if the new block would leave no viable corridor at the player row,
  // remove it immediately. Cull decisions happen top-of-screen so the player never sees a pop.
  if (graceTimer >= GRACE_PERIOD && largestClearGap(player.y) < MIN_CLEAR_GAP) {
    obstacles.pop();
  }
}

// ── Lane-based wave spawner ──────────────────────────────────────────────────
// Spawns 2–4 blocks using a named lane pattern that always leaves open corridors.
// Replaces old random-X cluster patterns with a controlled, fair wave system.
function spawnWave() {
  if (obstacles.length >= MAX_OBSTACLES) return;
  const cw        = canvas.width;
  const lw        = cw / NUM_LANES;
  const lanes     = getLaneCenters();
  const base      = GAME_CONFIG.baseSpeed * speedMultiplier * panicSpeedMult();
  const slow      = activePowerupKey === 'SLOW';
  const postGrace = graceTimer >= GRACE_PERIOD;

  // Detect which lane the player is in, then choose a player-aware safe lane.
  const playerLane = getPlayerLane();
  let safeLane, blocked;
  for (let attempt = 0; attempt < 4; attempt++) {
    safeLane = pickSafeLane(playerLane);
    blocked  = pickBlockedLanes(safeLane, playerLane);
    if (!postGrace || validateEscapeRoute(lanes, blocked, lw)) break;
  }

  const beforeLen = obstacles.length;
  for (const laneIdx of blocked) {
    if (obstacles.length >= MAX_OBSTACLES) break;
    // Sub-lane X jitter — removes rigid vertical-column look
    const jitter = (Math.random() - 0.5) * lw * 0.44;
    const cx = Math.max(4, Math.min(cw - 4, lanes[laneIdx] + jitter));
    // Never spawn inside player safe radius
    if (Math.abs(cx - player.x) < player.radius + 44) continue;

    // Block size variety — mix of small darts, medium, tall bullets, wide fills, rare large
    let w, h, wType;
    const szRoll = Math.random();
    if (szRoll < 0.22) {
      w = 10 + Math.random() * 10;  h = 10 + Math.random() * 10;  wType = 4; // small/dart
    } else if (szRoll < 0.48) {
      w = 22 + Math.random() * 16;  h = 20 + Math.random() * 16;  wType = 0; // medium
    } else if (szRoll < 0.67) {
      w = 12 + Math.random() * 10;  h = 46 + Math.random() * 26;  wType = 3; // tall/bullet
    } else if (szRoll < 0.90) {
      w = Math.max(16, lw * 0.60 + Math.random() * 14);  h = 20 + Math.random() * 14;  wType = 0; // wide moderate
    } else {
      const bigCount = obstacles.filter(o => o.type === 2).length;
      if (bigCount < 2) { w = 50 + Math.random() * 18;  h = 34 + Math.random() * 12;  wType = 2; } // large hazard
      else               { w = 22 + Math.random() * 14;  h = 20 + Math.random() * 14;  wType = 0; }
    }
    const speedScale = wType === 4 ? 1.65 : (wType === 3 ? 1.35 : (wType === 2 ? 0.62 : 1.0));
    const vyR = base * speedScale + Math.random() * 70;
    const vy  = slow ? vyR * 0.4 : vyR;

    // Color: honor warning-phase fairness (30% forbidden during color transition)
    let colorIndex;
    if (!postGrace) {
      colorIndex = Math.floor(Math.random() * GAME_COLORS.length);
      if (colorIndex === forbiddenIndex) colorIndex = (colorIndex + 1) % GAME_COLORS.length;
    } else {
      const forbRatio = warningActive ? 0.30 : 0.60;
      if (Math.random() < forbRatio) {
        colorIndex = forbiddenIndex;
      } else {
        colorIndex = Math.floor(Math.random() * GAME_COLORS.length);
        if (colorIndex === forbiddenIndex) colorIndex = (colorIndex + 1) % GAME_COLORS.length;
      }
    }

    // Sway only on single-lane waves; pulse on any
    const behRoll = Math.random();
    const doSway  = behRoll < 0.10 && blocked.length === 1;
    const doPulse = behRoll >= 0.10 && behRoll < 0.18;

    obstacles.push({
      x: cx - w / 2, y: -h - 12, w, h,
      vy, baseVy: vy, type: wType,
      colorIndex,
      originX: cx, nearMissIdx: -1,
      gravityPull: false,
      swayAmp:   doSway ? 20 + Math.random() * 20 : 0,
      swayFreq:  doSway ? 0.65 + Math.random() * 0.50 : 0,
      swayPhase: doSway ? Math.random() * Math.PI * 2 : 0,
      swayTime:  0,
      pulseAmp:   doPulse ? 0.15 : 0,
      pulseFreq:  doPulse ? 1.4 + Math.random() * 0.8 : 0,
      pulsePhase: doPulse ? Math.random() * Math.PI * 2 : 0,
      pulseTime:  0,
      baseW: w, baseH: h,
      cy: -h / 2 - 12,
    });
  }

  // Final safety net: roll back entire wave if no escape remains
  if (postGrace && largestClearGap(player.y) < MIN_CLEAR_GAP) {
    obstacles.length = beforeLen;
  }
}


// Mutations removed: Speed Burst, Gravity Pull, Wall Pattern — all hurt gameplay clarity.

// ── Lane-based spawn helpers ────────────────────────────────────────────────────────────────────────

// Returns an array of NUM_LANES center-X positions evenly spanning canvas width.
function getLaneCenters() {
  const lw = canvas.width / NUM_LANES;
  return Array.from({ length: NUM_LANES }, (_, i) => lw * (i + 0.5));
}

// Returns the lane index (0 – NUM_LANES-1) that the player is currently inside.
function getPlayerLane() {
  const lw = canvas.width / NUM_LANES;
  return Math.max(0, Math.min(NUM_LANES - 1, Math.floor(player.x / lw)));
}

// Chooses a safe lane relative to the player using a 60 / 30 / 10 distribution:
//   60% → player’s own lane (reward staying still)
//   30% → adjacent lane (gentle push)
//   10% → farther lane  (skill test)
function pickSafeLane(playerLane) {
  // Advance drift countdown -- gap shifts +-1 lane every 3-5 waves
  _wavesUntilDrift--;
  if (_wavesUntilDrift <= 0) {
    _wavesUntilDrift = 3 + Math.floor(Math.random() * 3);
    _safeLaneDrift  += Math.random() < 0.5 ? 1 : -1;
    _safeLaneDrift   = Math.max(0, Math.min(NUM_LANES - 1, _safeLaneDrift));
  }

  const r = Math.random();
  let candidate;
  if (r < 0.20) {
    // Mercy: 1 step from player -- prevents permanently unreachable gap
    const adj = playerLane + (Math.random() < 0.5 ? -1 : 1);
    candidate = Math.max(0, Math.min(NUM_LANES - 1, adj));
  } else if (r < 0.60) {
    // Drift position -- player must move toward the roaming gap
    candidate = _safeLaneDrift;
  } else {
    // Drift neighborhood -- 1 step from drift position
    candidate = Math.max(0, Math.min(NUM_LANES - 1,
      _safeLaneDrift + (Math.random() < 0.5 ? -1 : 1)));
  }

  // Prevent the exact same safe lane on consecutive waves
  if (candidate === _lastSafeLane && NUM_LANES > 2) {
    const nudge = candidate < _safeLaneDrift ? 1 : -1;
    candidate = Math.max(0, Math.min(NUM_LANES - 1, candidate + nudge));
  }
  _lastSafeLane = candidate;
  return candidate;
}

// Builds the set of lane indices to BLOCK this wave.
// • safeLane is always kept open.
// • At low difficulty a neighbor of safeLane is also kept open (breathing room).
// • Blocked lanes are sorted so the player’s side fills first — directional pressure.
function pickBlockedLanes(safeLane, playerLane) {
  const b          = difficultyBumps;
  const maxBlocked = b < 2 ? 3 : (b < 5 ? 4 : NUM_LANES - 1);

  const allBlocked = [];
  for (let i = 0; i < NUM_LANES; i++) {
    if (i !== safeLane) allBlocked.push(i);
  }

  allBlocked.sort((a, bIdx) =>
    Math.abs(a - playerLane) - Math.abs(bIdx - playerLane)
  );

  return allBlocked.slice(0, maxBlocked);
}
function validateEscapeRoute(laneCenters, blockedIdxs, laneW) {
  const BAND = 80;
  for (let i = 0; i < laneCenters.length; i++) {
    if (blockedIdxs.includes(i)) continue;
    const lx = laneCenters[i] - laneW / 2;
    const rx = laneCenters[i] + laneW / 2;
    let obstructed = false;
    for (const ob of obstacles) {
      if (ob.y + ob.h < player.y - BAND) continue;
      if (ob.y        > player.y + BAND) continue;
      if (ob.x < rx && ob.x + ob.w > lx) { obstructed = true; break; }
    }
    if (!obstructed) return true;
  }
  return false;
}

// ── Horizontal path guarantee ───────────────────────────────────────────────────────────
// Scans a horizontal band [scanY ± BAND] for blocked columns.
// Returns the widest unblocked gap (px). Used to cull spawns that would trap the player.
function largestClearGap(scanY) {
  const BAND = 60; // px above/below to check
  const W    = canvas.width;
  // Build a sorted list of [left, right] coverage segments from on-screen obstacles
  const segs = [];
  for (const ob of obstacles) {
    if (ob.y + ob.h < scanY - BAND) continue; // above band
    if (ob.y       > scanY + BAND) continue;  // below band
    segs.push([ob.x, ob.x + ob.w]);
  }
  if (segs.length === 0) return W;
  segs.sort((a, b) => a[0] - b[0]);
  // Merge overlapping segments
  const merged = [segs[0].slice()];
  for (let i = 1; i < segs.length; i++) {
    const cur = merged[merged.length - 1];
    if (segs[i][0] <= cur[1]) { cur[1] = Math.max(cur[1], segs[i][1]); }
    else                      { merged.push(segs[i].slice()); }
  }
  // Find largest gap in [0, W] not covered
  let maxGap = merged[0][0]; // gap from left edge to first segment
  for (let i = 1; i < merged.length; i++) {
    maxGap = Math.max(maxGap, merged[i][0] - merged[i - 1][1]);
  }
  maxGap = Math.max(maxGap, W - merged[merged.length - 1][1]); // gap to right edge
  return maxGap;
}

function updateObstacles(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];

    // ── Y advance ─────────────────────────────────────────────────────────────
    // Pulse blocks track center-Y so height scaling stays anchored.
    if (ob.pulseAmp > 0) {
      ob.cy += ob.vy * dt;
    } else {
      ob.y += ob.vy * dt;
    }

    // ── Sway: smooth sine sweep left–right ────────────────────────────────
    if (ob.swayAmp > 0) {
      ob.swayTime += dt;
      const sx = ob.originX + Math.sin(ob.swayTime * ob.swayFreq + ob.swayPhase) * ob.swayAmp;
      ob.x = Math.max(0, Math.min(canvas.width - ob.w, sx - ob.w / 2));
    }

    // ── Pulse: smooth grow/shrink around center ─────────────────────────────
    if (ob.pulseAmp > 0) {
      ob.pulseTime += dt;
      const raw   = 1 + ob.pulseAmp * Math.sin(ob.pulseTime * ob.pulseFreq + ob.pulsePhase);
      const scale = Math.max(0.82, Math.min(1.18, raw)); // safety clamp
      ob.w = ob.baseW * scale;
      ob.h = ob.baseH * scale;
      ob.x = Math.max(0, Math.min(canvas.width - ob.w, ob.originX - ob.w / 2));
      ob.y = ob.cy - ob.h / 2;
    }

    // Near-miss: record the forbiddenIndex active at the moment of the close pass.
    // Storing the index (not a boolean) means the award at exit is independent of
    // whatever forbiddenIndex happens to be current then — prevents both false-positives
    // from color cycling and false-negatives from color changing before the obstacle exits.
    if (ob.nearMissIdx < 0 && isDangerous(ob) && ob.y > -ob.h &&
        distCircleRect(player.x, player.y, player.radius, ob.x, ob.y, ob.w, ob.h) < NEAR_MISS_DIST) {
      ob.nearMissIdx = forbiddenIndex;
    }

    if (ob.y > canvas.height + 20) {
      if (ob.nearMissIdx >= 0) awardNearMiss(ob);
      obstacles.splice(i, 1);
    }
  }
}

function drawHatchPattern(x, y, w, h, r) {
  ctx.save();
  pathRoundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.38)';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  const step = 10;
  for (let i = -(h + w); i <= h + w; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i,     y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacle(ob) {
  const isForbidden = isDangerous(ob);
  // A block is in warning state if it matches the upcoming forbidden color and we're
  // in the warning window — it is NOT dangerous yet but signals the player to dodge.
  const isWarning   = !isForbidden && warningActive && nextForbiddenIdx >= 0
                      && ob.colorIndex === nextForbiddenIdx;
  const colorDef    = GAME_COLORS[ob.colorIndex];
  const hex         = colorDef.hex;
  const symbol      = colorDef.symbol;

  ctx.save();

  if (!isForbidden && !isWarning) {
    // ── Neutral block — dim, passable, gives the field texture without threat ──
    // Sway blocks get a faint ghost offset so the player can read the sweep direction
    if (ob.swayAmp > 0) {
      const ghostOff = Math.sin((ob.swayTime - 0.18) * ob.swayFreq + ob.swayPhase) * ob.swayAmp;
      const ghostX   = Math.max(0, Math.min(canvas.width - ob.w, ob.originX + ghostOff - ob.w / 2));
      pathRoundRect(ctx, ghostX, ob.y, ob.w, ob.h, 8);
      ctx.globalAlpha = 0.10;
      ctx.fillStyle   = hex;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    pathRoundRect(ctx, ob.x, ob.y, ob.w, ob.h, 8);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle   = hex;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  pathRoundRect(ctx, ob.x, ob.y, ob.w, ob.h, 8);
  ctx.fillStyle = hex;

  if (isWarning) {
    // ── Warning block — pulsing glow, not dangerous yet ──────────────────────
    const remaining = Math.max(0, forbiddenInterval - forbiddenTimer);
    const warnProg  = Math.max(0, Math.min(1, 1 - remaining / WARNING_DURATION)); // 0→1
    const flicker   = 0.5 + 0.5 * Math.sin(Date.now() / 100); // fast flicker
    ctx.globalAlpha = 0.55 + 0.35 * warnProg;
    ctx.shadowColor = hex;
    ctx.shadowBlur  = 6 + 20 * warnProg + 8 * flicker;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    // Animated border signals imminent danger
    pathRoundRect(ctx, ob.x, ob.y, ob.w, ob.h, 8);
    ctx.strokeStyle = `rgba(255,255,255,${(0.30 + 0.55 * flicker).toFixed(2)})`;
    ctx.lineWidth   = 2;
    ctx.stroke();
  } else {
    // ── Forbidden (dangerous) block — full brightness ─────────────────────────
    const pulse = 18 + 14 * (0.5 + 0.5 * Math.sin(Date.now() / 200));
    ctx.shadowColor = hex;
    ctx.shadowBlur  = pulse;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Strong white border — danger outline readable regardless of block color
    pathRoundRect(ctx, ob.x, ob.y, ob.w, ob.h, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.90)';
    ctx.lineWidth   = 3;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur  = 6;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Symbol — only in colorblind mode
    const minDim = Math.min(ob.w, ob.h);
    if (settings.colorblind && minDim >= 20) {
      const fontSize = Math.max(10, Math.min(14, minDim * 0.38));
      ctx.font         = `bold ${fontSize}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = 'rgba(255,255,255,0.82)';
      ctx.shadowColor  = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur   = 3;
      ctx.fillText(symbol, ob.x + ob.w / 2, ob.y + ob.h / 2);
      ctx.shadowBlur   = 0;
    }
    // Hatch overlay in colorblind mode
    if (settings.colorblind) drawHatchPattern(ob.x, ob.y, ob.w, ob.h, 8);
  }

  ctx.restore();
}

// ============================================================
// SECTION 10b: COIN PICKUP SYSTEM
// ============================================================

function spawnCoinItem() {
  const sz = 26; // larger — clearly visible on screen
  coinItems.push({
    x: sz + Math.random() * (canvas.width - sz * 2),
    y: -sz - 12,
    size: sz,
    vy: 95 + Math.random() * 30, // slightly slower so player has time to react
    value: 1 + Math.floor(Math.random() * 2), // 1–2 coins
  });
}

function updateCoinItems(dt) {
  for (let i = coinItems.length - 1; i >= 0; i--) {
    const c = coinItems[i];
    c.y += c.vy * dt;
    const dx   = player.x - c.x;
    const dy   = player.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < player.radius + c.size / 2 + 8) {
      AudioManager.playSound('coin');
      awardCoins(c.value);
      // Floating text at coin position (not player) for clear attribution
      addFloating(c.x, c.y - 20, '+' + c.value, '#fde047', 20, true);
      coinPickupFlashTimer = 1; // brief gold screen pulse
      // Ring burst for satisfying pickup feel
      ringBursts.push({ x: c.x, y: c.y, r: c.size * 0.4, maxR: c.size * 3.5, color: '#fbbf24', alpha: 0.9, speed: 200 });
      ringBursts.push({ x: c.x, y: c.y, r: 0,            maxR: c.size * 2.2, color: '#fff',    alpha: 0.5, speed: 280 });
      spawnParticles(c.x, c.y, '#fde047', settings.reducedMotion ? 5 : 14);
      coinItems.splice(i, 1);
      continue;
    }
    if (c.y > canvas.height + 20) coinItems.splice(i, 1);
  }
}

function drawCoinItem(c) {
  const r     = c.size / 2;
  const t     = performance.now();
  // Two-phase pulse: gentle breathing (slow) + shimmer spike (fast)
  const pulse = 0.88 + 0.12 * Math.sin(t / 500 + c.x)
              + 0.06 * Math.sin(t / 90  + c.x * 0.7);

  ctx.save();

  // Outer halo — large, bright, unmissable
  const haloR = r * 2.2;
  const halo  = ctx.createRadialGradient(c.x, c.y, r * 0.8, c.x, c.y, haloR);
  halo.addColorStop(0,   'rgba(253,224,71,0.40)');
  halo.addColorStop(0.5, 'rgba(251,191,36,0.18)');
  halo.addColorStop(1,   'rgba(251,191,36,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(c.x, c.y, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Glow shadow
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur  = 22 + 10 * Math.sin(t / 500 + c.x); // breathes

  // Coin disc — brighter, high-saturation gold
  const g = ctx.createRadialGradient(
    c.x - r * 0.38, c.y - r * 0.32, 0,
    c.x,             c.y,            r * pulse
  );
  g.addColorStop(0,    '#fffde7');
  g.addColorStop(0.18, '#fef08a');
  g.addColorStop(0.45, '#facc15');
  g.addColorStop(0.78, '#d97706');
  g.addColorStop(1,    '#92400e');
  ctx.beginPath();
  ctx.arc(c.x, c.y, r * pulse, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.shadowBlur = 0;

  // Bright inner highlight ring
  ctx.beginPath();
  ctx.arc(c.x, c.y, r * 0.60, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.50)';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Shine flare — small bright arc top-left
  ctx.beginPath();
  ctx.arc(c.x - r * 0.22, c.y - r * 0.26, r * 0.28, 0.8, 2.1);
  ctx.strokeStyle = 'rgba(255,255,255,0.70)';
  ctx.lineWidth   = 2;
  ctx.stroke();

  ctx.restore();
}

// ============================================================
// SECTION 10: POWER-UP SYSTEM
// ============================================================

function spawnPowerup() {
  const key = POWERUP_KEYS[Math.floor(Math.random() * POWERUP_KEYS.length)];
  const def = POWERUP_DEFS[key];
  const sz  = 42;
  powerups.push({
    x: sz / 2 + Math.random() * (canvas.width - sz), y: -sz - 12,
    size: sz, vy: 80, angle: 0,
    key, icon: def.icon, color: def.color, label: def.label,
  });
}

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y    += p.vy * dt;
    p.angle += dt * 1.9;
    const dx = player.x - p.x;
    const dy = player.y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) < player.radius + p.size / 2 + 4) {
      collectPowerup(p);
      powerups.splice(i, 1);
      continue;
    }
    if (p.y > canvas.height + 20) powerups.splice(i, 1);
  }
}

function collectPowerup(p) {
  missionRun.powerupsThisRun++;  // mission tracking
  AudioManager.playSound('coin');
  Announce.say(p.label + ' activated.');
  spawnParticles(p.x, p.y, p.color, 14);
  // Expanding ring burst — two rings at slightly different speeds
  if (!settings.reducedMotion) {
    ringBursts.push({ x: p.x, y: p.y, r: p.size * 0.5, maxR: p.size * 2.8, color: p.color, alpha: 0.9, speed: 160 });
    ringBursts.push({ x: p.x, y: p.y, r: p.size * 0.3, maxR: p.size * 2.2, color: '#fff',   alpha: 0.5, speed: 220 });
  }
  if (navigator.vibrate) navigator.vibrate([30, 20, 30]);

  addScore(POWERUP_COLLECT_BONUS);
  addFloating(p.x, p.y - 38, p.label + '  +' + POWERUP_COLLECT_BONUS, p.color, 18);

  switch (p.key) {
    case 'SMALL':
      playerRadiusTarget = Math.round(player.baseRadius * 0.58); // ~14 px
      activePowerupKey   = 'SMALL';
      activePowerupTimer = POWERUP_DEFS.SMALL.duration;
      activePowerupTotal = POWERUP_DEFS.SMALL.duration;
      break;
    case 'SHIELD':
      player.hasShield   = true;
      activePowerupKey   = 'SHIELD';
      activePowerupTimer = POWERUP_DEFS.SHIELD.duration;
      activePowerupTotal = POWERUP_DEFS.SHIELD.duration;
      break;
    case 'SLOW':
      activePowerupKey   = 'SLOW';
      activePowerupTimer = POWERUP_DEFS.SLOW.duration;
      activePowerupTotal = POWERUP_DEFS.SLOW.duration;
      obstacles.forEach(o => { o.vy = o.baseVy * 0.4; });
      break;
    case 'CLEAR':
      obstacles = obstacles.filter(o => o.colorIndex !== forbiddenIndex);
      break;
    case 'BOOST':
      activePowerupKey   = 'BOOST';
      activePowerupTimer = POWERUP_DEFS.BOOST.duration;
      activePowerupTotal = POWERUP_DEFS.BOOST.duration;
      break;
  }
  updatePowerupDisplay();
}

function tickActivePowerup(dt) {
  if (!activePowerupKey) return;
  const def = POWERUP_DEFS[activePowerupKey];
  if (def.duration === 0) return;
  activePowerupTimer -= dt;
  if (activePowerupTimer <= 0) {
    if (activePowerupKey === 'SLOW')   obstacles.forEach(o => { o.vy = o.baseVy; });
    if (activePowerupKey === 'SHIELD') { player.hasShield = false; Announce.say('Shield expired.'); }
    if (activePowerupKey === 'SMALL')  { playerRadiusTarget = player.baseRadius; Announce.say('Small Mode ended.'); }
    else                               { Announce.say('Power-up expired.'); }
    activePowerupKey = null;
    updatePowerupDisplay();
  } else {
    updatePowerupDisplay();
  }
}

function drawPowerup(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.shadowColor = p.color;
  ctx.shadowBlur  = 24;
  ctx.beginPath();
  drawStar(ctx, 0, 0, p.size / 2, p.size / 3.4, 5);
  ctx.fillStyle   = p.color;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.rotate(-p.angle);
  ctx.font         = (p.size * 0.42) + 'px serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = '#fff';
  ctx.fillText(p.icon, 0, 1);
  ctx.restore();
}

// ============================================================
// SECTION 11: PARTICLE SYSTEM
// ============================================================

function spawnParticles(x, y, color, count) {
  const n = settings.reducedMotion ? Math.max(2, Math.ceil((count || 8) * 0.35)) : (count || 8);
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.9;
    const spd = 60 + Math.random() * 110;
    particles.push({
      x, y, color,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      size: 3 + Math.random() * 4.5,
      life: 1, decay: 1.2 + Math.random() * 0.7,
    });
  }
}

function tickParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vy   += 100 * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  });
}

// ============================================================
// SECTION 12: FLOATING TEXT
// ============================================================

// ── Centre-screen milestone banner ────────────────────────────
const SCORE_MILESTONES = [500, 1000, 2000, 3500, 5000, 7500, 10000];
const TIME_MILESTONES  = [30, 60, 120, 180];   // seconds into run
const COMBO_MILESTONES = [5, 10, 20, 30];      // combo count

function triggerMilestone(text, color) {
  milestoneBanner = {
    text,
    color: color || '#facc15',
    timer: 0,
    totalTime: 1.9,
    scale: 1,
  };
  // Gentle shake for tactile emphasis
  triggerShake(4, 0.22);
  if (navigator.vibrate) navigator.vibrate(40);
}

function tickMilestoneBanner(dt) {
  if (!milestoneBanner) return;
  milestoneBanner.timer += dt;
  const t = milestoneBanner.timer;
  const T = milestoneBanner.totalTime;
  if (t >= T) { milestoneBanner = null; return; }

  // Scale: pop to 1.35 in first 0.12 s, settle to 1.0 by 0.35 s, hold, then no change
  if (t < 0.12)       milestoneBanner.scale = 1 + (t / 0.12) * 0.35;
  else if (t < 0.35)  milestoneBanner.scale = 1.35 - ((t - 0.12) / 0.23) * 0.35;
  else                milestoneBanner.scale = 1.0;
}

function drawMilestoneBanner() {
  if (!milestoneBanner) return;
  const m  = milestoneBanner;
  const t  = m.timer;
  const T  = m.totalTime;
  // fade-in over 0.12 s, hold, fade-out in last 0.45 s
  let alpha;
  if (t < 0.12)          alpha = t / 0.12;
  else if (t > T - 0.45) alpha = (T - t) / 0.45;
  else                   alpha = 1;

  const cx = canvas.width  / 2;
  const cy = canvas.height * 0.36;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(cx, cy);
  ctx.scale(m.scale, m.scale);

  // Glow halo
  ctx.shadowColor = m.color;
  ctx.shadowBlur  = 28;

  // Bold text
  ctx.font         = 'bold 38px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Subtle dark backing stroke for readability
  ctx.lineWidth    = 5;
  ctx.strokeStyle  = 'rgba(0,0,0,0.65)';
  ctx.strokeText(m.text, 0, 0);

  ctx.fillStyle = m.color;
  ctx.fillText(m.text, 0, 0);

  ctx.restore();
}

function addFloating(x, y, text, color, size, coinIcon) {
  floatingTexts.push({ x, y, text, color: color || '#facc15', alpha: 1, vy: -50, timer: 1.5, size: size || 15, scale: 1.4, coinIcon: !!coinIcon });
}

function tickFloating(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y    += t.vy * dt;
    t.timer -= dt;
    t.alpha  = Math.max(0, t.timer / 1.5);
    // scale pops in on spawn then settles to 1
    t.scale  = 1 + Math.max(0, (t.timer - 1.3) / 0.2) * 0.4;
    if (t.timer <= 0) floatingTexts.splice(i, 1);
  }
}

function drawFloating() {
  floatingTexts.forEach(t => {
    ctx.save();
    ctx.globalAlpha  = t.alpha;
    ctx.font         = `bold ${t.size}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = t.color;
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 6;
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);
    if (t.coinIcon) {
      // Draw inline coin circle + text
      const r   = Math.round(t.size * 0.52);
      const gap = 5;
      const tw  = ctx.measureText(t.text).width;
      const totalW = r * 2 + gap + tw;
      const startX = -totalW / 2;
      const cx = startX + r;
      // Coin radial gradient matching the CSS .coin-icon
      const grad = ctx.createRadialGradient(cx - r * 0.18, -r * 0.22, r * 0.1, cx, 0, r);
      grad.addColorStop(0,    '#fef9c3');
      grad.addColorStop(0.22, '#fde047');
      grad.addColorStop(0.55, '#eab308');
      grad.addColorStop(0.88, '#a16207');
      grad.addColorStop(1,    '#78350f');
      ctx.beginPath();
      ctx.arc(cx, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // Glow
      ctx.shadowColor = 'rgba(251,191,36,0.8)';
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(cx, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, 0, r - 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      // Text
      ctx.fillStyle  = t.color;
      ctx.textAlign  = 'left';
      ctx.fillText(t.text, startX + r * 2 + gap, 0);
    } else {
      ctx.fillText(t.text, 0, 0);
    }
    ctx.restore();
  });
}

// ============================================================
// SECTION 13: FORBIDDEN COLOR SYSTEM
// ============================================================

function pickNextForbidden() {
  let next = forbiddenIndex;
  while (next === forbiddenIndex) next = Math.floor(Math.random() * GAME_COLORS.length);
  return next;
}

// After a color change the new forbidden color may be underrepresented.
// Recolor a few upper-screen safe obstacles to restore the ratio.
function rebalanceAfterColorChange() {
  if (graceTimer < GRACE_PERIOD) return;
  const total = obstacles.length;
  if (total < 4) return;
  const nForbidden = obstacles.filter(o => o.colorIndex === forbiddenIndex).length;
  if (nForbidden / total >= FORBIDDEN_MIN_RATIO) return;

  const target  = Math.ceil(total * FORBIDDEN_MIN_RATIO);
  const deficit = Math.min(target - nForbidden, 4); // cap at 4 per change — stay fair

  // Only recolor obstacles in the upper 45 % of the canvas (far from the player).
  // Sort topmost-first so the most distant ones change first.
  const candidates = obstacles
    .filter(o => o.colorIndex !== forbiddenIndex && o.y < canvas.height * 0.45)
    .sort((a, b) => a.y - b.y);

  const count = Math.min(deficit, candidates.length);
  const newColor = GAME_COLORS[forbiddenIndex];
  for (let i = 0; i < count; i++) {
    candidates[i].colorIndex  = forbiddenIndex;
    candidates[i].nearMissIdx = -1; // reset stale near-miss tracking
  }
}

function changeForbiddenColor() {
  missionRun.colorChanges++;  // mission tracking
  // Use pre-computed next index, or pick one if not set
  forbiddenIndex = nextForbiddenIdx >= 0 ? nextForbiddenIdx : pickNextForbidden();
  nextForbiddenIdx = -1;
  // If Double Danger is active and second color now matches the new primary, re-pick
  if (ddPhase === 'active' && dd2ndIndex === forbiddenIndex) dd2ndIndex = pickDD2ndIndex();

  combo++;
  if (combo > maxCombo) maxCombo = combo;
  const bonus = combo * COMBO_BONUS_PER;
  addScore(bonus, false);
  if (combo > 1) {
    addFloating(player.x, player.y - 65, 'x' + combo + '  +' + bonus, '#f59e0b');
    AudioManager.playSound('combo', combo);
    comboPulseTimer = 1; // trigger screen pulse
  } else {
    addFloating(player.x, player.y - 65, '+' + bonus, '#f59e0b');
  }

  // Combo milestones
  for (const threshold of COMBO_MILESTONES) {
    if (combo >= threshold && !_comboMilestonesHit.has(threshold)) {
      _comboMilestonesHit.add(threshold);
      triggerMilestone('x' + threshold + ' COMBO', '#f97316');
    }
  }
  updateComboDisplay();

  forbiddenTimer = 0;
  warningActive  = false;
  hideNextColorPreview();
  setHudWarning(0);
  updateTimerBar(0, forbiddenInterval);
  updateForbiddenDisplay();
  colorChangeGrace = 0.25; // 0.25 s invincibility window on color change
  // rebalanceAfterColorChange() disabled — blocks keep their spawn color
  AudioManager.playSound('colorChange');
  flashForbiddenBorder(GAME_COLORS[forbiddenIndex].hex);
  Announce.say('Forbidden color is now ' + GAME_COLORS[forbiddenIndex].name + '!');
}

function tickForbiddenTimer(dt) {
  forbiddenTimer += dt;
  const remaining = Math.max(0, forbiddenInterval - forbiddenTimer);

  // Update countdown bar
  updateTimerBar(forbiddenTimer, forbiddenInterval);

  // Start warning phase
  if (!warningActive && remaining <= WARNING_DURATION) {
    warningActive    = true;
    nextForbiddenIdx = pickNextForbidden();
    showNextColorPreview(nextForbiddenIdx);
    Audio.warning();
    Announce.say('Warning: forbidden color changing to ' + GAME_COLORS[nextForbiddenIdx].name + ' — get ready!');
  }

  // Update HUD warning level (compressed 0.8 s window)
  if (warningActive) {
    if (remaining <= 0.3) setHudWarning(2);
    else                  setHudWarning(1);
  }

  if (forbiddenTimer >= forbiddenInterval) changeForbiddenColor();
}

// ============================================================
// SECTION 14: COLLISION DETECTION
// ============================================================

// Single source of truth: an obstacle is dangerous iff its colorIndex matches
// the current forbiddenIndex. Used by rendering, collision, and near-miss.
function isDangerous(ob) {
  if (ob.colorIndex === forbiddenIndex) return true;
  if (ddPhase === 'active' && ob.colorIndex === dd2ndIndex) return true;
  return false;
}

function distCircleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  return Math.sqrt((cx - nx) ** 2 + (cy - ny) ** 2);
}

function checkCollisions() {
  if (colorChangeGrace > 0) return; // brief invincibility after a color change
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    if (distCircleRect(player.x, player.y, player.radius, ob.x, ob.y, ob.w, ob.h) >= player.radius) continue;
    if (!isDangerous(ob)) continue; // safe color — re-checked against current forbiddenIndex

    if (player.hasShield) {
      player.hasShield = false;
      if (activePowerupKey === 'SHIELD') { activePowerupKey = null; updatePowerupDisplay(); }
      obstacles.splice(i, 1);
      spawnParticles(ob.x + ob.w / 2, ob.y + ob.h / 2, GAME_COLORS[ob.colorIndex].hex, 16);
      addFloating(player.x, player.y - 55, 'Blocked', '#facc15');
      triggerShake(6, 0.22);
      if (navigator.vibrate) navigator.vibrate(50);
      Announce.say('Shield absorbed a hit.');
    } else {
      triggerGameOver();
      return;
    }
  }
}

// ============================================================
// SECTION 15: SCORING
// ============================================================

function addScore(pts, useBoost) {
  const mult = (useBoost !== false && activePowerupKey === 'BOOST') ? 2 : 1;
  score += pts * mult;
  // Throttle DOM update — only every ~100ms to avoid layout thrash
}

let _lastHudUpdate = 0;
function maybeUpdateHud(ts) {
  if (ts - _lastHudUpdate > 100) { updateHUD(); _lastHudUpdate = ts; }
}

function tickScoreOverTime(dt) {
  // ~5 pts/s base; combo gently scales it up (combo 10 → ~7.5 pts/s)
  const rate = 5 * (1 + combo * 0.05);
  addScore(rate * dt);

  // Score milestones
  const s = Math.floor(score);
  for (const threshold of SCORE_MILESTONES) {
    if (s >= threshold && !_scoreMilestonesHit.has(threshold)) {
      _scoreMilestonesHit.add(threshold);
      const label = threshold >= 1000 ? (threshold / 1000) + 'K' : String(threshold);
      triggerMilestone(label, '#fbbf24');
    }
  }
  // Beyond fixed list: every 5000 above 10000
  if (s >= 10000) {
    const extraStep = Math.floor(s / 5000) * 5000;
    if (!_scoreMilestonesHit.has(extraStep)) {
      _scoreMilestonesHit.add(extraStep);
      triggerMilestone((extraStep / 1000) + 'K', '#fbbf24');
    }
  }
}

function awardNearMiss(ob) {
  if (nearMissCooldownTimer > 0) return; // global spam guard — 300 ms between near misses
  nearMissCooldownTimer = 0.30;
  nearMissGlowTimer     = 1; // flash player glow bright
  AudioManager.playSound('nearMiss');
  missionRun.nearMissesThisRun++;
  // Larger, distinct text — snaps attention without cluttering
  addFloating(ob.x + ob.w / 2, ob.y - 18, 'CLOSE CALL  +' + NEAR_MISS_BONUS, '#34d399', 19);
  // Small particle burst at the miss point
  spawnParticles(ob.x + ob.w / 2, ob.y + ob.h / 2, '#34d399', settings.reducedMotion ? 4 : 10);
  // Gentle shake — confirms the danger without being disorienting
  triggerShake(3.5, 0.18);
  addScore(NEAR_MISS_BONUS);
  if (navigator.vibrate) navigator.vibrate(25);
}

// ============================================================
// SECTION 16: DIFFICULTY SCALING
// ============================================================

// ── Panic wave ──────────────────────────────────────────────
// Lifecycle: cooldown → announce (banner shown) → wave (doubled spawn rate)
// The active spawn rate is read via panicSpawnRate() below.
// No state is permanently altered; everything resets after each wave.
function panicSpawnRate() {
  return panicPhase === 'wave' ? spawnRate * 0.42 : spawnRate; // ~2.4× faster during wave
}
function panicSpeedMult() {
  return panicPhase === 'wave' ? 1.25 : 1.0; // 25 % faster obstacle velocity during wave
}
function activeForbiddenRatio() {
  return panicPhase === 'wave' ? 0.62 : FORBIDDEN_MIN_RATIO; // more dangerous blocks during wave
}

function tickPanicWave(dt) {
  if (graceTimer < GRACE_PERIOD + 2) return; // never fire in first 3 s
  if (panicBlockFromDD > 0) { panicBlockFromDD -= dt; } // count down post-DD buffer

  if (panicPhase === 'cooldown') {
    // Block while Double Danger is active, announcing, or in its post-event buffer
    if (ddPhase !== 'idle' || panicBlockFromDD > 0) return;
    panicTimer += dt;
    if (panicTimer >= panicCooldown) {
      panicTimer    = 0;
      panicPhase    = 'announce';
      panicDuration = 2.0 + Math.random() * 2.0; // 2–4 s
      triggerShake(6, 0.3);
      // Red entrance flash via CSS overlay
      const _panicFlash = document.getElementById('color-flash-overlay');
      if (_panicFlash && !settings.reducedMotion) {
        _panicFlash.style.setProperty('--flash-color', '#ff1111');
        _panicFlash.classList.remove('flash-active');
        void _panicFlash.offsetWidth;
        _panicFlash.classList.add('flash-active');
      }
    }

  } else if (panicPhase === 'announce') {
    panicTimer += dt;
    if (panicTimer >= PANIC_ANNOUNCE) {
      panicTimer = 0;
      panicPhase = 'wave';
      Announce.say('Surge active. Obstacles are faster.');
    }

  } else if (panicPhase === 'wave') {
    panicTimer += dt;
    if (panicTimer >= panicDuration) {
      panicTimer    = 0;
      panicPhase    = 'cooldown';
      panicCooldown = PANIC_COOLDOWN_BASE + Math.random() * PANIC_COOLDOWN_VAR;
      ddBlockTimer  = EVENT_POST_BUFFER; // prevent DD for 5 s after a panic wave
      missionRun.panicWavesSurvived++; // stats tracking
    }
  }
}

function drawPanicBanner() {
  if (panicPhase !== 'announce' && panicPhase !== 'wave') return;

  const isWave      = panicPhase === 'wave';
  const progress    = isWave ? 1 - panicTimer / panicDuration : panicTimer / PANIC_ANNOUNCE;
  // Fade in during announce, fade out in last 0.3 s of wave
  let alpha;
  if (!isWave) {
    alpha = Math.min(1, progress * 3);                        // quick fade-in
  } else {
    const fadeStart = Math.max(0, panicDuration - 0.3);
    alpha = panicTimer >= fadeStart
      ? 1 - (panicTimer - fadeStart) / 0.3
      : 1;
  }

  const cx  = canvas.width / 2;
  const cy  = canvas.height * 0.28;
  const pul = 1 + Math.sin(Date.now() / 80) * (isWave ? 0.04 : 0.01); // subtle pulse during wave

  // Subtle red screen tint — wave only, soft fade-in/out matching banner alpha
  if (isWave) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.10;
    ctx.fillStyle = '#ff1111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha * 0.92;

  // Dark backing pill
  const tw  = 200;
  const th  = 38;
  ctx.fillStyle = 'rgba(20,0,0,0.68)';
  ctx.beginPath();
  ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, 8);
  ctx.fill();

  // Bold label
  ctx.font         = `bold ${Math.round(20 * pul)}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = isWave ? '#ff3333' : '#ff8800';
  ctx.shadowColor  = isWave ? '#ff0000' : '#ff6600';
  ctx.shadowBlur   = isWave ? 18 : 8;
  ctx.fillText(isWave ? 'PANIC WAVE' : 'PANIC INCOMING', cx, cy);

  ctx.restore();
}

// ── Double Danger ───────────────────────────────────────────────────────────
// Rare event: two colors become lethal simultaneously for 2–4 s.
// Cannot overlap with a Panic Wave; both directions get a 5 s post-event buffer.
function pickDD2ndIndex() {
  let idx, attempts = 0;
  do {
    idx = Math.floor(Math.random() * GAME_COLORS.length);
    attempts++;
  } while (idx === forbiddenIndex && attempts < 20);
  return idx;
}

function tickDoubleDanger(dt) {
  if (ddBlockTimer > 0) { ddBlockTimer -= dt; } // count down post-panic buffer
  // Not enough play time yet
  if (graceTimer < GRACE_PERIOD + DD_MIN_PLAYTIME) return;
  // Never overlap with a Panic Wave
  if (panicPhase !== 'cooldown') return;

  if (ddPhase === 'idle') {
    ddTimer += dt;
    if (ddTimer >= ddCooldown && ddBlockTimer <= 0) {
      ddTimer    = 0;
      ddPhase    = 'announce';
      dd2ndIndex = pickDD2ndIndex();
      updateForbiddenDisplay();
      triggerShake(5, 0.25);
    }

  } else if (ddPhase === 'announce') {
    ddTimer += dt;
    if (ddTimer >= DD_ANNOUNCE) {
      ddTimer    = 0;
      ddPhase    = 'active';
      ddDuration = 2.0 + Math.random() * 2.0; // 2–4 s
      Announce.say('Double Danger. Avoid ' + GAME_COLORS[forbiddenIndex].name + ' and ' + GAME_COLORS[dd2ndIndex].name + '.');
    }

  } else if (ddPhase === 'active') {
    ddTimer += dt;
    if (ddTimer >= ddDuration) {
      ddTimer          = 0;
      ddPhase          = 'idle';
      ddCooldown       = DD_COOLDOWN_BASE + Math.random() * DD_COOLDOWN_VAR;
      dd2ndIndex       = -1;
      panicBlockFromDD = EVENT_POST_BUFFER; // prevent panic wave for 5 s
      updateForbiddenDisplay();
      Announce.say('Double Danger ended.');
    }
  }
}

function drawDoubleDangerBanner() {
  if (ddPhase !== 'announce' && ddPhase !== 'active') return;

  const isActive = ddPhase === 'active';
  const progress = isActive ? 1 - ddTimer / ddDuration : ddTimer / DD_ANNOUNCE;
  let alpha;
  if (!isActive) {
    alpha = Math.min(1, progress * 3);          // quick fade-in
  } else {
    const fadeStart = Math.max(0, ddDuration - 0.3);
    alpha = ddTimer >= fadeStart ? 1 - (ddTimer - fadeStart) / 0.3 : 1;
  }

  const cx  = canvas.width / 2;
  const cy  = canvas.height * 0.28;             // same position — events never overlap
  const pul = 1 + Math.sin(Date.now() / 100) * (isActive ? 0.03 : 0.01);

  // Subtle amber tint during active phase
  if (isActive) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.09;
    ctx.fillStyle   = '#ff8800';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha * 0.92;

  // Dark backing pill
  const tw = 242;
  const th = 38;
  ctx.fillStyle = 'rgba(30,15,0,0.72)';
  ctx.beginPath();
  ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, 8);
  ctx.fill();

  // Label
  ctx.font         = `bold ${Math.round(18 * pul)}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = isActive ? '#ffcc00' : '#ffa040';
  ctx.shadowColor  = isActive ? '#ff8800' : '#ff6600';
  ctx.shadowBlur   = isActive ? 16 : 8;
  ctx.fillText(isActive ? 'DOUBLE DANGER' : 'DANGER INCOMING', cx, cy);

  ctx.restore();
}

function tickDifficulty(dt) {
  difficultyTimer += dt;
  if (difficultyTimer < DIFF_SCALE_EVERY) return;
  difficultyTimer = 0;
  difficultyBumps++;
  const prevMultiplier = speedMultiplier;
  // Steeper linear speed ramp; hard cap at 2.8×
  speedMultiplier   = Math.min(1.0 + difficultyBumps * 0.14, 2.8);
  // Steeper spawn ramp (0.82 decay vs 0.85); floor 0.14 s — very dense late game
  spawnRate         = Math.max(GAME_CONFIG.spawnRate * Math.pow(0.82, difficultyBumps), 0.14);
  // forbiddenInterval floors at 2.0 s for relentless pressure
  forbiddenInterval = Math.max(GAME_CONFIG.forbiddenInterval - difficultyBumps * 0.24, 2.0);
  // Rescale existing on-screen obstacles so the speed-up is felt immediately,
  // not only on newly spawned ones. Preserves per-type relative speeds.
  if (speedMultiplier > prevMultiplier) {
    const ratio  = speedMultiplier / prevMultiplier;
    const isSlow = activePowerupKey === 'SLOW';
    obstacles.forEach(o => {
      o.baseVy *= ratio;
      o.vy      = isSlow ? o.baseVy * 0.4 : o.baseVy;
    });
  }
  Music.setTempo(speedMultiplier);
}

// ============================================================
// SECTION 17: SCREEN SHAKE
// ============================================================

function triggerShake(intensity, dur) {
  if (settings.reducedMotion) return;
  shakeTimer = dur || 0.25;
  shakeX = (Math.random() - 0.5) * intensity;
  shakeY = (Math.random() - 0.5) * intensity;
}

// Flash a colored border around the game canvas on forbidden-color change
function flashForbiddenBorder(hex) {
  if (settings.reducedMotion) return;
  const el = document.getElementById('color-flash-overlay');
  if (!el) return;
  el.style.setProperty('--flash-color', hex);
  el.classList.remove('flash-active');
  // Force reflow so the animation restarts cleanly every call
  void el.offsetWidth;
  el.classList.add('flash-active');
}

function tickShake(dt) {
  if (shakeTimer <= 0) { shakeX = shakeY = 0; return; }
  shakeTimer -= dt;
  const t = Math.max(0, shakeTimer);
  shakeX = (Math.random() - 0.5) * 9 * t;
  shakeY = (Math.random() - 0.5) * 9 * t;
}

// ── Ring bursts (powerup pickup feedback) ───────────────────
function tickRings(dt) {
  for (let i = ringBursts.length - 1; i >= 0; i--) {
    const r = ringBursts[i];
    r.r     += r.speed * dt;
    r.alpha -= dt * 2.2;
    if (r.alpha <= 0 || r.r >= r.maxR) ringBursts.splice(i, 1);
  }
}

function drawRings() {
  ringBursts.forEach(r => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, r.alpha);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.strokeStyle = r.color;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = r.color;
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.restore();
  });
}

// ============================================================
// SECTION 18: RENDERING
// ============================================================

function drawBackground() {
  const isPanic = panicPhase === 'wave';
  if (settings.highContrast) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth   = 1;
    for (let x2 = 0; x2 < canvas.width;  x2 += 44) { ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, canvas.height); ctx.stroke(); }
    for (let y2 = 0; y2 < canvas.height; y2 += 44) { ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(canvas.width, y2); ctx.stroke(); }
  } else {
    // During panic wave: shift gradient darker/redder
    const topColor    = isPanic ? '#120006' : '#0d0d1a';
    const bottomColor = isPanic ? '#1a0010' : '#130d2e';
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, topColor);
    g.addColorStop(1, bottomColor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // During panic: pulsing red center glow
    if (isPanic) {
      const pulse = 0.10 + 0.06 * Math.sin(Date.now() / 130);
      const rg = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.65
      );
      rg.addColorStop(0,   'rgba(180,0,30,' + pulse.toFixed(3) + ')');
      rg.addColorStop(0.5, 'rgba(120,0,20,' + (pulse * 0.4).toFixed(3) + ')');
      rg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
}

function render(ts) {
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  obstacles.forEach(drawObstacle);
  powerups.forEach(drawPowerup);
  coinItems.forEach(drawCoinItem);
  drawTrail();
  drawPlayer();
  drawParticles();
  drawRings();
  drawFloating();
  drawMilestoneBanner();
  drawPanicBanner();
  drawDoubleDangerBanner();
  // Screen pulse on combo increase — brief white radial flash from center
  if (comboPulseTimer > 0 && !settings.reducedMotion) {
    const easedPulse = comboPulseTimer * comboPulseTimer; // ease-out
    const pg = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.55
    );
    pg.addColorStop(0,   'rgba(255,220,50,' + (easedPulse * 0.18).toFixed(3) + ')');
    pg.addColorStop(0.5, 'rgba(255,150,0,'  + (easedPulse * 0.08).toFixed(3) + ')');
    pg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Gold screen pulse on coin pickup
  if (coinPickupFlashTimer > 0 && !settings.reducedMotion) {
    const ep = coinPickupFlashTimer * coinPickupFlashTimer;
    const cg = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.50
    );
    cg.addColorStop(0,   'rgba(253,224,71,' + (ep * 0.22).toFixed(3) + ')');
    cg.addColorStop(0.6, 'rgba(251,191,36,' + (ep * 0.10).toFixed(3) + ')');
    cg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Combo vignette: red pulsing edge when combo >= 5
  if (combo >= 5 && !settings.reducedMotion) {
    const intensity = Math.min(1, (combo - 4) / 8); // ramps from 0 at combo 5 → full at combo 13
    const pulse     = 0.5 + 0.5 * Math.sin(ts / (220 - combo * 8)); // faster pulse at higher combo
    const alpha     = intensity * (0.22 + pulse * 0.16);
    const vg = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.28,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.82
    );
    vg.addColorStop(0,   'rgba(0,0,0,0)');
    vg.addColorStop(0.6, 'rgba(180,0,0,' + (alpha * 0.5).toFixed(3) + ')');
    vg.addColorStop(1,   'rgba(220,0,0,' + alpha.toFixed(3) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
}

// ============================================================
// SECTION 19: GAME LOOP
// ============================================================

function gameLoop(ts) {
  if (currentState !== STATE.PLAYING) return;
  const dt = Math.min((ts - lastFrameTime) / 1000, 0.05);
  lastFrameTime = ts;
  graceTimer   += dt;

  updatePlayer(dt);
  tickShake(dt);
  if (colorChangeGrace > 0) colorChangeGrace -= dt;
  if (nearMissCooldownTimer > 0) nearMissCooldownTimer -= dt;
  if (nearMissGlowTimer    > 0) nearMissGlowTimer     = Math.max(0, nearMissGlowTimer - dt / 0.30);
  if (coinPickupFlashTimer > 0) coinPickupFlashTimer  = Math.max(0, coinPickupFlashTimer - dt / 0.25);
  if (comboPulseTimer > 0) comboPulseTimer = Math.max(0, comboPulseTimer - dt / 0.35);
  tickForbiddenTimer(dt);
  tickDifficulty(dt);
  tickActivePowerup(dt);
  tickScoreOverTime(dt);
  tickParticles(dt);
  tickFloating(dt);
  tickMilestoneBanner(dt);
  tickRings(dt);
  tickPanicWave(dt);
  tickDoubleDanger(dt);
  Music.tick(dt);
  maybeUpdateHud(ts);

  // Survival time milestones
  const elapsed = (performance.now() - gameStartTime - pausedDuration) / 1000;
  for (const t of TIME_MILESTONES) {
    if (elapsed >= t && !_timeMilestonesHit.has(t)) {
      _timeMilestonesHit.add(t);
      const label = t >= 60 ? Math.floor(t / 60) + 'm Survived' : t + 's Survived';
      triggerMilestone(label, '#a78bfa');
    }
  }

  spawnTimer += dt;
  if (spawnTimer >= panicSpawnRate()) {
    spawnTimer = 0;
    const r = Math.random();
    if (r < CLUSTER_CHANCE) spawnWave();
    else                    spawnObstacle();
  }

  powerupTimer += dt;
  if (powerupTimer >= POWERUP_INTERVAL) { powerupTimer = 0; spawnPowerup(); }

  coinItemTimer += dt;
  if (coinItemTimer >= COIN_ITEM_INTERVAL) { coinItemTimer = 0; spawnCoinItem(); }

  updateObstacles(dt);
  updatePowerups(dt);
  updateCoinItems(dt);
  checkCollisions();
  render(ts);

  rafHandle = requestAnimationFrame(gameLoop);
}

// ============================================================
// SECTION 20: GAME STATE TRANSITIONS
// ============================================================

function startGame() {
  Audio.init();
  score = 0; combo = 0; maxCombo = 0; graceTimer = 0;
  obstacles = []; particles = []; powerups = []; coinItems = []; floatingTexts = []; ringBursts = [];
  milestoneBanner = null;
  _scoreMilestonesHit = new Set();
  _timeMilestonesHit  = new Set();
  _comboMilestonesHit = new Set();
  playerTrail = [];
  spawnTimer = 0; powerupTimer = 0; coinItemTimer = 0; difficultyTimer = 0; difficultyBumps = 0;
  // Reset per-run mission counters (cumulative stat handled separately in evaluateMissions)
  missionRun = { seconds: 0, score: 0, colorChanges: 0, powerupsThisRun: 0, nearMissesThisRun: 0, panicWavesSurvived: 0, maxCombo: 0 };
  // Apply any pending mission bonus
  if (pendingMissionBonus > 0) {
    const bonus = pendingMissionBonus;
    pendingMissionBonus = 0;
    saveMissions();
    // Award after game starts so addScore works normally
    setTimeout(() => { addScore(bonus); addFloating(canvas.width / 2, 80, '+' + bonus + ' Bonus', '#a78bfa'); }, 800);
  }
  warningActive = false; nextForbiddenIdx = -1;
  activePowerupKey = null; activePowerupTimer = 0; activePowerupTotal = 0;
  playerRadiusTarget = player.baseRadius;
  player.radius      = player.baseRadius;
  nearMissCooldownTimer = 0;
  nearMissGlowTimer    = 0;
  coinPickupFlashTimer = 0;
  comboPulseTimer = 0;
  shakeX = shakeY = shakeTimer = 0;
  panicTimer    = 0;
  panicPhase    = 'cooldown';
  panicCooldown = PANIC_COOLDOWN_BASE + Math.random() * PANIC_COOLDOWN_VAR;
  colorChangeGrace = 0;
  ddPhase       = 'idle';
  ddTimer       = 0;
  ddCooldown    = DD_COOLDOWN_BASE + Math.random() * DD_COOLDOWN_VAR;
  ddDuration    = 0;
  dd2ndIndex    = -1;
  ddBlockTimer  = 0;
  panicBlockFromDD = 0;
  _safeLaneDrift   = Math.floor(NUM_LANES / 2);
  _lastSafeLane    = -1;
  _wavesUntilDrift = 3 + Math.floor(Math.random() * 2);

  spawnRate         = GAME_CONFIG.spawnRate;
  forbiddenInterval = GAME_CONFIG.forbiddenInterval;
  speedMultiplier   = 1.0;
  // Head-start timers — first coin ~3s in, first color change ~6s in
  forbiddenTimer    = GAME_CONFIG.forbiddenInterval - 6.0;
  coinItemTimer     = COIN_ITEM_INTERVAL - 3.0;
  forbiddenIndex    = Math.floor(Math.random() * GAME_COLORS.length);
  nextForbiddenIdx  = -1;

  currentState = STATE.PLAYING;
  showScreen('game-screen');
  updateHUD();
  updateForbiddenDisplay();
  hideNextColorPreview();
  updateTimerBar(0, forbiddenInterval);
  setHudWarning(0);
  updateComboDisplay();
  updatePowerupDisplay();

  setTimeout(() => {
    resizeCanvas();
    initPlayer();
    // Pre-fill obstacles so there's immediate on-screen pressure
    const preCount = 18;
    for (let _i = 0; _i < preCount; _i++) {
      spawnObstacle();
      if (obstacles.length > 0) {
        const ob = obstacles[obstacles.length - 1];
        // Tight stagger — blocks arrive in a quick wave over the first ~2 s
        ob.y = -(ob.h + 10) - _i * (canvas.height * 0.10 + 6);
        // Demote big blocks on pre-fill — opening screen stays readable
        if (ob.type === 2) { ob.type = 0; ob.w = 28 + Math.random()*16; ob.h = ob.w; }
      }
    }
    spawnTimer = 0;
    gameStartTime    = performance.now();
    pausedDuration   = 0;
    pauseStartTime   = 0;
    lastFrameTime    = performance.now();
    const c = GAME_COLORS[forbiddenIndex];
    Announce.say('Game started. Forbidden color: ' + c.name + '.');
    Music.start();
    rafHandle = requestAnimationFrame(gameLoop);
  }, 50);
}

function pauseGame() {
  if (currentState !== STATE.PLAYING) return;
  pauseStartTime = performance.now();
  currentState = STATE.PAUSED;
  cancelAnimationFrame(rafHandle); rafHandle = null;
  clearAllInputs();
  Music.pause();
  document.getElementById('pause-overlay').hidden = false;
  requestAnimationFrame(() => document.getElementById('btn-resume').focus());
  Announce.say('Paused.');
}

function resumeGame() {
  if (currentState !== STATE.PAUSED) return;
  pausedDuration += performance.now() - pauseStartTime;
  document.getElementById('pause-overlay').hidden = true;
  currentState  = STATE.PLAYING;
  lastFrameTime = performance.now();
  Music.resume();
  rafHandle = requestAnimationFrame(gameLoop);
  Announce.say('Resumed.');
}

function pickDeathMessage(score, combo, colorChanges) {
  // Milestone hints
  const milestones = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000];
  const next = milestones.find(m => m > score && m - score <= score * 0.25);
  if (next) return 'Almost ' + next + '.';
  if (colorChanges === 1) return 'One more shift next time.';
  if (combo >= 8) return 'Incredible run.';
  if (combo >= 4) return 'Strong combo. Keep going.';
  // Generic messages
  const msgs = [
    'So close.', 'Try again.', 'Keep going.', 'You got this.',
    'Almost.', 'One more run.', "Don't stop now.", 'Next time.',
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function triggerGameOver() {
  currentState = STATE.GAMEOVER;
  cancelAnimationFrame(rafHandle); rafHandle = null;
  clearAllInputs();
  AudioManager.stopMusic();
  AudioManager.playSound('death');
  if (navigator.vibrate) navigator.vibrate([100, 50, 200]);

  // Red death flash overlay
  flashForbiddenBorder('#ff1111');

  // Big particle burst at player position
  spawnParticles(player.x, player.y, '#ff4444', settings.reducedMotion ? 8 : 28);
  spawnParticles(player.x, player.y, '#ffffff', settings.reducedMotion ? 4 : 12);

  // Strong shake
  triggerShake(18, 0.5);
  render(performance.now()); // shake frame

  // Brief hit-pause: render one more frame, then show overlay after a short delay
  const DEATH_DELAY = settings.reducedMotion ? 0 : 120; // ms
  setTimeout(() => {
    const final      = Math.floor(score);
    missionRun.score    = final;
    missionRun.seconds  = Math.max(0, Math.floor((performance.now() - gameStartTime - pausedDuration) / 1000));
    missionRun.maxCombo = maxCombo;
    evaluateMissions();
    const wasNewBest = final > settings.bestScore;
    const prevBest = settings.bestScore;
    if (wasNewBest) { settings.bestScore = final; saveSettings(); newBestThisGame = true; }
    if (wasNewBest) checkSkinUnlocks(prevBest, settings.bestScore);

    const elapsed = Math.max(0, Math.floor((performance.now() - gameStartTime - pausedDuration) / 1000));
    const coinsEarned = awardRunCoins(final, elapsed);
    updateSkinsUI();
    updateStats(elapsed); // persist lifetime stats before showing overlay
    const timeStr  = elapsed >= 60 ? Math.floor(elapsed / 60) + 'm ' + (elapsed % 60) + 's' : elapsed + 's';

    document.getElementById('gameover-best').textContent  = settings.bestScore;
    document.getElementById('gameover-combo').textContent = maxCombo;
    document.getElementById('gameover-time').textContent   = timeStr;
    document.getElementById('gameover-coins').textContent  = '+' + coinsEarned;
    const goIcon = document.getElementById('gameover-icon');
    if (goIcon) goIcon.textContent = '';
    document.getElementById('new-best-badge').hidden      = !wasNewBest;

    const deathMsg = document.getElementById('death-message');
    if (deathMsg) {
      deathMsg.textContent = wasNewBest ? 'New Record' : pickDeathMessage(final, maxCombo, missionRun.colorChanges);
      deathMsg.classList.remove('death-msg-in');
      void deathMsg.offsetWidth; // reflow to restart animation
      deathMsg.classList.add('death-msg-in');
    }

    const hsEl = document.getElementById('home-highscore');
    if (hsEl) hsEl.textContent = settings.bestScore;

    document.getElementById('gameover-overlay').hidden = false;

    animateCounter(0, final, settings.reducedMotion ? 0 : 850, document.getElementById('final-score'));

    // Prime the share button with this run's score
    const shareBtn = document.getElementById('btn-share-score');
    if (shareBtn) shareBtn.dataset.score = final;

    requestAnimationFrame(() => document.getElementById('btn-restart').focus());
    Announce.say('Game Over! Score: ' + final + '. Best: ' + settings.bestScore + '.');
    // Evaluate daily challenge against this run's stats
    DailyChallenge.onRunEnd({
      elapsed:           elapsed,
      score:             final,
      nearMissesThisRun: missionRun.nearMissesThisRun,
      colorChanges:      missionRun.colorChanges,
      maxCombo:          maxCombo,
      powerupsThisRun:   missionRun.powerupsThisRun,
    });
  }, DEATH_DELAY);
}

function restartGame() {
  document.getElementById('gameover-overlay').hidden = true;
  document.getElementById('pause-overlay').hidden    = true;
  startGame();
}

function returnHome() {
  currentState = STATE.HOME;
  cancelAnimationFrame(rafHandle); rafHandle = null;
  clearAllInputs();
  document.getElementById('gameover-overlay').hidden = true;
  document.getElementById('pause-overlay').hidden    = true;
  showScreen('home-screen');
  applySettingsToUI();

  // Flash the highscore badge if a new best was just set
  if (newBestThisGame) {
    newBestThisGame = false;
    setTimeout(() => {
      const hsWrap = document.querySelector('.home-highscore');
      if (hsWrap) {
        hsWrap.classList.remove('hs-flash');
        void hsWrap.offsetWidth; // force reflow to restart animation
        hsWrap.classList.add('hs-flash');
      }
    }, 520); // after entrance animations settle
  }
  requestAnimationFrame(() => document.getElementById('btn-start').focus());
  Announce.say('Home screen.');
}

// ============================================================
// SECTION 21: ANIMATED SCORE COUNTER
// ============================================================

function animateCounter(from, to, duration, el) {
  if (!el) return;
  if (duration <= 0) { el.textContent = to; return; }
  const start = performance.now();
  function tick(now) {
    const t    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
    el.textContent = Math.floor(from + (to - from) * ease);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = to;
  }
  requestAnimationFrame(tick);
}

// ============================================================
// SECTION 22: INPUT HANDLING
// ============================================================

const KEY_MAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down',
};

function clearAllInputs() {
  ['left','right','up','down'].forEach(d => { keys[d] = false; touchDirs[d] = false; });
  touchTarget = null;
}

function onKeyDown(e) {
  const dir = KEY_MAP[e.key];
  if (dir) {
    if (currentState === STATE.PLAYING) { e.preventDefault(); keys[dir] = true; }
    return;
  }

  // Pause / resume
  if (e.key === 'p' || e.key === 'P' || e.key === ' ' || e.key === 'Spacebar') {
    if      (currentState === STATE.PLAYING) { e.preventDefault(); pauseGame();  }
    else if (currentState === STATE.PAUSED)  { e.preventDefault(); resumeGame(); }
    return;
  }

  if ((e.key === 'r' || e.key === 'R') && currentState === STATE.GAMEOVER) { restartGame(); return; }
  if ((e.key === 'h' || e.key === 'H') && currentState === STATE.GAMEOVER) { returnHome();  return; }

  if (e.key === 'Escape') {
    if      (currentState === STATE.PAUSED)   { resumeGame(); }
    else if (currentState === STATE.PLAYING)  { pauseGame(); }
    else if (currentState === STATE.GAMEOVER) { returnHome(); }
    else if (!document.getElementById('modal-settings').hidden) { hideModal('modal-settings'); document.getElementById('btn-settings').focus(); }
    else if (!document.getElementById('modal-progress').hidden)  { hideModal('modal-progress');  document.getElementById('btn-progress').focus(); }
  }
}

function onKeyUp(e) {
  const dir = KEY_MAP[e.key];
  if (dir) {
    if (currentState === STATE.PLAYING) e.preventDefault();
    keys[dir] = false;
  }
}

// Unified pointer-event touch handler — works for both mouse and touch
function bindTouchBtn(btn, dir) {
  function press(e) {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    touchDirs[dir] = true;
    btn.classList.add('pressed');
    if (navigator.vibrate) navigator.vibrate(18);
  }
  function release(e) {
    e.preventDefault();
    touchDirs[dir] = false;
    btn.classList.remove('pressed');
  }
  btn.addEventListener('pointerdown',  press,   { passive: false });
  btn.addEventListener('pointerup',    release, { passive: false });
  btn.addEventListener('pointercancel',release, { passive: false });
  btn.addEventListener('pointerleave', release, { passive: false });
}

// ============================================================
// SECTION 23: CANVAS RESIZE
// ============================================================

let _lastCanvasW = 0, _lastCanvasH = 0;

function resizeCanvas() {
  const w = canvas.offsetWidth  || window.innerWidth;
  const h = canvas.offsetHeight || Math.max(200, window.innerHeight - 68);
  if (w === _lastCanvasW && h === _lastCanvasH) return; // no-op if unchanged
  _lastCanvasW = w; _lastCanvasH = h;
  canvas.width  = w;
  canvas.height = h;
}

function setupResize() {
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      if (currentState === STATE.PLAYING || currentState === STATE.PAUSED) {
        resizeCanvas();
        clampPlayer();
      }
    });
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', () => {
      if (currentState === STATE.PLAYING || currentState === STATE.PAUSED) {
        resizeCanvas(); clampPlayer();
      }
    });
  }
}

// ============================================================
// SECTION 24: DRAWING HELPERS
// ============================================================

function pathRoundRect(ctx2, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx2.beginPath();
  ctx2.moveTo(x + r, y);
  ctx2.lineTo(x + w - r, y);   ctx2.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx2.lineTo(x + w, y + h - r); ctx2.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx2.lineTo(x + r, y + h);   ctx2.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx2.lineTo(x, y + r);       ctx2.quadraticCurveTo(x,     y,     x + r, y);
  ctx2.closePath();
}

function drawStar(ctx2, cx, cy, outer, inner, pts) {
  ctx2.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / pts - Math.PI / 2;
    if (i === 0) ctx2.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    else         ctx2.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx2.closePath();
}

// ============================================================
// SECTION 25: VISIBILITY / FOCUS AUTO-PAUSE
// ============================================================

document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentState === STATE.PLAYING) pauseGame();
});

window.addEventListener('blur', () => {
  if (currentState === STATE.PLAYING) pauseGame();
  clearAllInputs();
});

// ============================================================
// SECTION 25b: CANVAS TOUCH-DRAG (direct finger follow)
// ============================================================

function _canvasTouchToGamePos(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) * (canvas.width  / rect.width),
    y: (touch.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function onCanvasTouchStart(e) {
  e.preventDefault();
  if (currentState !== STATE.PLAYING) return;
  touchTarget = _canvasTouchToGamePos(e.touches[0]);
}

function onCanvasTouchMove(e) {
  e.preventDefault();
  if (currentState !== STATE.PLAYING) return;
  if (e.touches.length > 0) touchTarget = _canvasTouchToGamePos(e.touches[0]);
}

function onCanvasTouchEnd(e) {
  e.preventDefault();
  if (e.touches.length === 0) touchTarget = null;
}

// ============================================================
// SECTION 26: INITIALISATION
// ============================================================

function init() {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');

  Announce.init();
  loadSettings();
  loadStats();
  loadMissions();
  applySettingsToUI();
  updateMissionUI();

  // Kick off home screen background and coin count-up on first load
  HomeBg.start();
  HomePreview.start();
  DailyChallenge.init();
  DailyChallenge.startCountdown();
  const _coinEl = document.getElementById('home-coins');
  if (_coinEl && !settings.reducedMotion) {
    setTimeout(() => animateCounter(0, settings.coins, 700, _coinEl), 500);
  }

  // Focus traps for modals and overlays
  ['modal-settings','modal-progress','pause-overlay','gameover-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) makeFocusTrap(el);
  });

  // One-shot unlock for iOS/Android — AudioContext must be created inside a user gesture.
  // We listen on both touchstart and pointerdown so it fires on the very first tap/click.
  const _unlockAudio = () => {
    Audio.unlock();
    document.removeEventListener('touchstart', _unlockAudio, true);
    document.removeEventListener('pointerdown', _unlockAudio, true);
  };
  document.addEventListener('touchstart',  _unlockAudio, { capture: true, passive: true, once: true });
  document.addEventListener('pointerdown', _unlockAudio, { capture: true, passive: true, once: true });

  // Home screen
  document.getElementById('btn-start').addEventListener('click', () => { Audio.uiClick(); startGame(); });
  document.getElementById('btn-settings').addEventListener('click', () => { Audio.uiClick(); showModal('modal-settings'); });
  document.getElementById('btn-progress').addEventListener('click', () => {
    Audio.uiClick();
    renderStatsUI();
    const selIdx = SKIN_DEFS.findIndex(s => s.id === settings.selectedSkin);
    if (selIdx >= 0) skinCarouselIdx = selIdx;
    updateSkinsUI();
    showModal('modal-progress');
  });

  document.getElementById('btn-settings-close').addEventListener('click', () => {
    hideModal('modal-settings'); document.getElementById('btn-settings').focus();
  });
  document.getElementById('btn-settings-close-bottom').addEventListener('click', () => {
    hideModal('modal-settings'); document.getElementById('btn-settings').focus();
  });

  document.getElementById('btn-progress-close').addEventListener('click', () => {
    hideModal('modal-progress'); document.getElementById('btn-progress').focus();
  });
  document.getElementById('btn-progress-close-bottom').addEventListener('click', () => {
    hideModal('modal-progress'); document.getElementById('btn-progress').focus();
  });

  // Game overlays
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-home-from-pause').addEventListener('click', returnHome);
  document.getElementById('btn-restart').addEventListener('click', restartGame);
  document.getElementById('btn-home-from-gameover').addEventListener('click', returnHome);

  // Share / copy challenge button
  document.getElementById('btn-share-score').addEventListener('click', () => {
    Audio.uiClick();
    const scoreVal = document.getElementById('btn-share-score').dataset.score || '0';
    const url = location.href.split('?')[0]; // clean URL, no query params
    const text = 'I scored ' + scoreVal + ' in Forbidden Color — can you beat me? ' + url;
    const copiedEl = document.getElementById('share-copied');
    let hideTimer = null;
    const showCopied = () => {
      if (copiedEl) {
        copiedEl.hidden = false;
        copiedEl.classList.remove('shareCopiedIn');
        void copiedEl.offsetWidth;
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { copiedEl.hidden = true; }, 2200);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied).catch(() => {
        // Fallback: execCommand
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showCopied(); } catch (_e) {}
        document.body.removeChild(ta);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); showCopied(); } catch (_e) {}
      document.body.removeChild(ta);
    }
  });

  // Touch pause button
  document.getElementById('touch-pause').addEventListener('pointerdown', e => {
    e.preventDefault();
    if      (currentState === STATE.PLAYING) pauseGame();
    else if (currentState === STATE.PAUSED)  resumeGame();
  }, { passive: false });

  // Settings
  document.getElementById('sound-toggle').addEventListener('change', e => {
    settings.sound = e.target.checked; saveSettings(); Audio.init();
  });
  document.getElementById('reduced-motion-toggle').addEventListener('change', e => {
    settings.reducedMotion = e.target.checked; applyColorMode(); saveSettings();
  });
  document.getElementById('high-contrast-toggle').addEventListener('change', e => {
    settings.highContrast = e.target.checked; applyColorMode(); saveSettings();
  });
  document.getElementById('colorblind-toggle').addEventListener('change', e => {
    settings.colorblind = e.target.checked; applyColorMode(); saveSettings();
  });

  // Skin carousel — prev / next arrows
  document.getElementById('skin-prev').addEventListener('click', () => {
    skinCarouselIdx = (skinCarouselIdx - 1 + SKIN_DEFS.length) % SKIN_DEFS.length;
    updateSkinsUI('prev');
    Audio.uiClick();
  });
  document.getElementById('skin-next').addEventListener('click', () => {
    skinCarouselIdx = (skinCarouselIdx + 1) % SKIN_DEFS.length;
    updateSkinsUI('next');
    Audio.uiClick();
  });

  // Keyboard
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup',   onKeyUp,   { passive: false });

  // Skin buy confirmation dialog
  document.getElementById('sbd-confirm').addEventListener('click', confirmBuySkin);
  document.getElementById('sbd-cancel').addEventListener('click',  cancelBuyConfirm);
  document.getElementById('skin-buy-overlay').addEventListener('click', cancelBuyConfirm);
  document.getElementById('skin-buy-dialog').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); cancelBuyConfirm(); }
  });

  // Canvas touch-drag: direct finger-follow control (replaces simple preventDefault)
  canvas.addEventListener('touchstart',  onCanvasTouchStart, { passive: false });
  canvas.addEventListener('touchmove',   onCanvasTouchMove,  { passive: false });
  canvas.addEventListener('touchend',    onCanvasTouchEnd,   { passive: false });
  canvas.addEventListener('touchcancel', onCanvasTouchEnd,   { passive: false });

  setupResize();
}

document.addEventListener('DOMContentLoaded', init);
