// ============================================================
// SHIFTPANIC - Game Logic v2
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
  SLOW:   { label: 'Slow Time', icon: '',        color: '#38bdf8', duration: 6  },
  CLEAR:  { label: 'Clear',    icon: '',         color: '#e879f9', duration: 0  },
  BOOST:  { label: 'Score x2',  icon: '',         color: '#fb923c', duration: 8  },
  SMALL:  { label: 'Small Mode',icon: '\uD83D\uDD35',  color: '#34d399', duration: 5  },
};
const POWERUP_KEYS = Object.keys(POWERUP_DEFS);
const POWERUP_UPGRADE_DEFS = {
  SHIELD: { maxLevel: 3, bonusPerLevel: 0.5, costs: [500, 1200, 2000] },
  SMALL:  { maxLevel: 3, bonusPerLevel: 0.5, costs: [500, 1200, 2000] },
  SLOW:   { maxLevel: 3, bonusPerLevel: 0.5, costs: [500, 1200, 2000] },
};
const POWERUP_UPGRADE_KEYS = Object.keys(POWERUP_UPGRADE_DEFS);

// Single built-in difficulty - ramps automatically via tickDifficulty()
const GAME_CONFIG = { playerSpeed: 255, spawnRate: 0.60, forbiddenInterval: 2.6, baseSpeed: 230 };

// ============================================================
// DIFFICULTY REDESIGN CONFIG
// All balance tuning lives here. No magic numbers elsewhere.
// To re-balance: edit phase values; adjust caps at bottom.
// ============================================================
const DIFFICULTY_CONFIG = {
  // phases: each entry controls live game values for that time window.
  //   endAt = elapsed seconds when this phase ends (Infinity = forever)
  //   spd   = speedMultiplier target         increase carefully
  //   si    = spawn interval (s)             lower = more blocks
  //   cc    = cluster/wave chance (0-1)      higher = more pattern waves
  //   fi    = forbidden color interval (s)   lower = faster color shifts
  //   mo    = max simultaneous obstacles     soft cap per phase
  //   ac    = anti-camp targeting bonus (0-1)
  phases: [
    // Phase 0 - Rush    (0-10s):   hard immediately, active from first second
    { name:'Rush',    endAt:  10, spd:1.12, si:0.60, cc:0.50, fi:2.80, mo:16, ac:0.45 },
    // Phase 1 - Drive   (10-40s):  sustained pressure, close calls begin, must keep moving
    { name:'Drive',   endAt:  40, spd:1.26, si:0.44, cc:0.64, fi:2.50, mo:22, ac:0.64 },
    // Phase 2 - Engage  (40-80s):  high engagement, frequent dodges, requires timing
    { name:'Engage',  endAt:  80, spd:1.40, si:0.32, cc:0.72, fi:2.15, mo:28, ac:0.78 },
    // Phase 3 - Intense (80-130s): skilled play required, tight windows, layered threats
    { name:'Intense', endAt: 130, spd:1.54, si:0.22, cc:0.80, fi:1.90, mo:35, ac:0.90 },
    // Phase 4 - Expert  (130s+):   mastery required, very hard, always one escape exists
    { name:'Expert',  endAt: Infinity, spd:1.68, si:0.16, cc:0.88, fi:1.65, mo:42, ac:0.98 },
  ],

  //  Hard safety caps  NEVER exceeded regardless of phase, combo, or panic 
  // phase1_spawn_rate  = phases[0].si  = 0.60s
  // phase2_spawn_rate  = phases[2].si  = 0.32s
  // phase3_spawn_rate  = phases[4].si  = 0.16s
  // max_speed          = speedMultHardCap
  // active_threat_cap  = maxObstaclesHardCap
  // safe_gap_minimum   = MIN_CLEAR_GAP (below)
  // anti_camp_strength = FLOW_CONFIG.campDecayPerSec
  // panic_mode_intensity = panicForbidRatio
  // pattern_complexity = phases[n].cc
  speedMultHardCap:    1.80,  // peak speed  fast but still readable
  spawnIntervalFloor:  0.15,  // absolute minimum spawn gap at peak intensity
  maxObstaclesHardCap: 44,    // max simultaneous live threats on screen

  //  Phase blend  smoothstep cross-fade between consecutive phases 
  blendWindow: 5.0,           // tighter = faster ramp between phases

  //  Panic wave tuning 
  panicSpeedBonus:  1.32,  // obstacle speed 1.32 during panic  noticeably faster
  panicSpawnMult:   0.30,  // spawn interval 0.30 during panic (~3.3 more frequent)
  panicForbidRatio: 0.92,  // 92% of new blocks forbidden  very dense panic surge
  ddSpawnRateMult:  0.68,  // Double Danger: 0.68 spawn interval (~47% more frequent)

  //  Per-obstacle-type speed multipliers 
  // Applied as: vy = base * typeSpeedMults[type] + rand(0, typeSpeedRand[type])
  typeSpeedMults: { 0:1.02, 1:0.90, 2:0.65, 3:1.12, 4:1.22 },
  typeSpeedRand:  { 0:24,   1:20,   2:16,   3:22,   4:22   },

  // Developer debug overlay  toggle: DIFFICULTY_CONFIG.debugOverlay = true
  debugOverlay: false,
};

// ============================================================
// PATTERN LIBRARY
// Named wave patterns. phaseWeights[i] = relative weight in phase i.
// 0 = never appears in that phase. Higher = more likely.
// ============================================================
const PATTERN_LIBRARY = [
  { id:'HALF_FILL',   phaseWeights:[ 6, 5, 3, 2, 1] },  // Half lanes blocked  reduced, too passive
  { id:'SINGLE_SIDE', phaseWeights:[ 4, 3, 2, 1, 0] },  // Single threat  tapers off quickly
  { id:'STAGGER',     phaseWeights:[ 9, 9, 8, 7, 6] },  // Staggered gaps  requires movement always
  { id:'SWEEP_GAP',   phaseWeights:[ 5, 8, 9, 8, 7] },  // Moving gap  tracks player well
  { id:'CENTER_PUSH', phaseWeights:[ 3, 5, 8, 9, 9] },  // Center threat, side escape
  { id:'SIDE_PUSH',   phaseWeights:[ 3, 4, 7, 8, 9] },  // Flank threat, center escape
  { id:'PINCER',      phaseWeights:[ 1, 3, 5, 8, 9] },  // Both flanks  tight middle
  { id:'TARGETED',    phaseWeights:[ 3, 4, 6, 8, 9] },  // Direct player pressure  starts early
];

// Player skins - unlock thresholds are bestScore requirements (bestScore never decreases)
const SKIN_DEFS = [
  // -- Common --
  { id: 'classic', name: 'Classic', unlock:    0, rarity: 'common', effect: 'none',    color1: '#ffffff', color2: '#c084fc', glow: '#a855f7', shape: 'circle', trail: false },
  { id: 'neon',    name: 'Neon',    unlock: 0, coinCost:  75, rarity: 'common', effect: 'pulse',   color1: '#ccfdf2', color2: '#06b6d4', glow: '#06b6d4', shape: 'circle', trail: true  },
  // -- Rare --
  { id: 'ice',     name: 'Ice',     unlock: 0, coinCost: 150, rarity: 'rare',   effect: 'shimmer', color1: '#e0f2fe', color2: '#38bdf8', glow: '#7dd3fc', shape: 'circle', trail: true  },
  { id: 'lava',    name: 'Lava',    unlock: 0, coinCost: 175, rarity: 'rare',   effect: 'flicker', color1: '#fef08a', color2: '#ef4444', glow: '#f97316', shape: 'circle', trail: true  },
  { id: 'crimson',  name: 'Crimson',  unlock: 0, coinCost: 200, rarity: 'rare',      effect: 'flicker',  color1: '#ffe4e1', color2: '#dc2626', glow: '#ef4444', shape: 'circle', trail: true  },
  { id: 'aurora',   name: 'Aurora',   unlock: 0, lifetimeUnlock: 500000, rarity: 'rare', effect: 'shimmer', color1: '#d1fae5', color2: '#0ea5e9', glow: '#22d3ee', shape: 'circle', trail: true  },
  // -- Epic --
  { id: 'gold',    name: 'Gold',    unlock: 0, coinCost: 300, rarity: 'epic',   effect: 'shimmer', color1: '#fefce8', color2: '#eab308', glow: '#fbbf24', shape: 'star',   trail: false },
  { id: 'void',     name: 'Void',     unlock: 0, coinCost: 425, rarity: 'epic',      effect: 'void',     color1: '#ddd6fe', color2: '#3b0764', glow: '#c084fc', shape: 'star',   trail: true  },
  { id: 'electric', name: 'Electric', unlock: 0, coinCost: 350, rarity: 'epic',      effect: 'electric', color1: '#e0f2fe', color2: '#0284c7', glow: '#38bdf8', shape: 'circle', trail: true  },
  { id: 'inferno',  name: 'Inferno',  unlock: 0, coinCost: 350, rarity: 'epic',      effect: 'inferno',  color1: '#fffbeb', color2: '#dc2626', glow: '#f97316', shape: 'circle', trail: true  },
  { id: 'prism',    name: 'Prism',    unlock: 0, coinCost: 350, rarity: 'epic',      effect: 'prism',    color1: '#ffffff', color2: '#a855f7', glow: '#e879f9', shape: 'circle', trail: true  },
  { id: 'afterglow', name: 'Afterglow', unlock: 0, lifetimeUnlock: 2000000, rarity: 'epic', effect: 'prism', color1: '#fef3c7', color2: '#f472b6', glow: '#fb7185', shape: 'circle', trail: true  },
  // -- Legendary --
  { id: 'galaxy',   name: 'Galaxy',   unlock: 0, coinCost: 550, rarity: 'legendary', effect: 'galaxy',   color1: '#c4b5fd', color2: '#1e1b4b', glow: '#818cf8', shape: 'star',   trail: true  },
  { id: 'eclipse',  name: 'Eclipse',  unlock: 0, lifetimeUnlock: 3500000, rarity: 'legendary', effect: 'void', color1: '#f5f3ff', color2: '#111827', glow: '#a78bfa', shape: 'star', trail: true  },
  // -- Defense / Ability Skins --
  { id: 'coin-magnet',  name: 'Coin Magnet',  unlock: 0, coinCost: 100, rarity: 'common',    effect: 'pulse',    color1: '#fefce8', color2: '#eab308', glow: '#fbbf24', shape: 'circle', trail: false },
  { id: 'neon-shield',  name: 'Neon Shield',  unlock: 0, coinCost: 175, rarity: 'rare',      effect: 'electric', color1: '#e0f2fe', color2: '#0ea5e9', glow: '#38bdf8', shape: 'circle', trail: true  },
  { id: 'frost-runner', name: 'Frost Runner', unlock: 0, coinCost: 200, rarity: 'rare',      effect: 'shimmer',  color1: '#f0f9ff', color2: '#7dd3fc', glow: '#93c5fd', shape: 'circle', trail: true  },
  { id: 'dash-core',    name: 'Dash Core',    unlock: 0, coinCost: 350, rarity: 'epic',      effect: 'electric', color1: '#eff6ff', color2: '#3b82f6', glow: '#60a5fa', shape: 'circle', trail: true  },
  { id: 'pulse-wave',   name: 'Pulse Wave',   unlock: 0, coinCost: 425, rarity: 'epic',      effect: 'prism',    color1: '#faf5ff', color2: '#a855f7', glow: '#c084fc', shape: 'circle', trail: true  },
  { id: 'ghost-shift',  name: 'Ghost Shift',  unlock: 0, coinCost: 600, rarity: 'legendary', effect: 'aura',     color1: '#f8fafc', color2: '#94a3b8', glow: '#cbd5e1', shape: 'star',   trail: true  },
];
// Ability metadata for defence skins. Maps skin id -> ability config.
// passive:true = always active, no cooldown UI shown.
// duration:-1  = permanent until triggered externally (Neon Shield).
// duration:0   = instant effect, no effect timer (Pulse Wave).
const SKIN_ABILITY_DEFS = {
  'coin-magnet':  { abilityId: 'magnet', abilityName: 'Coin Magnet',  icon: '\u{1F9F2}', passive: true,  cooldown: 0,  duration: 0,   desc: 'Pulls nearby coins toward you automatically.' },
  'neon-shield':  { abilityId: 'shield', abilityName: 'Neon Shield',  icon: '\uD83D\uDEE1', passive: false, cooldown: 45, duration: -1,  desc: 'Survive 1 collision every 45s. Shield recharges after breaking.' },
  'frost-runner': { abilityId: 'frost',  abilityName: 'Frost Aura',   icon: '\u2744',     passive: false, cooldown: 25, duration: 3,   desc: 'Slow all blocks 35% for 3s every 25s.' },
  'dash-core':    { abilityId: 'dash',   abilityName: 'Dash Boost',   icon: '\uD83D\uDCA8', passive: false, cooldown: 20, duration: 1,   desc: '1.75\xd7 speed burst for 1s every 20s.' },
  'pulse-wave':   { abilityId: 'pulse',  abilityName: 'Pulse Wave',   icon: '\uD83D\uDCA5', passive: false, cooldown: 30, duration: 0,   desc: 'Blasts nearby blocks outward every 30s.' },
  'ghost-shift':  { abilityId: 'ghost',  abilityName: 'Ghost Mode',   icon: '\uD83D\uDC7B', passive: false, cooldown: 40, duration: 1,   desc: 'Phase through danger blocks for 1s every 40s.' },
};
const LIFETIME_REWARD_DEFS = [
  // -- Common ------------------------------------------------------------------
  { id: 'lt_coins_500',   milestone:   25000, label: '100 Coins',      type: 'coins',  coins: 100,  rarity: 'common',    icon: '', description: 'A starter coin bundle to kick off your journey.' },
  { id: 'lt_coins_1500',  milestone:  100000, label: '200 Coins',      type: 'coins',  coins: 200,  rarity: 'common',    icon: '', description: 'Keep playing - the coins stack up.' },
  // -- Rare --------------------------------------------------------------------
  { id: 'aurora',         milestone:  500000, label: 'Aurora Skin',    type: 'skin',   rarity: 'rare',      icon: '', description: 'A shimmering neon-teal skin for the dedicated.' },
  { id: 'lt_coins_4k',    milestone:  750000, label: '350 Coins',      type: 'coins',  coins: 350,  rarity: 'rare',      icon: '', description: 'A rare coin reward for dedicated players.' },
  { id: 'lt_badge_5k',    milestone: 1000000, label: 'Trailblazer',    type: 'badge',               rarity: 'rare',      icon: '', description: 'Awarded to those who push past the score ceiling.' },
  { id: 'lt_coins_7500',  milestone: 1500000, label: '500 Coins',      type: 'coins',  coins: 500,  rarity: 'rare',      icon: '', description: 'Half a thousand coins - impressive.' },
  // -- Epic --------------------------------------------------------------------
  { id: 'afterglow',      milestone: 2000000, label: 'Afterglow Skin', type: 'skin',   rarity: 'epic',      icon: '', description: 'A saturated sunset prism skin for elite players.' },
  { id: 'lt_coins_15k',   milestone: 2500000, label: '750 Coins',      type: 'coins',  coins: 750,  rarity: 'epic',      icon: '', description: 'An epic hoard of coins.' },
  { id: 'lt_badge_20k',   milestone: 3000000, label: 'Veteran',        type: 'badge',               rarity: 'epic',      icon: '', description: 'A mark of true dedication and skill.' },
  // -- Legendary ---------------------------------------------------------------
  { id: 'eclipse',        milestone: 3500000, label: 'Eclipse Skin',   type: 'skin',   rarity: 'legendary', icon: '', description: 'A dark legendary cosmic skin.' },
  { id: 'lt_coins_35k',   milestone: 4000000, label: '1,000 Coins',    type: 'coins',  coins: 1000, rarity: 'legendary', icon: '', description: 'A legendary coin vault.' },
  { id: 'lt_badge_50k',   milestone: 4250000, label: 'Legend',         type: 'badge',               rarity: 'legendary', icon: '', description: 'Only legends reach this summit.' },
  { id: 'lt_coins_75k',   milestone: 4500000, label: '2,000 Coins',    type: 'coins',  coins: 2000, rarity: 'legendary', icon: '', description: 'A massive coin fortune.' },
  { id: 'lt_mythic',      milestone: 5000000, label: 'Mythic',         type: 'badge',               rarity: 'legendary', icon: '', description: 'The pinnacle of ShiftPanic mastery.' },
];

const STATE = { HOME: 'home', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

const WARNING_DURATION    = 0.8;  // short flash warning - just enough to react
const NEAR_MISS_DIST      = 65;   // px (from player center to nearest rect edge)
const NEAR_MISS_BONUS     = 40;
const COMBO_BONUS_PER         = 25;   // pts per combo level on each color change (combox25: 25, 50, 75...)
const POWERUP_COLLECT_BONUS   = 50;   // flat pts for picking up any power-up
const POWERUP_INTERVAL    = 15;   // s between powerup spawns (more frequent to compensate)
const COIN_ITEM_INTERVAL  = 8.5;  // s between coin column spawns (columns have 4-6 coins each)
const DIFF_SCALE_EVERY    = 4;    // s between difficulty bumps  faster ramp (was 5)
const MAX_OBSTACLES       = 48;   // increased from 40 - blocks persist longer now, need more capacity
const GRACE_PERIOD        = 0.20; // reduced -- game pressures player earlier
const FORBIDDEN_MIN_RATIO = 0.65; // keep at least 65% of active obstacles forbidden - keeps screen readable
const CLUSTER_CHANCE      = 0.55; // structured wave patterns fire on most spawn ticks
const MIN_CLEAR_GAP       = 62;   // minimum safe corridor width  tight but passable
const NUM_LANES           = 6;    // play area divided into this many columns for controlled, fair spawning
const CAMPING_WAVE_LIMIT  = 1;    //  anti-camp triggers after just 1 repeated wave (was 2)
const MAX_SAFE_LANE_STREAK = 2;   // hard cap for repeating the exact same safe lane
const MAX_PLAYER_LANE_SHIELD = 0; // single spawns no longer avoid player lane (full pressure)
const OBSTACLE_CLEANUP_MARGIN = 110; // blocks removed shortly after leaving screen (frees cap for new threats)
// Wall / narrow-lane patterns removed - challenge comes from spawn rate and color cycling.

const FLOW_CONFIG = {
  maxCombo: 36,
  passiveGainPerSec: 0.42,
  motionBonusScale: 0.18,
  coinGainPerCoin: 0.85,
  nearMissGain: 1.6,
  colorShiftGain: 1.2,
  shieldHitPenalty: 3.5,
  idleGrace: 1.2,           // less idle grace  decay kicks in faster
  idleDecayPerSec: 1.8,     // faster idle decay  punishes standing still
  campRadius: 38,           // tighter camp zone  player must actually move
  campGrace: 0.5,           // very short grace before camping pressure builds
  campDecayPerSec: 4.5,     // fast camp pressure ramp  discourages any camping
  movementMinSpeed: 42,
  scoreMultPerCombo: 0.12,
  scoreMultCap: 2.1,
  coinMultPerCombo: 0.08,
  coinMultCap: 1.2,
  spawnIntervalPerCombo: 0.008,  //  slightly  combo reduces interval a bit more
  spawnIntervalCap: 0.15,
  gapTightenPerCombo: 0.42,       // was 0.95
  gapTightenCap: 8,              // was 15
  targetingPerCombo: 0.012,
  targetingCap: 0.18,
  switchSpeedPerCombo: 0.018,
  switchSpeedCap: 0.28,
  extraMovePerCombo: 0.012,
  extraMoveCap: 0.14,
  trickUnlockCombo: 7,
  trickChancePerCombo: 0.015,
  trickChanceCap: 0.22,
  ambientFxCombo: 4,
  ambientFxInterval: 0.16,
  closeCallCoins: 1,
};

// -- Mini run goals shown in HUD ------------------------------
const MINI_GOAL_DEFS = [
  { id: 'coins5',    label: 'Collect 5 coins',   icon: '', stat: 'pickupCoins', goal: 5,    reward: 4 },
  { id: 'miss2',     label: 'Near-miss x2',       icon: '', stat: 'nearMisses',  goal: 2,    reward: 4 },
  { id: 'score2k',   label: 'Score 2,000',         icon: '', stat: 'score',       goal: 2000, reward: 5 },
  { id: 'survive30', label: 'Survive 30s',          icon: '', stat: 'seconds',     goal: 30,   reward: 4 },
  { id: 'combo5',    label: '5x combo',             icon: '', stat: 'combo',       goal: 5,    reward: 5 },
  { id: 'coins10',   label: 'Collect 10 coins',     icon: '', stat: 'pickupCoins', goal: 10,   reward: 6 },
  { id: 'miss5',     label: 'Near-miss x5',         icon: '', stat: 'nearMisses',  goal: 5,    reward: 6 },
  { id: 'score5k',   label: 'Score 5,000',           icon: '', stat: 'score',       goal: 5000, reward: 7 },
];

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
  // -- Easy ----------------------------------------------
  {
    id: 'survive45',    difficulty: 'easy',
    label: 'Survivor I',
    description: 'Survive for 45 seconds in a single run.',
    stat: 'seconds',    goal: 45,   coinReward: 10,
  },
  {
    id: 'score5000',    difficulty: 'easy',
    label: 'Score Seeker',
    description: 'Reach a score of 5,000 in a single run.',
    stat: 'score',      goal: 5000, coinReward: 10,
  },
  {
    id: 'nearmiss3',    difficulty: 'easy',
    label: 'Close Shave',
    description: 'Land 3 near misses in a single run.',
    stat: 'nearMissesThisRun', goal: 3, coinReward: 10,
  },
  {
    id: 'streak3',      difficulty: 'easy',
    label: 'On a Roll',
    description: 'Play ShiftPanic 3 days in a row.',
    stat: 'streak',     goal: 3,    coinReward: 10,
  },
  // -- Medium ------------------------------------------
  {
    id: 'survive180',   difficulty: 'medium',
    label: 'Survivor II',
    description: 'Survive for 3 minutes in a single run.',
    stat: 'seconds',    goal: 180,  coinReward: 20,
  },
  {
    id: 'score15000',   difficulty: 'medium',
    label: 'High Scorer',
    description: 'Reach a score of 15,000 in a single run.',
    stat: 'score',      goal: 15000, coinReward: 20,
  },
  {
    id: 'colorchange20', difficulty: 'medium',
    label: 'Color Veteran',
    description: 'Survive 20 color shifts in one run.',
    stat: 'colorChanges', goal: 20, coinReward: 20,
  },
  {
    id: 'powerups25',   difficulty: 'medium',
    label: 'Power Hoarder',
    description: 'Collect 25 power-ups across all runs.',
    stat: 'powerupsThisRun', goal: 25, coinReward: 20, cumulative: true,
  },
  {
    id: 'streak7',      difficulty: 'medium',
    label: 'Week Warrior',
    description: 'Play ShiftPanic 7 days in a row.',
    stat: 'streak',     goal: 7,    coinReward: 20,
  },
  // -- Hard ----------------------------------------------
  {
    id: 'survive360',   difficulty: 'hard',
    label: 'Ironclad',
    description: 'Survive for 6 minutes in a single run.',
    stat: 'seconds',    goal: 360,  coinReward: 40,
  },
  {
    id: 'score35000',   difficulty: 'hard',
    label: 'Score Master',
    description: 'Reach a score of 35,000 in a single run.',
    stat: 'score',      goal: 35000, coinReward: 40,
  },
  {
    id: 'panic3run',    difficulty: 'hard',
    label: 'Panic Proof',
    description: 'Survive 3 panic waves in a single run.',
    stat: 'panicWavesSurvived', goal: 3, coinReward: 40,
  },
  {
    id: 'combo20',      difficulty: 'hard',
    label: 'Combo King',
    description: 'Reach a 20x combo in a single run.',
    stat: 'maxCombo',   goal: 20,   coinReward: 40,
  },
  {
    id: 'nearmiss10',   difficulty: 'hard',
    label: 'Bulletproof',
    description: 'Land 10 near misses in a single run.',
    stat: 'nearMissesThisRun', goal: 10, coinReward: 40,
  },
  {
    id: 'streak30',     difficulty: 'hard',
    label: 'Dedicated',
    description: 'Play ShiftPanic 30 days in a row.',
    stat: 'streak',     goal: 30,   coinReward: 40,
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

// -- Daily streak tracking ----------------------------------------------
function todayDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function updateStreak() {
  const today = todayDateStr();
  if (settings.streakLastDate === today) return;
  const lastDate  = settings.streakLastDate ? new Date(settings.streakLastDate) : null;
  const todayDate = new Date(today);
  const diffDays  = lastDate ? Math.round((todayDate - lastDate) / 86400000) : 0;
  if (diffDays === 1) {
    settings.streakCount = (settings.streakCount || 0) + 1;
  } else {
    settings.streakCount = 1;
  }
  settings.streakLastDate = today;
  saveSettings();
}

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

// Returns true if a difficulty tier is locked (prerequisite tier not fully claimed)
function isTierLocked(difficulty) {
  if (difficulty === 'easy') return false;
  const pre = difficulty === 'medium' ? 'easy' : 'medium';
  return !MISSION_DEFS.filter(m => m.difficulty === pre).every(m => isMissionClaimed(m));
}

// Called every completed game to evaluate all missions against current run stats
function evaluateMissions() {
  let anyNewlyDone = false;
  MISSION_DEFS.forEach(m => {
    if (isMissionDone(m)) return;
    if (isTierLocked(m.difficulty)) return; // tier prerequisite not met
    if (!missionState[m.id]) missionState[m.id] = { done: false, claimed: false, progress: 0 };
    const ms = missionState[m.id];

    const statVal = m.stat === 'streak' ? (settings.streakCount || 0) : (missionRun[m.stat] || 0);
    if (m.cumulative) {
      ms.progress += statVal;
    } else {
      ms.progress = Math.max(ms.progress, statVal);
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
  toast.innerHTML = '<strong>' + m.label + '</strong> complete!<br><small>Open Shop to claim <strong>+' + (m.coinReward || 20) + ' coins</strong></small>';
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
  settings.coins += (m.coinReward || 20);
  saveSettings();
  updateCoinUI(true);
  updateMissionUI();
  // Flash animation on the card
  const card = document.querySelector('.mission-item[data-mission-id="' + id + '"]');
  if (card) {
    card.classList.add('mission-claim-flash');
    setTimeout(() => card.classList.remove('mission-claim-flash'), 700);
  }
}

function buildMissionCard(m) {
  const done    = isMissionDone(m);
  const claimed = isMissionClaimed(m);
  const locked  = isTierLocked(m.difficulty);
  const prog    = getMissionProgress(m);
  const pct     = Math.min(100, Math.round((prog / m.goal) * 100));

  const item = document.createElement('div');
  item.className = 'mission-item' +
    (locked ? ' mission-tier-locked' : done ? ' mission-completed' : '');
  item.dataset.missionId = m.id;

  const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[m.difficulty] || '';
  const diffBadge = '<span class="mission-diff mission-diff-' + (m.difficulty || 'easy') + '">' + diffLabel + '</span>';
  const coinAmt   = m.coinReward || 20;
  const rewardBadge = locked ? '' :
    '<span class="mission-reward"><span class="coin-icon coin-sm" aria-hidden="true"></span>' + coinAmt + '</span>';

  let footer;
  if (locked) {
    const unlockTier = m.difficulty === 'medium' ? 'Easy' : 'Medium';
    footer = '<p class="mission-locked-label">Complete all ' + unlockTier + ' challenges to unlock</p>';
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

  return item;
}

function updateMissionUI() {
  const list     = document.getElementById('missions-list');
  const doneList = document.getElementById('missions-completed-list');
  const doneWrap = document.getElementById('missions-completed-section');
  if (!list) return;

  list.innerHTML = '';
  const completedItems = [];

  MISSION_DEFS.forEach(m => {
    if (isMissionClaimed(m)) {
      completedItems.push(m);
    } else {
      list.appendChild(buildMissionCard(m));
    }
  });

  // Completed section
  if (doneList && doneWrap) {
    doneList.innerHTML = '';
    doneWrap.hidden = completedItems.length === 0;
    completedItems.forEach(m => {
      const item = document.createElement('div');
      item.className = 'mission-item mission-done';
      const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[m.difficulty] || '';
      item.innerHTML =
        '<div class="mission-row">' +
          '<span class="mission-label">' + m.label + '</span>' +
          '<span class="mission-meta">' +
            '<span class="mission-diff mission-diff-' + m.difficulty + '">' + diffLabel + '</span>' +
          '</span>' +
        '</div>' +
        '<p class="mission-desc">' + m.description + '</p>' +
        '<p class="mission-claimed-label">OK Claimed</p>';
      doneList.appendChild(item);
    });
  }

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
  masterVol:      0.85,
  musicVol:       0.70,
  sfxVol:         0.80,
  reducedMotion:  false,
  highContrast:   false,
  colorblind:     false,
  perfMode:       'high', // 'high' | 'low' - Low reduces particles, glow, and animations
  screenShake:    true,
  particles:      true,
  showFps:        false,
  bestScore:      0,
  lifetimeScore:  0,
  selectedSkin:   'classic',
  coins:          0,
  purchasedSkins: [],
  lifetimeRewards: [],
  powerupUpgrades: {},
  streakCount:    0,
  streakLastDate: '',
  // Version guards: persisted so one-time migrations only fire once per version bump.
  economyVersion: 2,  // keep in sync with ECONOMY_VERSION constant
  skinVersion:    1,  // keep in sync with SKIN_VERSION constant
};

let score         = 0;
let combo         = 0;
let maxCombo      = 0;
let gameStartTime = 0;
let pausedDuration  = 0; // total ms spent paused - excluded from all elapsed calculations
let pauseStartTime  = 0; // performance.now() at the moment pause began
let graceTimer    = 0;
let lastFrameTime = 0;

let obstacles     = [];
let particles     = [];
let powerups      = [];
let coinItems     = []; // collectable gold coin pickups
let floatingTexts = [];
let ringBursts    = []; // expanding ring effects for powerup pickups

// Milestone banner - one large centre-screen announcement at a time
let milestoneBanner = null; // { text, color, timer, totalTime, scale }
let _scoreMilestonesHit = new Set();
let _timeMilestonesHit  = new Set();
let _comboMilestonesHit = new Set();

const player = { x: 0, y: 0, radius: 24, baseRadius: 24, speed: 255, hasShield: false, vx: 0, vy: 0 };
let playerTrail = []; // recent positions for trail-producing skins

let spawnTimer        = 0;
let spawnRate         = 0.60;  // matches GAME_CONFIG.spawnRate  hard from frame 1
let forbiddenTimer    = 0;
let forbiddenInterval = 2.6;   // matches GAME_CONFIG.forbiddenInterval
let warningActive     = false;
let nextForbiddenIdx  = -1;
let powerupTimer      = 0;
let coinItemTimer     = 0;

let difficultyBumps   = 0;
let difficultyTimer   = 0;
let speedMultiplier   = 1.0;
let difficultyPhase   = 0;   // 0=Intro 1=Build 2=Engage 3=Intense 4=Expert
let forbiddenIndex    = 0;

let activePowerupKey   = null;
let activePowerupTimer = 0;
let activePowerupTotal = 0;
let playerRadiusTarget = 24; // lerp target for smooth SMALL powerup shrink/restore

let colorChangeGrace   = 0; // s remaining - brief invincibility on forbidden color change

let nearMissCooldownTimer = 0; // global cooldown (s) to prevent near-miss spam from multiple simultaneous blocks
let nearMissGlowTimer    = 0; // 0->1 - boosts player glow briefly on near miss
let coinPickupFlashTimer = 0; // 0->1 - brief gold screen pulse on coin collect

// -- Coin streak & run tracking -------------------------------
let coinStreakCount         = 0;   // consecutive coins collected without gap
let coinStreakTimer         = 0;   // countdown (s) until streak resets
let roundCoins = 0;  // coins earned from in-run pickups

// -- Mini run goal --------------------------------------------
let runMiniGoal = null; // { ...def, progress: 0, done: false }

let shakeX = 0, shakeY = 0, shakeTimer = 0;

// Panic wave state
let panicCooldown  = 10;   // first panic wave fires ~10s in (was 18)  immediate pressure
let panicTimer     = 0;   // counts up during cooldown / down during wave / down during announce
let panicPhase     = 'cooldown'; // 'cooldown' | 'announce' | 'wave'
let panicDuration  = 0;   // chosen length of current wave (2-4 s)
let comboPulseTimer = 0;  // 0->1 flash on combo increase, decays over ~0.35s
let flowState = {
  meter: 0,
  idleTime: 0,
  areaTime: 0,
  campPressure: 0,
  anchorX: 0,
  anchorY: 0,
  prevX: 0,
  prevY: 0,
  particleTimer: 0,
  displayCombo: -1,
};

// -- Try Mode & Shop Preview ----------------------------------
const tryMode = { active: false, timer: 0, duration: 8, originalSkin: null };
let _shopPreviewRaf      = null;
let _shopPreviewSkinId   = null;

// Double Danger state
let ddPhase        = 'idle';  // 'idle' | 'announce' | 'active'
let ddTimer        = 0;
let ddCooldown     = 35;      // first event ~35-53 s in
let ddDuration     = 0;
let dd2ndIndex     = -1;      // second forbidden color (-1 = none)
let ddBlockTimer   = 0;       // s remaining before DD can fire (post-panic buffer)
let panicBlockFromDD = 0;     // s remaining before panic wave can fire (post-DD buffer)

// Roaming safe-gap state - the open corridor wanders across the screen over time.
// Resets on startGame. Drives pickSafeLane() so the player must keep repositioning.
let _safeLaneDrift   = 2;   // which lane the open gap is currently biased toward
let _lastSafeLane    = -1;  // the safe lane chosen last wave - prevents same column repeat
let _wavesUntilDrift = 3;   // countdown: when 0, _safeLaneDrift shifts +/-1
let _safeLaneStreak  = 0;   // consecutive waves that picked the same safe lane
let _lastPlayerLaneSeen = -1; // player lane at previous spawn wave
let _samePlayerLaneWaves = 0; // consecutive spawn waves player stayed in same lane
let _playerLaneSafeStreak = 0; // consecutive waves where player's lane was picked as safe
let _playerLaneShieldStreak = 0; // consecutive single-spawn waves that avoided player's lane

const PANIC_ANNOUNCE = 0.9; // s of banner before wave starts
const PANIC_COOLDOWN_BASE = 5;  // s between panic waves  frequent surges (was 6)
const PANIC_COOLDOWN_VAR  = 4;  // random extra: 5-9 s gap

const DD_MIN_PLAYTIME   = 12;   // earliest Double Danger can fire  sooner (was 15s)
const DD_COOLDOWN_BASE  = 20;   // s between DD events  more frequent (was 24)
const DD_COOLDOWN_VAR   = 12;   // randomised range: 20-32 s (was 24-38)
const DD_ANNOUNCE       = 0.75; // warning banner duration (s)
const EVENT_POST_BUFFER = 4.0;  //  buffer between any two special events (was 5s)

const keys      = { left: false, right: false, up: false, down: false };
const touchDirs = { left: false, right: false, up: false, down: false };
let touchTarget = null; // canvas drag: {x,y} in canvas coords, or null

let canvas, ctx, rafHandle = null;

// ============================================================
// SECTION 3: SETTINGS & LOCAL STORAGE
// ============================================================

// -- Lifetime stats ---------------------------------------
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

function formatNumber(value) {
  return Math.floor(Math.max(0, value || 0)).toLocaleString();
}

function renderStatsUI() {
  const el = document.getElementById('stats-grid');
  if (!el) return;
  gameStats.bestScore = settings.bestScore; // keep in sync
  const rows = [
    { label: 'Lifetime Score',       value: formatNumber(settings.lifetimeScore || 0) },
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
    let _migrated = false;
    // Load version guards FIRST so that saveSettings() will persist them.
    // Without this, economyVersion is never saved and the migration fires every reload.
    if (typeof s.economyVersion === 'number') settings.economyVersion = s.economyVersion;
    if (typeof s.skinVersion    === 'number') settings.skinVersion    = s.skinVersion;
    if (settings.economyVersion < ECONOMY_VERSION) {
      // Economy was rebalanced - reset coins only, preserve everything else
      s.coins = 0;
      s.economyVersion = ECONOMY_VERSION;
      settings.economyVersion = ECONOMY_VERSION;  // persisted via saveSettings()
      _migrated = true;
    }
    if (settings.skinVersion < SKIN_VERSION) {
      // Skin shop converted to coin-only - reset purchased skins once
      s.purchasedSkins = [];
      s.selectedSkin = 'classic';
      s.skinVersion = SKIN_VERSION;
      settings.skinVersion = SKIN_VERSION;  // persisted via saveSettings()
      _migrated = true;
    }
    if (typeof s.sound         === 'boolean') settings.sound         = s.sound;
    if (typeof s.masterVol     === 'number')  settings.masterVol     = Math.max(0, Math.min(1, s.masterVol));
    if (typeof s.musicVol      === 'number')  settings.musicVol      = Math.max(0, Math.min(1, s.musicVol));
    if (typeof s.sfxVol        === 'number')  settings.sfxVol        = Math.max(0, Math.min(1, s.sfxVol));
    if (typeof s.reducedMotion === 'boolean') settings.reducedMotion = s.reducedMotion;
    if (typeof s.highContrast  === 'boolean') settings.highContrast  = s.highContrast;
    if (typeof s.colorblind    === 'boolean') settings.colorblind    = s.colorblind;
    if (s.perfMode === 'low' || s.perfMode === 'high') settings.perfMode = s.perfMode;
    if (typeof s.screenShake === 'boolean') settings.screenShake = s.screenShake;
    if (typeof s.particles   === 'boolean') settings.particles   = s.particles;
    if (typeof s.showFps     === 'boolean') settings.showFps     = s.showFps;
    // Migrate old colorMode string format
    if (s.colorMode === 'high-contrast') settings.highContrast = true;
    if (s.colorMode === 'colorblind')    settings.colorblind   = true;
    if (typeof s.selectedSkin === 'string' && SKIN_DEFS.some(sk => sk.id === s.selectedSkin)) {
      settings.selectedSkin = s.selectedSkin;
    }
    if (typeof s.bestScore === 'number' && s.bestScore >= 0) settings.bestScore = s.bestScore;
    if (typeof s.lifetimeScore === 'number' && s.lifetimeScore >= 0) settings.lifetimeScore = Math.floor(s.lifetimeScore);
    if (typeof s.coins === 'number' && s.coins >= 0) settings.coins = s.coins;
    if (s.powerupUpgrades && typeof s.powerupUpgrades === 'object') {
      settings.powerupUpgrades = s.powerupUpgrades;
    }
    if (typeof s.streakCount === 'number')    settings.streakCount    = s.streakCount;
    if (typeof s.streakLastDate === 'string') settings.streakLastDate = s.streakLastDate;
    if (Array.isArray(s.purchasedSkins)) {
      settings.purchasedSkins = s.purchasedSkins.filter(id => SKIN_DEFS.some(sk => sk.id === id));
    }
    if (Array.isArray(s.lifetimeRewards)) {
      settings.lifetimeRewards = s.lifetimeRewards.filter(id => LIFETIME_REWARD_DEFS.some(reward => reward.id === id));
    }
    normalizePowerupUpgradeState();
    normalizeLifetimeRewardState();
    if (_migrated) saveSettings();
  } catch (_) {}
}

function saveSettings() {
  try { localStorage.setItem('forbiddenColor_settings', JSON.stringify(settings)); } catch (_) {}
}

function applyColorMode() {
  document.body.classList.toggle('mode-high-contrast', !!settings.highContrast);
  document.body.classList.toggle('mode-colorblind',    !!settings.colorblind);
  document.body.classList.toggle('reduced-motion',     !!settings.reducedMotion);
  // perf-low: strips backdrop-filters, pauses most CSS animations, reduces blob blur
  document.body.classList.toggle('perf-low',           settings.perfMode === 'low');
}

//  Settings drawer open/close helpers 
function openSettingsDrawer() {
  const panel   = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-drawer-overlay');
  if (!panel) return;
  panel.hidden   = false;
  overlay.hidden = false;
  requestAnimationFrame(() => {
    panel.classList.add('sdr-open');
    overlay.classList.add('sdr-open');
  });
  panel.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    const first = panel.querySelector('button,[href],input,[tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  });
}
function closeSettingsDrawer() {
  const panel   = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-drawer-overlay');
  if (!panel) return;
  panel.classList.remove('sdr-open');
  overlay.classList.remove('sdr-open');
  panel.setAttribute('aria-hidden', 'true');
  const onEnd = () => {
    panel.hidden   = true;
    overlay.hidden = true;
    panel.removeEventListener('transitionend', onEnd);
  };
  panel.addEventListener('transitionend', onEnd, { once: true });
  // Return focus to gear button
  const gear = document.getElementById('btn-gear-settings');
  if (gear) gear.focus();
}

function applySettingsToUI() {
  const soundEl    = document.getElementById('sound-toggle');
  const rmEl       = document.getElementById('reduced-motion-toggle');
  const hcEl       = document.getElementById('high-contrast-toggle');
  const cbEl       = document.getElementById('colorblind-toggle');
  const pmEl       = document.getElementById('perf-mode-toggle');
  const shakeEl    = document.getElementById('screen-shake-toggle');
  const partEl     = document.getElementById('particles-toggle');
  const fpsEl      = document.getElementById('fps-toggle');
  const hsEl       = document.getElementById('home-highscore');
  const musicVolEl = document.getElementById('music-vol-slider');
  const sfxVolEl   = document.getElementById('sfx-vol-slider');

  // Note: sound-toggle now means "Mute All"  checked = muted, so invert
  if (soundEl)  soundEl.checked  = !settings.sound;
  if (rmEl)     rmEl.checked     = settings.reducedMotion;
  if (hcEl)     hcEl.checked     = settings.highContrast;
  if (cbEl)     cbEl.checked     = settings.colorblind;
  if (pmEl)     pmEl.checked     = settings.perfMode === 'low';
  if (shakeEl)  shakeEl.checked  = settings.screenShake !== false; // default on
  if (partEl)   partEl.checked   = settings.particles !== false;   // default on
  if (fpsEl)    fpsEl.checked    = !!settings.showFps;
  if (hsEl)     hsEl.textContent = settings.bestScore;
  if (musicVolEl) {
    musicVolEl.value = Math.round((settings.musicVol ?? VOL_DEFAULTS.music) * 100);
    const lbl = document.getElementById('music-vol-val');
    if (lbl) lbl.textContent = musicVolEl.value + '%';
  }
  if (sfxVolEl) {
    sfxVolEl.value = Math.round((settings.sfxVol ?? VOL_DEFAULTS.sfx) * 100);
    const lbl = document.getElementById('sfx-vol-val');
    if (lbl) lbl.textContent = sfxVolEl.value + '%';
  }

  // Sync FPS counter visibility
  const fpsCtr = document.getElementById('fps-counter');
  if (fpsCtr) fpsCtr.hidden = !settings.showFps;

  // Wire change listeners once (idempotent guard via _settingsWired flag)
  if (!applySettingsToUI._wired) {
    applySettingsToUI._wired = true;
    // Mute All  inverted: checked = muted
    if (soundEl) soundEl.addEventListener('change', () => {
      settings.sound = !soundEl.checked; saveSettings(); AudioManager.refreshAllVolumes();
    });
    if (rmEl) rmEl.addEventListener('change', () => {
      settings.reducedMotion = rmEl.checked; saveSettings(); applyColorMode();
    });
    if (hcEl) hcEl.addEventListener('change', () => {
      settings.highContrast = hcEl.checked; saveSettings(); applyColorMode();
    });
    if (cbEl) cbEl.addEventListener('change', () => {
      settings.colorblind = cbEl.checked; saveSettings(); applyColorMode();
    });
    if (pmEl) pmEl.addEventListener('change', () => {
      settings.perfMode = pmEl.checked ? 'low' : 'high'; saveSettings(); applyColorMode();
    });
    if (shakeEl) shakeEl.addEventListener('change', () => {
      settings.screenShake = shakeEl.checked; saveSettings();
    });
    if (partEl) partEl.addEventListener('change', () => {
      settings.particles = partEl.checked; saveSettings();
    });
    if (fpsEl) fpsEl.addEventListener('change', () => {
      settings.showFps = fpsEl.checked; saveSettings();
      const fpsCtr = document.getElementById('fps-counter');
      if (fpsCtr) fpsCtr.hidden = !settings.showFps;
    });
    if (musicVolEl) musicVolEl.addEventListener('input', () => {
      settings.musicVol = parseInt(musicVolEl.value, 10) / 100;
      const lbl = document.getElementById('music-vol-val');
      if (lbl) lbl.textContent = musicVolEl.value + '%';
      saveSettings(); AudioManager.refreshAllVolumes();
    });
    if (sfxVolEl) sfxVolEl.addEventListener('input', () => {
      settings.sfxVol = parseInt(sfxVolEl.value, 10) / 100;
      const lbl = document.getElementById('sfx-vol-val');
      if (lbl) lbl.textContent = sfxVolEl.value + '%';
      saveSettings(); AudioManager.refreshAllVolumes();
    });
  }
  updateSkinsUI();
  updateCoinUI();
  renderLifetimeProgressUI();
  updatePowerupUpgradeUI();
  applyColorMode();
}

function normalizeLifetimeRewardState() {
  if (!Array.isArray(settings.lifetimeRewards)) {
    settings.lifetimeRewards = [];
  }
  settings.lifetimeRewards = [...new Set(settings.lifetimeRewards)]
    .filter(id => LIFETIME_REWARD_DEFS.some(reward => reward.id === id));
}

function isLifetimeRewardUnlocked(id) {
  normalizeLifetimeRewardState();
  return settings.lifetimeRewards.includes(id);
}

function getNextLifetimeReward() {
  normalizeLifetimeRewardState();
  return LIFETIME_REWARD_DEFS.find(reward => !isLifetimeRewardUnlocked(reward.id)) || null;
}

function getLifetimeProgressState() {
  const total = Math.max(0, Math.floor(settings.lifetimeScore || 0));
  const nextReward = getNextLifetimeReward();
  if (!nextReward) {
    return { total, nextReward: null, pct: 100 };
  }
  const previousMilestone = LIFETIME_REWARD_DEFS
    .filter(reward => reward.milestone < nextReward.milestone)
    .reduce((max, reward) => Math.max(max, reward.milestone), 0);
  const span = Math.max(1, nextReward.milestone - previousMilestone);
  const current = Math.max(0, Math.min(span, total - previousMilestone));
  return {
    total,
    nextReward,
    pct: Math.max(0, Math.min(100, Math.round((current / span) * 100))),
  };
}

function unlockLifetimeRewards(prevScore, newScore) {
  normalizeLifetimeRewardState();
  const unlocked = [];
  LIFETIME_REWARD_DEFS.forEach(reward => {
    // Only auto-unlock skin rewards - coin/badge rewards require explicit player claim.
    // Skins must be immediately available as a playable asset when the score threshold is crossed.
    if (reward.type !== 'skin') return;
    if (prevScore < reward.milestone && newScore >= reward.milestone && !settings.lifetimeRewards.includes(reward.id)) {
      settings.lifetimeRewards.push(reward.id);
      unlocked.push(reward.id);
    }
  });
  normalizeLifetimeRewardState();
  return unlocked;
}

function claimLifetimeReward(id) {
  const reward = LIFETIME_REWARD_DEFS.find(r => r.id === id);
  if (!reward) return;
  if (isLifetimeRewardUnlocked(id)) return;              // already claimed
  if (reward.type === 'skin') return;                    // skins auto-unlock on score threshold
  const total = Math.floor(settings.lifetimeScore || 0);
  if (total < reward.milestone) return;                  // not yet earned

  settings.lifetimeRewards.push(id);
  normalizeLifetimeRewardState();

  if (reward.type === 'coins' && reward.coins) {
    settings.coins = (settings.coins || 0) + reward.coins;
    updateCoinUI(true);
    _showCoinRewardToast(reward.coins);
  }

  saveSettings();
  Audio.uiClick();
  renderLifetimeProgressUI();
}

function renderLifetimeProgressUI() {
  normalizeLifetimeRewardState();
  const progress   = getLifetimeProgressState();
  const total      = progress.total;
  const nextReward = progress.nextReward;

  // -- Home screen elements -----------------------------------------
  const homeScore  = document.getElementById('home-lifetime-score');
  const homeBar    = document.getElementById('home-lifetime-bar');
  const homeNext   = document.getElementById('home-lifetime-next');
  const homeDetail = document.getElementById('home-lifetime-detail');
  if (homeScore)  homeScore.textContent  = formatNumber(total);
  if (homeBar)    homeBar.style.width    = progress.pct + '%';
  if (homeNext)   homeNext.textContent   = nextReward
    ? 'Next unlock at ' + formatNumber(nextReward.milestone) + ' Lifetime Score'
    : 'All lifetime rewards unlocked!';
  if (homeDetail) homeDetail.textContent = nextReward
    ? formatNumber(total) + ' / ' + formatNumber(nextReward.milestone) + ' - ' + nextReward.label
    : 'Every milestone reward claimed';

  // -- Shop panel ---------------------------------------------------
  const headerEl = document.getElementById('lp-header');
  const road     = document.getElementById('lifetime-rewards-list');
  if (!headerEl || !road) return;

  // Header
  const pct = progress.pct;
  headerEl.innerHTML =
    '<div class="lp-header-row">' +
      '<div class="lp-score-block">' +
        '<div class="lp-score-lbl">LIFETIME SCORE</div>' +
        '<div class="lp-score-val" id="lifetime-score-value">' + formatNumber(total) + '</div>' +
      '</div>' +
      '<div class="lp-bar-block">' +
        '<div class="lp-bar-title" id="lifetime-next-target">' + (nextReward
          ? 'Next: ' + nextReward.label + ' at ' + formatNumber(nextReward.milestone)
          : 'All rewards unlocked!') + '</div>' +
        '<div class="lp-bar-row">' +
          '<div class="lp-bar-track">' +
            '<div class="lp-bar-fill" id="lifetime-progress-bar" style="width:' + pct + '%"></div>' +
          '</div>' +
          '<span class="lp-bar-pct">' + pct + '%</span>' +
        '</div>' +
        '<div class="lp-bar-sub" id="lifetime-progress-detail">' + (nextReward
          ? formatNumber(total) + ' / ' + formatNumber(nextReward.milestone)
          : 'Every milestone reward claimed') + '</div>' +
      '</div>' +
    '</div>' +
    '<p class="lp-tagline">Earn lifetime score across all runs to unlock exclusive rewards</p>';

  // Reward Road
  const GLOW = { common: '#94a3b8', rare: '#38bdf8', epic: '#a855f7', legendary: '#fbbf24' };
  const RLBL = { common: 'COMMON',  rare: 'RARE',    epic: 'EPIC',    legendary: 'LEGENDARY' };
  const firstUnclaimed = LIFETIME_REWARD_DEFS.find(r => !isLifetimeRewardUnlocked(r.id));

  road.innerHTML = LIFETIME_REWARD_DEFS.map((reward, i) => {
    const claimed   = isLifetimeRewardUnlocked(reward.id);
    const earned    = total >= reward.milestone;
    // Skins auto-unlock via unlockLifetimeRewards; coins/badges need explicit claim
    const claimable = !claimed && earned && reward.type !== 'skin';
    const isCurrent = reward.id === (firstUnclaimed && firstUnclaimed.id);
    const isFirst   = i === 0;
    const isLast    = i === LIFETIME_REWARD_DEFS.length - 1;
    const glowHex   = GLOW[reward.rarity];
    const remaining = Math.max(0, reward.milestone - total);

    let stateClass = claimed ? 'lp-claimed' : claimable ? 'lp-claimable' : 'lp-locked';
    if (isCurrent && !claimed) stateClass += ' lp-current';

    const lineBefore = (claimed || claimable) ? ' lp-line-filled' : '';
    const lineAfter  = claimed ? ' lp-line-filled' : '';

    let actionHtml;
    if (claimed) {
      actionHtml = '<span class="lp-s-claimed">' + (reward.type === 'skin' ? 'Unlocked' : 'Claimed') + '</span>';
    } else if (claimable) {
      const coinPart = reward.type === 'coins' && reward.coins
        ? ' +' + reward.coins + ' <span class="coin-icon lp-coin-xs" aria-hidden="true"></span>' : '';
      actionHtml = '<button class="lp-claim-btn" data-id="' + reward.id + '" aria-label="Claim ' + reward.label + '">Claim' + coinPart + '</button>';
    } else if (reward.type === 'skin' && earned) {
      actionHtml = '<span class="lp-s-claimed">Unlocked</span>';
    } else {
      actionHtml = '<span class="lp-s-locked">Need ' + formatNumber(remaining) + '</span>';
    }

    return '<div class="lp-node ' + stateClass + ' lp-r-' + reward.rarity + '"' +
               ' style="--glow:' + glowHex + '"' +
               ' data-id="' + reward.id + '"' +
               ' role="listitem"' +
               ' tabindex="0"' +
               ' aria-label="' + reward.label + ', ' + reward.rarity + ', ' + formatNumber(reward.milestone) + ' pts, ' + (claimed ? 'claimed' : claimable ? 'claimable' : 'locked') + '">' +
      '<div class="lp-conn">' +
        '<div class="lp-line lp-line-before' + (isFirst ? ' lp-line-edge' : lineBefore) + '"></div>' +
        '<div class="lp-dot">' +
          '<span class="lp-dot-icon">' + reward.icon + '</span>' +
          (claimed ? '<div class="lp-dot-check">Done</div>' : '') +
        '</div>' +
        '<div class="lp-line lp-line-after' + (isLast ? ' lp-line-edge' : lineAfter) + '"></div>' +
      '</div>' +
      '<div class="lp-tile">' +
        '<div class="lp-tile-rarity">' + RLBL[reward.rarity] + '</div>' +
        '<div class="lp-tile-name">' + reward.label + '</div>' +
        '<div class="lp-tile-score">' + formatNumber(reward.milestone) + ' pts</div>' +
        '<div class="lp-tile-desc">' + reward.description + '</div>' +
        '<div class="lp-tile-action">' + actionHtml + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Event delegation - one listener, no accumulation
  if (!road._lpDelegated) {
    road._lpDelegated = true;
    road.addEventListener('click', e => {
      const btn = e.target.closest('.lp-claim-btn');
      if (btn) claimLifetimeReward(btn.dataset.id);
    });
    road.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const btn = (e.target.closest('.lp-claim-btn')) ||
                    (e.target.closest('.lp-node') && e.target.closest('.lp-node').querySelector('.lp-claim-btn'));
        if (btn) claimLifetimeReward(btn.dataset.id);
      }
    });
  }

  // Scroll the current target node into center view after layout is done
  requestAnimationFrame(() => {
    const cur = road.querySelector('.lp-current');
    if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

function normalizePowerupUpgradeState() {
  if (!settings.powerupUpgrades || typeof settings.powerupUpgrades !== 'object') {
    settings.powerupUpgrades = {};
  }
  POWERUP_UPGRADE_KEYS.forEach(key => {
    const def = POWERUP_UPGRADE_DEFS[key];
    const raw = Number(settings.powerupUpgrades[key]);
    settings.powerupUpgrades[key] = Number.isFinite(raw)
      ? Math.max(0, Math.min(def.maxLevel, Math.floor(raw)))
      : 0;
  });
}

function getPowerupUpgradeLevel(key) {
  if (!POWERUP_UPGRADE_DEFS[key]) return 0;
  normalizePowerupUpgradeState();
  return settings.powerupUpgrades[key] || 0;
}

function getPowerupDuration(key) {
  const def = POWERUP_DEFS[key];
  if (!def) return 0;
  const upDef = POWERUP_UPGRADE_DEFS[key];
  if (!upDef) return def.duration;
  return def.duration + getPowerupUpgradeLevel(key) * upDef.bonusPerLevel;
}

function formatSeconds(seconds) {
  return (Math.round(seconds * 10) / 10).toFixed(1) + 's';
}

function updatePowerupUpgradeUI() {
  const list = document.getElementById('powerup-upgrades-list');
  if (!list) return;
  normalizePowerupUpgradeState();

  const DESC = {
    SHIELD: 'Protects you from one forbidden color hit per run.',
    SMALL:  'Shrinks your ball to slip through tighter gaps.',
    SLOW:   'Slows all tiles for a brief window of control.',
  };
  const ACC_RGB = {
    '#facc15': '250,204,21',
    '#34d399': '52,211,153',
    '#38bdf8': '56,189,248',
    '#fb923c': '251,146,60',
    '#e879f9': '232,121,249',
  };
  const coinSpan = '<span class="coin-icon coin-sm" aria-hidden="true"></span>';

  // Update summary strip
  const summary = document.getElementById('pup-summary');
  if (summary) {
    const totalLevels = POWERUP_UPGRADE_KEYS.reduce((s, k) => s + getPowerupUpgradeLevel(k), 0);
    const maxTotal = POWERUP_UPGRADE_KEYS.reduce((s, k) => s + POWERUP_UPGRADE_DEFS[k].maxLevel, 0);
    summary.innerHTML =
      '<div class="pup-sum-stat"><span class="pup-sum-val">' + POWERUP_UPGRADE_KEYS.length + '</span><span class="pup-sum-lbl">Powerups</span></div>' +
      '<div class="pup-sum-divider"></div>' +
      '<div class="pup-sum-stat"><span class="pup-sum-val">' + totalLevels + ' / ' + maxTotal + '</span><span class="pup-sum-lbl">Levels Owned</span></div>' +
      '<div class="pup-sum-divider"></div>' +
      '<span class="pup-sum-note">Max level 3 each</span>';
  }

  list.innerHTML = POWERUP_UPGRADE_KEYS.map(key => {
    const def = POWERUP_DEFS[key];
    const upDef = POWERUP_UPGRADE_DEFS[key];
    const level = getPowerupUpgradeLevel(key);
    const isMaxed = level >= upDef.maxLevel;
    const nextLevel = Math.min(level + 1, upDef.maxLevel);
    const currentDur = getPowerupDuration(key);
    const nextDur = def.duration + nextLevel * upDef.bonusPerLevel;
    const nextCost = isMaxed ? 0 : upDef.costs[level];
    const canAfford = !isMaxed && settings.coins >= nextCost;
    const accRgb = ACC_RGB[def.color] || '139,92,246';
    const desc = DESC[key] || '';

    const segs = Array.from({ length: upDef.maxLevel }, (_, i) =>
      '<div class="pup-seg' + (i < level ? ' pup-seg-on' : '') + '"></div>'
    ).join('');

    const action = isMaxed
      ? '<div class="pup-max-badge">MAX</div>'
      : '<button class="pup-btn ' + (canAfford ? 'pup-btn-afford' : 'pup-btn-cant') + '" type="button"' +
        ' data-upgrade-key="' + key + '">' +
        coinSpan + '<span>' + nextCost.toLocaleString() + '</span></button>';

    return '<article class="pup-card" data-powerup-key="' + key + '" data-maxed="' + isMaxed + '"' +
      ' style="--pup-acc:' + def.color + ';--pup-acc-rgb:' + accRgb + '">' +
      '<div class="pup-zone-icon"><div class="pup-icon-ring">' + def.icon + '</div></div>' +
      '<div class="pup-zone-info">' +
        '<div class="pup-name-row">' +
          '<span class="pup-name">' + def.label + '</span>' +
          '<span class="pup-level-tag">Lv ' + level + ' / ' + upDef.maxLevel + '</span>' +
        '</div>' +
        '<p class="pup-desc">' + desc + '</p>' +
        '<div class="pup-stats-row">' +
          '<div class="pup-stat"><span class="pup-stat-l">Now</span><span class="pup-stat-v">' + formatSeconds(currentDur) + '</span></div>' +
          '<span class="pup-stat-sep">-></span>' +
          '<div class="pup-stat pup-stat-next"><span class="pup-stat-l">Next</span><span class="pup-stat-v">' + formatSeconds(nextDur) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="pup-zone-action">' +
        '<div class="pup-segs">' + segs + '</div>' +
        action +
      '</div>' +
    '</article>';
  }).join('');
}

function buyPowerupUpgrade(key) {
  const upDef = POWERUP_UPGRADE_DEFS[key];
  if (!upDef) return;
  normalizePowerupUpgradeState();
  const level = getPowerupUpgradeLevel(key);
  if (level >= upDef.maxLevel) return;
  const cost = upDef.costs[level];
  if (settings.coins < cost) return;

  settings.coins -= cost;
  settings.powerupUpgrades[key] = level + 1;
  saveSettings();
  updateCoinUI();
  updatePowerupUpgradeUI();
  updateSkinsUI();
  Audio.uiClick();
}

// ============================================================
// SECTION 4: AUDIO SYSTEM (Web Audio API)
// ============================================================

// Volume defaults  user can override via settings sliders
const VOL_DEFAULTS = { master: 0.85, music: 0.70, sfx: 0.80 };

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

  // Shared SFX output gain (respects sfxVol setting)
  let _sfxGain = null;
  function _sfxOut() {
    const c = ctx_(); if (!c) return null;
    if (!_sfxGain) {
      _sfxGain = c.createGain();
      _sfxGain.gain.value = (settings.sfxVol ?? VOL_DEFAULTS.sfx) * (settings.masterVol ?? VOL_DEFAULTS.master);
      _sfxGain.connect(c.destination);
    }
    return _sfxGain;
  }

  return {
    init()   { ctx_(); },
    getCtx() { return _actx; },
    unlock() {
      if (_actx && _actx.state !== 'suspended') return;
      ctx_();
    },
    refreshSfxVol() {
      if (_sfxGain) {
        _sfxGain.gain.value = (settings.sfxVol ?? VOL_DEFAULTS.sfx) * (settings.masterVol ?? VOL_DEFAULTS.master);
      }
    },

    // Coin collect: sparkling 3-note arpeggio C6E6G6
    collect() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      [[1046.50, 0], [1318.51, 0.055], [1567.98, 0.110]].forEach(([freq, delay]) => {
        const osc = c.createOscillator(); const env = c.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        env.gain.setValueAtTime(0.0001, t + delay);
        env.gain.linearRampToValueAtTime(0.28, t + delay + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.10);
        osc.connect(env); env.connect(dest);
        osc.start(t + delay); osc.stop(t + delay + 0.11);
        const osc2 = c.createOscillator(); const env2 = c.createGain();
        osc2.type = 'triangle'; osc2.frequency.value = freq * 2;
        env2.gain.setValueAtTime(0.0001, t + delay);
        env2.gain.linearRampToValueAtTime(0.08, t + delay + 0.004);
        env2.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.07);
        osc2.connect(env2); env2.connect(dest);
        osc2.start(t + delay); osc2.stop(t + delay + 0.08);
      });
    },

    // Near miss: fast downward noise whoosh
    nearMiss() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const nb = _noise(); if (!nb) return;
      const dest = _sfxOut(); if (!dest) return;
      const t  = c.currentTime;
      const src = c.createBufferSource(); src.buffer = nb;
      const bp  = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(4200, t);
      bp.frequency.exponentialRampToValueAtTime(600, t + 0.14);
      const g = c.createGain();
      src.connect(bp); bp.connect(g); g.connect(dest);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.38, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.start(t); src.stop(t + 0.18);
    },



    // Game over: dramatic impact + descending fail stinger
    gameOver() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      const osc = c.createOscillator(); const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.38);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.75, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.48);
      [[329.63, 0.08], [293.66, 0.20], [261.63, 0.34]].forEach(([freq, delay]) => {
        const o = c.createOscillator(); const eg = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = freq;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        eg.gain.setValueAtTime(0.0001, t + delay);
        eg.gain.linearRampToValueAtTime(0.22, t + delay + 0.010);
        eg.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.18);
        o.connect(lp); lp.connect(eg); eg.connect(dest);
        o.start(t + delay); o.stop(t + delay + 0.20);
      });
      const nb = _noise();
      if (nb) {
        const src = c.createBufferSource(); src.buffer = nb;
        const lp  = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
        const gn  = c.createGain();
        src.connect(lp); lp.connect(gn); gn.connect(dest);
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.linearRampToValueAtTime(0.32, t + 0.004);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        src.start(t); src.stop(t + 0.24);
      }
    },

    // Powerup spawn: ascending shimmer
    powerupSpawn() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = c.createOscillator(); const env = c.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        env.gain.setValueAtTime(0.0001, t + i * 0.045);
        env.gain.linearRampToValueAtTime(0.14, t + i * 0.045 + 0.010);
        env.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.045 + 0.14);
        osc.connect(env); env.connect(dest);
        osc.start(t + i * 0.045); osc.stop(t + i * 0.045 + 0.16);
      });
    },

    // Powerup collect: exciting major chord hit
    powerupCollect() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      [523.25, 659.25, 783.99].forEach(freq => {
        const osc = c.createOscillator(); const env = c.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = freq;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.22, t + 0.008);
        env.gain.setValueAtTime(0.22, t + 0.12);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
        osc.connect(lp); lp.connect(env); env.connect(dest);
        osc.start(t); osc.stop(t + 0.32);
      });
    },

    // Panic riser: upward noise sweep
    panicRiser() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const nb = _noise(); if (!nb) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = nb;
      const bp  = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(4000, t + 0.55);
      const gn = c.createGain();
      src.connect(bp); bp.connect(gn); gn.connect(dest);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(0.35, t + 0.10);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);
      src.start(t); src.stop(t + 0.60);
    },

    // Double danger: stutter bass pulse
    doubleDangerWarning() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      [0, 0.09, 0.18].forEach(delay => {
        const osc = c.createOscillator(); const env = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t + delay);
        osc.frequency.exponentialRampToValueAtTime(55, t + delay + 0.08);
        env.gain.setValueAtTime(0.0001, t + delay);
        env.gain.linearRampToValueAtTime(0.55, t + delay + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.08);
        osc.connect(env); env.connect(dest);
        osc.start(t + delay); osc.stop(t + delay + 0.10);
      });
    },

    warning() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      const osc = c.createOscillator(); const g = c.createGain();
      osc.type = 'square'; osc.frequency.value = 880;
      g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.11);
    },
    comboUp(n) {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      const osc = c.createOscillator(); const g = c.createGain();
      osc.type = 'sine'; osc.frequency.value = 440 + n * 55;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.15);
    },
    uiClick() {
      if (!settings.sound) return;
      const c = ctx_(); if (!c) return;
      const dest = _sfxOut(); if (!dest) return;
      const t = c.currentTime;
      const osc = c.createOscillator(); const g = c.createGain();
      osc.type = 'sine'; osc.frequency.value = 700;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.07);
    },
  };
})();

// ============================================================
// SECTION 4b: DYNAMIC MUSIC ENGINE
// ============================================================

const Music = (() => {
  let _actx       = null;
  let _masterGain = null;
  let _compressor = null;
  let _baseGain   = null;
  let _midGain    = null;   // counter-melody layer (tier 1+)
  let _intGain    = null;
  let _isPlaying  = false;
  let _beat       = 0;
  let _nextBeat   = 0;
  let _schedTimer = null;
  let _bpm        = 142;
  let _intCurrent = 0;
  let _intTarget  = 0;
  let _tierCurrent = 0;    // 0=early, 1=mid(20s+), 2=late(60s+)
  let _beatPhase  = 0;     // 0..1 within current beat (for UI pulse)

  const SCHEDULE_AHEAD = 0.14;
  const LOOKAHEAD_MS   = 55;
  const BEATS_PER_LOOP = 16;   // 4 bars of 4/4  (Am  F  C  G)

  // Bass line: root-tone walk per beat
  const BASS_LINE = [
    110.00, 130.81, 164.81, 130.81,  // Am
     87.31, 110.00, 130.81, 110.00,  // F
    130.81, 164.81, 196.00, 164.81,  // C
     98.00, 123.47, 146.83, 123.47,  // G
  ];

  // Lead melody: descending chord-tone phrase over AmFCG
  // Lead melody A  verse feel (tier 0/1)
  const LEAD_MELODY = [
    659.25, 587.33, 523.25, 440.00,
    698.46, 587.33, 523.25, 349.23,
    659.25, 523.25, 392.00, 329.63,
    587.33, 523.25, 392.00, 493.88,
  ];

  // Lead melody B  high intensity / tier 2
  const LEAD_B = [
    880.00, 783.99, 659.25, 783.99,
    932.33, 783.99, 698.46, 523.25,
    880.00, 783.99, 587.33, 523.25,
    783.99, 698.46, 523.25, 659.25,
  ];

  // Counter-melody (mid+ layer, softer triangle pad)
  const COUNTER = [
    523.25, 493.88, 440.00, 493.88,
    349.23, 392.00, 440.00, 392.00,
    523.25, 440.00, 392.00, 440.00,
    493.88, 440.00, 392.00, 329.63,
  ];

  // Arp chords (16th-note bursts at high intensity)
  const ARP_CHORDS = [
    [440.00, 523.25, 659.25, 880.00],
    [349.23, 440.00, 523.25, 698.46],
    [261.63, 329.63, 392.00, 523.25],
    [196.00, 246.94, 293.66, 392.00],
  ];

  // Chord stab voicings (intensity downbeats)
  const CHORD_STABS = [
    [440.00, 523.25, 659.25],
    [349.23, 440.00, 523.25],
    [261.63, 329.63, 392.00],
    [196.00, 246.94, 293.66],
  ];

  function _ctx_() {
    _actx = Audio.getCtx();
    if (!_actx) return null;
    if (_actx.state === 'suspended') _actx.resume().catch(() => {});
    return _actx;
  }

  let _noiseBuf = null;
  function _noise() {
    if (_noiseBuf) return _noiseBuf;
    const len = _actx.sampleRate;
    _noiseBuf = _actx.createBuffer(1, len, _actx.sampleRate);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return _noiseBuf;
  }

  function _ensureGraph() {
    if (_masterGain) return true;
    const c = _actx; if (!c) return false;
    // Master dynamics compressor for loudness and glue
    _compressor = c.createDynamicsCompressor();
    _compressor.threshold.value = -14;
    _compressor.knee.value      = 6;
    _compressor.ratio.value     = 4;
    _compressor.attack.value    = 0.003;
    _compressor.release.value   = 0.25;
    _compressor.connect(c.destination);
    _masterGain = c.createGain(); _masterGain.gain.value = 0;
    _masterGain.connect(_compressor);
    _baseGain = c.createGain(); _baseGain.gain.value = 0.65;
    _baseGain.connect(_masterGain);
    _midGain = c.createGain(); _midGain.gain.value = 0;
    _midGain.connect(_masterGain);
    _intGain = c.createGain(); _intGain.gain.value = 0;
    _intGain.connect(_masterGain);
    return true;
  }

  // ---- Instruments ----

  function _kick(when) {
    const c = _actx;
    // Sine sweep for body
    const osc = c.createOscillator(); const env = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.18);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(1.0, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.30);
    osc.connect(env); env.connect(_baseGain);
    osc.start(when); osc.stop(when + 0.32);
    // Click transient
    const nb = _noise(); const click = c.createBufferSource(); click.buffer = nb;
    const clickBp = c.createBiquadFilter(); clickBp.type = 'bandpass'; clickBp.frequency.value = 3500; clickBp.Q.value = 0.5;
    const clickEnv = c.createGain();
    clickEnv.gain.setValueAtTime(0.18, when);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, when + 0.010);
    click.connect(clickBp); clickBp.connect(clickEnv); clickEnv.connect(_baseGain);
    click.start(when); click.stop(when + 0.012);
  }

  function _snare(when) {
    const c = _actx; const nb = _noise();
    // Tonal body
    const body = c.createOscillator(); const bodyEnv = c.createGain();
    body.type = 'triangle'; body.frequency.value = 190;
    bodyEnv.gain.setValueAtTime(0.0001, when);
    bodyEnv.gain.linearRampToValueAtTime(0.30, when + 0.002);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, when + 0.10);
    body.connect(bodyEnv); bodyEnv.connect(_baseGain);
    body.start(when); body.stop(when + 0.11);
    // Noise crack
    const src = c.createBufferSource(); src.buffer = nb;
    const hp  = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.55, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.20);
    src.connect(hp); hp.connect(env); env.connect(_baseGain);
    src.start(when); src.stop(when + 0.22);
  }

  function _closedHat(when, vol) {
    const c = _actx; const nb = _noise();
    const src = c.createBufferSource(); src.buffer = nb;
    const hp  = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
    const bp  = c.createBiquadFilter(); bp.type  = 'bandpass'; bp.frequency.value = 12000; bp.Q.value = 0.8;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(vol || 0.20, when + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.030);
    src.connect(hp); hp.connect(bp); bp.connect(env); env.connect(_baseGain);
    src.start(when); src.stop(when + 0.040);
  }

  function _openHat(when) {
    const c = _actx; const nb = _noise();
    const src = c.createBufferSource(); src.buffer = nb;
    const hp  = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.22, when + 0.002);
    env.gain.setValueAtTime(0.22, when + 0.10);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.30);
    src.connect(hp); hp.connect(env); env.connect(_baseGain);
    src.start(when); src.stop(when + 0.32);
  }

  function _bass(when, freq, dur) {
    const c = _actx;
    const osc  = c.createOscillator();
    const osc2 = c.createOscillator(); // power fifth for thickness
    const lp   = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.4;
    const env  = c.createGain();
    osc.type  = 'sawtooth'; osc.frequency.value  = freq;
    osc2.type = 'square';   osc2.frequency.value = freq * 1.5;
    const osc2g = c.createGain(); osc2g.gain.value = 0.18;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.60, when + 0.006);
    env.gain.setValueAtTime(0.60, when + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(lp); osc2.connect(osc2g); osc2g.connect(lp);
    lp.connect(env); env.connect(_baseGain);
    osc.start(when); osc.stop(when + dur + 0.01);
    osc2.start(when); osc2.stop(when + dur + 0.01);
  }

  // Detuned dual-saw lead synth  the main melody voice
  function _lead(when, freq, dur) {
    const c = _actx;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator(); // slight detune for width/warmth
    osc1.type = 'sawtooth'; osc1.frequency.value = freq;
    osc2.type = 'sawtooth'; osc2.frequency.value = freq * 1.006;
    const lp  = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 1.2;
    const g1  = c.createGain(); g1.gain.value = 0.5;
    const g2  = c.createGain(); g2.gain.value = 0.5;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.30, when + 0.008);
    env.gain.setValueAtTime(0.30, when + dur * 0.60);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc1.connect(g1); osc2.connect(g2); g1.connect(lp); g2.connect(lp);
    lp.connect(env); env.connect(_baseGain);
    osc1.start(when); osc1.stop(when + dur + 0.01);
    osc2.start(when); osc2.stop(when + dur + 0.01);
  }

  // Mid-layer: soft pad counter-melody (triangle wave, filtered, goes to _midGain)
  function _counter(when, freq, dur) {
    const c = _actx;
    const osc = c.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = freq;
    const lp  = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.18, when + 0.012);
    env.gain.setValueAtTime(0.18, when + dur * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(lp); lp.connect(env); env.connect(_midGain);
    osc.start(when); osc.stop(when + dur + 0.01);
  }

  // Intensity: punchy square-wave arp note
  function _arp(when, freq) {
    const c = _actx;
    const osc = c.createOscillator(); const env = c.createGain();
    osc.type = 'square'; osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.14, when + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.060);
    osc.connect(env); env.connect(_intGain);
    osc.start(when); osc.stop(when + 0.070);
  }

  // Intensity: percussive chord stab
  function _chordStab(when, freqs) {
    const c = _actx;
    freqs.forEach(freq => {
      const osc = c.createOscillator(); const env = c.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, when);
      env.gain.linearRampToValueAtTime(0.07, when + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
      osc.connect(env); env.connect(_intGain);
      osc.start(when); osc.stop(when + 0.16);
    });
  }

  // ---- Scheduler ----

  function _scheduleOneBeat(when, beat) {
    const BEAT = 60 / _bpm;
    const bar  = Math.floor(beat / 4);  // 03: which chord
    const pos  = beat % 4;              // position within bar

    // --- Drums ---
    // 4-on-the-floor kicks
    if (pos === 0) _kick(when);
    // Syncopated ghost kicks at tier 1+
    if (_tierCurrent >= 1 && (beat === 3 || beat === 11)) _kick(when, 0.55);
    // Backbeat snare on beats 2, 6, 10, 14
    if (pos === 2) _snare(when);
    // Ghost snare at high intensity / tier 2
    if (_tierCurrent >= 2 && _intCurrent > 0.5 && pos === 3) _snare(when);
    // Closed hi-hat every beat; accent on downbeats
    _closedHat(when, pos === 0 ? 0.28 : (pos % 2 === 0 ? 0.18 : 0.14));
    // 16th hi-hats on mid+
    if (_tierCurrent >= 1) _closedHat(when + BEAT * 0.5, 0.08);
    // Open hat on upbeat of bars 2 & 4
    if (beat === 5 || beat === 13) _openHat(when + BEAT * 0.5);
    // Extra hi-hat 16ths at tier 2 / panic
    if (_tierCurrent >= 2 && _intCurrent > 0.6) {
      _closedHat(when + BEAT * 0.25, 0.06);
      _closedHat(when + BEAT * 0.75, 0.06);
    }

    // --- Bass ---
    _bass(when, BASS_LINE[beat], BEAT * 0.80);

    // --- Lead melody (B during high intensity/tier 2) ---
    const melody = (_tierCurrent >= 2 && _intCurrent > 0.5) ? LEAD_B : LEAD_MELODY;
    _lead(when, melody[beat], BEAT * 0.72);

    // --- Counter-melody (mid+ tier) ---
    if (_tierCurrent >= 1) {
      _counter(when, COUNTER[beat], BEAT * 0.65);
    }

    // --- Intensity layers ---
    if (_intCurrent > 0.30) {
      _arp(when, ARP_CHORDS[bar][pos]);
      if (_intCurrent > 0.65) {
        _arp(when + BEAT * 0.5, ARP_CHORDS[bar][(pos + 2) % 4]);
      }
    }
    if (pos === 0 && _intCurrent > 0.58) {
      _chordStab(when, CHORD_STABS[bar]);
    }
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

  function _musicVol() {
    return (settings.musicVol ?? VOL_DEFAULTS.music) * (settings.masterVol ?? VOL_DEFAULTS.master);
  }

  return {
    get beatPhase() { return _beatPhase; },

    start() {
      if (!settings.sound) return;
      const c = _ctx_(); if (!c) return;
      if (c.state === 'suspended') {
        c.resume().then(() => this.start()).catch(() => {});
        return;
      }
      if (!_ensureGraph()) return;
      _noise();
      _isPlaying   = true;
      _beat        = 0;
      _nextBeat    = c.currentTime + 0.06;
      _intCurrent  = 0; _intTarget  = 0;
      _tierCurrent = 0; _beatPhase  = 0;
      _midGain.gain.cancelScheduledValues(c.currentTime);
      _midGain.gain.setValueAtTime(0, c.currentTime);
      _intGain.gain.cancelScheduledValues(c.currentTime);
      _intGain.gain.setValueAtTime(0, c.currentTime);
      _masterGain.gain.cancelScheduledValues(c.currentTime);
      _masterGain.gain.setValueAtTime(0, c.currentTime);
      _masterGain.gain.linearRampToValueAtTime(_musicVol(), c.currentTime + 0.30);
      _scheduler();
    },

    stop() {
      _isPlaying = false;
      clearTimeout(_schedTimer); _schedTimer = null;
      if (!_actx || !_masterGain) return;
      const t = _actx.currentTime;
      _masterGain.gain.cancelScheduledValues(t);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, t);
      _masterGain.gain.linearRampToValueAtTime(0, t + 0.045);
    },

    pause() {
      _isPlaying = false;
      clearTimeout(_schedTimer); _schedTimer = null;
      if (!_actx || !_masterGain) return;
      const t = _actx.currentTime;
      _masterGain.gain.cancelScheduledValues(t);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, t);
      _masterGain.gain.linearRampToValueAtTime(0, t + 0.18);
    },

    resume() {
      if (!settings.sound || _isPlaying) return;
      const c = _ctx_(); if (!c || !_masterGain) return;
      const doResume = () => {
        _isPlaying = true;
        _nextBeat  = c.currentTime + 0.06;
        const t = c.currentTime;
        _masterGain.gain.cancelScheduledValues(t);
        _masterGain.gain.setValueAtTime(0, t);
        _masterGain.gain.linearRampToValueAtTime(_musicVol(), t + 0.20);
        _scheduler();
      };
      if (c.state === 'suspended') { c.resume().then(doResume).catch(() => {}); }
      else { doResume(); }
    },

    // Called every game frame  drives intensity/tier/beat phase for UI sync
    tick(dt) {
      if (!_isPlaying || !_actx || !_intGain) return;

      // Beat phase 01 (for UI pulse sync)
      const beatDur = 60 / _bpm;
      _beatPhase = ((_actx.currentTime % (beatDur * BEATS_PER_LOOP)) / beatDur) % 1;

      // Intensity target from game state
      if (panicPhase === 'wave')  _intTarget = 1.0;
      else if (combo >= 6)        _intTarget = 0.75;
      else if (combo >= 4)        _intTarget = 0.50;
      else if (combo >= 2)        _intTarget = 0.28;
      else                        _intTarget = 0.0;

      const rate  = dt / 0.28;
      const delta = _intTarget - _intCurrent;
      _intCurrent = Math.max(0, Math.min(1, _intCurrent + (delta > 0 ? rate : -rate * 0.7)));
      _intGain.gain.setValueAtTime(_intCurrent * 0.52, _actx.currentTime);

      // Tier transitions driven by elapsed game time
      const elapsed = gameStartTime > 0 ? (performance.now() - gameStartTime - pausedDuration) / 1000 : 0;
      const newTier = elapsed >= 60 ? 2 : (elapsed >= 20 ? 1 : 0);
      if (newTier !== _tierCurrent) {
        _tierCurrent = newTier;
        if (newTier >= 1) {
          _midGain.gain.cancelScheduledValues(_actx.currentTime);
          _midGain.gain.linearRampToValueAtTime(0.42, _actx.currentTime + 4.0);
        }
        if (newTier >= 2) {
          _baseGain.gain.cancelScheduledValues(_actx.currentTime);
          _baseGain.gain.linearRampToValueAtTime(0.75, _actx.currentTime + 2.0);
        }
      }
    },

    setIntensity(level) {
      if (!_actx || !_intGain) return;
      _intTarget = Math.max(0, Math.min(1, level));
    },

    setTempo(multiplier) {
      _bpm = Math.round(142 + ((multiplier - 1.0) / 1.8) * 26);
      _bpm = Math.min(Math.max(_bpm, 142), 168);
    },

    refreshVolume() {
      if (!_masterGain || !_isPlaying) return;
      _masterGain.gain.setValueAtTime(_musicVol(), _actx.currentTime);
    },
  };
})();

// ============================================================
// SECTION 4b: HOME SCREEN MUSIC (calm, futuristic groove)
// ============================================================

const HomeMusic = (() => {
  let _actx       = null;
  let _masterGain = null;
  let _compressor = null;
  let _isPlaying  = false;
  let _beat       = 0;
  let _nextBeat   = 0;
  let _schedTimer = null;
  const BPM       = 118;
  const BEATS     = 8;

  const BASS_H    = [110.00, 130.81, 110.00, 98.00, 87.31, 110.00, 87.31, 98.00];
  const PAD_H     = [[220.00, 261.63, 329.63], [174.61, 220.00, 261.63],
                     [220.00, 261.63, 329.63], [196.00, 246.94, 293.66],
                     [174.61, 220.00, 261.63], [220.00, 261.63, 329.63],
                     [174.61, 220.00, 261.63], [196.00, 246.94, 329.63]];
  const MELODY_H  = [440.00, 523.25, 493.88, 440.00, 392.00, 440.00, 493.88, 523.25];

  function _ctx_() {
    _actx = Audio.getCtx();
    if (!_actx) return null;
    if (_actx.state === 'suspended') _actx.resume().catch(() => {});
    return _actx;
  }
  function _mv() {
    return (settings.musicVol ?? VOL_DEFAULTS.music) * (settings.masterVol ?? VOL_DEFAULTS.master) * 0.68;
  }
  function _ensureGraph() {
    if (_masterGain) return true;
    const c = _actx; if (!c) return false;
    _compressor = c.createDynamicsCompressor();
    _compressor.threshold.value = -16; _compressor.ratio.value = 3;
    _compressor.attack.value = 0.010;  _compressor.release.value = 0.40;
    _compressor.connect(c.destination);
    _masterGain = c.createGain(); _masterGain.gain.value = 0;
    _masterGain.connect(_compressor);
    return true;
  }
  function _pad(when, freqs, dur) {
    freqs.forEach(freq => {
      const osc = _actx.createOscillator(); const env = _actx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, when);
      env.gain.linearRampToValueAtTime(0.06, when + 0.35);
      env.gain.setValueAtTime(0.06, when + dur - 0.30);
      env.gain.linearRampToValueAtTime(0.0001, when + dur);
      osc.connect(env); env.connect(_masterGain);
      osc.start(when); osc.stop(when + dur + 0.01);
    });
  }
  function _homeBass(when, freq, dur) {
    const osc = _actx.createOscillator(); const env = _actx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    const lp = _actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.55, when + 0.018);
    env.gain.setValueAtTime(0.55, when + dur * 0.45);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(lp); lp.connect(env); env.connect(_masterGain);
    osc.start(when); osc.stop(when + dur + 0.01);
  }
  function _homeMelody(when, freq, dur) {
    const osc = _actx.createOscillator(); const env = _actx.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq;
    const lp = _actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.14, when + 0.020);
    env.gain.setValueAtTime(0.14, when + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(lp); lp.connect(env); env.connect(_masterGain);
    osc.start(when); osc.stop(when + dur + 0.01);
  }
  function _homeHat(when) {
    const osc = _actx.createOscillator(); const env = _actx.createGain();
    osc.type = 'sine'; osc.frequency.value = 3200;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.06, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.038);
    osc.connect(env); env.connect(_masterGain);
    osc.start(when); osc.stop(when + 0.04);
  }
  function _scheduleBeat(when, beat) {
    const BEAT = 60 / BPM;
    _pad(when, PAD_H[beat], BEAT * 1.05);
    _homeBass(when, BASS_H[beat], BEAT * 0.72);
    if (beat % 2 === 0) _homeMelody(when, MELODY_H[beat], BEAT * 0.65);
    _homeHat(when + BEAT * 0.5);
    if (beat % 2 === 0) _homeHat(when);
  }
  function _scheduler() {
    if (!_isPlaying || !_actx) return;
    while (_nextBeat < _actx.currentTime + 0.14) {
      _scheduleBeat(_nextBeat, _beat);
      _nextBeat += 60 / BPM;
      _beat = (_beat + 1) % BEATS;
    }
    _schedTimer = setTimeout(_scheduler, 55);
  }
  return {
    start() {
      if (!settings.sound) return;
      const c = _ctx_(); if (!c) return;
      if (c.state === 'suspended') { c.resume().then(() => this.start()).catch(() => {}); return; }
      if (!_ensureGraph()) return;
      _isPlaying = true; _beat = 0; _nextBeat = c.currentTime + 0.06;
      _masterGain.gain.cancelScheduledValues(c.currentTime);
      _masterGain.gain.setValueAtTime(0, c.currentTime);
      _masterGain.gain.linearRampToValueAtTime(_mv(), c.currentTime + 1.2);
      _scheduler();
    },
    stop() {
      _isPlaying = false; clearTimeout(_schedTimer); _schedTimer = null;
      if (!_actx || !_masterGain) return;
      const t = _actx.currentTime;
      _masterGain.gain.cancelScheduledValues(t);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, t);
      _masterGain.gain.linearRampToValueAtTime(0, t + 0.55);
    },
    refreshVolume() {
      if (_masterGain && _isPlaying) _masterGain.gain.setValueAtTime(_mv(), _actx.currentTime);
    },
  };
})();

// ============================================================
// SECTION 4b2: SHOP MUSIC (fun, futuristic, rewarding)
// ============================================================

const ShopMusic = (() => {
  let _actx       = null;
  let _masterGain = null;
  let _compressor = null;
  let _isPlaying  = false;
  let _beat       = 0;
  let _nextBeat   = 0;
  let _schedTimer = null;
  const BPM       = 110;
  const BEATS     = 16;  // 4 bars of 4/4  (C  G  Am  F)

  // Bass line: gentle root-note pulse (C major feel)
  const BASS_S = [
    130.81, 130.81, 146.83, 130.81,  // C
    196.00, 196.00, 220.00, 196.00,  // G
    220.00, 220.00, 246.94, 220.00,  // Am
    174.61, 174.61, 196.00, 174.61,  // F
  ];

  // Sparkly arp melody (C  G  Am  F, single octave higher)
  const ARP_S = [
    523.25, 659.25, 783.99, 659.25,  // C maj
    587.33, 739.99, 880.00, 739.99,  // G maj
    880.00, 783.99, 659.25, 783.99,  // Am
    698.46, 659.25, 523.25, 587.33,  // F maj
  ];

  // Chime accent melody (higher octave, hits on every-other beat)
  const CHIME_S = [
    1046.50, 1318.51, 1567.98, 1318.51,
     784.00,  987.77, 1174.66,  987.77,
    1174.66, 1046.50,  880.00, 1046.50,
    1174.66, 1046.50,  880.00,  783.99,
  ];

  // Pad chord voicings (soft, warm sine pads)
  const PAD_S = [
    [261.63, 329.63, 392.00, 523.25],   // C maj
    [196.00, 246.94, 293.66, 392.00],   // G maj
    [220.00, 261.63, 329.63, 440.00],   // Am
    [174.61, 220.00, 261.63, 349.23],   // F maj
  ];

  function _ctx_() {
    _actx = Audio.getCtx();
    if (!_actx) return null;
    if (_actx.state === 'suspended') _actx.resume().catch(() => {});
    return _actx;
  }
  function _mv() {
    return (settings.musicVol ?? VOL_DEFAULTS.music) * (settings.masterVol ?? VOL_DEFAULTS.master) * 0.72;
  }
  function _ensureGraph() {
    if (_masterGain) return true;
    const c = _actx; if (!c) return false;
    _compressor = c.createDynamicsCompressor();
    _compressor.threshold.value = -14; _compressor.ratio.value = 3;
    _compressor.attack.value = 0.010;  _compressor.release.value = 0.45;
    _compressor.connect(c.destination);
    _masterGain = c.createGain(); _masterGain.gain.value = 0;
    _masterGain.connect(_compressor);
    return true;
  }

  // Soft sine pad  lush, warm chords
  function _pad(when, freqs, dur) {
    freqs.forEach(freq => {
      const osc = _actx.createOscillator(); const env = _actx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, when);
      env.gain.linearRampToValueAtTime(0.045, when + 0.28);
      env.gain.setValueAtTime(0.045, when + dur - 0.25);
      env.gain.linearRampToValueAtTime(0.0001, when + dur);
      osc.connect(env); env.connect(_masterGain);
      osc.start(when); osc.stop(when + dur + 0.01);
    });
  }

  // Sub-bass: smooth sine pulse
  function _bass(when, freq, dur) {
    const osc = _actx.createOscillator(); const env = _actx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    const lp = _actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.50, when + 0.015);
    env.gain.setValueAtTime(0.50, when + dur * 0.50);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(lp); lp.connect(env); env.connect(_masterGain);
    osc.start(when); osc.stop(when + dur + 0.01);
  }

  // Sparkling arp  bright triangle with a quick pluck envelope
  function _arp(when, freq, dur) {
    const c = _actx;
    const osc = c.createOscillator(); const env = c.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq;
    // Gentle detune wobble for a synth-pop shimmer
    const osc2 = c.createOscillator(); const env2 = c.createGain();
    osc2.type = 'triangle'; osc2.frequency.value = freq * 1.004;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.22, when + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    env2.gain.setValueAtTime(0.0001, when);
    env2.gain.linearRampToValueAtTime(0.12, when + 0.008);
    env2.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(env); env.connect(lp);
    osc2.connect(env2); env2.connect(lp);
    lp.connect(_masterGain);
    osc.start(when); osc.stop(when + dur + 0.01);
    osc2.start(when); osc2.stop(when + dur + 0.01);
  }

  // Chime accent  high sine bell with slow decay
  function _chime(when, freq) {
    const c = _actx;
    const osc = c.createOscillator(); const env = c.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.09, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.55);
    osc.connect(env); env.connect(_masterGain);
    osc.start(when); osc.stop(when + 0.57);
  }

  // Light tick percussion (coin-tinkle feel, no snare/kick)
  function _tick(when, vol) {
    const c = _actx;
    const osc = c.createOscillator(); const env = c.createGain();
    osc.type = 'sine'; osc.frequency.value = 2800;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(vol || 0.07, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.025);
    osc.connect(env); env.connect(_masterGain);
    osc.start(when); osc.stop(when + 0.028);
  }

  function _scheduleBeat(when, beat) {
    const BEAT   = 60 / BPM;
    const bar    = Math.floor(beat / 4);  // 0-3
    const pos    = beat % 4;

    // Full pad chord once per bar (on the downbeat)
    if (pos === 0) _pad(when, PAD_S[bar], BEAT * 4.2);

    // Bass on every beat
    _bass(when, BASS_S[beat], BEAT * 0.82);

    // Sparkling arp on every beat
    _arp(when, ARP_S[beat], BEAT * 0.70);

    // Chime accent on beats 0, 4, 8, 12 and halfway through bars 1 & 3
    if (pos === 0) _chime(when, CHIME_S[beat]);
    if (beat === 6 || beat === 14) _chime(when, CHIME_S[beat]);

    // Light ticks  8th-note feel, accenting downbeat of each bar
    _tick(when, pos === 0 ? 0.10 : 0.06);
    _tick(when + BEAT * 0.5, 0.045);
  }

  function _scheduler() {
    if (!_isPlaying || !_actx) return;
    while (_nextBeat < _actx.currentTime + 0.14) {
      _scheduleBeat(_nextBeat, _beat);
      _nextBeat += 60 / BPM;
      _beat = (_beat + 1) % BEATS;
    }
    _schedTimer = setTimeout(_scheduler, 55);
  }

  return {
    start() {
      if (!settings.sound) return;
      const c = _ctx_(); if (!c) return;
      if (c.state === 'suspended') { c.resume().then(() => this.start()).catch(() => {}); return; }
      if (!_ensureGraph()) return;
      _isPlaying = true; _beat = 0; _nextBeat = c.currentTime + 0.06;
      _masterGain.gain.cancelScheduledValues(c.currentTime);
      _masterGain.gain.setValueAtTime(0, c.currentTime);
      _masterGain.gain.linearRampToValueAtTime(_mv(), c.currentTime + 1.5);
      _scheduler();
    },
    stop() {
      _isPlaying = false; clearTimeout(_schedTimer); _schedTimer = null;
      if (!_actx || !_masterGain) return;
      const t = _actx.currentTime;
      _masterGain.gain.cancelScheduledValues(t);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, t);
      _masterGain.gain.linearRampToValueAtTime(0, t + 0.65);
    },
    refreshVolume() {
      if (_masterGain && _isPlaying) _masterGain.gain.setValueAtTime(_mv(), _actx.currentTime);
    },
  };
})();

// ============================================================
// SECTION 4b-2: THEME PLAYER (MP3 file via HTMLMediaElement)
// Plays public/audio/shift-panic-theme.mp3 through the Web Audio
// graph so volume is controlled via the same gain bus as synthesized
// audio.  createMediaElementSource is called exactly once (lazy init).
// ============================================================

const ThemePlayer = (() => {
  let _audioEl   = null;   // <audio id="theme-audio">
  let _srcNode   = null;   // MediaElementAudioSourceNode (created once)
  let _gainNode  = null;   // GainNode for music volume
  let _ctx       = null;   // AudioContext reference
  let _initDone  = false;
  let _wantsPlay = false;  // deferred play requested before context ready

  // Effective volume: musicVol  masterVol (0 when muted)
  function _targetGain() {
    if (!settings.sound) return 0;
    return (settings.musicVol ?? VOL_DEFAULTS.music) *
           (settings.masterVol ?? VOL_DEFAULTS.master);
  }

  // Wire the <audio> element into the Web Audio graph (once per session).
  // Must be called from inside a user-gesture handler.
  function _ensureInit() {
    if (_initDone) return true;
    _audioEl = document.getElementById('theme-audio');
    if (!_audioEl) return false;
    _ctx = Audio.getCtx();
    if (!_ctx) return false;

    // Attach an error listener so a 404 or network fail never crashes the game
    _audioEl.addEventListener('error', (ev) => {
      const code = _audioEl.error ? _audioEl.error.code : '?';
      console.warn('[ThemePlayer] Audio load error (code ' + code + '). Music will be silent. src=' + _audioEl.src);
    }, { once: false });

    try {
      _srcNode  = _ctx.createMediaElementSource(_audioEl);
      _gainNode = _ctx.createGain();
      _gainNode.gain.value = _targetGain();
      _srcNode.connect(_gainNode);
      _gainNode.connect(_ctx.destination);
      _initDone = true;
    } catch (err) {
      // Already connected (e.g. hot-reload)  treat as ready
      console.warn('[ThemePlayer] init error:', err);
      _initDone = true;
    }
    return _initDone;
  }

  function _doPlay() {
    if (!_audioEl) return;
    const promise = _audioEl.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(err => {
        // Autoplay blocked  retry on next user gesture
        if (err.name !== 'AbortError') console.warn('[ThemePlayer] play blocked:', err.name);
      });
    }
  }

  return {
    /** Start / restart from current position (loops automatically). */
    start() {
      if (!_ensureInit()) { _wantsPlay = true; return; }
      _wantsPlay = false;
      if (!_gainNode) return;
      _gainNode.gain.cancelScheduledValues(_ctx.currentTime);
      _gainNode.gain.setValueAtTime(0, _ctx.currentTime);
      _gainNode.gain.linearRampToValueAtTime(_targetGain(), _ctx.currentTime + 0.25);
      if (_ctx.state === 'suspended') {
        _ctx.resume().then(() => _doPlay()).catch(() => {});
      } else {
        _doPlay();
      }
    },

    /** Full stop  pauses and rewinds to beginning. */
    stop() {
      if (!_audioEl) return;
      if (_gainNode && _ctx) {
        const t = _ctx.currentTime;
        _gainNode.gain.cancelScheduledValues(t);
        _gainNode.gain.setValueAtTime(_gainNode.gain.value, t);
        _gainNode.gain.linearRampToValueAtTime(0, t + 0.08);
        setTimeout(() => {
          _audioEl.pause();
          _audioEl.currentTime = 0;
        }, 100);
      } else {
        _audioEl.pause();
        _audioEl.currentTime = 0;
      }
    },

    /** Pause playback (used when game is paused  preserves position). */
    pause() {
      if (!_audioEl) return;
      if (_gainNode && _ctx) {
        const t = _ctx.currentTime;
        _gainNode.gain.cancelScheduledValues(t);
        _gainNode.gain.setValueAtTime(_gainNode.gain.value, t);
        _gainNode.gain.linearRampToValueAtTime(0, t + 0.18);
        setTimeout(() => { _audioEl.pause(); }, 200);
      } else {
        _audioEl.pause();
      }
    },

    /** Resume from paused state. */
    resume() {
      if (!_audioEl || !_gainNode || !_ctx) return;
      const doR = () => {
        _doPlay();
        const t = _ctx.currentTime;
        _gainNode.gain.cancelScheduledValues(t);
        _gainNode.gain.setValueAtTime(0, t);
        _gainNode.gain.linearRampToValueAtTime(_targetGain(), t + 0.20);
      };
      if (_ctx.state === 'suspended') { _ctx.resume().then(doR).catch(() => {}); }
      else { doR(); }
    },

    /** Called by AudioManager.refreshAllVolumes() whenever settings change. */
    refreshVolume() {
      if (!_gainNode || !_ctx) return;
      const target = _targetGain();
      const t = _ctx.currentTime;
      _gainNode.gain.cancelScheduledValues(t);
      _gainNode.gain.setValueAtTime(_gainNode.gain.value, t);
      _gainNode.gain.linearRampToValueAtTime(target, t + 0.08);
      // Also reflect mute state in the media element volume as a fallback
      if (_audioEl) _audioEl.muted = !settings.sound;
    },
  };
})();

// ============================================================
// ============================================================
// SECTION 4c: AUDIO MANAGER (central facade)
// ============================================================

const AudioManager = (() => {
  const COOLDOWNS = {
    coin: 75, nearMiss: 180, death: 0, combo: 100,
    powerupSpawn: 400, powerupCollect: 100, panicRiser: 2000, doubleDanger: 500,
  };
  const _lastPlayed = {};
  const _dispatch = {
    coin:           () => Audio.collect(),
    nearMiss:       () => Audio.nearMiss(),
    death:          () => Audio.gameOver(),
    combo:          (n) => Audio.comboUp(n),
    powerupSpawn:   () => Audio.powerupSpawn(),
    powerupCollect: () => Audio.powerupCollect(),
    panicRiser:     () => Audio.panicRiser(),
    doubleDanger:   () => Audio.doubleDangerWarning(),
  };
  return {
    playSound(name, ...args) {
      if (!settings.sound) return;
      const fn = _dispatch[name]; if (!fn) return;
      const now = performance.now();
      const cd  = COOLDOWNS[name] ?? 100;
      if (now - (_lastPlayed[name] || 0) < cd) return;
      _lastPlayed[name] = now;
      fn(...args);
    },
    setMusicIntensity(level) { Music.setIntensity(level); },
    stopMusic()              { ThemePlayer.stop(); Music.stop(); HomeMusic.stop(); ShopMusic.stop(); },
    startHomeMusic()         { ThemePlayer.stop(); ShopMusic.stop(); Music.stop(); HomeMusic.start(); },
    stopHomeMusic()          { HomeMusic.stop(); },
    startGameMusic()         { HomeMusic.stop(); ShopMusic.stop(); Music.stop(); ThemePlayer.start(); },
    startShopMusic()         { HomeMusic.stop(); ThemePlayer.stop(); Music.stop(); ShopMusic.start(); },
    stopShopMusic()          { ShopMusic.stop(); },
    refreshAllVolumes() {
      Audio.refreshSfxVol();
      Music.refreshVolume();
      HomeMusic.refreshVolume();
      ShopMusic.refreshVolume();
      ThemePlayer.refreshVolume();
    },
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

    // -- Cycle forbidden color ----------------------------------
    forbiddenT -= dt;
    if (forbiddenT <= 0) {
      const cur  = COLORS.indexOf(forbidden);
      let   next = Math.floor(Math.random() * COLORS.length);
      if (next === cur) next = (next + 1) % COLORS.length;
      forbidden  = COLORS[next];
      forbiddenT = 4 + Math.random() * 3;
    }

    // -- Spawn blocks -------------------------------------------
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

    // -- Update blocks ------------------------------------------
    for (let i = blocks.length - 1; i >= 0; i--) {
      blocks[i].y += blocks[i].vy * dt;
      if (blocks[i].y > H + 20) blocks.splice(i, 1);
    }

    // -- Move ghost: steer toward waypoint, dodge forbidden -----
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

    // -- Draw blocks --------------------------------------------
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

    // -- Draw ghost player --------------------------------------
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
    { id: 'combo8',     label: 'Reach an 8x combo',           stat: 'maxCombo',         goal: 8,  coins: 22 },
    { id: 'powerups3',  label: 'Collect 3 power-ups',         stat: 'powerupsThisRun',  goal: 3,  coins: 18 },
  ];

  const STORAGE_KEY = 'forbiddenColor_dailyChallenge';

  // Deterministic seeded pick: date string -> numeric seed -> index
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

  // Claim the reward - called from claim button click
  function claim() {
    if (!_state || !_state.completed || _state.claimed) return;
    _state.claimed = true;
    save();
    const ch = getChallenge();
    settings.coins += ch.coins;
    saveSettings();
    updateCoinUI(true);
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
  const _gear = document.getElementById('btn-gear-settings');
  if (_gear) _gear.hidden = (id === 'game-screen');

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
  const el      = document.getElementById('combo-display');
  const val     = document.getElementById('combo-val');
  const scoreEl = document.getElementById('combo-score-mult');
  const coinEl  = document.getElementById('combo-coin-bonus');
  const fillEl  = document.getElementById('combo-meter-fill');
  if (!el) return;
  el.hidden = false;
  if (val) val.textContent = combo;
  if (scoreEl) scoreEl.textContent = 'Score x' + getFlowScoreMultiplier().toFixed(2);
  if (coinEl)  coinEl.textContent  = 'Coins +' + Math.round((getFlowCoinMultiplier() - 1) * 100) + '%';
  if (fillEl)  fillEl.style.width  = Math.max(0, Math.min(100, (flowState.meter / FLOW_CONFIG.maxCombo) * 100)).toFixed(1) + '%';
  el.classList.remove('combo-idle', 'combo-t2', 'combo-t3', 'combo-t4');
  if      (combo >= 10) el.classList.add('combo-t4');
  else if (combo >= 6)  el.classList.add('combo-t3');
  else if (combo >= 2)  el.classList.add('combo-t2');
  else                  el.classList.add('combo-idle');
  if (flowState.displayCombo !== combo) {
    el.classList.remove('combo-pop');
    void el.offsetWidth;
    el.classList.add('combo-pop');
    flowState.displayCombo = combo;
  }
}

function resetFlowState(x, y) {
  flowState.meter = 0;
  flowState.idleTime = 0;
  flowState.areaTime = 0;
  flowState.campPressure = 0;
  flowState.anchorX = x || 0;
  flowState.anchorY = y || 0;
  flowState.prevX = x || 0;
  flowState.prevY = y || 0;
  flowState.particleTimer = 0;
  flowState.displayCombo = -1;
  combo = 0;
}

function syncComboFromFlow() {
  combo = Math.max(0, Math.min(FLOW_CONFIG.maxCombo, Math.floor(flowState.meter)));
  if (combo > maxCombo) maxCombo = combo;
  missionRun.maxCombo = Math.max(missionRun.maxCombo || 0, combo);
}

function getFlowIntensity() {
  return Math.min(1, combo / FLOW_CONFIG.maxCombo);
}

function getFlowScoreMultiplier() {
  return 1 + Math.min(combo * FLOW_CONFIG.scoreMultPerCombo, FLOW_CONFIG.scoreMultCap);
}

function getFlowCoinMultiplier() {
  return 1 + Math.min(combo * FLOW_CONFIG.coinMultPerCombo, FLOW_CONFIG.coinMultCap);
}

function getActiveSpawnInterval() {
  const comboReduction = Math.min(combo * FLOW_CONFIG.spawnIntervalPerCombo, FLOW_CONFIG.spawnIntervalCap);
  const campReduction  = flowState.campPressure * 0.08;
  const ddMult = (ddPhase === 'active') ? DIFFICULTY_CONFIG.ddSpawnRateMult : 1.0;
  return Math.max(DIFFICULTY_CONFIG.spawnIntervalFloor, panicSpawnRate() * (1 - comboReduction - campReduction) * ddMult);
}

function getActiveForbiddenInterval() {
  const comboReduction = Math.min(combo * FLOW_CONFIG.switchSpeedPerCombo, FLOW_CONFIG.switchSpeedCap);
  return Math.max(1.1, forbiddenInterval * (1 - comboReduction)); //  tighter floor (was 1.2)
}

function getFlowGapTighten() {
  return Math.min(combo * FLOW_CONFIG.gapTightenPerCombo, FLOW_CONFIG.gapTightenCap);
}

function getFlowTargetingBonus() {
  return Math.min(combo * FLOW_CONFIG.targetingPerCombo, FLOW_CONFIG.targetingCap) + flowState.campPressure * 0.10;
}

function getFlowMovingChance() {
  if (combo < 4) return 0;
  return Math.min((combo - 3) * FLOW_CONFIG.extraMovePerCombo, FLOW_CONFIG.extraMoveCap);
}

function getFlowTrickChance() {
  if (combo < FLOW_CONFIG.trickUnlockCombo) return 0;
  return Math.min((combo - FLOW_CONFIG.trickUnlockCombo + 1) * FLOW_CONFIG.trickChancePerCombo, FLOW_CONFIG.trickChanceCap);
}

function pickObstacleTrick(type, postGrace, allowLateral) {
  const chance = getFlowTrickChance();
  if (!postGrace || chance <= 0 || Math.random() >= chance) return null;
  if (type === 2 || type === 3) return 'surge';
  return allowLateral ? (Math.random() < 0.55 ? 'juke' : 'surge') : 'surge';
}

function applyFlowDelta(delta, reason) {
  if (!Number.isFinite(delta) || delta === 0) return;
  const prevCombo = combo;
  flowState.meter = Math.max(0, Math.min(FLOW_CONFIG.maxCombo + 0.999, flowState.meter + delta));
  syncComboFromFlow();
  if (combo > prevCombo) {
    comboPulseTimer = 1;
    for (const threshold of COMBO_MILESTONES) {
      if (combo >= threshold && !_comboMilestonesHit.has(threshold)) {
        _comboMilestonesHit.add(threshold);
        triggerMilestone('x' + threshold + ' FLOW', '#f97316');
      }
    }
    if (reason !== 'idle' && reason !== 'camp' && combo > 1) {
      AudioManager.playSound('combo', combo);
    }
  }
}

function tickFlowSystem(dt) {
  const dx = player.x - flowState.prevX;
  const dy = player.y - flowState.prevY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed = dt > 0 ? dist / dt : 0;
  const moving = speed > FLOW_CONFIG.movementMinSpeed || Math.abs(player.vx) > FLOW_CONFIG.movementMinSpeed || Math.abs(player.vy) > FLOW_CONFIG.movementMinSpeed;

  applyFlowDelta((FLOW_CONFIG.passiveGainPerSec + Math.min(speed / 240, FLOW_CONFIG.motionBonusScale)) * dt, 'survival');

  if (moving || touchTarget || keys.left || keys.right || keys.up || keys.down) {
    flowState.idleTime = 0;
  } else {
    flowState.idleTime += dt;
  }
  if (flowState.idleTime > FLOW_CONFIG.idleGrace) {
    applyFlowDelta(-FLOW_CONFIG.idleDecayPerSec * dt * (1 + flowState.campPressure * 0.8), 'idle');
  }

  if (Math.hypot(player.x - flowState.anchorX, player.y - flowState.anchorY) > FLOW_CONFIG.campRadius) {
    flowState.anchorX = player.x;
    flowState.anchorY = player.y;
    flowState.areaTime = 0;
  } else {
    flowState.areaTime += dt;
  }
  flowState.campPressure = Math.max(0, Math.min(1, (flowState.areaTime - FLOW_CONFIG.campGrace) / 2.1));
  if (flowState.campPressure > 0) {
    applyFlowDelta(-FLOW_CONFIG.campDecayPerSec * flowState.campPressure * dt, 'camp');
  }

  if (combo >= FLOW_CONFIG.ambientFxCombo && !settings.reducedMotion) {
    flowState.particleTimer -= dt;
    if (flowState.particleTimer <= 0) {
      flowState.particleTimer = Math.max(0.08, FLOW_CONFIG.ambientFxInterval - getFlowIntensity() * 0.08);
      const angle = Math.random() * Math.PI * 2;
      const radius = player.radius + 8 + Math.random() * 10;
      spawnParticles(
        player.x + Math.cos(angle) * radius,
        player.y + Math.sin(angle) * radius,
        combo >= 10 ? '#f59e0b' : '#a855f7',
        2
      );
    }
  } else {
    flowState.particleTimer = 0;
  }

  flowState.prevX = player.x;
  flowState.prevY = player.y;
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
  if (id === 'modal-progress') {
    // Pause home bg loops while shop is open - they're hidden anyway and
    // running them alongside the preview loop wastes CPU/GPU unnecessarily.
    HomeBg.stop();
    HomePreview.stop();
    startShopPreviewLoop();
    AudioManager.startShopMusic();
  }
  requestAnimationFrame(() => {
    const first = m.querySelector('button,[href],input,select,[tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  });
}

function hideModal(id) {
  const m = document.getElementById(id);
  if (m) m.hidden = true;
  if (id === 'modal-progress') {
    stopShopPreviewLoop();
    AudioManager.stopShopMusic();
    // Restart home bg loops only if we're on the home screen
    if (currentState === STATE.HOME) {
      HomeBg.start();
      HomePreview.start();
      AudioManager.startHomeMusic();
    }
  }
}

// ============================================================
// SKINS SYSTEM
// ============================================================

function isSkinAvailable(skin) {
  if (skin.lifetimeUnlock) return isLifetimeRewardUnlocked(skin.id);
  if (skin.coinCost) return settings.purchasedSkins.includes(skin.id);
  return settings.bestScore >= skin.unlock;
}

function getSkin() {
  const skin = SKIN_DEFS.find(s => s.id === settings.selectedSkin);
  if (!skin) return SKIN_DEFS[0];
  if (tryMode.active) return skin; // bypass ownership check during try mode
  if (!isSkinAvailable(skin)) return SKIN_DEFS[0];
  return skin;
}

// ============================================================
// SKIN ABILITY ENGINE
// Auto-cooldown, activation, and per-frame effects for the 6
// defence ability skins.  Integrates with game loop, collision,
// coin attraction, obstacle movement, and player speed.
// ============================================================
const SkinAbility = (() => {
  let _def         = null;   // SKIN_ABILITY_DEFS entry, or null
  let _cooldown    = 0;      // seconds until ability fires again (0 = ready)
  let _effectTime  = 0;      // seconds left on active effect; -1 = permanent
  let _active      = false;  // is an effect currently running?
  let _skinShield  = false;  // Neon Shield is armed
  let _ghostMode   = false;  // Ghost Shift phase-through is active
  let _frostActive = false;  // Frost Aura slow is active
  let _dashActive  = false;  // Dash Boost speed multiplier is active

  // Call at game start (after initPlayer) to arm the skin's ability.
  function reset() {
    const skin = getSkin();
    _def        = SKIN_ABILITY_DEFS[skin.id] || null;
    _cooldown   = 0;
    _effectTime = 0;
    _active     = false;
    _skinShield = false;
    _ghostMode  = false;
    _frostActive = false;
    _dashActive  = false;
    // Neon Shield arms immediately.
    if (_def && _def.abilityId === 'shield') {
      _skinShield = true;
      _active     = true;
      _effectTime = -1;
    }
    _updateHUD();
  }

  // Called every game-loop frame.
  function tick(dt) {
    if (!_def || _def.passive) { _updateHUD(); return; }

    if (_active) {
      if (_effectTime > 0) {
        _effectTime -= dt;
        if (_effectTime <= 0) {
          _effectTime = 0;
          _deactivate();
          _cooldown = _def.cooldown;
          _active   = false;
        }
      }
      // _effectTime === -1: permanent until externally triggered (shield).
      _updateHUD();
      return;
    }

    if (_cooldown > 0) {
      _cooldown = Math.max(0, _cooldown - dt);
    }
    if (_cooldown <= 0) {
      _activate();
    }
    _updateHUD();
  }

  function _activate() {
    if (!_def) return;
    _active     = true;
    _effectTime = _def.duration;
    switch (_def.abilityId) {
      case 'shield':
        _skinShield = true;
        _effectTime = -1;
        addFloating(player.x, player.y - 55, '\uD83D\uDEE1 Shield Ready!', '#38bdf8', 20);
        break;
      case 'frost':
        _frostActive = true;
        _doFrostRipple();
        addFloating(player.x, player.y - 55, '\u2744 Frost Aura!', '#93c5fd', 20);
        break;
      case 'dash':
        _dashActive = true;
        spawnParticles(player.x, player.y, '#60a5fa', settings.reducedMotion ? 6 : 14);
        addFloating(player.x, player.y - 55, '\uD83D\uDCA8 Dash!', '#60a5fa', 20);
        break;
      case 'pulse':
        _doPulseWave();
        addFloating(player.x, player.y - 55, '\uD83D\uDCA5 Pulse!', '#c084fc', 20);
        // Instant effect: immediately reset and start cooldown.
        _active     = false;
        _effectTime = 0;
        _cooldown   = _def.cooldown;
        break;
      case 'ghost':
        _ghostMode = true;
        addFloating(player.x, player.y - 55, '\uD83D\uDC7B Ghost Mode!', '#e2e8f0', 20);
        break;
    }
    _updateHUD();
  }

  function _deactivate() {
    switch (_def.abilityId) {
      case 'frost':  _frostActive = false; break;
      case 'dash':   _dashActive  = false; break;
      case 'ghost':  _ghostMode   = false; break;
    }
  }

  // Called by checkCollisions when the skin shield absorbs a hit.
  function onShieldBroken() {
    _skinShield = false;
    _active     = false;
    _effectTime = 0;
    _cooldown   = _def.cooldown;
    _updateHUD();
  }

  function _doFrostRipple() {
    ringBursts.push({ x: player.x, y: player.y, r: player.radius, maxR: 200, color: '#93c5fd', alpha: 0.9, speed: 250 });
    ringBursts.push({ x: player.x, y: player.y, r: 0,             maxR: 140, color: '#bfdbfe', alpha: 0.5, speed: 360 });
    triggerShake(3, 0.12);
  }

  function _doPulseWave() {
    ringBursts.push({ x: player.x, y: player.y, r: player.radius, maxR: 280, color: '#c084fc', alpha: 0.9, speed: 440 });
    ringBursts.push({ x: player.x, y: player.y, r: 0,             maxR: 200, color: '#f0abfc', alpha: 0.5, speed: 580 });
    triggerShake(4, 0.15);
    for (const ob of obstacles) {
      const obCx = ob.x + ob.w / 2;
      const obCy = ob.y + ob.h / 2;
      const dx   = obCx - player.x;
      const dy   = obCy - player.y;
      const d    = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = Math.max(0, 1 - d / 320) * 420;
      if (force > 0) {
        ob.pulseKickVx = (dx / d) * force;
        ob.pulseKickVy = (dy / d) * force * 0.7;
      }
    }
  }

  function _updateHUD() {
    const el = document.getElementById('skin-ability-hud');
    if (!el) return;
    if (!_def) { el.hidden = true; return; }
    el.hidden = false;
    const iconEl  = el.querySelector('.sa-icon');
    const nameEl  = el.querySelector('.sa-name');
    const barEl   = el.querySelector('.sa-bar-fill');
    const stateEl = el.querySelector('.sa-state');
    if (iconEl) iconEl.textContent = _def.icon;
    if (nameEl) nameEl.textContent = _def.abilityName;
    if (_def.passive) {
      el.dataset.state = 'active';
      if (stateEl) stateEl.textContent = 'Passive';
      if (barEl)   barEl.style.width   = '100%';
      return;
    }
    if (_active) {
      el.dataset.state = 'active';
      if (_def.abilityId === 'shield') {
        if (stateEl) stateEl.textContent = 'Armed';
        if (barEl)   barEl.style.width   = '100%';
      } else {
        const pct = _def.duration > 0 ? Math.max(0, (_effectTime / _def.duration) * 100) : 0;
        if (stateEl) stateEl.textContent = _effectTime > 0 ? _effectTime.toFixed(1) + 's' : 'Active';
        if (barEl)   barEl.style.width   = pct + '%';
      }
    } else {
      const pct = _def.cooldown > 0 ? Math.max(0, (1 - _cooldown / _def.cooldown) * 100) : 100;
      el.dataset.state = _cooldown <= 0 ? 'ready' : 'cooling';
      if (stateEl) stateEl.textContent = _cooldown > 0 ? Math.ceil(_cooldown) + 's' : 'Ready';
      if (barEl)   barEl.style.width   = pct + '%';
    }
  }

  function hasMagnet()     { return !!(_def && _def.abilityId === 'magnet'); }
  function hasFrost()      { return _frostActive; }
  function getDashMult()   { return _dashActive ? 1.75 : 1; }
  function hasGhost()      { return _ghostMode; }
  function hasSkinShield() { return _skinShield; }

  return { reset, tick, onShieldBroken, hasMagnet, hasFrost, getDashMult, hasGhost, hasSkinShield };
})();


function updateCoinUI(animate) {
  const homeCoinEl     = document.getElementById('home-coins');
  const progressCoinEl = document.getElementById('progress-coins');
  if (homeCoinEl)     homeCoinEl.textContent     = settings.coins;
  if (progressCoinEl) progressCoinEl.textContent = settings.coins;
  updateSkinsUI();
  updatePowerupUpgradeUI();
  renderLifetimeProgressUI();
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

function updateRoundCoinHUD() {
  const el = document.getElementById('round-coin-count');
  if (el) el.textContent = roundCoins;
}

function showRoundCoinHUD() {
  const hud = document.getElementById('round-coin-hud');
  if (hud) hud.hidden = false;
}

function hideRoundCoinHUD() {
  const hud = document.getElementById('round-coin-hud');
  if (hud) hud.hidden = true;
}

// -- Shop Preview Loop --------------------------------------
function startShopPreviewLoop() {
  if (_shopPreviewRaf) return;
  function tick() {
    _shopPreviewRaf = requestAnimationFrame(tick);
    const now = performance.now();

    // Main large preview
    const previewCanvas = document.getElementById('skin-preview-canvas');
    if (previewCanvas) {
      const skinId = _shopPreviewSkinId || settings.selectedSkin;
      const skin   = SKIN_DEFS.find(s => s.id === skinId) || SKIN_DEFS[0];
      const pCtx   = previewCanvas.getContext('2d');
      const W = previewCanvas.width, H = previewCanvas.height;
      pCtx.clearRect(0, 0, W, H);
      const bob = Math.sin(now / 900) * 4;
      drawSkinPreviewAt(pCtx, skin, W / 2, H / 2 + bob, 44, now);
    }

    // Mini per-card skin canvases in the grid
    document.querySelectorAll('.skin-canvas-mini').forEach(canvas => {
      const skinId = canvas.dataset.skin;
      const skin = SKIN_DEFS.find(s => s.id === skinId);
      if (!skin) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const locked = canvas.closest('.skin-btn') && canvas.closest('.skin-btn').classList.contains('skin-locked');
      if (locked) ctx.globalAlpha = 0.45;
      drawSkinPreviewAt(ctx, skin, canvas.width / 2, canvas.height / 2, 30, now);
      if (locked) ctx.globalAlpha = 1;
    });
  }
  _shopPreviewRaf = requestAnimationFrame(tick);
}

function stopShopPreviewLoop() {
  if (_shopPreviewRaf) {
    cancelAnimationFrame(_shopPreviewRaf);
    _shopPreviewRaf = null;
  }
}

// -- Select skin in preview panel (hover / click / open) ---
function selectSkinForPreview(skinId) {
  _shopPreviewSkinId = skinId;
  const skin       = SKIN_DEFS.find(s => s.id === skinId) || SKIN_DEFS[0];
  const nameEl     = document.getElementById('preview-skin-name');
  const rarityEl   = document.getElementById('preview-skin-rarity');
  const actionsEl  = document.getElementById('preview-actions');
  if (nameEl)   nameEl.textContent = skin.name;
  if (rarityEl) { rarityEl.textContent = skin.rarity; rarityEl.dataset.rarity = skin.rarity; }
  // Ability info panel
  const abilityInfoEl = document.getElementById('preview-ability-info');
  if (abilityInfoEl) {
    const abilDef = SKIN_ABILITY_DEFS[skin.id];
    if (abilDef) {
      abilityInfoEl.hidden = false;
      abilityInfoEl.innerHTML =
        '<span class="preview-ability-icon">' + abilDef.icon + '</span>' +
        '<span class="preview-ability-name">' + abilDef.abilityName + '</span>' +
        '<span class="preview-ability-desc">' + abilDef.desc + '</span>';
    } else {
      abilityInfoEl.hidden = true;
    }
  }
  if (!actionsEl) return;

  const available  = isSkinAvailable(skin);
  const selected   = settings.selectedSkin === skin.id && available;
  const isCoinSkin = !!skin.coinCost;
  const isLifetime = !!skin.lifetimeUnlock;
  const canAfford  = isCoinSkin && settings.coins >= skin.coinCost;
  const coinSpan   = '<span class="coin-icon coin-sm" aria-hidden="true"></span>';

  let primaryHTML = '';
  if (selected) {
    primaryHTML = '<button class="btn btn-secondary preview-btn-disabled" disabled>OK Equipped</button>';
  } else if (available) {
    primaryHTML = '<button class="btn btn-primary preview-equip-btn" data-skin="' + skin.id + '">Equip</button>';
  } else if (isLifetime) {
    primaryHTML = '<button class="btn btn-secondary preview-btn-disabled" disabled>\uD83D\uDD12 ' + formatNumber(skin.lifetimeUnlock) + '</button>';
  } else if (isCoinSkin) {
    // Always show an enabled Buy button - if unaffordable it triggers the video flow
    const label = canAfford
      ? 'Buy ' + coinSpan + ' ' + skin.coinCost
      : coinSpan + ' ' + skin.coinCost + ' &nbsp;<span class="preview-buy-video-hint">Watch ad</span>';
    primaryHTML = '<button class="btn btn-primary preview-buy-btn' + (canAfford ? '' : ' preview-buy-needcoins') + '" data-skin="' + skin.id + '">' + label + '</button>';
  }

  const tryHTML = '<button class="btn btn-try preview-try-btn" data-skin="' + skin.id + '">Try</button>';
  actionsEl.innerHTML = primaryHTML + tryHTML;

  const equipBtn = actionsEl.querySelector('.preview-equip-btn');
  if (equipBtn) {
    equipBtn.addEventListener('click', () => {
      settings.selectedSkin = skin.id;
      saveSettings();
      updateSkinsUI();
      renderLifetimeProgressUI();
      Audio.uiClick();
    });
  }
  const buyBtn = actionsEl.querySelector('.preview-buy-btn');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      if (settings.coins >= skin.coinCost) {
        showBuyConfirm(skin.id);
      } else {
        showCantAffordFlow(skin.id);
      }
      Audio.uiClick();
    });
  }
  actionsEl.querySelectorAll('.preview-try-btn').forEach(btn => {
    btn.addEventListener('click', () => startTrySkin(skin.id));
  });
}

function updateSkinsUI() {
  const grid = document.getElementById('skin-stage');
  if (!grid) return;
  const coinSpan = '<span class="coin-icon coin-sm" aria-hidden="true"></span>';

  // Rebuild DOM only when necessary - track a content hash to avoid redundant innerHTML sets
  const _skinHash = JSON.stringify(SKIN_DEFS.map(s => ({
    id: s.id, owned: isSkinAvailable(s), sel: settings.selectedSkin === s.id,
    coins: settings.coins, lt: settings.lifetimeScore,
  })));
  if (grid._lastSkinHash === _skinHash) {
    // State unchanged - skip expensive innerHTML rebuild, just update preview
    selectSkinForPreview(_shopPreviewSkinId || settings.selectedSkin);
    return;
  }
  grid._lastSkinHash = _skinHash;

  grid.innerHTML = SKIN_DEFS.map(skin => {
    const isCoinSkin     = !!skin.coinCost;
    const isLifetimeSkin = !!skin.lifetimeUnlock;
    const available      = isSkinAvailable(skin);
    const locked         = !available;
    const selected       = settings.selectedSkin === skin.id && available;
    const canAfford      = isCoinSkin && settings.coins >= skin.coinCost;

    let statusHTML = '';
    if (selected) {
      statusHTML = '<span class="skin-grid-status skin-grid-equipped">Equipped</span>';
    } else if (available) {
      statusHTML = '<span class="skin-grid-status skin-grid-owned">Owned</span>';
    } else if (isLifetimeSkin) {
      const pct = Math.min(100, Math.round(((settings.lifetimeScore || 0) / skin.lifetimeUnlock) * 100));
      statusHTML = '<div class="skin-grid-lock-info">' +
        '<span class="skin-grid-lock-label">' + formatNumber(skin.lifetimeUnlock) + '</span>' +
        '<div class="skin-bar-track"><div class="skin-bar-fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    } else if (isCoinSkin) {
      const cls = canAfford ? '' : ' skin-grid-unaffordable';
      statusHTML = '<div class="skin-grid-cost' + cls + '">' + coinSpan + ' ' + skin.coinCost + '</div>';
    }

    const cardClasses = [
      'skin-btn',
      locked   ? 'skin-locked'    : '',
      selected ? 'skin-selected'  : '',
      isCoinSkin && !available ? 'skin-coin-card' : '',
    ].filter(Boolean).join(' ');

    const abilDef = SKIN_ABILITY_DEFS[skin.id];
    const abilityTagHTML = abilDef
      ? '<span class="skin-ability-tag">' + abilDef.icon + ' ' + abilDef.abilityName + '</span>'
      : '';
    return '<div class="' + cardClasses + '" data-skin="' + skin.id + '" data-rarity="' + skin.rarity + '" role="listitem" tabindex="0">' +
      (locked ? '<span class="skin-grid-lock-icon" aria-hidden="true">\uD83D\uDD12</span>' : '') +
      '<canvas class="skin-preview skin-canvas-mini" width="80" height="80" data-skin="' + skin.id + '" aria-hidden="true"></canvas>' +
      '<span class="skin-rarity" data-rarity="' + skin.rarity + '">' + skin.rarity + '</span>' +
      '<span class="skin-name">' + skin.name + '</span>' +
      abilityTagHTML +
      statusHTML +
      '</div>';
  }).join('');

  // Event delegation: one listener on the grid instead of N listeners on N cards.
  // This avoids accumulating duplicate listeners on every updateSkinsUI() call.
  if (!grid._delegated) {
    grid._delegated = true;
    grid.addEventListener('click', e => {
      const card = e.target.closest('.skin-btn');
      if (!card) return;
      const skinId = card.dataset.skin;
      const skin = SKIN_DEFS.find(s => s.id === skinId);
      if (!skin) return;
      selectSkinForPreview(skinId);
      if (isSkinAvailable(skin) && settings.selectedSkin !== skinId) {
        settings.selectedSkin = skinId;
        saveSettings();
        grid._lastSkinHash = null; // invalidate hash so next call rebuilds
        updateSkinsUI();
        renderLifetimeProgressUI();
      }
      Audio.uiClick();
    });
    grid.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.closest('.skin-btn')?.click(); }
    });
  }

  // Update preview panel for current or previously hovered skin
  selectSkinForPreview(_shopPreviewSkinId || settings.selectedSkin);
}

// -- Try Mode ----------------------------------------------
function startTrySkin(skinId) {
  if (tryMode.active) return;
  tryMode.originalSkin  = settings.selectedSkin;
  settings.selectedSkin = skinId; // temporary - NOT saved to localStorage
  tryMode.active = true;
  tryMode.timer  = tryMode.duration;
  stopShopPreviewLoop();
  hideModal('modal-progress');
  startGame();
  // Show try mode banner after game starts
  setTimeout(() => {
    const banner = document.getElementById('try-mode-banner');
    if (banner) banner.hidden = false;
  }, 100);
}

function endTrySkin() {
  tryMode.active = false;
  tryMode.timer  = 0;
  settings.selectedSkin = tryMode.originalSkin || 'classic';
  const banner = document.getElementById('try-mode-banner');
  if (banner) banner.hidden = true;
  cancelAnimationFrame(rafHandle); rafHandle = null;
  AudioManager.stopMusic();
  currentState = STATE.HOME;
  showScreen('home-screen');
  showModal('modal-progress');
  updateSkinsUI();
  selectSkinForPreview(settings.selectedSkin);
  AudioManager.startHomeMusic();
}

function awardCoins(amount, showFloat = false, source = 'generic') {
  if (tryMode.active) return 0;
  if (amount <= 0) return 0;
  // Only 'pickup' source awards coins; all other bonus sources are ignored
  if (source !== 'pickup') return 0;
  settings.coins += amount;
  saveSettings();
  updateCoinUI(true);
  if (showFloat && currentState === STATE.PLAYING && player) {
    addFloating(player.x, player.y - 72, '+' + amount, '#fde047', 18);
  }
  return amount;
}

function awardRunCoins(finalScore, elapsedSecs) {
  // Award exactly the number of coins physically collected this run (no multipliers).
  if (roundCoins > 0) {
    settings.coins += roundCoins;
    saveSettings();
    updateCoinUI(true);
  }
  return roundCoins;
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
  renderLifetimeProgressUI();
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

// -- Can't-afford flow: prompt to watch rewarded video -----
let _cantAffordSkinId = null;
let _cantAffordPowerupKey = null;

function showCantAffordFlow(skinId) {
  const skin = SKIN_DEFS.find(s => s.id === skinId);
  if (!skin) return;
  _cantAffordSkinId = skinId;
  const need = skin.coinCost - settings.coins;

  const overlay    = document.getElementById('nocoins-overlay');
  const dialog     = document.getElementById('nocoins-dialog');
  const title      = document.getElementById('ncd-title');
  const balanceEl  = document.getElementById('ncd-balance');
  const needEl     = document.getElementById('ncd-need');

  if (title)    title.textContent   = 'Not enough coins for ' + skin.name;
  if (balanceEl) balanceEl.textContent = settings.coins;
  if (needEl)   {
    const coinSpan = '<span class="coin-icon coin-sm" aria-hidden="true"></span>';
    needEl.innerHTML = 'You need ' + coinSpan + ' ' + need + ' more. Watch a video to earn 100 coins!';
  }

  if (overlay) { overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false'); }
  if (dialog)  { dialog.hidden  = false; }
  const watchBtn = document.getElementById('ncd-watch');
  if (watchBtn) watchBtn.focus();
  Audio.uiClick();
}

function _closeNoCoinDialog() {
  const overlay = document.getElementById('nocoins-overlay');
  const dialog  = document.getElementById('nocoins-dialog');
  if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
  if (dialog)  { dialog.hidden  = true; }
}

function showCantAffordPowerupFlow(key) {
  const upDef = POWERUP_UPGRADE_DEFS[key];
  const def   = POWERUP_DEFS[key];
  if (!upDef || !def) return;
  normalizePowerupUpgradeState();
  const level = getPowerupUpgradeLevel(key);
  if (level >= upDef.maxLevel) return;
  _cantAffordPowerupKey = key;
  _cantAffordSkinId     = null;
  const cost  = upDef.costs[level];
  const need  = cost - (settings.coins || 0);
  const coinSpan = '<span class="coin-icon coin-sm" aria-hidden="true"></span>';

  const overlay    = document.getElementById('nocoins-overlay');
  const dialog     = document.getElementById('nocoins-dialog');
  const title      = document.getElementById('ncd-title');
  const balanceEl  = document.getElementById('ncd-balance');
  const needEl     = document.getElementById('ncd-need');

  if (title)     title.textContent  = 'Not enough coins to upgrade ' + def.label;
  if (balanceEl) balanceEl.textContent = settings.coins;
  if (needEl)    needEl.innerHTML   = 'You need ' + coinSpan + '\u202f' + need + ' more coins. Watch a short video to earn 100 coins!';

  if (overlay) { overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false'); }
  if (dialog)  { dialog.hidden  = false; }
  const watchBtn = document.getElementById('ncd-watch');
  if (watchBtn) watchBtn.focus();
  Audio.uiClick();
}

// -- Rewarded Ad System -------------------------------------
// Replace _RewardedAd.show() with a real ad SDK call to integrate a provider.
// State machine: 'idle' -> 'playing' -> 'completed' -> 'rewarded' | 'cancelled'
const _RewardedAd = (() => {
  const AD_DURATION  = 15;   // fallback countdown seconds
  const COIN_REWARD  = 100;

  let _state        = 'idle';
  let _onReward     = null;
  let _rewardGiven  = false;
  let _fbTimer      = null;
  let _fbElapsed    = 0;
  let _dom          = null;

  function _D() {
    if (_dom) return _dom;
    _dom = {
      overlay:    document.getElementById('rad-overlay'),
      modal:      document.getElementById('rad-modal'),
      video:      document.getElementById('rad-video'),
      fallback:   document.getElementById('rad-fallback'),
      fbFill:     document.getElementById('rad-fb-fill'),
      fbSecs:     document.getElementById('rad-fb-secs'),
      idleOvl:    document.getElementById('rad-idle-overlay'),
      startBtn:   document.getElementById('rad-start'),
      compOvl:    document.getElementById('rad-complete-overlay'),
      progFill:   document.getElementById('rad-progress-fill'),
      progTrack:  document.querySelector('.rad-progress-track'),
      timerLbl:   document.getElementById('rad-timer-label'),
      statusTxt:  document.getElementById('rad-status-text'),
      closeBtn:   document.getElementById('rad-close'),
      claimBtn:   document.getElementById('rad-claim'),
    };
    return _dom;
  }

  function _setState(s) {
    _state = s;
    const d = _D();
    if (d.modal) d.modal.dataset.state = s;
  }

  function _fmt(secs) {
    const s = Math.max(0, Math.floor(secs));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function _setProgress(pct, secsLeft) {
    const d = _D();
    const p = Math.min(100, Math.max(0, pct));
    d.progFill.style.width = p + '%';
    if (d.progTrack) d.progTrack.setAttribute('aria-valuenow', Math.round(p));
    d.timerLbl.textContent = _fmt(secsLeft);
  }

  function _onComplete() {
    clearInterval(_fbTimer);
    const d = _D();
    _setProgress(100, 0);
    d.statusTxt.textContent  = 'OK Video complete - claim your reward!';
    d.compOvl.hidden         = false;
    d.closeBtn.disabled      = false;
    _setState('completed');
    try { if (navigator.vibrate) navigator.vibrate([40, 25, 70]); } catch (_) {}
    requestAnimationFrame(() => requestAnimationFrame(() => d.claimBtn.focus()));
  }

  function _startFallback() {
    const d = _D();
    d.video.style.display = 'none';
    try { d.video.pause(); } catch (_) {}
    d.fallback.hidden = false;
    _fbElapsed = 0;
    d.fbFill.style.transition = 'none';
    d.fbFill.style.width = '0%';
    if (d.fbSecs) d.fbSecs.textContent = AD_DURATION + 's';
    clearInterval(_fbTimer);
    requestAnimationFrame(() => { d.fbFill.style.transition = 'width 1s linear'; });

    _fbTimer = setInterval(() => {
      _fbElapsed++;
      const pct = Math.min(100, (_fbElapsed / AD_DURATION) * 100);
      d.fbFill.style.width = pct + '%';
      _setProgress(pct, Math.max(0, AD_DURATION - _fbElapsed));
      if (d.fbSecs) d.fbSecs.textContent = Math.max(0, AD_DURATION - _fbElapsed) + 's';
      if (_fbElapsed >= AD_DURATION) { clearInterval(_fbTimer); _onComplete(); }
    }, 1000);
  }

  function _startPlayback() {
    const d = _D();
    _setState('playing');
    d.closeBtn.disabled = true;
    d.statusTxt.textContent = 'Reward unlocks when the video finishes';

    d.video.ontimeupdate = () => {
      if (_state !== 'playing') return;
      const dur = d.video.duration || AD_DURATION;
      _setProgress((d.video.currentTime / dur) * 100, dur - d.video.currentTime);
    };
    d.video.onended = () => { if (_state === 'playing') _onComplete(); };
    d.video.onerror = () => { if (_state === 'playing') _startFallback(); };

    d.video.currentTime = 0;
    const p = d.video.play();
    if (p !== undefined) p.catch(() => _startFallback());

    // Hard fallback if video never loads data
    setTimeout(() => {
      if (_state === 'playing' && d.video.readyState < 2 && d.fallback.hidden) {
        _startFallback();
      }
    }, 3000);
  }

  function show(onReward) {
    _onReward    = onReward;
    _rewardGiven = false;
    clearInterval(_fbTimer);
    const d = _D();

    // Reset video
    try { d.video.pause(); d.video.currentTime = 0; } catch (_) {}
    d.video.style.display   = '';
    d.video.ontimeupdate    = null;
    d.video.onended         = null;
    d.video.onerror         = null;

    // Reset overlays
    d.fallback.hidden   = true;
    d.compOvl.hidden    = true;
    d.closeBtn.disabled = false;
    d.fbFill.style.width = '0%';
    if (d.fbSecs) d.fbSecs.textContent = AD_DURATION + 's';

    // Reset progress
    d.progFill.style.width   = '0%';
    d.timerLbl.textContent   = _fmt(AD_DURATION);
    d.statusTxt.textContent  = 'Reward unlocks when the video finishes';

    _setState('idle');
    d.overlay.hidden = false;
    d.overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => requestAnimationFrame(() => d.startBtn.focus()));

    // Start button
    d.startBtn.onclick = () => {
      if (_state !== 'idle') return;
      _startPlayback();
    };

    // Claim (one-shot guard)
    d.claimBtn.onclick = () => {
      if (_rewardGiven || _state !== 'completed') return;
      _rewardGiven = true;
      _setState('rewarded');
      const cb = _onReward; _onReward = null;
      // Brief delay so the completion state is visible before closing
      setTimeout(() => { close(); if (cb) cb(COIN_REWARD); }, 480);
    };

    // Close
    d.closeBtn.onclick = () => {
      if (_state === 'playing') { _cancel(); }
      else if (_state !== 'rewarded') { close(); }
    };

    // Backdrop cancel
    d.overlay.onclick = (e) => {
      if (e.target !== d.overlay) return;
      if (_state === 'playing') { _cancel(); }
      else if (_state !== 'rewarded') { close(); }
    };
  }

  function _cancel() {
    clearInterval(_fbTimer);
    const d = _D();
    try { d.video.pause(); } catch (_) {}
    _setState('cancelled');
    close();
    _showCancelToast();
  }

  function close() {
    clearInterval(_fbTimer);
    const d = _D();
    if (d.video) {
      try { d.video.pause(); } catch (_) {}
      d.video.ontimeupdate = null;
      d.video.onended      = null;
      d.video.onerror      = null;
    }
    if (d.overlay) {
      d.overlay.hidden = true;
      d.overlay.setAttribute('aria-hidden', 'true');
    }
    if (_state !== 'rewarded') _onReward = null;
  }

  return { show, close, COIN_REWARD };
})();

function _showCoinRewardToast(amount) {
  const toast = document.getElementById('coin-reward-toast');
  if (!toast) return;
  const coinSpan = '<span class="coin-icon coin-sm" aria-hidden="true"></span>';
  toast.innerHTML = '+' + amount + '\u202f' + coinSpan + '\u202fCoins!';
  toast.className = 'coin-reward-toast';
  toast.hidden = false;
  void toast.offsetWidth;
  toast.classList.add('crt-show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.classList.remove('crt-show');
    setTimeout(() => { toast.hidden = true; }, 500);
  }, 2400);
}

function _showCancelToast() {
  const toast = document.getElementById('coin-reward-toast');
  if (!toast) return;
  toast.innerHTML = '\ufe0f Reward cancelled &mdash; finish the video to earn coins';
  toast.className = 'coin-reward-toast crt-cancelled';
  toast.hidden = false;
  void toast.offsetWidth;
  toast.classList.add('crt-show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.classList.remove('crt-show');
    setTimeout(() => { toast.hidden = true; toast.className = 'coin-reward-toast'; }, 500);
  }, 3200);
}

function _initRewardedAdButtons() {
  const ncdCancel = document.getElementById('ncd-cancel');
  const ncdWatch  = document.getElementById('ncd-watch');
  const ncdOverlay = document.getElementById('nocoins-overlay');
  if (ncdCancel) ncdCancel.addEventListener('click', () => { _cantAffordSkinId = null; _cantAffordPowerupKey = null; _closeNoCoinDialog(); Audio.uiClick(); });
  if (ncdOverlay) ncdOverlay.addEventListener('click', (e) => { if (e.target === ncdOverlay) { _cantAffordSkinId = null; _cantAffordPowerupKey = null; _closeNoCoinDialog(); } });
  if (ncdWatch) ncdWatch.addEventListener('click', () => {
    const skinId = _cantAffordSkinId;
    const pupKey = _cantAffordPowerupKey;
    _cantAffordSkinId     = null;
    _cantAffordPowerupKey = null;
    _closeNoCoinDialog();
    _RewardedAd.show((coinsEarned) => {
      // Award coins
      settings.coins += coinsEarned;
      saveSettings();
      updateCoinUI(true);
      _showCoinRewardToast(coinsEarned);
      // Powerup path
      if (pupKey) {
        updatePowerupUpgradeUI();
        // Auto-upgrade if player can now afford it
        const upDef = POWERUP_UPGRADE_DEFS[pupKey];
        const lvl   = getPowerupUpgradeLevel(pupKey);
        if (upDef && lvl < upDef.maxLevel && settings.coins >= upDef.costs[lvl]) {
          setTimeout(() => buyPowerupUpgrade(pupKey), 420);
        }
      }
      // Skin path
      if (skinId) {
        selectSkinForPreview(skinId);
        updateSkinsUI();
        const skin = SKIN_DEFS.find(s => s.id === skinId);
        if (skin && skin.coinCost && settings.coins >= skin.coinCost && !isSkinAvailable(skin)) {
          setTimeout(() => showBuyConfirm(skinId), 400);
        }
      }
    });
  });
}

function checkSkinUnlocks(prevBest, newBest) {
  SKIN_DEFS.forEach(skin => {
    if (skin.unlock > 0 && !skin.coinCost && !skin.lifetimeUnlock && prevBest < skin.unlock && newBest >= skin.unlock) {
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
      // Lava/Crimson: hot embers - small, bright, random flicker
      alpha  = t * (0.28 + 0.14 * Math.sin(now / 80 + i * 0.9));
      radius = Math.max(1.5, player.radius * t * 0.45);
    } else if (skin.effect === 'shimmer') {
      // Ice/Gold: icy sparkle - tapered and bright
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
    // Halve trail glow in low-perf mode - shadowBlur is one of the most expensive canvas ops
    ctx.shadowColor = tc;
    ctx.shadowBlur  = settings.perfMode === 'low'
      ? (skin.rarity === 'legendary' ? 8 : 3)
      : (skin.rarity === 'legendary' ? 14 : skin.rarity === 'epic' ? 8 : skin.rarity === 'rare' ? 5 : 3);
    ctx.fill();
    ctx.restore();
  });
}

// -- Movement physics constants ---------------------------------------
// Accel: reach max speed in ~6 frames @ 60 fps - responsive but not instant.
// Friction: velocity decays to ~10% in ~0.2s - snappy stop, no long slide.
const PLAYER_ACCEL   = 2200; // px/s^2 - how fast velocity builds
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
  // Trail - record before moving so the ghost lags visually behind the player.
  // Always record (all skins) - trail is drawn only for skins that opt-in via trail:true.
  playerTrail.push({ x: player.x, y: player.y });
  if (playerTrail.length > 14) playerTrail.shift();

  // -- Gather input direction --------------------------------------------------
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
    if (dist > 10) {          // 10 px dead-zone - ignore micro-jitter
      inputX = tdx / dist;
      inputY = tdy / dist;
      // Scale input 0->1 over 12-60 px so near-finger movement is gentler
      const proximity = Math.min(1, (dist - 10) / 50);
      inputX *= proximity;
      inputY *= proximity;
    } else {
      inputX = 0; inputY = 0;
    }
  }

  // -- Velocity physics ----------------------------------------------------
  const maxSpd = player.speed * SkinAbility.getDashMult();
  const hasInput = inputX !== 0 || inputY !== 0;

  if (hasInput) {
    // Accelerate toward desired direction
    player.vx += inputX * PLAYER_ACCEL * dt;
    player.vy += inputY * PLAYER_ACCEL * dt;
  } else {
    // Friction decay - exponential so it always converges cleanly to zero
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

  // Smooth radius lerp - used by SMALL powerup (approx 80 px/s transition)
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
  // Ghost Shift: flicker player alpha to show phase-through is active
  if (SkinAbility.hasGhost()) {
    ctx.globalAlpha = 0.38 + 0.24 * Math.sin(now / 70);
  }

  // -- Per-skin outer effect (drawn behind the player) --------------------
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

  // -- Color-change grace ring -------------------------------------
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

  // -- Small Mode ring - cyan pulsing ring shows shrunk state ----
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

  // -- Shield ring -----------------------------------------------
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

  // -- Body ----------------------------------------------------
  // Glow intensity by rarity / effect - boosted by combo
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

// -- Inner skin effects: rendered INSIDE the player shape via canvas clip --
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
// SKIN PREVIEW CANVAS - standalone drawing (no global ctx/player deps)
// ============================================================

function _ha(hex, alpha) {
  const rv = parseInt(hex.slice(1, 3), 16);
  const gv = parseInt(hex.slice(3, 5), 16);
  const bv = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + rv + ',' + gv + ',' + bv + ',' + alpha.toFixed(3) + ')';
}

function _drawStarPath(pCtx, x, y, outerR, innerR, pts) {
  const step = Math.PI / pts;
  pCtx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle  = i * step - Math.PI / 2;
    if (i === 0) pCtx.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    else         pCtx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  pCtx.closePath();
}

function drawSkinPreviewAt(pCtx, skin, cx, cy, r, now) {
  pCtx.save();

  // -- Outer effect -------------------------------------------
  if (skin.effect === 'pulse') {
    const pulse = 0.4 + 0.6 * Math.sin(now / 340);
    pCtx.beginPath();
    pCtx.arc(cx, cy, r + 7 + pulse * 4, 0, Math.PI * 2);
    pCtx.strokeStyle  = skin.glow;
    pCtx.lineWidth    = 2;
    pCtx.globalAlpha  = 0.25 + pulse * 0.35;
    pCtx.shadowColor  = skin.glow;
    pCtx.shadowBlur   = 10;
    pCtx.stroke();
    pCtx.globalAlpha  = 1;
    pCtx.shadowBlur   = 0;
  } else if (skin.effect === 'flicker' || skin.effect === 'inferno') {
    const f = 0.5 + 0.5 * Math.sin(now / 90 + 1.3);
    pCtx.beginPath();
    pCtx.arc(cx, cy, r + 5 + f * 4, 0, Math.PI * 2);
    pCtx.strokeStyle  = skin.glow;
    pCtx.lineWidth    = 2.5;
    pCtx.globalAlpha  = 0.35 + f * 0.35;
    pCtx.shadowColor  = skin.glow;
    pCtx.shadowBlur   = 12;
    pCtx.stroke();
    pCtx.globalAlpha  = 1;
    pCtx.shadowBlur   = 0;
  } else if (skin.effect === 'shimmer') {
    pCtx.beginPath();
    pCtx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    pCtx.strokeStyle  = skin.glow;
    pCtx.lineWidth    = 1.5;
    pCtx.globalAlpha  = 0.30;
    pCtx.shadowColor  = skin.glow;
    pCtx.shadowBlur   = 16;
    pCtx.stroke();
    pCtx.globalAlpha  = 1;
    pCtx.shadowBlur   = 0;
  } else if (skin.effect === 'electric') {
    const fast = 0.5 + 0.5 * Math.sin(now / 120);
    pCtx.beginPath();
    pCtx.arc(cx, cy, r + 4 + fast * 3, 0, Math.PI * 2);
    pCtx.strokeStyle  = skin.glow;
    pCtx.lineWidth    = 1.5;
    pCtx.globalAlpha  = 0.40 + fast * 0.30;
    pCtx.shadowColor  = skin.glow;
    pCtx.shadowBlur   = 14;
    pCtx.stroke();
    pCtx.globalAlpha  = 1;
    pCtx.shadowBlur   = 0;
  } else if (skin.effect === 'prism') {
    const hue   = (now / 20) % 360;
    const pulse = 0.4 + 0.6 * Math.sin(now / 500);
    pCtx.beginPath();
    pCtx.arc(cx, cy, r + 6 + pulse * 3, 0, Math.PI * 2);
    pCtx.strokeStyle  = 'hsl(' + hue + ',100%,65%)';
    pCtx.lineWidth    = 2;
    pCtx.globalAlpha  = 0.50 + pulse * 0.30;
    pCtx.shadowColor  = 'hsl(' + hue + ',100%,65%)';
    pCtx.shadowBlur   = 14;
    pCtx.stroke();
    pCtx.globalAlpha  = 1;
    pCtx.shadowBlur   = 0;
  } else if (skin.effect === 'galaxy') {
    const pulse = 0.45 + 0.55 * Math.sin(now / 700);
    const rg    = r + 12 + pulse * 7;
    const ag    = pCtx.createRadialGradient(cx, cy, r * 0.6, cx, cy, rg);
    ag.addColorStop(0, _ha(skin.glow, 0.50 * pulse));
    ag.addColorStop(1, _ha(skin.glow, 0));
    pCtx.beginPath();
    pCtx.arc(cx, cy, rg, 0, Math.PI * 2);
    pCtx.fillStyle = ag;
    pCtx.fill();
    for (let j = 0; j < 5; j++) {
      const angle = now / 900 + j * (Math.PI * 2 / 5);
      const ox = cx + Math.cos(angle) * (r + 15);
      const oy = cy + Math.sin(angle) * (r + 15);
      pCtx.beginPath();
      pCtx.arc(ox, oy, 1.8, 0, Math.PI * 2);
      pCtx.fillStyle  = skin.color1;
      pCtx.globalAlpha = 0.55 + 0.45 * Math.sin(now / 300 + j);
      pCtx.shadowColor = skin.glow;
      pCtx.shadowBlur  = 6;
      pCtx.fill();
      pCtx.shadowBlur  = 0;
      pCtx.globalAlpha = 1;
    }
  } else if (skin.effect === 'void') {
    const pulse = 0.45 + 0.55 * Math.sin(now / 380);
    const rg    = r + 14 + pulse * 8;
    const ag    = pCtx.createRadialGradient(cx, cy, 0, cx, cy, rg);
    ag.addColorStop(0,   'rgba(0,0,0,0.40)');
    ag.addColorStop(0.4, _ha(skin.glow, 0.25 * pulse));
    ag.addColorStop(1,   _ha(skin.glow, 0));
    pCtx.beginPath();
    pCtx.arc(cx, cy, rg, 0, Math.PI * 2);
    pCtx.fillStyle = ag;
    pCtx.fill();
  }

  // -- Glow / shadow setup ------------------------------------
  let shadowBlur = 20;
  let c1 = skin.color1, c2 = skin.color2;
  if (skin.effect === 'flicker') {
    const f = 0.6 + 0.4 * Math.sin(now / 70 + 2.1);
    shadowBlur = 16 + f * 18;
    c2 = f > 0.75 ? '#f97316' : skin.color2;
  } else if (skin.effect === 'shimmer')  { shadowBlur = 18 + 8  * Math.sin(now / 600); }
    else if (skin.effect === 'pulse')    { shadowBlur = 18 + 14 * Math.sin(now / 340); }
    else if (skin.effect === 'electric') { shadowBlur = 20 + 20 * (0.5 + 0.5 * Math.sin(now / 180)); }
    else if (skin.effect === 'inferno')  {
      const fi = 0.5 + 0.5 * Math.sin(now / 65);
      shadowBlur = 22 + 16 * fi;
      c2 = fi > 0.70 ? '#fbbf24' : fi > 0.40 ? '#f97316' : skin.color2;
    } else if (skin.effect === 'prism') {
      const hue = (now / 20) % 360;
      shadowBlur = 18 + 8 * Math.sin(now / 500);
      c1 = 'hsl(' + hue + ',80%,90%)';
      c2 = 'hsl(' + ((hue + 120) % 360) + ',100%,60%)';
    } else if (skin.effect === 'galaxy') { shadowBlur = 24 + 14 * Math.sin(now / 700); }
      else if (skin.effect === 'void')   { shadowBlur = 30 + 12 * Math.sin(now / 380); }

  // -- Body --------------------------------------------------
  if (skin.shape === 'star') {
    const g = pCtx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, r);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    pCtx.shadowColor = skin.glow;
    pCtx.shadowBlur  = shadowBlur;
    _drawStarPath(pCtx, cx, cy, r, r * 0.44, 5);
    pCtx.fillStyle = g;
    pCtx.fill();
    pCtx.shadowBlur = 0;
    drawSkinPreviewInner(pCtx, skin, cx, cy, r, now);
    pCtx.strokeStyle = c1;
    pCtx.lineWidth   = 1.5;
    _drawStarPath(pCtx, cx, cy, r, r * 0.44, 5);
    pCtx.stroke();
  } else {
    const g = pCtx.createRadialGradient(cx - 7, cy - 7, 2, cx, cy, r);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    pCtx.beginPath();
    pCtx.arc(cx, cy, r, 0, Math.PI * 2);
    pCtx.fillStyle   = g;
    pCtx.shadowColor = skin.glow;
    pCtx.shadowBlur  = shadowBlur;
    pCtx.fill();
    pCtx.shadowBlur  = 0;
    drawSkinPreviewInner(pCtx, skin, cx, cy, r, now);
    pCtx.strokeStyle = c1;
    pCtx.lineWidth   = 2;
    pCtx.beginPath();
    pCtx.arc(cx, cy, r, 0, Math.PI * 2);
    pCtx.stroke();
  }

  pCtx.restore();
}

function drawSkinPreviewInner(pCtx, skin, cx, cy, r, now) {
  pCtx.save();
  pCtx.beginPath();
  pCtx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  pCtx.clip();

  if (skin.effect === 'shimmer') {
    const t  = (now / 2000) % 1;
    const sx = cx - r * 1.6 + t * r * 3.2;
    const sg = pCtx.createLinearGradient(sx - 10, 0, sx + 10, 0);
    sg.addColorStop(0,   'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.24)');
    sg.addColorStop(1,   'rgba(255,255,255,0)');
    pCtx.fillStyle = sg;
    pCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (skin.effect === 'pulse') {
    for (let i = 0; i < 2; i++) {
      const phase = ((now / 900) + i * 0.5) % 1;
      const pr    = phase * r * 0.88;
      pCtx.beginPath();
      pCtx.arc(cx, cy, pr, 0, Math.PI * 2);
      pCtx.strokeStyle = _ha(skin.glow, (1 - phase) * 0.42);
      pCtx.lineWidth   = 1.8;
      pCtx.stroke();
    }
  } else if (skin.effect === 'flicker') {
    const bx = cx + Math.sin(now / 300) * r * 0.30;
    const by = cy + Math.cos(now / 250) * r * 0.24;
    const lg = pCtx.createRadialGradient(bx, by, 0, bx, by, r * 0.90);
    lg.addColorStop(0,    'rgba(253,224,71,0.48)');
    lg.addColorStop(0.38, 'rgba(249,115,22,0.28)');
    lg.addColorStop(0.72, 'rgba(220,38,38,0.10)');
    lg.addColorStop(1,    'rgba(220,38,38,0)');
    pCtx.fillStyle = lg;
    pCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (skin.effect === 'electric') {
    const flash = Math.max(0, Math.sin(now / 130) - 0.45) / 0.55;
    const eg    = pCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
    eg.addColorStop(0,   _ha('#e0f2fe', 0.14 + flash * 0.38));
    eg.addColorStop(0.5, _ha('#38bdf8', 0.05 + flash * 0.12));
    eg.addColorStop(1,   'rgba(56,189,248,0)');
    pCtx.fillStyle = eg;
    pCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (skin.effect === 'inferno') {
    const fx = cx + Math.sin(now / 280 + 0.5) * r * 0.28;
    const fy = cy + Math.cos(now / 210) * r * 0.22;
    const ig = pCtx.createRadialGradient(fx, fy, 0, fx, fy, r * 0.84);
    ig.addColorStop(0,    'rgba(254,240,138,0.52)');
    ig.addColorStop(0.33, 'rgba(249,115,22,0.32)');
    ig.addColorStop(0.68, 'rgba(220,38,38,0.12)');
    ig.addColorStop(1,    'rgba(220,38,38,0)');
    pCtx.fillStyle = ig;
    pCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (skin.effect === 'prism') {
    const a   = now / 1100;
    const hue = (now / 15) % 360;
    const pg  = pCtx.createLinearGradient(
      cx + Math.cos(a) * r, cy + Math.sin(a) * r,
      cx - Math.cos(a) * r, cy - Math.sin(a) * r);
    pg.addColorStop(0,   'hsla(' + hue + ',100%,72%,0.30)');
    pg.addColorStop(0.5, 'hsla(' + ((hue + 90) % 360) + ',100%,72%,0.06)');
    pg.addColorStop(1,   'hsla(' + ((hue + 180) % 360) + ',100%,72%,0.30)');
    pCtx.fillStyle = pg;
    pCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (skin.effect === 'void') {
    const va = now / 1400;
    const vx = cx + Math.cos(va) * r * 0.28;
    const vy = cy + Math.sin(va) * r * 0.28;
    const vg = pCtx.createRadialGradient(vx, vy, 0, cx, cy, r * 0.80);
    vg.addColorStop(0,    'rgba(0,0,0,0.72)');
    vg.addColorStop(0.38, 'rgba(59,7,100,0.40)');
    vg.addColorStop(0.72, 'rgba(107,33,168,0.14)');
    vg.addColorStop(1,    'rgba(107,33,168,0)');
    pCtx.fillStyle = vg;
    pCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (skin.effect === 'galaxy') {
    const ng = pCtx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.75);
    ng.addColorStop(0,   'rgba(129,140,248,0.18)');
    ng.addColorStop(0.6, 'rgba(99,102,241,0.06)');
    ng.addColorStop(1,   'rgba(99,102,241,0)');
    pCtx.fillStyle = ng;
    pCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + now / 5000;
      const dist  = (0.18 + (i % 4) * 0.16) * r;
      const gx    = cx + Math.cos(angle) * dist;
      const gy    = cy + Math.sin(angle) * dist;
      pCtx.beginPath();
      pCtx.arc(gx, gy, 1.0, 0, Math.PI * 2);
      pCtx.fillStyle = _ha('#c4b5fd', 0.38 + 0.42 * Math.sin(now / (160 + i * 65) + i * 1.3));
      pCtx.fill();
    }
  }

  pCtx.restore();
}

// ============================================================
// SECTION 9: OBSTACLE SYSTEM
// ============================================================
// Types: 0=NORMAL (straight), 2=BIG (large+slow)

// Returns a color index for a newly-spawned obstacle, centralising all forbidden-ratio logic.
// Handles: grace period, warning-phase fairness, panic high-density, Double Danger dual-threat.
function pickObstacleColorIndex() {
  if (graceTimer < GRACE_PERIOD) {
    // Before grace: never forbidden
    let ci = Math.floor(Math.random() * GAME_COLORS.length);
    if (ci === forbiddenIndex) ci = (ci + 1) % GAME_COLORS.length;
    return ci;
  }
  if (warningActive) {
    // During color-switch warning: reduced ratio so new blocks don't pile up forbidden
    const r = Math.random();
    if (r < 0.34) return forbiddenIndex;
    let ci = Math.floor(Math.random() * GAME_COLORS.length);
    if (ci === forbiddenIndex) ci = (ci + 1) % GAME_COLORS.length;
    return ci;
  }
  if (panicPhase === 'wave') {
    // Panic wave: overwhelming forbidden density -- forces movement
    const r = Math.random();
    if (r < DIFFICULTY_CONFIG.panicForbidRatio) return forbiddenIndex;
    let ci = Math.floor(Math.random() * GAME_COLORS.length);
    if (ci === forbiddenIndex) ci = (ci + 1) % GAME_COLORS.length;
    return ci;
  }
  if (ddPhase === 'active' && dd2ndIndex >= 0) {
    // Double Danger: 50% primary forbidden, 28% secondary forbidden, 22% safe
    const r = Math.random();
    if (r < 0.50) return forbiddenIndex;
    if (r < 0.78) return dd2ndIndex;
    // safe -- skip both forbidden colors
    let ci = Math.floor(Math.random() * GAME_COLORS.length);
    let guard = 0;
    while ((ci === forbiddenIndex || ci === dd2ndIndex) && guard++ < 20) {
      ci = (ci + 1) % GAME_COLORS.length;
    }
    return ci;
  }
  // Normal: phase-driven forbidden ratio
  if (Math.random() < activeForbiddenRatio()) return forbiddenIndex;
  let ci = Math.floor(Math.random() * GAME_COLORS.length);
  if (ci === forbiddenIndex) ci = (ci + 1) % GAME_COLORS.length;
  return ci;
}

function spawnObstacle() {
  if (obstacles.length >= getPhaseMaxObstacles()) return;

  // Color: centralised logic handles grace, warning, panic, and Double Danger.
  let colorIndex = pickObstacleColorIndex();

  // -- Type selection ------------------------------------------------
  // 0=straight square  2=big slow hazard
  // 3=bullet (tall thin, fast)  4=dart (tiny, superfast)
  // Weights: 0->50% | 2->10% | 3->25% | 4->15%
  // Type 2 is also hard-capped at 2 on-screen; surplus becomes type 0.
  const rnd  = Math.random();
  let   type = rnd < 0.50 ? 0 : (rnd < 0.60 ? 2 : (rnd < 0.85 ? 3 : 4));
  // Cap big obstacles - if 2 already on screen, demote to type 0
  if (type === 2 && obstacles.filter(o => o.type === 2).length >= 2) type = 0;
  const base = GAME_CONFIG.baseSpeed * speedMultiplier * panicSpeedMult();

  let w, h, vy;
  switch (type) {
    case 0: w = 28 + Math.random()*16;  h = w;                         vy = base * DIFFICULTY_CONFIG.typeSpeedMults[0] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[0]; break;
    case 1: w = 26 + Math.random()*14;  h = w;                         vy = base*0.85 + Math.random()*50;  break;
    case 2: w = 52 + Math.random()*20;  h = 38 + Math.random()*14;     vy = base*0.60 + Math.random()*28;  break; // medium-large, not room-filling
    case 3: w = 14 + Math.random()*10;  h = 52 + Math.random()*28;     vy = base * DIFFICULTY_CONFIG.typeSpeedMults[3] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[3]; break;
    case 4: w = 12 + Math.random()*8;   h = 12 + Math.random()*8;      vy = base * DIFFICULTY_CONFIG.typeSpeedMults[4] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[4]; break;
  }

  if (activePowerupKey === 'SLOW') vy *= 0.4;

  // Spawn position - bias toward the player's lane and neighbors so staying still is punished.
  // INCREASED PRESSURE: Higher bias values mean blocks track player position more directly.
  const _spawnLanes = getLaneCenters();
  const _playerLane = getPlayerLane();
  observePlayerLaneForSpawn(_playerLane);
  const isPanic = panicPhase === 'wave';
  const isCamping = isPanic || _samePlayerLaneWaves >= CAMPING_WAVE_LIMIT;
  const shieldPlayerLane = !isCamping && _playerLaneShieldStreak < MAX_PLAYER_LANE_SHIELD;
  const _laneW      = canvas.width / NUM_LANES;
  const flowTargeting = getFlowTargetingBonus();
  // During panic: very small safe radius -- blocks can spawn right next to player
  const spawnSafeR  = Math.max(4, player.radius + (shieldPlayerLane ? 26 : (isPanic ? 2 : (isCamping ? 6 : 10))) - flowTargeting * 18);
  const _candidates = getPressuredLaneOrder(_playerLane, !shieldPlayerLane);
  let pickedLane = _candidates[0] ?? Math.floor(Math.random() * NUM_LANES);
  let ox = _spawnLanes[pickedLane];
  const pressureBias = Math.min(0.96, (isCamping ? 0.92 : 0.72) + flowTargeting);
  for (const _ci of _candidates) {
    const _cx = getTargetedLaneX(_spawnLanes[_ci], _laneW, player.x, pressureBias);
    if (Math.abs(_cx - player.x) >= spawnSafeR) { ox = _cx; pickedLane = _ci; break; }
  }
  _playerLaneShieldStreak = pickedLane === _playerLane ? 0 : (_playerLaneShieldStreak + 1);
  // Clamp so block stays fully on screen regardless of its width
  ox = Math.max(w / 2 + 2, Math.min(canvas.width - w / 2 - 2, ox));

  const isForbiddenSpawn = graceTimer >= GRACE_PERIOD;

  // Behaviors: mutually exclusive - 13% sway on straight blocks, 9% pulse on straight/big
  const behRoll = Math.random();
  const extraMoveChance = getFlowMovingChance();
  const swayChance = 0.13 + extraMoveChance;
  const pulseChance = 0.09 + extraMoveChance * 0.6;
  const doSway  = behRoll < swayChance && type === 0;
  const doPulse = behRoll >= swayChance && behRoll < swayChance + pulseChance && (type === 0 || type === 2);
  const trickType = pickObstacleTrick(type, isForbiddenSpawn, !doSway);

  obstacles.push({
    x: ox - w / 2, y: -h - 12, w, h, vy, baseVy: vy, type,
    colorIndex,
    originX: ox, nearMissIdx: -1,
    gravityPull: false,
    // Side-to-side sway (slow sine sweep - only type 0, ~13%)
    swayAmp:   doSway ? 25 + Math.random() * 22 : 0,
    swayFreq:  doSway ? 0.65 + Math.random() * 0.50 : 0,
    swayPhase: doSway ? Math.random() * Math.PI * 2 : 0,
    swayTime:  0,
    // Size pulse (smooth grow/shrink - ~9%, not fast bullet types)
    pulseAmp:   doPulse ? 0.17 : 0,
    pulseFreq:  doPulse ? 1.4 + Math.random() * 1.0 : 0,
    pulsePhase: doPulse ? Math.random() * Math.PI * 2 : 0,
    pulseTime:  0,
    baseW: w, baseH: h,
    cy: -h / 2 - 12, // tracked center-Y for pulse height scaling
    trickType,
    trickTriggered: false,
    trickTimer: 0,
    trickVx: 0,
  });

  // Path safety check: if the new block would leave no viable corridor at the player row,
  // remove it immediately. Cull decisions happen top-of-screen so the player never sees a pop.
  if (graceTimer >= GRACE_PERIOD && largestClearGap(player.y) < currentRequiredClearGap()) {
    obstacles.pop();
  }
}

// -- Lane-based wave spawner --------------------------------------------------
// Spawns 2-4 blocks using a named lane pattern that always leaves open corridors.
// Replaces old random-X cluster patterns with a controlled, fair wave system.
function spawnWave() {
  if (obstacles.length >= getPhaseMaxObstacles()) return;
  const cw        = canvas.width;
  const lw        = cw / NUM_LANES;
  const lanes     = getLaneCenters();
  const base      = GAME_CONFIG.baseSpeed * speedMultiplier * panicSpeedMult();
  const slow      = activePowerupKey === 'SLOW';
  const postGrace = graceTimer >= GRACE_PERIOD;

  // Detect which lane the player is in, then choose a player-aware safe lane.
  const playerLane = getPlayerLane();
  observePlayerLaneForSpawn(playerLane);

  // Pattern-based safe lane selection
  const patternId  = selectSpawnPattern();
  const midLane    = Math.floor(NUM_LANES / 2);
  let   safeLaneHint = -1;
  if (patternId === 'CENTER_PUSH') {
    safeLaneHint = Math.random() < 0.5 ? 0 : NUM_LANES - 1;
  } else if (patternId === 'SIDE_PUSH' || patternId === 'PINCER') {
    safeLaneHint = Math.max(1, Math.min(NUM_LANES - 2, midLane + (Math.random() < 0.5 ? 0 : -1)));
  } else if (patternId === 'HALF_FILL') {
    safeLaneHint = playerLane <= midLane ? NUM_LANES - 1 : 0;
  }
  const plan = buildWavePlan(lanes, playerLane, lw, postGrace, safeLaneHint);
  const safeLane = plan.safeLane;
  const blocked  = plan.blocked;

  const beforeLen = obstacles.length;
  const isPanic = panicPhase === 'wave';
  const isCamping = isPanic || _samePlayerLaneWaves >= CAMPING_WAVE_LIMIT;
  const flowTargeting = getFlowTargetingBonus();
  //  raised base pressure: 0.78 normal (was 0.72), 0.90 camping (was 0.88)
  const wavePressure = Math.min(0.98, (isPanic ? 0.97 : (isCamping ? 0.90 : 0.78)) + flowTargeting);
  for (const laneIdx of blocked) {
    if (obstacles.length >= MAX_OBSTACLES) break;
    const cx = Math.max(4, Math.min(cw - 4, getTargetedLaneX(lanes[laneIdx], lw, player.x, wavePressure)));
    // Never spawn inside player safe radius (smaller radius during panic for tighter targeting)
    const waveMinSafeR = Math.max(4, player.radius + (isPanic ? 2 : (isCamping ? 10 : 18)) - flowTargeting * 14);
    if (Math.abs(cx - player.x) < waveMinSafeR) continue;

    // Block size variety - mix of small darts, medium, tall bullets, wide fills, rare large
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
    const speedScale = DIFFICULTY_CONFIG.typeSpeedMults[wType] ?? 1.0;
    const speedRandV = DIFFICULTY_CONFIG.typeSpeedRand[wType] ?? 28;
    const vyR = base * speedScale + Math.random() * speedRandV;
    const vy  = slow ? vyR * 0.4 : vyR;

    // Color: centralised logic handles grace, warning, panic, and Double Danger.
    let colorIndex = pickObstacleColorIndex();

    // Sway only on single-lane waves; pulse on any
    const behRoll = Math.random();
    const extraMoveChance = getFlowMovingChance();
    const doSway  = behRoll < (0.10 + extraMoveChance) && blocked.length === 1;
    const doPulse = behRoll >= (0.10 + extraMoveChance) && behRoll < (0.18 + extraMoveChance * 0.65);
    const trickType = pickObstacleTrick(wType, postGrace, !doSway);

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
      trickType,
      trickTriggered: false,
      trickTimer: 0,
      trickVx: 0,
    });
  }

  // Final safety net: roll back entire wave if no escape remains
  if (postGrace && largestClearGap(player.y) < currentRequiredClearGap()) {
    obstacles.length = beforeLen;
  }
}


// Mutations removed: Speed Burst, Gravity Pull, Wall Pattern - all hurt gameplay clarity.

// -- Lane-based spawn helpers ------------------------------------------------------------------------

// Returns an array of NUM_LANES center-X positions evenly spanning canvas width.
function getLaneCenters() {
  const lw = canvas.width / NUM_LANES;
  return Array.from({ length: NUM_LANES }, (_, i) => lw * (i + 0.5));
}

// Returns the lane index (0 - NUM_LANES-1) that the player is currently inside.
function getPlayerLane() {
  const lw = canvas.width / NUM_LANES;
  return Math.max(0, Math.min(NUM_LANES - 1, Math.floor(player.x / lw)));
}

function observePlayerLaneForSpawn(playerLane) {
  if (playerLane === _lastPlayerLaneSeen) {
    _samePlayerLaneWaves += 1;
  } else {
    _samePlayerLaneWaves = 1;
    _playerLaneShieldStreak = 0;
  }
  _lastPlayerLaneSeen = playerLane;
}

function currentRequiredClearGap() {
  return Math.max(MIN_CLEAR_GAP - difficultyBumps * 4 - getFlowGapTighten(), 50);
}

function getLanePressureScore(laneIdx, playerLane) {
  const dist = Math.abs(laneIdx - playerLane);
  let score = dist === 0 ? 12 : (dist === 1 ? 8.5 : (dist === 2 ? 4 : 1));
  score += Math.min(difficultyBumps, 6) * (dist <= 1 ? 0.9 : 0.25);
  if (_samePlayerLaneWaves >= CAMPING_WAVE_LIMIT) {
    if (dist === 0) score += 9;
    else if (dist === 1) score += 5;
  }
  return score;
}

function getTargetedLaneX(laneCenter, laneW, playerX, pressure) {
  const maxPull = laneW * 0.22;
  const pull = Math.max(-maxPull, Math.min(maxPull, playerX - laneCenter)) * pressure;
  const jitter = (Math.random() - 0.5) * laneW * (0.34 - pressure * 0.10);
  return laneCenter + pull + jitter;
}

function getPressuredLaneOrder(playerLane, includePlayerLane) {
  const lanes = [];
  for (let i = 0; i < NUM_LANES; i++) {
    if (!includePlayerLane && i === playerLane) continue;
    lanes.push(i);
  }
  lanes.sort((a, b) => {
    const diff = getLanePressureScore(b, playerLane) - getLanePressureScore(a, playerLane);
    return diff !== 0 ? diff : (Math.random() < 0.5 ? -1 : 1);
  });
  return lanes;
}

function pickAdjacentLane(baseLane, preferredLane) {
  const opts = [];
  if (baseLane > 0) opts.push(baseLane - 1);
  if (baseLane < NUM_LANES - 1) opts.push(baseLane + 1);
  if (opts.length === 0) return baseLane;
  opts.sort((a, b) => {
    const da = Math.abs(a - preferredLane);
    const db = Math.abs(b - preferredLane);
    if (da !== db) return da - db;
    return Math.random() < 0.5 ? -1 : 1;
  });
  return opts[0];
}

function buildWavePlan(laneCenters, playerLane, laneW, postGrace, safeLaneHint) {
  // If a pattern hint is provided, try that safe lane first
  if (safeLaneHint !== undefined && safeLaneHint >= 0) {
    const blocked = pickBlockedLanes(safeLaneHint, playerLane);
    if (!postGrace || validateEscapeRoute(laneCenters, blocked, laneW)) {
      return { safeLane: safeLaneHint, blocked };
    }
  }
  const attempts = postGrace ? 8 : 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const safeLane = pickSafeLane(playerLane);
    const blocked  = pickBlockedLanes(safeLane, playerLane);
    if (!postGrace || validateEscapeRoute(laneCenters, blocked, laneW)) {
      return { safeLane, blocked };
    }
  }

  const fallbackSafe = pickAdjacentLane(playerLane, _safeLaneDrift);
  return {
    safeLane: fallbackSafe,
    blocked: pickBlockedLanes(fallbackSafe, playerLane),
  };
}

// Chooses a safe lane that is usually near the player, but rarely exactly on them.
// This keeps escape routes readable while forcing frequent repositioning.
function pickSafeLane(playerLane) {
  // Advance drift countdown -- gap shifts +-1 lane every 2-4 waves
  _wavesUntilDrift--;
  if (_wavesUntilDrift <= 0) {
    _wavesUntilDrift = 2 + Math.floor(Math.random() * 3);
    _safeLaneDrift  += Math.random() < 0.5 ? 1 : -1;
    _safeLaneDrift   = Math.max(0, Math.min(NUM_LANES - 1, _safeLaneDrift));
  }

  const nearbySafe = pickAdjacentLane(playerLane, _safeLaneDrift);
  const driftNeighbor = pickAdjacentLane(_safeLaneDrift, playerLane);
  const r = Math.random();
  let candidate;
  const isCamping = _samePlayerLaneWaves >= CAMPING_WAVE_LIMIT;
  if (isCamping) {
    candidate = nearbySafe;
  } else if (r < 0.58) {
    candidate = nearbySafe;
  } else if (r < 0.82) {
    candidate = driftNeighbor;
  } else if (r < 0.94) {
    candidate = _safeLaneDrift;
  } else {
    candidate = playerLane;
  }

  // Never let the same safe lane repeat indefinitely.
  if (_lastSafeLane >= 0 && candidate === _lastSafeLane && _safeLaneStreak >= MAX_SAFE_LANE_STREAK) {
    candidate = pickAdjacentLane(_lastSafeLane, playerLane);
  }

  // Player lane should be a brief exception, not the normal answer.
  if (candidate === playerLane && (isCamping || _playerLaneSafeStreak >= 1)) {
    candidate = nearbySafe;
  }

  _safeLaneStreak = (candidate === _lastSafeLane) ? (_safeLaneStreak + 1) : 1;
  _lastSafeLane = candidate;
  _playerLaneSafeStreak = (candidate === playerLane) ? (_playerLaneSafeStreak + 1) : 0;
  return candidate;
}

// Builds the set of lane indices to BLOCK this wave.
// \u2022 safeLane is always kept open.
// \u2022 At low difficulty a neighbor of safeLane is also kept open (breathing room).
// \u2022 Blocked lanes are sorted so the player's side fills first - directional pressure.
function pickBlockedLanes(safeLane, playerLane) {
  const b          = difficultyBumps;
  //  more lanes blocked sooner: 5 from b<1, all-but-safe from b<3
  const maxBlocked = b < 1 ? 5 : (b < 3 ? NUM_LANES - 1 : NUM_LANES - 1);

  const allBlocked = [];
  for (let i = 0; i < NUM_LANES; i++) {
    if (i !== safeLane) allBlocked.push(i);
  }

  allBlocked.sort((a, bIdx) => {
    const diff = getLanePressureScore(bIdx, playerLane) - getLanePressureScore(a, playerLane);
    return diff !== 0 ? diff : (Math.random() < 0.5 ? -1 : 1);
  });

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

// -- Horizontal path guarantee -----------------------------------------------------------
// Scans a horizontal band [scanY +/- BAND] for blocked columns.
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

    // -- Y advance -------------------------------------------------------------
    // Pulse blocks track center-Y so height scaling stays anchored.
    // Frost Aura slows block fall speed by 35%.
    const _frostMult = SkinAbility.hasFrost() ? 0.65 : 1;
    if (ob.pulseAmp > 0) {
      ob.cy += ob.vy * dt * _frostMult;
    } else {
      ob.y += ob.vy * dt * _frostMult;
    }

    // -- Pulse Wave kick: push obstacle away from player ----------------------
    if (ob.pulseKickVx) {
      const nx = Math.max(0, Math.min(canvas.width - ob.w, ob.x + ob.pulseKickVx * dt));
      if (ob.swayAmp > 0) ob.originX += (nx - ob.x); // keep sway origin in sync
      ob.x  = nx;
      ob.y += ob.pulseKickVy * dt;
      const kickDecay = Math.exp(-6 * dt);
      ob.pulseKickVx *= kickDecay;
      ob.pulseKickVy *= kickDecay;
      if (Math.abs(ob.pulseKickVx) < 0.5) { ob.pulseKickVx = 0; ob.pulseKickVy = 0; }
    }

    // -- Sway: smooth sine sweep left-right --------------------------------
    if (ob.swayAmp > 0) {
      ob.swayTime += dt;
      const sx = ob.originX + Math.sin(ob.swayTime * ob.swayFreq + ob.swayPhase) * ob.swayAmp;
      ob.x = Math.max(0, Math.min(canvas.width - ob.w, sx - ob.w / 2));
    }

    // -- Pulse: smooth grow/shrink around center -----------------------------
    if (ob.pulseAmp > 0) {
      ob.pulseTime += dt;
      const raw   = 1 + ob.pulseAmp * Math.sin(ob.pulseTime * ob.pulseFreq + ob.pulsePhase);
      const scale = Math.max(0.82, Math.min(1.18, raw)); // safety clamp
      ob.w = ob.baseW * scale;
      ob.h = ob.baseH * scale;
      ob.x = Math.max(0, Math.min(canvas.width - ob.w, ob.originX - ob.w / 2));
      ob.y = ob.cy - ob.h / 2;
    }

    if (ob.trickType === 'surge' && !ob.trickTriggered && isDangerous(ob) && ob.y + ob.h * 0.5 > player.y - 180) {
      ob.trickTriggered = true;
      ob.baseVy *= 1.22 + getFlowIntensity() * 0.16;
      ob.vy = activePowerupKey === 'SLOW' ? ob.baseVy * 0.4 : ob.baseVy;
    }
    if (ob.trickType === 'juke' && !ob.trickTriggered && isDangerous(ob) && Math.abs((ob.y + ob.h * 0.5) - player.y) < 160) {
      ob.trickTriggered = true;
      ob.trickTimer = 0.25;
      const toPlayer = Math.sign(player.x - (ob.x + ob.w / 2)) || (Math.random() < 0.5 ? -1 : 1);
      ob.trickVx = toPlayer * (70 + getFlowIntensity() * 35);
    }
    if (ob.trickTimer > 0) {
      ob.trickTimer -= dt;
      ob.x += ob.trickVx * dt;
      ob.x = Math.max(0, Math.min(canvas.width - ob.w, ob.x));
      ob.originX = ob.x + ob.w / 2;
    }

    // Near-miss: record the forbiddenIndex active at the moment of the close pass.
    // Storing the index (not a boolean) means the award at exit is independent of
    // whatever forbiddenIndex happens to be current then - prevents both false-positives
    // from color cycling and false-negatives from color changing before the obstacle exits.
    if (ob.nearMissIdx < 0 && isDangerous(ob) && ob.y > -ob.h &&
        distCircleRect(player.x, player.y, player.radius, ob.x, ob.y, ob.w, ob.h) < NEAR_MISS_DIST) {
      ob.nearMissIdx = forbiddenIndex;
    }

    if (ob.nearMissIdx >= 0 && ob.y > player.y + player.radius + 14) {
      awardNearMiss(ob);
      ob.nearMissIdx = -2;
    }

    if (ob.y > canvas.height + Math.max(OBSTACLE_CLEANUP_MARGIN, ob.h * 1.25)) {
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
  // in the warning window - it is NOT dangerous yet but signals the player to dodge.
  const isWarning   = !isForbidden && warningActive && nextForbiddenIdx >= 0
                      && ob.colorIndex === nextForbiddenIdx;
  const colorDef    = GAME_COLORS[ob.colorIndex];
  const hex         = colorDef.hex;
  const symbol      = colorDef.symbol;

  ctx.save();

  if (!isForbidden && !isWarning) {
    // -- Neutral block - dim, passable, gives the field texture without threat --
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
    // -- Warning block - pulsing glow, not dangerous yet ----------------------
    const remaining = Math.max(0, forbiddenInterval - forbiddenTimer);
    const warnProg  = Math.max(0, Math.min(1, 1 - remaining / WARNING_DURATION)); // 0->1
    const flicker   = 0.5 + 0.5 * Math.sin(Date.now() / 100); // fast flicker
    ctx.globalAlpha = 0.55 + 0.35 * warnProg;
    ctx.shadowColor = hex;
    // Reduced warning glow to cut GPU load - still clearly visible
    ctx.shadowBlur  = settings.perfMode === 'low' ? 4 + 6 * warnProg : 4 + 12 * warnProg + 5 * flicker;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    // Animated border signals imminent danger
    pathRoundRect(ctx, ob.x, ob.y, ob.w, ob.h, 8);
    ctx.strokeStyle = `rgba(255,255,255,${(0.30 + 0.55 * flicker).toFixed(2)})`;
    ctx.lineWidth   = 2;
    ctx.stroke();
  } else {
    // -- Forbidden (dangerous) block - full brightness -------------------------
    // Forbidden block glow - capped to reduce GPU cost
    const pulse = settings.perfMode === 'low' ? 10 : 14 + 8 * (0.5 + 0.5 * Math.sin(Date.now() / 200));
    ctx.shadowColor = hex;
    ctx.shadowBlur  = pulse;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Strong white border - danger outline readable regardless of block color
    pathRoundRect(ctx, ob.x, ob.y, ob.w, ob.h, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.90)';
    ctx.lineWidth   = 3;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur  = 6;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Symbol - only in colorblind mode
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

function findRiskyCoinLane() {
  if (!obstacles.length) return -1;
  const laneW = canvas.width / NUM_LANES;
  // Use active dangerous blocks that are entering or occupying the top/mid play space.
  const candidates = obstacles.filter(ob => {
    if (!isDangerous(ob)) return false;
    if (ob.y + ob.h < -40) return false;
    if (ob.y > canvas.height * 0.58) return false;
    return true;
  });
  if (!candidates.length) return -1;

  // Prefer the block closest to the player's vertical region for readable risk/reward decisions.
  let pick = candidates[0];
  let best = Math.abs((pick.y + pick.h * 0.5) - player.y);
  for (let i = 1; i < candidates.length; i++) {
    const ob = candidates[i];
    const d = Math.abs((ob.y + ob.h * 0.5) - player.y);
    if (d < best) { best = d; pick = ob; }
  }

  const centerLane = Math.max(0, Math.min(NUM_LANES - 1, Math.floor((pick.x + pick.w * 0.5) / laneW)));
  // Place coins near danger (adjacent lane) rather than directly inside the block lane.
  if (centerLane <= 0) return 1;
  if (centerLane >= NUM_LANES - 1) return NUM_LANES - 2;
  return centerLane + (Math.random() < 0.5 ? -1 : 1);
}

// spawnCoinColumn - spawns a vertical column of 4-6 coins at a lane-aligned X position.
// Coins are spaced 64px apart so players can collect them in a satisfying sequence.
// Lane selection is biased toward the player's current lane (reward movement) or adjacent.
function spawnCoinColumn() {
  const lanes  = getLaneCenters();
  const pLane  = getPlayerLane();
  const roll   = Math.random();

  const riskyLane = findRiskyCoinLane();

  let laneIdx;
  if (riskyLane >= 0 && roll < 0.22) {
    // Occasionally align a column near dangerous blocks to create risk-vs-reward choices.
    laneIdx = riskyLane;
  } else if (roll < 0.57) {
    // Player's current lane - reward being in flow with the coins
    laneIdx = pLane;
  } else if (roll < 0.82) {
    // Adjacent lane - encourage lateral movement
    const dir = Math.random() < 0.5 ? -1 : 1;
    laneIdx = Math.max(0, Math.min(NUM_LANES - 1, pLane + dir));
  } else {
    // Any lane - occasional stretch across the screen
    laneIdx = Math.floor(Math.random() * NUM_LANES);
  }

  const cx      = lanes[laneIdx];
  const sz      = 22;
  const spacing = 64;   // px between each coin center vertically
  const count   = 4 + Math.floor(Math.random() * 3); // 4, 5, or 6 coins
  const speed   = 100 + Math.random() * 22;           // all coins same speed -> stay in column
  const colId   = Date.now();                          // group ID for streak attribution

  for (let i = 0; i < count; i++) {
    coinItems.push({
      x:     cx + (Math.random() - 0.5) * 6,  // tiny jitter for organic feel
      y:     -sz - 10 - i * spacing,           // staggered above screen
      size:  sz,
      vy:    speed,
      value: 1,
      colId,
    });
  }
}

// Kept for compatibility - delegates to column spawner
function spawnCoinItem() { spawnCoinColumn(); }

function updateCoinItems(dt) {
  // Tick down streak timer - if too long since last pickup, break the streak
  if (coinStreakTimer > 0) {
    coinStreakTimer -= dt;
    if (coinStreakTimer <= 0) coinStreakCount = 0;
  }

  for (let i = coinItems.length - 1; i >= 0; i--) {
    const c = coinItems[i];
    c.y += c.vy * dt;
    // -- Coin Magnet ability: pull coins toward player when active ---------------
    if (SkinAbility.hasMagnet()) {
      const mdx = player.x - c.x;
      const mdy = player.y - c.y;
      const md  = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
      if (md < 220) {
        const pull = 210 * (1 - md / 220);
        c.x += (mdx / md) * pull * dt;
        c.y += (mdy / md) * pull * dt;
      }
    }
    const dx   = player.x - c.x;
    const dy   = player.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < player.radius + c.size / 2 + 8) {
      AudioManager.playSound('coin');
      applyFlowDelta(FLOW_CONFIG.coinGainPerCoin * c.value, 'coin');

      // Exactly +1 coin per physical pickup  no multipliers, no flow scaling
      roundCoins += 1;
      updateRoundCoinHUD();

      // Streak tracking  visual feedback only, no extra coins
      coinStreakCount++;
      coinStreakTimer = 0.65; // window to extend the streak
      if (coinStreakCount === 3) {
        addFloating(c.x, c.y - 48, '\xd73 Streak!', '#fde047', 21, true);
      } else if (coinStreakCount === 5) {
        addFloating(c.x, c.y - 48, '\xd75 Streak!', '#fb923c', 23, true);
      } else if (coinStreakCount === 8) {
        addFloating(c.x, c.y - 48, '\xd78 Streak!', '#c084fc', 26, true);
        triggerShake(2, 0.08);
      } else if (coinStreakCount > 8 && coinStreakCount % 4 === 0) {
        addFloating(c.x, c.y - 48, '\xd7' + coinStreakCount + '!', '#e879f9', 24, true);
      }

      // Floating "+1 coin" popup near the coin
      addFloating(c.x, c.y - 20, '+1 coin', '#fde047', 20, true);
      coinPickupFlashTimer = 1;

      // Update mini goal progress for coin collection
      if (runMiniGoal && !runMiniGoal.done && runMiniGoal.stat === 'pickupCoins') {
        runMiniGoal.progress = roundCoins;
        if (runMiniGoal.progress >= runMiniGoal.goal) completeMiniGoal();
        else updateMiniGoalHUD();
      }

      // Ring burst + particles
      ringBursts.push({ x: c.x, y: c.y, r: c.size * 0.4, maxR: c.size * 3.5, color: '#fbbf24', alpha: 0.9, speed: 200 });
      ringBursts.push({ x: c.x, y: c.y, r: 0,            maxR: c.size * 2.2, color: '#fff',    alpha: 0.5, speed: 280 });
      spawnParticles(c.x, c.y, '#fde047', settings.reducedMotion ? 5 : 14);
      coinItems.splice(i, 1);
      continue;
    }
    if (c.y > canvas.height + 20) {
      // Coin missed - if this was the last coin of a column, streak window shortens
      if (coinStreakTimer > 0) coinStreakTimer = Math.min(coinStreakTimer, 0.25);
      coinItems.splice(i, 1);
    }
  }
}

function drawCoinItem(c) {
  const r     = c.size / 2;
  const t     = performance.now();
  // Two-phase pulse: gentle breathing (slow) + shimmer spike (fast)
  const pulse = 0.88 + 0.12 * Math.sin(t / 500 + c.x)
              + 0.06 * Math.sin(t / 90  + c.x * 0.7);

  ctx.save();

  // Outer halo - large, bright, unmissable
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

  // Coin disc - brighter, high-saturation gold
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

  // Shine flare - small bright arc top-left
  ctx.beginPath();
  ctx.arc(c.x - r * 0.22, c.y - r * 0.26, r * 0.28, 0.8, 2.1);
  ctx.strokeStyle = 'rgba(255,255,255,0.70)';
  ctx.lineWidth   = 2;
  ctx.stroke();

  ctx.restore();
}

// ============================================================
// SECTION 9B: MINI RUN GOAL SYSTEM
// ============================================================

function pickMiniGoal() {
  // Pick a random goal that isn't trivially already done at run start
  const def = MINI_GOAL_DEFS[Math.floor(Math.random() * MINI_GOAL_DEFS.length)];
  runMiniGoal = { ...def, progress: 0, done: false };
}

function getMiniGoalProgress() {
  if (!runMiniGoal) return 0;
  switch (runMiniGoal.stat) {
    case 'pickupCoins': return roundCoins;
    case 'nearMisses':  return missionRun.nearMissesThisRun;
    case 'score':       return Math.floor(score);
    case 'seconds':     return Math.max(0, Math.floor((performance.now() - gameStartTime - pausedDuration) / 1000));
    case 'combo':       return combo;
    default:            return 0;
  }
}

function updateMiniGoalHUD() {
  const bar      = document.getElementById('run-goal-bar');
  const iconEl   = document.getElementById('run-goal-icon');
  const labelEl  = document.getElementById('run-goal-label');
  const fillEl   = document.getElementById('run-goal-fill');
  const pctEl    = document.getElementById('run-goal-pct');
  if (!bar) return;
  if (!runMiniGoal || currentState !== STATE.PLAYING) { bar.hidden = true; return; }
  bar.hidden = false;
  if (iconEl)  iconEl.textContent  = runMiniGoal.icon;
  if (labelEl) labelEl.textContent = runMiniGoal.label;
  const pct = Math.min(1, runMiniGoal.progress / runMiniGoal.goal);
  if (fillEl)  fillEl.style.width  = (pct * 100).toFixed(1) + '%';
  if (pctEl)   pctEl.textContent   = runMiniGoal.done ? '\u2713' : Math.round(pct * 100) + '%';
  bar.classList.toggle('run-goal-done', !!runMiniGoal.done);
}

function tickMiniGoal() {
  if (!runMiniGoal || runMiniGoal.done || currentState !== STATE.PLAYING) return;
  const prog = getMiniGoalProgress();
  if (prog !== runMiniGoal.progress) {
    runMiniGoal.progress = prog;
    updateMiniGoalHUD();
    if (runMiniGoal.progress >= runMiniGoal.goal) completeMiniGoal();
  }
}

function completeMiniGoal() {
  if (!runMiniGoal || runMiniGoal.done) return;
  runMiniGoal.done = true;
  // Celebration popup at centre of screen
  addFloating(canvas.width / 2, canvas.height / 2 - 80,
    'Goal: ' + runMiniGoal.label, '#34d399', 22);
  spawnParticles(canvas.width / 2, canvas.height / 2 - 70, '#34d399', settings.reducedMotion ? 6 : 18);
  triggerShake(3, 0.14);
  AudioManager.playSound('nearMiss');
  updateMiniGoalHUD();
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
  // Expanding ring burst - two rings at slightly different speeds
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
      activePowerupTimer = getPowerupDuration('SMALL');
      activePowerupTotal = activePowerupTimer;
      break;
    case 'SHIELD':
      player.hasShield   = true;
      activePowerupKey   = 'SHIELD';
      activePowerupTimer = getPowerupDuration('SHIELD');
      activePowerupTotal = activePowerupTimer;
      break;
    case 'SLOW':
      activePowerupKey   = 'SLOW';
      activePowerupTimer = getPowerupDuration('SLOW');
      activePowerupTotal = activePowerupTimer;
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
  if (settings.particles === false) return;
  // perf-low: 25% of normal; reducedMotion: 35% of normal
  const base = count || 8;
  const n = settings.reducedMotion ? Math.max(1, Math.ceil(base * 0.35))
          : settings.perfMode === 'low' ? Math.max(2, Math.ceil(base * 0.25))
          : base;
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
  // Skip particles that have drifted offscreen - no save/restore overhead per particle
  const W = canvas.width + 24, H = canvas.height + 24;
  ctx.save();
  particles.forEach(p => {
    if (p.x < -24 || p.x > W || p.y < -24 || p.y > H) return;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ============================================================
// SECTION 12: FLOATING TEXT
// ============================================================

// -- Centre-screen milestone banner ----------------------------
const SCORE_MILESTONES = [5000, 10000, 25000, 50000];
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
  const deficit = Math.min(target - nForbidden, 4); // cap at 4 per change - stay fair

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

  const prevCombo = combo;
  applyFlowDelta(FLOW_CONFIG.colorShiftGain, 'color-shift');
  const bonus = combo * COMBO_BONUS_PER;
  addScore(bonus, false, false);
  if (combo > 1) {
    addFloating(player.x, player.y - 65, 'x' + combo + '  +' + bonus, '#f59e0b');
  } else {
    addFloating(player.x, player.y - 65, '+' + bonus, '#f59e0b');
  }
  updateComboDisplay();

  forbiddenTimer = 0;
  warningActive  = false;
  hideNextColorPreview();
  setHudWarning(0);
  updateTimerBar(0, getActiveForbiddenInterval());
  updateForbiddenDisplay();
  colorChangeGrace = 0.25; // 0.25 s invincibility window on color change
  // rebalanceAfterColorChange() disabled - blocks keep their spawn color
  flashForbiddenBorder(GAME_COLORS[forbiddenIndex].hex);
  Announce.say('Forbidden color is now ' + GAME_COLORS[forbiddenIndex].name + '!');
}

function tickForbiddenTimer(dt) {
  forbiddenTimer += dt;
  const activeInterval = getActiveForbiddenInterval();
  const warningWindow = Math.min(WARNING_DURATION, activeInterval * 0.45);
  const remaining = Math.max(0, activeInterval - forbiddenTimer);

  // Update countdown bar
  updateTimerBar(forbiddenTimer, activeInterval);

  // Start warning phase
  if (!warningActive && remaining <= warningWindow) {
    warningActive    = true;
    nextForbiddenIdx = pickNextForbidden();
    showNextColorPreview(nextForbiddenIdx);
    Audio.warning();
    Announce.say('Warning: forbidden color changing to ' + GAME_COLORS[nextForbiddenIdx].name + ' - get ready!');
  }

  // Update HUD warning level (compressed 0.8 s window)
  if (warningActive) {
    if (remaining <= Math.min(0.3, warningWindow * 0.4)) setHudWarning(2);
    else                  setHudWarning(1);
  }

  if (forbiddenTimer >= activeInterval) changeForbiddenColor();
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
    if (!isDangerous(ob)) continue; // safe color - re-checked against current forbiddenIndex

    // Ghost Shift (skin ability): phase through dangerous blocks
    if (SkinAbility.hasGhost()) {
      obstacles.splice(i, 1);
      spawnParticles(ob.x + ob.w / 2, ob.y + ob.h / 2, '#e2e8f0', settings.reducedMotion ? 4 : 10);
      continue;
    }
    // Neon Shield (skin ability): absorb one collision then start recharge
    if (SkinAbility.hasSkinShield()) {
      SkinAbility.onShieldBroken();
      applyFlowDelta(-FLOW_CONFIG.shieldHitPenalty, 'shield-hit');
      obstacles.splice(i, 1);
      spawnParticles(ob.x + ob.w / 2, ob.y + ob.h / 2, '#38bdf8', settings.reducedMotion ? 8 : 18);
      addFloating(player.x, player.y - 55, '\uD83D\uDEE1 Shield Broke!', '#38bdf8');
      triggerShake(6, 0.22);
      if (navigator.vibrate) navigator.vibrate(50);
      Announce.say('Skin shield absorbed a hit.');
      continue;
    }

    if (player.hasShield) {
      player.hasShield = false;
      if (activePowerupKey === 'SHIELD') { activePowerupKey = null; updatePowerupDisplay(); }
      applyFlowDelta(-FLOW_CONFIG.shieldHitPenalty, 'shield-hit');
      obstacles.splice(i, 1);
      spawnParticles(ob.x + ob.w / 2, ob.y + ob.h / 2, GAME_COLORS[ob.colorIndex].hex, 16);
      addFloating(player.x, player.y - 55, 'Blocked!', '#facc15');
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

function addScore(pts, useBoost, useFlow) {
  if (tryMode.active) return;
  const boostMult = (useBoost !== false && activePowerupKey === 'BOOST') ? 2 : 1;
  const flowMult  = useFlow !== false ? getFlowScoreMultiplier() : 1;
  score += pts * boostMult * flowMult;
  // Throttle DOM update - only every ~100ms to avoid layout thrash
}

let _lastHudUpdate = 0;
function maybeUpdateHud(ts) {
  if (ts - _lastHudUpdate > 100) {
    updateHUD();
    updateComboDisplay();
    _lastHudUpdate = ts;
  }
}

function tickScoreOverTime(dt) {
  const rate = 5.2;
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
  // Beyond fixed list: every 100000 above 50000
  if (s >= 100000) {
    const extraStep = Math.floor(s / 100000) * 100000;
    if (!_scoreMilestonesHit.has(extraStep)) {
      _scoreMilestonesHit.add(extraStep);
      triggerMilestone((extraStep / 1000) + 'K', '#fbbf24');
    }
  }
}

function awardNearMiss(ob) {
  if (nearMissCooldownTimer > 0) return; // global spam guard - 300 ms between near misses
  nearMissCooldownTimer = 0.30;
  nearMissGlowTimer     = 1; // flash player glow bright
  applyFlowDelta(FLOW_CONFIG.nearMissGain, 'near-miss');
  AudioManager.playSound('nearMiss');
  missionRun.nearMissesThisRun++;
  const cx = ob.x + ob.w / 2;
  const cy = ob.y + ob.h / 2;
  addFloating(cx, ob.y - 18, 'Close Call', '#34d399', 20);
  // Small particle burst at the miss point
  spawnParticles(cx, cy, '#34d399', settings.reducedMotion ? 4 : 10);
  // Gentle shake - confirms the danger without being disorienting
  triggerShake(3.5, 0.18);
  addScore(NEAR_MISS_BONUS);
  if (navigator.vibrate) navigator.vibrate(25);
}

// ============================================================
// SECTION 16: DIFFICULTY SCALING
// ============================================================

// -- Panic wave ----------------------------------------------
// Lifecycle: cooldown -> announce (banner shown) -> wave (doubled spawn rate)
// The active spawn rate is read via panicSpawnRate() below.
// No state is permanently altered; everything resets after each wave.
function panicSpawnRate() {
  return panicPhase === 'wave' ? spawnRate * DIFFICULTY_CONFIG.panicSpawnMult : spawnRate;
}
function panicSpeedMult() {
  return panicPhase === 'wave' ? DIFFICULTY_CONFIG.panicSpeedBonus : 1.0;
}
function activeForbiddenRatio() {
  if (panicPhase === 'wave') return DIFFICULTY_CONFIG.panicForbidRatio;
  if (ddPhase === 'active') return 0.65; // elevated during Double Danger
  return Math.min(0.68 + difficultyBumps * 0.016, 0.84); // high base, steep ramp
}
function currentClusterChance() {
  // Phase-driven cluster chance - replaces old fixed-ramp difficultyBumps formula
  const elapsed = getElapsedPlayTime();
  const base    = lerpDiff(elapsed, 'cc');
  return Math.min(base + Math.min(graceTimer, 6) * 0.006, 0.76);
}

function tickPanicWave(dt) {
  if (graceTimer < GRACE_PERIOD + 1.0) return; // never fire in the opening second
  if (panicBlockFromDD > 0) { panicBlockFromDD -= dt; } // count down post-DD buffer

  if (panicPhase === 'cooldown') {
    // Block while Double Danger is active, announcing, or in its post-event buffer
    if (ddPhase !== 'idle' || panicBlockFromDD > 0) return;
    panicTimer += dt;
    if (panicTimer >= panicCooldown) {
      panicTimer    = 0;
      panicPhase    = 'announce';
      panicDuration = 3.5 + Math.random() * 3.5; // 3.5-7s -- longer, more impactful waves
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

  // Subtle red screen tint - wave only, soft fade-in/out matching banner alpha
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
  pathRoundRect(ctx, cx - tw / 2, cy - th / 2, tw, th, 8);
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

// -- Double Danger -----------------------------------------------------------
// Rare event: two colors become lethal simultaneously for 2-4 s.
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
      ddDuration = 5.0 + Math.random() * 4.0; // 5-9 s -- longer DD for real impact
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
  const cy  = canvas.height * 0.28;             // same position - events never overlap
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
  pathRoundRect(ctx, cx - tw / 2, cy - th / 2, tw, th, 8);
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

// --- Phase-aware difficulty helpers (added v47) ---

function getElapsedPlayTime() {
  if (gameStartTime <= 0) return 0;
  return Math.max(0, (performance.now() - gameStartTime - pausedDuration) / 1000);
}

function getDiffPhase(elapsed) {
  const phases = DIFFICULTY_CONFIG.phases;
  for (let i = 0; i < phases.length - 1; i++) {
    if (elapsed < phases[i].endAt) return i;
  }
  return phases.length - 1;
}

function lerpDiff(elapsed, key) {
  const phases = DIFFICULTY_CONFIG.phases;
  const pi     = getDiffPhase(elapsed);
  if (pi === 0) return phases[0][key];
  const prev   = phases[pi - 1];
  const cur    = phases[pi];
  const t      = Math.min(1, (elapsed - prev.endAt) / DIFFICULTY_CONFIG.blendWindow);
  const ease   = t * t * (3 - 2 * t);
  return prev[key] + (cur[key] - prev[key]) * ease;
}

function getPhaseMaxObstacles() {
  const elapsed = getElapsedPlayTime();
  return Math.min(Math.round(lerpDiff(elapsed, 'mo')), DIFFICULTY_CONFIG.maxObstaclesHardCap);
}

function selectSpawnPattern() {
  const elapsed  = getElapsedPlayTime();
  const phaseIdx = getDiffPhase(elapsed);
  let total = 0;
  for (const p of PATTERN_LIBRARY) total += (p.phaseWeights[phaseIdx] || 0);
  if (total <= 0) return 'STAGGER';
  let r = Math.random() * total;
  for (const p of PATTERN_LIBRARY) {
    r -= (p.phaseWeights[phaseIdx] || 0);
    if (r <= 0) return p.id;
  }
  return PATTERN_LIBRARY[0].id;
}

function tickDifficulty(dt) {
  // Smooth phase-based difficulty. No more sudden bumps every 6 seconds.
  const elapsed    = getElapsedPlayTime();
  const prevPhase  = difficultyPhase;
  difficultyPhase  = getDiffPhase(elapsed);

  const newSpeedMult = Math.min(lerpDiff(elapsed, 'spd'), DIFFICULTY_CONFIG.speedMultHardCap);
  const newSpawnRate = Math.max(lerpDiff(elapsed, 'si'),  DIFFICULTY_CONFIG.spawnIntervalFloor);

  // Rescale on-screen obstacles when speed increases
  if (newSpeedMult > speedMultiplier && speedMultiplier > 0) {
    const ratio  = newSpeedMult / speedMultiplier;
    const isSlow = activePowerupKey === 'SLOW';
    obstacles.forEach(o => {
      o.baseVy *= ratio;
      o.vy      = isSlow ? o.baseVy * 0.4 : o.baseVy;
    });
  }

  speedMultiplier   = newSpeedMult;
  spawnRate         = newSpawnRate;
  forbiddenInterval = lerpDiff(elapsed, 'fi');

  // Legacy counter used by lane-selection helpers (0-12 range, now reaches max ~48s)
  difficultyBumps = Math.min(12, Math.round(elapsed / DIFF_SCALE_EVERY));

  // Phase transition announcement
  if (difficultyPhase !== prevPhase && difficultyPhase > 0 && !settings.reducedMotion) {
    const label = DIFFICULTY_CONFIG.phases[difficultyPhase].name;
    addFloating(canvas.width / 2, canvas.height / 3, label + ' Phase', '#f97316', 20);
  }

  Music.setTempo(speedMultiplier);
}

// ============================================================
// SECTION 17: SCREEN SHAKE
// ============================================================

function triggerShake(intensity, dur) {
  if (settings.reducedMotion || settings.screenShake === false) return;
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

// -- Ring bursts (powerup pickup feedback) -------------------
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

    const flowIntensity = getFlowIntensity();
    if (flowIntensity > 0.02) {
      const fg = ctx.createRadialGradient(
        player.x || canvas.width / 2, player.y || canvas.height * 0.7, 0,
        player.x || canvas.width / 2, player.y || canvas.height * 0.7, Math.max(canvas.width, canvas.height) * 0.72
      );
      fg.addColorStop(0, 'rgba(251,191,36,' + (0.04 + flowIntensity * 0.08).toFixed(3) + ')');
      fg.addColorStop(0.6, 'rgba(168,85,247,' + (flowIntensity * 0.06).toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (flowState.campPressure > 0.01) {
      const cg = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, canvas.width * 0.45);
      cg.addColorStop(0, 'rgba(239,68,68,' + (flowState.campPressure * 0.08).toFixed(3) + ')');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
}


// --- Developer debug overlay (DIFFICULTY_CONFIG.debugOverlay = true to enable) ---
function drawDebugOverlay() {
  const elapsed  = getElapsedPlayTime();
  const ph       = DIFFICULTY_CONFIG.phases[difficultyPhase] || {};
  const lines    = [
    'Phase: ' + (ph.name||'?') + ' (' + difficultyPhase + ')  t=' + elapsed.toFixed(1) + 's',
    'SpeedMult: ' + speedMultiplier.toFixed(3) + ' / cap=' + DIFFICULTY_CONFIG.speedMultHardCap,
    'SpawnRate: ' + spawnRate.toFixed(3) + 's raw  active=' + getActiveSpawnInterval().toFixed(3) + 's',
    'ClusterChance: ' + (currentClusterChance()*100).toFixed(0) + '%',
    'ForbidInterval: ' + forbiddenInterval.toFixed(2) + 's',
    'Obstacles: ' + obstacles.length + ' / soft=' + getPhaseMaxObstacles() + ' / hard=' + DIFFICULTY_CONFIG.maxObstaclesHardCap,
    'Combo: ' + combo + '  Camp: ' + flowState.campPressure.toFixed(2) + '  DiffBumps: ' + difficultyBumps,
    'Panic: ' + panicPhase + '  DD: ' + ddPhase,
  ];
  ctx.save();
  ctx.font = '11px monospace';
  ctx.textBaseline = 'top';
  const pad=7, lh=15, bw=340, bh=lines.length*lh+pad*2;
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(2, 2, bw, bh);
  ctx.strokeStyle = 'rgba(139,92,246,0.65)';
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, bw, bh);
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#f97316' : i >= 5 ? '#94a3b8' : '#e2e8f0';
    ctx.fillText(line, 2 + pad, 2 + pad + i * lh);
  });
  ctx.restore();
}

function render(ts) {
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  obstacles.forEach(drawObstacle);
  // Frost Aura: subtle blue screen wash while the slow is active
  if (SkinAbility.hasFrost() && !settings.reducedMotion) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle   = '#93c5fd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }
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
  // Screen pulse on combo increase - brief white radial flash from center
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
    const intensity = Math.min(1, (combo - 4) / 8); // ramps from 0 at combo 5 -> full at combo 13
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
  if (DIFFICULTY_CONFIG.debugOverlay) drawDebugOverlay();
  ctx.restore();
}

// ============================================================
// SECTION 19: GAME LOOP
// ============================================================

function gameLoop(ts) {
  if (currentState !== STATE.PLAYING) return;
  try {
    const dt = Math.min((ts - lastFrameTime) / 1000, 0.033); // cap at ~30 fps step to prevent lag-spike tunnelling
    lastFrameTime = ts;
    graceTimer   += dt;

    // FPS counter
    if (settings.showFps) {
      gameLoop._fpsFrames = (gameLoop._fpsFrames || 0) + 1;
      gameLoop._fpsAccum  = (gameLoop._fpsAccum  || 0) + dt;
      if (gameLoop._fpsAccum >= 0.5) {
        const fps = Math.round(gameLoop._fpsFrames / gameLoop._fpsAccum);
        const fpsCtr = document.getElementById('fps-counter');
        if (fpsCtr) fpsCtr.textContent = fps + ' fps';
        gameLoop._fpsFrames = 0;
        gameLoop._fpsAccum  = 0;
      }
    }

    // Try mode countdown
    if (tryMode.active) {
      tryMode.timer -= dt;
      const cdEl = document.getElementById('try-mode-countdown');
      if (cdEl) cdEl.textContent = Math.max(0, Math.ceil(tryMode.timer)) + 's';
      if (tryMode.timer <= 0) { endTrySkin(); return; }
    }

    updatePlayer(dt);
    SkinAbility.tick(dt);
    tickFlowSystem(dt);
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
    tickMiniGoal();
    // Music.tick(dt) removed  synthesized game music replaced by ThemePlayer (MP3)
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
    if (spawnTimer >= getActiveSpawnInterval()) {
      spawnTimer = 0;
      const r = Math.random();
      if (r < currentClusterChance()) spawnWave();
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
  } catch (err) {
    // Keep the loop alive and surface the root cause in console instead of freezing to black.
    console.error('[ForbiddenColor] gameLoop runtime error', err);
    try {
      if (ctx && canvas) {
        drawBackground();
        drawPlayer();
      }
    } catch (_err) {
      // Ignore nested fallback errors.
    }
  }

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
  spawnTimer = 0; powerupTimer = 0; coinItemTimer = 0; difficultyTimer = 0; difficultyBumps = 0; difficultyPhase = 0;
  coinStreakCount = 0; coinStreakTimer = 0; roundCoins = 0;
  // Reset per-run mission counters (cumulative stat handled separately in evaluateMissions)
  missionRun = { seconds: 0, score: 0, colorChanges: 0, powerupsThisRun: 0, nearMissesThisRun: 0, panicWavesSurvived: 0, maxCombo: 0 };
  // Pick a fresh mini goal for this run
  pickMiniGoal();
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
  resetFlowState(0, 0);
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
  _safeLaneStreak  = 0;
  _lastPlayerLaneSeen = -1;
  _samePlayerLaneWaves = 0;
  _playerLaneSafeStreak = 0;
  _playerLaneShieldStreak = 0;

  spawnRate         = GAME_CONFIG.spawnRate;
  forbiddenInterval = GAME_CONFIG.forbiddenInterval;
  speedMultiplier   = 1.0;
  // Head-start timers - first coin ~3s in, first color change ~1.2s in
  forbiddenTimer    = GAME_CONFIG.forbiddenInterval - 1.4;
  coinItemTimer     = COIN_ITEM_INTERVAL - 3.0;
  forbiddenIndex    = Math.floor(Math.random() * GAME_COLORS.length);
  nextForbiddenIdx  = -1;

  currentState = STATE.PLAYING;
  showScreen('game-screen');
  updateHUD();
  updateForbiddenDisplay();
  hideNextColorPreview();
  updateTimerBar(0, getActiveForbiddenInterval());
  setHudWarning(0);
  updateComboDisplay();
  updatePowerupDisplay();

  setTimeout(() => {
    resizeCanvas();
    initPlayer();
    SkinAbility.reset();
    resetFlowState(player.x, player.y);
    updateComboDisplay();
    // Pre-fill obstacles so there's immediate on-screen pressure
    const preCount = 8;  // was 24 -- gentle opening so the first 2s are readable
    for (let _i = 0; _i < preCount; _i++) {
      spawnObstacle();
      if (obstacles.length > 0) {
        const ob = obstacles[obstacles.length - 1];
        // Wider stagger -- blocks arrive gradually, not all at once
        ob.y = -(ob.h + 10) - _i * (canvas.height * 0.15 + 8);
        if (ob.type === 2) { ob.type = 0; ob.w = 28 + Math.random()*16; ob.h = ob.w; }
      }
    }
    spawnTimer = 0;
    updateStreak();  // record today's play for daily streak
    gameStartTime    = performance.now();
    pausedDuration   = 0;
    pauseStartTime   = 0;
    lastFrameTime    = performance.now();
    updateMiniGoalHUD(); // show mini goal bar immediately when game starts
    updateRoundCoinHUD(); showRoundCoinHUD(); // show round coin counter
    const c = GAME_COLORS[forbiddenIndex];
    Announce.say('Game started. Forbidden color: ' + c.name + '.');
    AudioManager.startGameMusic();
    rafHandle = requestAnimationFrame(gameLoop);
  }, 50);
}

function pauseGame() {
  if (currentState !== STATE.PLAYING) return;
  pauseStartTime = performance.now();
  currentState = STATE.PAUSED;
  cancelAnimationFrame(rafHandle); rafHandle = null;
  clearAllInputs();
  ThemePlayer.pause();
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
  ThemePlayer.resume();
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
  if (tryMode.active) { endTrySkin(); return; }
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

    const prevLifetimeScore = settings.lifetimeScore || 0;
    settings.lifetimeScore = prevLifetimeScore + final;
    const lifetimeUnlocks = unlockLifetimeRewards(prevLifetimeScore, settings.lifetimeScore);
    saveSettings();

    const elapsed = Math.max(0, Math.floor((performance.now() - gameStartTime - pausedDuration) / 1000));
    const coinsEarned = awardRunCoins(final, elapsed);
    updateSkinsUI();
    renderLifetimeProgressUI();
    updateStats(elapsed); // persist lifetime stats before showing overlay
    LeaderboardUI.showPostRunRank(final, wasNewBest); // leaderboard: submit + rank display
    const timeStr  = elapsed >= 60 ? Math.floor(elapsed / 60) + 'm ' + (elapsed % 60) + 's' : elapsed + 's';

    lifetimeUnlocks.forEach((skinId, idx) => {
      const unlockedSkin = SKIN_DEFS.find(skin => skin.id === skinId);
      if (unlockedSkin) {
        setTimeout(() => showSkinUnlockToast(unlockedSkin), 1400 + (idx * 450));
      }
    });

    document.getElementById('gameover-best').textContent  = settings.bestScore;
    document.getElementById('gameover-combo').textContent = maxCombo;
    document.getElementById('gameover-time').textContent   = timeStr;
    document.getElementById('gameover-coins').textContent  = '+' + coinsEarned;
    hideRoundCoinHUD();
    const goIcon = document.getElementById('gameover-icon');
    if (goIcon) goIcon.textContent = '';
    document.getElementById('new-best-badge').hidden      = !wasNewBest;

    // -- Lifetime progress section in game-over --
    const lps = getLifetimeProgressState();
    const goLifeTotal = document.getElementById('go-lifetime-total');
    const goLifeFill  = document.getElementById('go-lifetime-fill');
    const goLifeNext  = document.getElementById('go-lifetime-next');
    if (goLifeTotal) goLifeTotal.textContent = formatNumber(lps.total);
    if (goLifeFill)  {
      goLifeFill.style.width = '0%';
      // Animate the bar fill in
      setTimeout(() => { goLifeFill.style.width = lps.pct + '%'; }, 200);
    }
    if (goLifeNext) {
      if (lps.nextReward) {
        const diff = lps.nextReward.milestone - lps.total;
        goLifeNext.textContent = formatNumber(diff) + ' more  to  ' + lps.nextReward.label;
      } else {
        goLifeNext.textContent = 'All lifetime rewards unlocked!';
      }
    }

    // -- Coin breakdown tooltip --
    const goCoinsBreak = document.getElementById('go-coins-breakdown');
    if (goCoinsBreak) {
      goCoinsBreak.innerHTML =
        '<span>Collected</span><span>' + roundCoins + '</span>';
    }

    // Hide mini goal bar (game is over)
    const runGoalBar = document.getElementById('run-goal-bar');
    if (runGoalBar) runGoalBar.hidden = true;

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
  hideRoundCoinHUD();
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
  AudioManager.startHomeMusic();
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
    const _drawer = document.getElementById('settings-drawer');
    const _drawerOpen = _drawer && _drawer.classList.contains('sdr-open');
    if      (currentState === STATE.PAUSED)   { resumeGame(); }
    else if (currentState === STATE.PLAYING)  { pauseGame(); }
    else if (currentState === STATE.GAMEOVER) { returnHome(); }
    else if (_drawerOpen)                     { closeSettingsDrawer(); }
    else if (!document.getElementById('modal-howtoplay').hidden) { hideModal('modal-howtoplay'); }
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

// Unified pointer-event touch handler - works for both mouse and touch
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

// -- Desktop pointer/mouse follow (non-touch pointer types only) --
// Allows mouse and trackpad users to steer with the cursor, identical to touch.
function _canvasPointerToGamePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function onCanvasPointerDown(e) {
  if (e.pointerType === 'touch') return; // handled by touch events
  if (currentState !== STATE.PLAYING) return;
  touchTarget = _canvasPointerToGamePos(e);
  canvas.setPointerCapture(e.pointerId);
}

function onCanvasPointerMove(e) {
  if (e.pointerType === 'touch') return; // handled by touch events
  if (currentState !== STATE.PLAYING || !touchTarget) return;
  touchTarget = _canvasPointerToGamePos(e);
}

function onCanvasPointerUp(e) {
  if (e.pointerType === 'touch') return;
  touchTarget = null;
}

// ============================================================
// TUTORIAL  first-time stepped How-To-Play
// ============================================================
const Tutorial = (() => {
  const STEPS = 5;
  const LS_KEY = 'shiftPanicTutorialSeen';
  let _step = 0;
  let _onComplete = null; // callback to invoke when player starts or skips

  function _slide(i) { return document.querySelector(`#tut-slides [data-step="${i}"]`); }
  function _dot(i)   { return document.querySelector(`#tut-dots [data-dot="${i}"]`); }

  function _goTo(i, dir) {
    const prev = _slide(_step);
    _step = i;
    const nextSlide = _slide(_step);
    if (prev && prev !== nextSlide) {
      prev.hidden = true;
      prev.classList.remove('tut-slide-enter', 'tut-slide-enter-back');
    }
    if (nextSlide) {
      nextSlide.hidden = false;
      nextSlide.classList.remove('tut-slide-enter', 'tut-slide-enter-back');
      void nextSlide.offsetWidth; // reflow to restart animation
      nextSlide.classList.add(dir === 'back' ? 'tut-slide-enter-back' : 'tut-slide-enter');
    }
    // Update badge
    const badge = document.getElementById('tut-step-badge');
    if (badge) badge.textContent = (_step + 1) + ' / ' + STEPS;
    // Update dots
    document.querySelectorAll('#tut-dots .tut-dot').forEach((d, idx) => {
      d.classList.toggle('tut-dot-active', idx === _step);
    });
    // Update buttons
    const back  = document.getElementById('tut-btn-back');
    const skip  = document.getElementById('tut-btn-skip');
    const next  = document.getElementById('tut-btn-next');
    const start = document.getElementById('tut-btn-start');
    const last  = _step === STEPS - 1;
    if (back)  back.hidden  = (_step === 0);
    if (skip)  skip.hidden  = last;
    if (next)  next.hidden  = last;
    if (start) start.hidden = !last;
  }

  function _markSeen() {
    try { localStorage.setItem(LS_KEY, 'true'); } catch (_) {}
  }

  function _finish() {
    _markSeen();
    hideModal('modal-howtoplay');
    if (typeof _onComplete === 'function') {
      const cb = _onComplete;
      _onComplete = null;
      cb();
    }
  }

  function open(onComplete) {
    _onComplete = onComplete || null;
    _step = -1; // force _goTo to treat first slide as new
    _goTo(0, 'fwd');
    // Show/hide Start Game button label depending on mode
    const startBtn = document.getElementById('tut-btn-start');
    if (startBtn) startBtn.textContent = _onComplete ? 'Start Game' : 'Done';
    showModal('modal-howtoplay');
    // Focus first focusable element
    setTimeout(() => {
      const el = document.getElementById('tut-btn-next') || document.getElementById('tut-btn-start');
      if (el) el.focus();
    }, 80);
  }

  function hasSeen() {
    try { return localStorage.getItem(LS_KEY) === 'true'; } catch (_) { return false; }
  }

  function _bindButtons() {
    const next  = document.getElementById('tut-btn-next');
    const back  = document.getElementById('tut-btn-back');
    const skip  = document.getElementById('tut-btn-skip');
    const start = document.getElementById('tut-btn-start');
    const close = document.getElementById('btn-htp-close');
    if (next)  next.addEventListener('click',  () => { Audio.uiClick(); _goTo(Math.min(_step + 1, STEPS - 1), 'fwd'); });
    if (back)  back.addEventListener('click',  () => { Audio.uiClick(); _goTo(Math.max(_step - 1, 0), 'back'); });
    if (skip)  skip.addEventListener('click',  () => { Audio.uiClick(); _finish(); });
    if (start) start.addEventListener('click', () => { Audio.uiClick(); _finish(); });
    //  marks seen (so it never auto-shows again) but does NOT start game
    if (close) close.addEventListener('click', () => { Audio.uiClick(); _markSeen(); _onComplete = null; hideModal('modal-howtoplay'); });
  }

  return { open, hasSeen, bindButtons: _bindButtons };
})();

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
  renderLifetimeProgressUI();
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
  ['modal-progress','modal-howtoplay','modal-leaderboard','pause-overlay','gameover-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) makeFocusTrap(el);
  });
  // Drawer focus trap
  const _drawerEl = document.getElementById('settings-drawer');
  if (_drawerEl) makeFocusTrap(_drawerEl);

  // Bind tutorial buttons (must happen after DOM ready)
  Tutorial.bindButtons();

  // One-shot unlock for iOS/Android - AudioContext must be created inside a user gesture.
  // We listen on both touchstart and pointerdown so it fires on the very first tap/click.
  const _unlockAudio = () => {
    Audio.unlock();
    AudioManager.startHomeMusic();
    document.removeEventListener('touchstart', _unlockAudio, true);
    document.removeEventListener('pointerdown', _unlockAudio, true);
  };
  document.addEventListener('touchstart',  _unlockAudio, { capture: true, passive: true, once: true });
  document.addEventListener('pointerdown', _unlockAudio, { capture: true, passive: true, once: true });

  // Home screen  Play button: show tutorial first time, otherwise start directly
  document.getElementById('btn-start').addEventListener('click', () => {
    Audio.uiClick();
    if (!Tutorial.hasSeen()) {
      Tutorial.open(() => startGame());
    } else {
      startGame();
    }
  });
  document.getElementById('btn-progress').addEventListener('click', () => {
    Audio.uiClick();
    // Reset to Skins tab on every open
    document.querySelectorAll('.shop-tab-btn').forEach(b => {
      const active = b.dataset.tab === 'skins';
      b.classList.toggle('shop-tab-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.shop-panel').forEach(panel => {
      const active = panel.id === 'shop-panel-skins';
      panel.hidden = !active;
      panel.classList.toggle('shop-panel-active', active);
    });
    renderStatsUI();
    renderLifetimeProgressUI();
    updateSkinsUI();
    updatePowerupUpgradeUI();
    updateMissionUI();
    showModal('modal-progress');
  });

  // Gear settings button  open drawer
  const _gearBtn = document.getElementById('btn-gear-settings');
  if (_gearBtn) _gearBtn.addEventListener('click', () => { Audio.uiClick(); openSettingsDrawer(); });

  // Drawer close button
  const _drawerClose = document.getElementById('btn-settings-close');
  if (_drawerClose) _drawerClose.addEventListener('click', () => { closeSettingsDrawer(); });

  // Drawer overlay click  close
  const _drawerOverlay = document.getElementById('settings-drawer-overlay');
  if (_drawerOverlay) _drawerOverlay.addEventListener('click', () => { closeSettingsDrawer(); });

  // Reset settings button
  const _btnReset = document.getElementById('btn-reset-settings');
  if (_btnReset) _btnReset.addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults? Your scores and progress will not be affected.')) return;
    const keep = {
      bestScore: settings.bestScore, lifetimeScore: settings.lifetimeScore,
      coins: settings.coins, purchasedSkins: settings.purchasedSkins,
      lifetimeRewards: settings.lifetimeRewards, powerupUpgrades: settings.powerupUpgrades,
      selectedSkin: settings.selectedSkin, streakCount: settings.streakCount,
      streakLastDate: settings.streakLastDate, economyVersion: settings.economyVersion,
      skinVersion: settings.skinVersion,
    };
    Object.assign(settings, {
      sound: true, masterVol: 0.85, musicVol: 0.70, sfxVol: 0.80,
      reducedMotion: false, highContrast: false, colorblind: false, perfMode: 'high',
      screenShake: true, particles: true, showFps: false,
    }, keep);
    saveSettings(); applySettingsToUI(); applyColorMode(); AudioManager.refreshAllVolumes();
  });

  // Help button  How To Play
  const _btnHelp = document.getElementById('btn-help');
  if (_btnHelp) _btnHelp.addEventListener('click', () => { Audio.uiClick(); Tutorial.open(null); });
  // btn-htp-close is handled inside Tutorial.bindButtons()

  document.getElementById('btn-progress-close').addEventListener('click', () => {
    hideModal('modal-progress'); document.getElementById('btn-progress').focus();
  });
  document.getElementById('btn-progress-close-bottom').addEventListener('click', () => {
    hideModal('modal-progress'); document.getElementById('btn-progress').focus();
  });

  // -- Game screen controls ----------------------------------
  document.getElementById('btn-resume').addEventListener('click', () => { Audio.uiClick(); resumeGame(); });
  document.getElementById('btn-home-from-pause').addEventListener('click', () => { Audio.uiClick(); returnHome(); });
  document.getElementById('btn-restart').addEventListener('click', () => { Audio.uiClick(); restartGame(); });
  document.getElementById('btn-home-from-gameover').addEventListener('click', () => { Audio.uiClick(); returnHome(); });
  document.getElementById('touch-pause').addEventListener('click', () => { Audio.uiClick(); pauseGame(); });

  // Share / Copy Score button
  document.getElementById('btn-share-score').addEventListener('click', () => {
    const scoreVal = document.getElementById('btn-share-score').dataset.score || '0';
    const text = 'I scored ' + scoreVal + ' in ShiftPanic! Can you beat it? shiftpanic.com';
    navigator.clipboard.writeText(text).then(() => {
      const copied = document.getElementById('share-copied');
      if (copied) { copied.hidden = false; setTimeout(() => { copied.hidden = true; }, 2500); }
    }).catch(() => {});
    Audio.uiClick();
  });

  // Shop tab switching
  document.querySelectorAll('.shop-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.shop-tab-btn').forEach(b => {
        b.classList.toggle('shop-tab-active', b.dataset.tab === target);
        b.setAttribute('aria-selected', b.dataset.tab === target ? 'true' : 'false');
      });
      document.querySelectorAll('.shop-panel').forEach(panel => {
        const isTarget = panel.id === 'shop-panel-' + target;
        panel.hidden = !isTarget;
        panel.classList.toggle('shop-panel-active', isTarget);
      });
      if (target === 'skins')      { updateSkinsUI(); }
      if (target === 'upgrades')   { updatePowerupUpgradeUI(); }
      if (target === 'challenges') { renderStatsUI(); updateMissionUI(); }
      if (target === 'lifetime')   { renderLifetimeProgressUI(); }
      Audio.uiClick();
    });
  });

  const powerupUpgradeList = document.getElementById('powerup-upgrades-list');
  if (powerupUpgradeList) {
    powerupUpgradeList.addEventListener('click', e => {
      const btn = e.target.closest('[data-upgrade-key]');
      if (!btn) return;
      const key   = btn.dataset.upgradeKey;
      const upDef = POWERUP_UPGRADE_DEFS[key];
      if (!upDef) return;
      normalizePowerupUpgradeState();
      const level = getPowerupUpgradeLevel(key);
      if (level >= upDef.maxLevel) return;
      const cost  = upDef.costs[level];
      if ((settings.coins || 0) >= cost) {
        buyPowerupUpgrade(key);
      } else {
        showCantAffordPowerupFlow(key);
      }
    });
  }

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

  // Rewarded ad + nocoins flow
  _initRewardedAdButtons();

  // Leaderboard
  LeaderboardUI.init();

  // Canvas touch-drag: direct finger-follow control (replaces simple preventDefault)
  canvas.addEventListener('touchstart',  onCanvasTouchStart, { passive: false });
  canvas.addEventListener('touchmove',   onCanvasTouchMove,  { passive: false });
  canvas.addEventListener('touchend',    onCanvasTouchEnd,   { passive: false });
  canvas.addEventListener('touchcancel', onCanvasTouchEnd,   { passive: false });

  // Desktop mouse / stylus: hold and drag to steer
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup',   onCanvasPointerUp);
  canvas.addEventListener('pointercancel', onCanvasPointerUp);

  setupResize();
}

document.addEventListener('DOMContentLoaded', init);


// ============================================================
// ============================================================
// LEADERBOARD MODULE  (v3  Firebase as single source of truth)
// ============================================================
// Firebase structure:
//   leaderboards/global/scores/{playerId}           all-time best
//   leaderboards/weekly/{weekId}/scores/{playerId}  weekly best
//   leaderboards/daily/{dayId}/scores/{playerId}    daily best
//   leaderboards/_meta                              seed tracking
//
// playerId = localStorage UUID (key: shiftPanicPlayerId)
// One doc per player per board. No localStorage for scores.
// 100 fake players seeded to each board once per day.
// ============================================================

const LeaderboardService = (() => {
  // -- Path helpers -----------------------------------------
  const G_PATH  = ()     => 'leaderboards/global/scores';
  const W_PATH  = (wk)   => 'leaderboards/weekly_' + wk + '/scores';
  const D_PATH  = (dy)   => 'leaderboards/daily_'  + dy + '/scores';
  const META    = ()     => 'leaderboards/_meta';

  // -- Date helpers (UTC so all clients agree) ---------------
  function _getWeekId() {
    const d   = new Date();
    const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),
                  d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)));
    const ys  = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
    const wk  = 1 + Math.round(((thu - ys) / 86400000 - 3 + (ys.getUTCDay() + 6) % 7) / 7);
    return thu.getUTCFullYear() + '-W' + String(wk).padStart(2, '0');
  }
  function _getDayId() {
    const d = new Date();
    return d.getUTCFullYear() + '-'
      + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
      + String(d.getUTCDate()).padStart(2, '0');
  }

  // -- Board state & live cache (updated by Firestore listeners)
  const _boardState = { alltime: 'loading', daily: 'loading', weekly: 'loading' };
  const _cache      = { alltime: [], daily: [], weekly: [] };

  // -- Player identity (localStorage only for name/id) ------
  const NAMES_KEY = 'forbiddenColor_playerName';
  const ANON_KEY  = 'forbiddenColor_anonTag';
  let _playerName = null;

  function _getAnonTag() {
    let tag = null;
    try { tag = localStorage.getItem(ANON_KEY); } catch (_) {}
    if (!tag) {
      tag = 'Anon' + String(Math.floor(1000 + Math.random() * 9000));
      try { localStorage.setItem(ANON_KEY, tag); } catch (_) {}
    }
    return tag;
  }
  function getPlayerName() {
    if (_playerName) return _playerName;
    try { _playerName = localStorage.getItem(NAMES_KEY) || null; } catch (_) {}
    return _playerName;
  }
  function getDisplayName() { return getPlayerName() || _getAnonTag(); }

  function setPlayerName(name) {
    _playerName = name;
    try { localStorage.setItem(NAMES_KEY, name); } catch (_) {}
    _fbUpdateName(name);
  }
  async function _fbUpdateName(name) {
    const db = window._fbDb; if (!db) return;
    const pid = window._fbPlayerId; if (!pid) return;
    const safeName = String(name || '').trim().slice(0, 12); if (!safeName) return;
    const weekId = _getWeekId(), dayId = _getDayId();
    // Update name in all three leaderboard docs simultaneously
    const b = db.batch();
    const gRef = db.collection(G_PATH()).doc(pid);
    const wRef = db.collection(W_PATH(weekId)).doc(pid);
    const dRef = db.collection(D_PATH(dayId)).doc(pid);
    // Use set+merge so doc doesn't need to exist
    b.set(gRef, { playerName: safeName }, { merge: true });
    b.set(wRef, { playerName: safeName }, { merge: true });
    b.set(dRef, { playerName: safeName }, { merge: true });
    try {
      await b.commit();
      console.log('[ShiftPanic] Player name updated in Firebase:', safeName);
      // Update caches so UI refreshes immediately
      ['alltime','weekly','daily'].forEach(t => {
        _cache[t] = _cache[t].map(e => e.isPlayer ? Object.assign({}, e, { name: safeName }) : e);
      });
    } catch (err) {
      console.warn('[Firebase] Name update failed:', err.code || err.message);
    }
  }
  function validateName(name) {
    if (!name || typeof name !== 'string') return 'Name is required.';
    const t = name.trim();
    if (t.length < 3)  return 'Name must be at least 3 characters.';
    if (t.length > 12) return 'Name must be 12 characters or less.';
    if (!/^[a-zA-Z0-9]+$/.test(t)) return 'Letters and numbers only.';
    const blocked = ['fuck','shit','ass','bitch','cunt','dick','piss','cock','damn','hell'];
    const lower = t.toLowerCase();
    for (const w of blocked) { if (lower.includes(w)) return 'Name contains disallowed words.'; }
    return null;
  }

  // -- Stub (no localStorage leaderboard data to clear) -----
  function resetLocalLeaderboard() {
    console.log('[ShiftPanic] resetLocalLeaderboard: Firebase is source of truth; nothing local to reset.');
  }

  // -- Fake player seeding -----------------------------------
  // 100 fake players per board, seeded once per day to Firebase.
  const _FAKE_NAMES = [
    'NeonRider','PixelNinja','TurboFox','ShadowDash','OrbitWolf',
    'NovaByte','DashKnight','GlitchTiger','VortexAce','FrostRunner',
    'CosmicWolf','RapidFalcon','BlazeByte','PhantomAce','StormPixel',
    'LunarDash','CyberTiger','RocketPanda','QuantumFox','FlashRider',
    'NightFalcon','ByteRunner','SolarWolf','AquaDash','FirePixel',
    'GhostRider','NovaStorm','IceNinja','HyperFox','SpeedTiger',
    'NebulaByte','IronPixel','PlasmaFox','ZenithDash','SonicAce',
    'TitanByte','ArcaneWolf','PrismBlade','VoidHunter','FlarePulse',
    'CrystalEdge','HyperNova','StealthPix','OmegaDash','ZephyrAce',
    'IonNinja','ChromeFox','ApexRider','BurstWolf','EchoPixel',
    'DarkNova','NexusByte','SwiftAce','PulseDash','HexaGlitch',
    'TurboAce','PhaseShift','CycloneX','WarpCore','NeonByte',
    'PixelWolf','TurboNova','ShadowFox','OrbitNinja','ByteDash',
    'DashFox','GlitchWolf','VortexByte','FrostNova','CosmicNinja',
    'RapidByte','BlazeWolf','PhantomFox','StormNinja','LunarByte',
    'CyberNova','RocketFox','QuantumWolf','FlashByte','NebulaNinja',
    'IronNova','PlasmaWolf','ZenithFox','SonicNinja','TitanNova',
    'ArcaneFox','PrismWolf','VoidNinja','FlareByte','CrystalNova',
    'NightByte','HyperWolf','StealthFox','OmegaNinja','ZephyrByte',
    'IonWolf','ChromeNinja','ApexByte','BurstFox','SwiftNinja',
  ];
  // -- Client-side fake player generation (no Firestore writes needed) --
  // Uses a seeded PRNG so scores are stable across page reloads.
  function _seededRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
      s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
      s ^= s >>> 16;
      return (s >>> 0) / 0xffffffff;
    };
  }
  function _genFakeEntries(boardType, periodId) {
    const seedStr = boardType + '|' + periodId;
    const seedNum = seedStr.split('').reduce(function (acc, c) { return (acc * 31 + c.charCodeAt(0)) | 0; }, 7);
    const rng = _seededRng(seedNum);
    const maxScore = boardType === 'alltime' ? 495000 : boardType === 'weekly' ? 245000 : 145000;
    const minScore = 5000;
    return _FAKE_NAMES.map(function (name, i) {
      const rank   = i / (_FAKE_NAMES.length - 1);
      const base   = Math.floor(minScore + (1 - rank) * (maxScore - minScore));
      const jitter = Math.floor(rng() * 4000);
      return {
        uid:      'fake_' + name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        name:     name,
        score:    base + jitter,
        isPlayer: false,
        isFake:   true,
      };
    });
  }

  // -- Firebase score submission -----------------------------
  // Writes to all three boards. Each board only updates if the new
  // score beats the player's existing score in that board.
  async function _fbSubmit(score, name) {
    await (window._fbReady || Promise.resolve(false));
    const db = window._fbDb;
    if (!db) { console.warn('[ShiftPanic] Firebase not available  score not saved.'); return; }
    if (window._fbWaitForAuth) await window._fbWaitForAuth();

    const pid = window._fbPlayerId;
    if (!pid) { console.warn('[ShiftPanic] No playerId  score not submitted.'); return; }

    const intScore = Math.floor(score);
    if (intScore <= 0) return;
    const safeName = String(name || getDisplayName()).trim().slice(0, 12) || getDisplayName();
    const weekId   = _getWeekId(), dayId = _getDayId();

    console.log('[ShiftPanic] Submitting score:', intScore, '| playerId:', pid, '| name:', safeName);

    const gRef = db.collection(G_PATH()).doc(pid);
    const wRef = db.collection(W_PATH(weekId)).doc(pid);
    const dRef = db.collection(D_PATH(dayId)).doc(pid);
    const ts   = firebase.firestore.FieldValue.serverTimestamp();
    const base = { playerId: pid, playerName: safeName, isFakePlayer: false, updatedAt: ts };

    async function _writeIfBetter(ref, newScore) {
      try {
        await db.runTransaction(async tx => {
          const snap = await tx.get(ref);
          const cur  = snap.exists ? (snap.data().score || 0) : 0;
          if (newScore > cur) {
            const data = Object.assign({}, base, { score: newScore });
            if (!snap.exists) data.createdAt = ts;
            snap.exists ? tx.update(ref, data) : tx.set(ref, data);
            console.log('[ShiftPanic] Score written to', ref.path, ':', newScore, '(was', cur + ')');
          } else {
            console.log('[ShiftPanic] Score not updated for', ref.path, ':', newScore, '<= existing', cur);
          }
        });
      } catch (err) {
        if (err.code === 'permission-denied') {
          console.warn('[ShiftPanic] Write blocked by Firestore rules. Deploy rules from firebase-client.js header.');
        } else {
          console.warn('[Firebase] Score write failed:', ref.path, err.code || err.message);
        }
      }
    }

    await Promise.all([
      _writeIfBetter(gRef, intScore),
      _writeIfBetter(wRef, intScore),
      _writeIfBetter(dRef, intScore),
    ]);
    console.log('[ShiftPanic] Firebase score submission complete.');
  }

  // -- Firestore real-time subscription ---------------------
  // Fake players are generated client-side instantly, then real
  // Firebase scores are merged in on top when they arrive.
  // Board never shows empty even when Firebase is unavailable.
  function subscribeToLeaderboard(boardType, _limitArg, callback) {
    _boardState[boardType] = 'loading';
    let _unsub     = null;
    let _cancelled = false;

    const weekId   = _getWeekId(), dayId = _getDayId();
    const periodId = boardType === 'alltime' ? 'global' : boardType === 'weekly' ? weekId : dayId;

    // Immediately populate with client-side fake players
    const _fakeEntries = _genFakeEntries(boardType, periodId);
    // Inject the player's own locally-stored best score so they're visible immediately
    const localBest = (typeof settings !== 'undefined' && settings && settings.bestScore > 0)
      ? Math.floor(settings.bestScore) : 0;
    const localPid  = (typeof window !== 'undefined' && window._fbPlayerId) || null;
    const localName = getDisplayName();
    let _initialEntries;
    if (localBest > 0 && localPid) {
      const playerLocal = { uid: localPid, name: localName, score: localBest, isPlayer: true, isFake: false };
      const fakesFiltered = _fakeEntries.filter(function (e) { return e.uid !== localPid; });
      _initialEntries = fakesFiltered.concat(playerLocal);
    } else {
      _initialEntries = _fakeEntries.slice();
    }
    _initialEntries.sort(function (a, b) { return b.score - a.score; });
    _initialEntries = _initialEntries.slice(0, 100);
    _boardState[boardType] = 'ok';
    _cache[boardType] = _initialEntries;
    if (callback) setTimeout(function () { callback(_initialEntries); }, 0);

    (window._fbReady || Promise.resolve(false)).then(function () {
      if (_cancelled) return;

      const db = window._fbDb;
      if (!db) {
        console.warn('[ShiftPanic] Firebase unavailable — showing client-side fake players only.');
        return; // Keep showing fake players
      }

      const currentPid = window._fbPlayerId;
      const collPath   = boardType === 'alltime' ? G_PATH()
                       : boardType === 'weekly'  ? W_PATH(weekId)
                       : D_PATH(dayId);

      console.log('[ShiftPanic] Attaching Firestore listener:', collPath);
      const query = db.collection(collPath).orderBy('score', 'desc').limit(100);

      _unsub = query.onSnapshot(function (snap) {
        if (_cancelled) return;

        // Real scores from Firebase (skip fake_* docs that were written by old code)
        const realEntries = snap.docs.map(function (doc) {
          const d = doc.data();
          return {
            uid:      doc.id,
            name:     d.playerName || '',
            score:    typeof d.score === 'number' ? d.score : (parseInt(d.score, 10) || 0),
            isPlayer: doc.id === currentPid,
            isFake:   false,
          };
        }).filter(function (e) { return e.score > 0 && !e.uid.startsWith('fake_'); });

        // Merge: real entries replace any fake with same uid; keep top 100 total
        const realIds  = new Set(realEntries.map(function (e) { return e.uid; }));
        const fakeFill = _fakeEntries.filter(function (e) { return !realIds.has(e.uid); });
        const merged   = realEntries.concat(fakeFill)
          .sort(function (a, b) { return b.score - a.score; })
          .slice(0, 100);

        const playerInList = merged.some(function (e) { return e.isPlayer; });

        function _finalize(allEntries) {
          allEntries.sort(function (a, b) { return b.score - a.score; });
          _boardState[boardType] = 'ok';
          _cache[boardType]      = allEntries;
          if (callback) callback(allEntries);
        }

        if (!playerInList && currentPid) {
          db.collection(collPath).doc(currentPid).get().then(function (playerSnap) {
            if (!playerSnap.exists) { _finalize(merged); return; }
            const pd = playerSnap.data();
            const ps = typeof pd.score === 'number' ? pd.score : 0;
            if (ps > 0) {
              _finalize(merged.concat({
                uid: playerSnap.id, name: pd.playerName || '',
                score: ps, isPlayer: true, outsideTop: true,
              }));
            } else { _finalize(merged); }
          }).catch(function () { _finalize(merged); });
        } else {
          _finalize(merged);
        }

      }, function (err) {
        if (_cancelled) return;
        console.warn('[Firebase] Leaderboard listener error:', err.code || err.message);
        // Keep showing whatever is in cache (fake players at minimum)
      });
    });

    return function () {
      _cancelled = true;
      if (_unsub) { try { _unsub(); } catch (_) {} }
    };
  }

  // -- Sync reads from cache (used by LeaderboardUI) --------
  function getLeaderboard(type) { return _cache[type] || []; }
  function getBoardState(type)  { return _boardState[type] || 'loading'; }
  function getPlayerRank(type) {
    const idx = getLeaderboard(type).findIndex(function (e) { return e.isPlayer && !e.outsideTop; });
    return idx === -1 ? null : idx + 1;
  }

  // submitScore: Firebase only  no localStorage leaderboard
  function submitScore(score, name) {
    if (!score || score <= 0) return;
    _fbSubmit(score, name || getDisplayName()); // intentionally not awaited
  }

  function getRankSummary(score) {
    if (!score || score <= 0) return null;
    const board = getLeaderboard('alltime');
    const rank  = (board.findIndex(function (e) { return e.isPlayer && !e.outsideTop; }) + 1) || null;
    return rank ? { rank, total: board.filter(function (e) { return !e.outsideTop; }).length, board: 'alltime' } : null;
  }

  return {
    getLeaderboard, getBoardState, getPlayerRank, submitScore, resetLocalLeaderboard,
    getPlayerName, getDisplayName, setPlayerName, validateName, getRankSummary,
    subscribeToLeaderboard,
  };
})();
// LEADERBOARD UI
// ============================================================
const LeaderboardUI = (() => {
  let _activeTab = 'alltime';
  let _isOpen    = false;
  // Active Firestore listeners keyed by board type ('alltime'|'daily'|'weekly')
  let _unsubs    = {};
  const RANK_ICONS = { 1: '1st', 2: '2nd', 3: '3rd' };

  function _fmt(n) { return Math.floor(n || 0).toLocaleString(); }

  // -- Open / close -----------------------------------------
  function open(tab) {
    const modal = document.getElementById('modal-leaderboard');
    if (!modal) return;
    _isOpen = true;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    renderYourStats();
    switchTab(tab || _activeTab);
    document.getElementById('btn-lb-close').focus();
    Audio && Audio.uiClick && Audio.uiClick();
    // Prompt for a leaderboard name the first time the player opens the board
    if (!LeaderboardService.getPlayerName()) {
      setTimeout(() => promptPlayerName(() => {
        renderYourStats();
        renderBoard(_activeTab);
      }), 500);
    }
  }
  function close() {
    const modal = document.getElementById('modal-leaderboard');
    if (!modal) return;
    _isOpen = false;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    // Unsubscribe all active Firestore listeners when modal closes
    Object.values(_unsubs).forEach(fn => { try { fn(); } catch (_) {} });
    _unsubs = {};
  }

  // -- Your stats card --------------------------------------
  function renderYourStats() {
    const el = document.getElementById('lb-your-stats');
    if (!el) return;
    const best    = settings ? Math.floor(settings.bestScore || 0) : 0;
    const runs    = gameStats ? gameStats.totalRuns : 0;
    const longest = gameStats ? gameStats.longestSurvival : 0;
    const avg     = runs > 0
      ? Math.floor((settings ? (settings.lifetimeScore || 0) : 0) / runs)
      : 0;
    const rank    = LeaderboardService.getPlayerRank('alltime');
    const pName   = LeaderboardService.getDisplayName();

    const stats = [
      { val: best ? _fmt(best) : '-',    lbl: 'Best Score' },
      { val: runs || '0',                 lbl: 'Total Runs' },
      { val: avg ? _fmt(avg) : '-',       lbl: 'Avg Score' },
      { val: rank ? '#' + rank : '-',     lbl: 'Global Rank' },
      { val: longest ? fmtTime(longest) : '-', lbl: 'Best Time' },
    ];
    el.innerHTML = stats.map(s =>
      '<div class="lb-stat-item">' +
        '<span class="lb-stat-val">' + s.val + '</span>' +
        '<span class="lb-stat-lbl">' + s.lbl + '</span>' +
      '</div>'
    ).join('');

    // Update player name in footer
    const nameEl = document.getElementById('lb-player-name-display');
    if (nameEl) nameEl.textContent = pName || '(not set)';
  }

  // -- Tab switching -----------------------------------------
  // Starts a Firestore listener for the tab being opened (if not already active)
  function _ensureListener(tab) {
    if (tab === 'local' || _unsubs[tab]) return; // local tab needs no Firebase; already subscribed
    _unsubs[tab] = LeaderboardService.subscribeToLeaderboard(tab, 25, entries => {
      // Re-render this tab whenever Firebase sends a live update
      renderBoard(tab);
      // Also refresh 'Your Stats' rank number (it reads from the alltime cache)
      if (tab === 'alltime') renderYourStats();
    });
  }

  function switchTab(tab) {
    _activeTab = tab;
    // Tab buttons
    document.querySelectorAll('.lb-tab').forEach(btn => {
      const isActive = btn.dataset.lbTab === tab;
      btn.classList.toggle('lb-tab-active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    // Panels
    ['alltime','daily','weekly','local'].forEach(t => {
      const panel = document.getElementById('lb-panel-' + t);
      if (panel) panel.hidden = (t !== tab);
    });
    renderBoard(tab);
    _ensureListener(tab); // attach Firestore listener for this board type
  }

  // -- Render a board ----------------------------------------
  function renderBoard(type, highlightNew) {
    const container = document.getElementById('lb-rows-' + type);
    if (!container) return;

    // Show loading / error states for online boards
    if (type !== 'local') {
      const state = LeaderboardService.getBoardState(type);
      if (state === 'loading') {
        container.innerHTML =
          '<div class="lb-loading" aria-live="polite">' +
            '<span class="lb-loading-spinner" aria-hidden="true"></span>' +
            'Loading scores' +
          '</div>';
        return;
      }
      if (state === 'error') {
        container.innerHTML =
          '<div class="lb-empty">' +
            '<span class="lb-empty-icon"></span>' +
            'Could not load scores.<br>Check your connection and try again.' +
          '</div>';
        return;
      }
    }

    const entries = LeaderboardService.getLeaderboard(type);

    if (!entries || entries.length === 0) {
      container.innerHTML =
        '<div class="lb-empty">' +
          '<span class="lb-empty-icon"></span>' +
          'No scores yet. Play a round to appear here!' +
        '</div>';
      return;
    }

    // Separate main ranked entries from the player's out-of-top entry
    const mainEntries    = entries.filter(e => !e.outsideTop);
    const outsideEntry   = entries.find(e => e.outsideTop);
    const outsideRank    = outsideEntry ? entries.indexOf(outsideEntry) + 1 : null;

    let html = mainEntries.map((e, i) => {
      const rank     = i + 1;
      const isPlayer = e.isPlayer;
      const icon     = RANK_ICONS[rank] || '';
      const you      = isPlayer ? '<span class="lb-you-badge">YOU</span>' : '';
      const rowClass = 'lb-row' + (isPlayer ? ' lb-row-you' : '') + (highlightNew && isPlayer ? ' lb-new' : '');
      return '<div class="' + rowClass + '" data-rank="' + rank + '" role="listitem">' +
        '<div class="lb-rank">' +
          '<span class="lb-rank-num">' + rank + '</span>' +
          (icon ? '<span class="lb-rank-icon">' + icon + '</span>' : '') +
        '</div>' +
        '<div class="lb-player">' +
          '<span class="lb-player-name">' + _esc(e.name) + you + '</span>' +
        '</div>' +
        '<div class="lb-score-cell">' +
          '<span class="lb-score-val">' + _fmt(e.score) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    // If player is outside the top list, show a separator + their row at the bottom
    if (outsideEntry) {
      html += '<div class="lb-separator" role="separator">  </div>';
      html += '<div class="lb-row lb-row-you' + (highlightNew ? ' lb-new' : '') + '" data-rank="' + outsideRank + '" role="listitem">' +
        '<div class="lb-rank"><span class="lb-rank-num">' + outsideRank + '</span></div>' +
        '<div class="lb-player"><span class="lb-player-name">' + _esc(outsideEntry.name) + '<span class="lb-you-badge">YOU</span></span></div>' +
        '<div class="lb-score-cell"><span class="lb-score-val">' + _fmt(outsideEntry.score) + '</span></div>' +
      '</div>';
    }

    container.innerHTML = html;

    // Sticky "your rank" if player row is not visible (only for in-top entries)
    _renderStickyYou(container, mainEntries);

    // Scroll player row into view if highlightNew
    if (highlightNew) {
      requestAnimationFrame(() => {
        const you = container.querySelector('.lb-row-you');
        if (you) you.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  function _renderStickyYou(container, entries) {
    // Remove existing sticky
    const old = container.querySelector('.lb-you-sticky');
    if (old) old.remove();

    const idx = entries.findIndex(e => e.isPlayer);
    if (idx === -1) return;
    const rank = idx + 1;
    const e    = entries[idx];
    const sticky = document.createElement('div');
    sticky.className = 'lb-you-sticky hidden';
    sticky.innerHTML = '<span>Your Rank: <strong>#' + rank + '</strong></span><span>' + _fmt(e.score) + '</span>';
    container.appendChild(sticky);

    // Observer to show/hide sticky when player row scrolls out
    const board = container.closest('.lb-board');
    if (!board) return;
    const playerRow = container.querySelectorAll('.lb-row')[idx];
    if (!playerRow) return;
    const obs = new IntersectionObserver(([entry]) => {
      sticky.classList.toggle('hidden', entry.isIntersecting);
    }, { root: board, threshold: 0.1 });
    obs.observe(playerRow);
  }

  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // -- Post-run rank display ---------------------------------
  function showPostRunRank(score, wasNewBest) {
    // Submit the score (always  uses transaction so only personal bests are stored)
    LeaderboardService.submitScore(score, LeaderboardService.getDisplayName());

    const rank    = LeaderboardService.getPlayerRank('alltime');
    const section = document.getElementById('go-rank-section');
    const row     = document.getElementById('go-rank-row');
    if (!section || !row) return;

    if (!rank) { section.hidden = true; return; }
    section.hidden = false;

    const board = LeaderboardService.getLeaderboard('alltime');
    const total = board.filter(e => !e.outsideTop).length;
    let msg = 'Global Rank: <span class="go-rank-highlight">#' + rank + '</span> of ' + total;
    if (rank <= 10) msg += ' - Top 10!';
    if (rank <= 3)  msg = '<span class="go-rank-highlight">#' + rank + ' Global</span> - Incredible!';
    row.innerHTML = msg;

    // Show rank toast
    if (wasNewBest && rank <= 25) {
      _showRankToast('Rank #' + rank + ' - New Best Score!');
    }
  }

  function _showRankToast(msg) {
    const toast = document.getElementById('lb-rank-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    void toast.offsetWidth;
    toast.classList.add('lrt-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toast.classList.remove('lrt-show');
      setTimeout(() => { toast.hidden = true; }, 450);
    }, 3200);
  }

  // -- Player name dialog -------------------------------------
  let _nameResolve = null;
  function promptPlayerName(callback) {
    const overlay = document.getElementById('name-overlay');
    const dialog  = document.getElementById('name-dialog');
    const input   = document.getElementById('nd-input');
    const errEl   = document.getElementById('nd-error');
    if (!overlay || !dialog || !input) { if (callback) callback(null); return; }
    _nameResolve = callback;
    input.value  = LeaderboardService.getPlayerName() || '';
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false');
    dialog.hidden  = false;
    requestAnimationFrame(() => input.focus());
  }
  function _saveName() {
    const input = document.getElementById('nd-input');
    const errEl = document.getElementById('nd-error');
    const val   = (input ? input.value : '').trim();
    const err   = LeaderboardService.validateName(val);
    if (err) {
      if (errEl) { errEl.textContent = err; errEl.hidden = false; }
      return;
    }
    LeaderboardService.setPlayerName(val);
    _closeNameDialog();
    if (_nameResolve) { _nameResolve(val); _nameResolve = null; }
    // Refresh leaderboard name display
    const nameEl = document.getElementById('lb-player-name-display');
    if (nameEl) nameEl.textContent = val;
    renderBoard(_activeTab);
    renderYourStats();
  }
  function _closeNameDialog() {
    const overlay = document.getElementById('name-overlay');
    const dialog  = document.getElementById('name-dialog');
    if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
    if (dialog)  dialog.hidden = true;
  }

  // refreshActive  called externally to re-render the currently visible tab
  // (e.g. after a score submit so the UI stays in sync)
  function refreshActive() {
    if (_isOpen) renderBoard(_activeTab);
  }

  // -- Init / wire buttons -----------------------------------
  function init() {
    // Open leaderboard from home screen
    const btnLb = document.getElementById('btn-leaderboard');
    if (btnLb) btnLb.addEventListener('click', () => open('alltime'));

    // Open from game-over
    const btnLbGo = document.getElementById('btn-lb-gameover');
    if (btnLbGo) btnLbGo.addEventListener('click', () => {
      // Return to home first, then open
      if (typeof returnHome === 'function') returnHome();
      setTimeout(() => open('alltime'), 80);
    });

    // Close button
    const btnClose = document.getElementById('btn-lb-close');
    if (btnClose) btnClose.addEventListener('click', close);

    // Backdrop close — ignore events that are scroll-end touches
    const modal = document.getElementById('modal-leaderboard');
    if (modal) {
      let _lbScrolled = false;
      modal.addEventListener('scroll', () => { _lbScrolled = true; }, true);
      modal.addEventListener('touchmove', () => { _lbScrolled = true; }, { passive: true, capture: true });
      modal.addEventListener('click', e => {
        if (_lbScrolled) { _lbScrolled = false; return; }
        if (e.target === modal) close();
      });
    }

    // Tab buttons
    document.querySelectorAll('.lb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.lbTab);
        Audio && Audio.uiClick && Audio.uiClick();
      });
    });

    // Reset local
    const resetBtn = document.getElementById('lb-reset-local');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (!confirm('Reset all local scores?')) return;
      LeaderboardService.resetLocalLeaderboard();
      renderBoard('local');
    });

    // Change name
    const changeNameBtn = document.getElementById('lb-change-name');
    if (changeNameBtn) changeNameBtn.addEventListener('click', () => promptPlayerName(() => {}));

    // Name dialog: save
    const ndSave = document.getElementById('nd-save');
    if (ndSave) ndSave.addEventListener('click', _saveName);

    // Name dialog: cancel / skip  keep anon tag, still resolve callback
    const ndCancel = document.getElementById('nd-cancel');
    if (ndCancel) ndCancel.addEventListener('click', () => {
      const cb = _nameResolve; _nameResolve = null;
      _closeNameDialog();
      // Refresh so "Your Rank" card shows the anon display name
      const nameEl = document.getElementById('lb-player-name-display');
      if (nameEl) nameEl.textContent = LeaderboardService.getDisplayName();
      renderYourStats();
      if (cb) cb(null);
    });

    // Name dialog: enter key
    const ndInput = document.getElementById('nd-input');
    if (ndInput) ndInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); _saveName(); }
      if (e.key === 'Escape') { _nameResolve = null; _closeNameDialog(); }
    });

    // Escape to close leaderboard
    document.addEventListener('keydown', e => {
      if (_isOpen && e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  return { open, close, init, renderBoard, renderYourStats, showPostRunRank, promptPlayerName, switchTab, refreshActive };
})();





