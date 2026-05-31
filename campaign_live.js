// ============================================================
// SHIFTPANIC - CAMPAIGN MODE v1
// Clean, scalable campaign system. No regressions to Endless Mode.
// ============================================================
'use strict';
console.log('[Campaign] v2 module loading...');

// ============================================================
// SECTION 1: LEVEL CONFIG
// All 10 levels defined here. Add more by pushing to this array.
// ============================================================
const CAMPAIGN_LEVELS = [
    {
      id: 1,
      name: 'First Shift',
      subtitle: 'Learn to read the colors and survive.',
      difficulty: 'Easy',
      difficultyColor: '#22c55e',
      objectiveType: 'survive_seconds',
      objectiveTarget: 25,
      timeLimit: 25,
      rewardCoins: 30,
      replayReward: 5,
      tip: 'Quick bursts force early movement — read the color indicator and react fast.',
      starConditions: [
        { stars: 3, label: 'No hits',       check: (d) => d.hitsReceived === 0 },
        { stars: 2, label: 'At most 1 hit', check: (d) => d.hitsReceived <= 1 },
        { stars: 1, label: 'Survive 25s',   check: (d) => true },
      ],
      // Spawn script implements the requested timeline and safety events
      spawnScript: [
        // 0-5s: simple blocks, medium speed, force basic movement
        { time: 0.2, type: 'fallingWave', pattern: 'wideGaps', duration: 1.0 },
        { time: 1.0, type: 'safeGap', duration: 2.0 },
        // 5-15s: denser but fair falling blocks, wider variety
        { time: 5.0, type: 'fallingWave', pattern: 'default', duration: 10.0 },
        // 15s: warning then pressure wave (15-21s)
        { time: 15.0, type: 'warning', text: 'Pressure Wave!' },
        { time: 15.0, type: 'pressureWave', duration: 6 },
        // At the start of the pressure window, raise obstacle speeds/pressure
        { time: 15.0, handler: function(ev) { try { window._campaignSpawnConfig = window._campaignSpawnConfig || {}; window._campaignSpawnConfig.obstacleSpeedMin = 320; window._campaignSpawnConfig.obstacleSpeedMax = 360; window._campaignSpawnConfig.maxObstaclesOnScreen = 10; } catch(_){} } },
        // 21s: ease slightly for last few seconds
        { time: 21.0, handler: function(ev) { try { if (window._campaignSpawnConfig) { window._campaignSpawnConfig.obstacleSpeedMin = 260; window._campaignSpawnConfig.obstacleSpeedMax = 320; window._campaignSpawnConfig.maxObstaclesOnScreen = 10; } } catch(_){} } },
        { time: 22.5, type: 'safeGap', duration: 3.0 }
        ,{ time: 6.5, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.singleGapWall && window.CampaignPatterns.singleGapWall({}); } catch(_){} } }
        ,{ time: 12.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.staggeredGapRows && window.CampaignPatterns.staggeredGapRows({}); } catch(_){} } }
        ,{ time: 19.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.finalGapRush && window.CampaignPatterns.finalGapRush({}); } catch(_){} } }
      ],
      settings: {
        // tuning: spawnInterval in seconds (650ms), slightly higher base speed multiplier
        speedMult: 0.78, spawnInterval: 0.65, forbiddenInterval: 7.0,
        coinsEnabled: false, coinItemInterval: null, powerupsEnabled: false,
        // seed spawn overrides used by the spawn director (initial values)
        spawn: { obstacleSpeedMin: 280, obstacleSpeedMax: 320, maxObstaclesOnScreen: 10 },
        diffCap: { maxSpeedMult: 0.90, minSpawnInterval: 0.65, minForbiddenInterval: 5.5 },
        disablePanic: false, disableDoubleDanger: true,
        doubleTroubleAt: [], shrinkingArena: false, bossMode: false,
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
      rewardCoins: 36,
      replayReward: 8,
      tip: 'Gold coins appear regularly — move to them quickly without hitting danger blocks.',
      starConditions: [
        { stars: 3, label: '12+ sec left',  check: (d) => d.timeRemaining >= 12 },
        { stars: 2, label: '5+ sec left',   check: (d) => d.timeRemaining >= 5 },
        { stars: 1, label: 'Collect 15',    check: (d) => true },
      ],
      // Deterministic coin waves (total possible coins = 18)
      spawnScript: [
        // 0s: 2 coins center-left
        { time: 0.6, handler: function(ev) {
          try {
            const lanesCount = typeof numLanes === 'function' ? numLanes() : 5;
            const center = Math.floor(lanesCount/2);
            const lane = Math.max(0, center - 1);
            window._campaignSafeZones = window._campaignSafeZones || [];
            const cx = (typeof laneX === 'function') ? laneX(lane) : (canvas?canvas.width*0.35:240);
            window._campaignSafeZones.push({ x: cx, y: (canvas?canvas.height*0.6:240), r: 72, t: 6.0 });
            for (let i=0;i<2;i++) {
              const jitter = (seeded() - 0.5) * 0.04;
              _schedule(i * 0.12 + jitter, () => _createCoinAtLane(lane, { count: 1 }));
            }
          } catch(_) {}
        } },
        // 4s: 3 coins right arc
        { time: 4.0, handler: function(ev) {
          try {
            const lanesCount = typeof numLanes === 'function' ? numLanes() : 5;
            const start = Math.max(0, lanesCount - 1);
            window._campaignSafeZones = window._campaignSafeZones || [];
            const cx = (typeof laneX === 'function') ? laneX(start) : (canvas?canvas.width*0.85:560);
            window._campaignSafeZones.push({ x: cx, y: (canvas?canvas.height*0.6:240), r: 72, t: 6.0 });
            for (let i=0;i<3;i++) {
              const jitter = (seeded() - 0.5) * 0.035;
              _schedule(i * 0.12 + jitter, () => _createCoinAtLane(start - i, { count: 1 }));
            }
          } catch(_) {}
        } },
        // 8s: 2 coins left side
        { time: 8.0, handler: function(ev) {
          try {
            const lane = 0;
            window._campaignSafeZones = window._campaignSafeZones || [];
            const cx = (typeof laneX === 'function') ? laneX(lane) : (canvas?canvas.width*0.12:80);
            window._campaignSafeZones.push({ x: cx, y: (canvas?canvas.height*0.6:240), r: 72, t: 6.0 });
            for (let i=0;i<2;i++) _schedule(i * 0.12 + (seeded()-0.5)*0.03, () => _createCoinAtLane(lane, { count: 1 }));
          } catch(_) {}
        } },
        // 12s: 3 coins center zigzag
        { time: 12.0, handler: function(ev) {
          try {
            const lanesCount = typeof numLanes === 'function' ? numLanes() : 5;
            const center = Math.floor(lanesCount/2);
            const seq = [center, Math.max(0, center-1), Math.min(lanesCount-1, center+1)];
            window._campaignSafeZones = window._campaignSafeZones || [];
            const cx = (typeof laneX === 'function') ? laneX(center) : (canvas?canvas.width*0.5:400);
            window._campaignSafeZones.push({ x: cx, y: (canvas?canvas.height*0.6:240), r: 72, t: 6.0 });
            for (let i=0;i<seq.length;i++) _schedule(i * 0.12 + (seeded()-0.5)*0.03, () => _createCoinAtLane(seq[i], { count: 1 }));
          } catch(_) {}
        } },
        // 17s: 2 coins right lane
        { time: 17.0, handler: function(ev) {
          try {
            const lanesCount = typeof numLanes === 'function' ? numLanes() : 5;
            const lane = Math.max(0, lanesCount - 1);
            window._campaignSafeZones = window._campaignSafeZones || [];
            const cx = (typeof laneX === 'function') ? laneX(lane) : (canvas?canvas.width*0.85:560);
            window._campaignSafeZones.push({ x: cx, y: (canvas?canvas.height*0.6:240), r: 72, t: 6.0 });
            for (let i=0;i<2;i++) _schedule(i * 0.12 + (seeded()-0.5)*0.03, () => _createCoinAtLane(lane, { count: 1 }));
          } catch(_) {}
        } },
        // 22s: 3 coins left-to-right trail
        { time: 22.0, handler: function(ev) {
          try {
            const lanesCount = typeof numLanes === 'function' ? numLanes() : 5;
            const start = 0;
            window._campaignSafeZones = window._campaignSafeZones || [];
            const cx = (typeof laneX === 'function') ? laneX(start) : (canvas?canvas.width*0.12:80);
            window._campaignSafeZones.push({ x: cx, y: (canvas?canvas.height*0.6:240), r: 72, t: 6.0 });
            for (let i=0;i<3;i++) _schedule(i * 0.12 + (seeded()-0.5)*0.03, () => _createCoinAtLane(start + i, { count: 1 }));
          } catch(_) {}
        } },
        // 28s: 3 coins final center spread
        { time: 28.0, handler: function(ev) {
          try {
            const lanesCount = typeof numLanes === 'function' ? numLanes() : 5;
            const center = Math.floor(lanesCount/2);
            const seq = [Math.max(0, center-1), center, Math.min(lanesCount-1, center+1)];
            window._campaignSafeZones = window._campaignSafeZones || [];
            const cx = (typeof laneX === 'function') ? laneX(center) : (canvas?canvas.width*0.5:400);
            window._campaignSafeZones.push({ x: cx, y: (canvas?canvas.height*0.6:240), r: 80, t: 6.0 });
            for (let i=0;i<seq.length;i++) _schedule(i * 0.12 + (seeded()-0.5)*0.03, () => _createCoinAtLane(seq[i], { count: 1 }));
          } catch(_) {}
        } }
      ],
      settings: {
        speedMult: 0.75, spawnInterval: 0.65, forbiddenInterval: 4.0,
        coinsEnabled: true, coinItemInterval: null, powerupsEnabled: false,
        // ensure main spawner does not randomly inject coins during this level; deterministic waves above control coin count
        diffCap: { maxSpeedMult: 0.90, minSpawnInterval: 0.55, minForbiddenInterval: 3.5 },
        disablePanic: true, disableDoubleDanger: true,
        doubleTroubleAt: [], shrinkingArena: false, bossMode: false,
      },
    },
    {
      id: 3,
      name: 'Dodge School',
      subtitle: 'Prove your reflexes by dodging 100 blocks.',
      difficulty: 'Medium',
      difficultyColor: '#f59e0b',
      objectiveType: 'dodge_blocks',
      objectiveTarget: 100,
      timeLimit: 75,
      rewardCoins: 48,
      replayReward: 9,
      tip: 'A dodge counts when a danger block fully passes below you. Focus on gaps, not hits.',
      starConditions: [
        { stars: 3, label: 'No hits',       check: (d) => d.hitsReceived === 0 },
        { stars: 2, label: '≤ 2 hits',      check: (d) => d.hitsReceived <= 2 },
        { stars: 1, label: 'Dodge 100',     check: (d) => true },
      ],
      // Use the named spawn pattern so the campaign pattern factory can enable phase logic
      spawnPattern: 'dodgeSchoolPhases',
      settings: {
        // Base tuning; pattern will adjust speeds and cadence during phases
        speedMult: 0.85, spawnInterval: 0.70, forbiddenInterval: 3.5,
        coinsEnabled: false, coinItemInterval: null, powerupsEnabled: false,
        // seed spawn overrides used by spawners (initial values)
        spawn: { obstacleSpeedMin: 300, obstacleSpeedMax: 340, maxObstaclesOnScreen: 12 },
        diffCap: { maxSpeedMult: 1.10, minSpawnInterval: 0.50, minForbiddenInterval: 3.0 },
        disablePanic: true, disableDoubleDanger: true,
        doubleTroubleAt: [], shrinkingArena: false, bossMode: false,
      },
    },
    {
      id: 4,
      name: 'Fast Switch',
      subtitle: 'Colors change faster — stay sharp.',
      difficulty: 'Medium',
      difficultyColor: '#f59e0b',
      objectiveType: 'survive_seconds',
      objectiveTarget: 50,
      timeLimit: 50,
      rewardCoins: 54,
      replayReward: 10,
      tip: 'Watch the warning timer at the top. When it glows, the forbidden color is about to change.',
      starConditions: [
        { stars: 3, label: 'No hits',       check: (d) => d.hitsReceived === 0 },
        { stars: 2, label: 'At most 1 hit', check: (d) => d.hitsReceived <= 1 },
        { stars: 1, label: 'Survive 50s',   check: (d) => true },
      ],
      // Use the named spawn pattern implemented in script.js
      spawnPattern: 'fastSwitchWaves',
      settings: {
        // Base tuning: normal cadence 650ms, base obstacle speeds 300-360, slow color switch
        speedMult: 0.85, spawnInterval: 0.65, forbiddenInterval: 7.0,
        coinsEnabled: false, coinItemInterval: null, powerupsEnabled: false,
        // seed spawn overrides used by spawners (initial values)
        spawn: { obstacleSpeedMin: 300, obstacleSpeedMax: 360, maxObstaclesOnScreen: 12 },
        // Allow waves to temporarily reduce spawn interval below base
        diffCap: { maxSpeedMult: 1.25, minSpawnInterval: 0.32, minForbiddenInterval: 1.8 },
        disablePanic: false, disableDoubleDanger: true,
        doubleTroubleAt: [], shrinkingArena: false, bossMode: false,
      },
    },
    {
      id: 5,
      name: 'Tight Gaps',
      subtitle: 'Navigate narrow paths without breaking.',
      difficulty: 'Medium',
      difficultyColor: '#f59e0b',
      objectiveType: 'survive_seconds',
      objectiveTarget: 25,
      timeLimit: 25,
      rewardCoins: 30,
      replayReward: 5,
      tip: 'Quick bursts force early movement — read the color indicator and react fast.',
      starConditions: [
        { stars: 3, label: 'No hits',       check: (d) => d.hitsReceived === 0 },
        { stars: 2, label: 'At most 1 hit', check: (d) => d.hitsReceived <= 1 },
        { stars: 1, label: 'Survive 25s',   check: (d) => true },
      ],
      // Spawn script implements the requested timeline and safety events
      spawnScript: [
        // 0-5s: simple blocks, medium speed, force basic movement
        { time: 0.2, type: 'fallingWave', pattern: 'wideGaps', duration: 1.0 },
        { time: 1.0, type: 'safeGap', duration: 2.0 },
        // 5-15s: denser but fair falling blocks, wider variety
        { time: 5.0, type: 'fallingWave', pattern: 'default', duration: 10.0 },
        // 15s: warning then pressure wave (15-21s)
        { time: 15.0, type: 'warning', text: 'Pressure Wave!' },
        { time: 15.0, type: 'pressureWave', duration: 6 },
        // At the start of the pressure window, raise obstacle speeds/pressure
        { time: 15.0, handler: function(ev) { try { window._campaignSpawnConfig = window._campaignSpawnConfig || {}; window._campaignSpawnConfig.obstacleSpeedMin = 320; window._campaignSpawnConfig.obstacleSpeedMax = 360; window._campaignSpawnConfig.maxObstaclesOnScreen = 10; } catch(_){} } },
        // 21s: ease slightly for last few seconds
        { time: 21.0, handler: function(ev) { try { if (window._campaignSpawnConfig) { window._campaignSpawnConfig.obstacleSpeedMin = 260; window._campaignSpawnConfig.obstacleSpeedMax = 320; window._campaignSpawnConfig.maxObstaclesOnScreen = 10; } } catch(_){} } },
        { time: 22.5, type: 'safeGap', duration: 3.0 }
      ],
      settings: {
        // tuning: spawnInterval in seconds (650ms), slightly higher base speed multiplier
        speedMult: 0.78, spawnInterval: 0.65, forbiddenInterval: 7.0,
        coinsEnabled: false, coinItemInterval: null, powerupsEnabled: false,
        // seed spawn overrides used by the spawn director (initial values)
        spawn: { obstacleSpeedMin: 280, obstacleSpeedMax: 320, maxObstaclesOnScreen: 10 },
        diffCap: { maxSpeedMult: 0.90, minSpawnInterval: 0.65, minForbiddenInterval: 5.5 },
        disablePanic: false, disableDoubleDanger: true,
        doubleTroubleAt: [], shrinkingArena: false, bossMode: false,
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
      rewardCoins: 180,
      replayReward: 15,
      tip: 'Move aggressively to grab coins — but never into a forbidden block.',
      starConditions: [
        { stars: 3, label: '15+ sec left',  check: (d) => d.timeRemaining >= 15 },
        { stars: 2, label: '6+ sec left',   check: (d) => d.timeRemaining >= 6 },
        { stars: 1, label: 'Collect 25',    check: (d) => true },
      ],
      spawnScript: [
        { time: 0.8, type: 'coinTrail', pattern: 'leftToRightArc', lane: 1, count:5 },
        { time: 12.0, type: 'coinTrail', pattern: 'rightToLeftArc', lane: 4, count:4 },
        { time: 35.0, type: 'panicWave', duration: 5 }
      ],
      settings: {
        speedMult: 0.95, spawnInterval: 0.40, forbiddenInterval: 2.5,
        coinsEnabled: true, coinItemInterval: 3.0, powerupsEnabled: false,
        diffCap: { maxSpeedMult: 1.10, minSpawnInterval: 0.35, minForbiddenInterval: 2.0 },
        disablePanic: false, disableDoubleDanger: false,
        doubleTroubleAt: [], shrinkingArena: false, bossMode: false,
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
      rewardCoins: 210,
      replayReward: 18,
      tip: 'At 15s, 30s and 45s a surge fires. Use the brief warning to find a safe zone.',
      starConditions: [
        { stars: 3, label: 'No hits',       check: (d) => d.hitsReceived === 0 },
        { stars: 2, label: 'At most 1 hit', check: (d) => d.hitsReceived <= 1 },
        { stars: 1, label: 'Survive 60s',   check: (d) => true },
      ],
      spawnScript: [
        { time: 12.0, type: 'warning', text: 'Double Trouble imminent' },
        { time: 15.0, type: 'panicWave', duration: 4 },
        { time: 30.0, type: 'panicWave', duration: 4 },
        { time: 45.0, type: 'panicWave', duration: 4 }
        ,{ time: 16.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.spawnSideBlock && window.CampaignPatterns.spawnSideBlock({ side: 'left' }); } catch(_){} } },
        { time: 34.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.spawnSideBlock && window.CampaignPatterns.spawnSideBlock({ side: 'right' }); } catch(_){} } }
      ],
      settings: {
        speedMult: 1.0, spawnInterval: 0.42, forbiddenInterval: 2.8,
        coinsEnabled: false, coinItemInterval: null, powerupsEnabled: false,
        diffCap: { maxSpeedMult: 1.15, minSpawnInterval: 0.35, minForbiddenInterval: 2.3 },
        disablePanic: false, disableDoubleDanger: false,
        doubleTroubleAt: [15, 30, 45], shrinkingArena: false, bossMode: false,
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
      timeLimit: 50,
      rewardCoins: 240,
      replayReward: 20,
      tip: 'Watch the glowing boundaries. Move early and keep to the inner arena.',
      starConditions: [
        { stars: 3, label: 'No hits',       check: (d) => d.hitsReceived === 0 },
        { stars: 2, label: 'At most 1 hit', check: (d) => d.hitsReceived <= 1 },
        { stars: 1, label: 'Survive 50s',   check: (d) => true },
      ],
      spawnScript: [
        { time: 2.0, type: 'fallingWave', pattern: 'tight' },
        { time: 6.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.movingGapWall && window.CampaignPatterns.movingGapWall({}); } catch(_){} } },
        { time: 14.0, type: 'pressureWave', duration: 3 }
        ,{ time: 28.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.doubleGapWall && window.CampaignPatterns.doubleGapWall({}); } catch(_){} } }
      ],
      settings: {
        speedMult: 1.0, spawnInterval: 0.38, forbiddenInterval: 2.8,
        coinsEnabled: false, coinItemInterval: null, powerupsEnabled: false,
        diffCap: { maxSpeedMult: 1.10, minSpawnInterval: 0.32, minForbiddenInterval: 2.3 },
        disablePanic: false, disableDoubleDanger: false,
        doubleTroubleAt: [], shrinkingArena: true, bossMode: false,
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
      rewardCoins: 300,
      replayReward: 25,
      tip: 'All three objectives must be completed. Panic wave fires at 45s — be ready.',
      starConditions: [
        { stars: 3, label: 'No hits',       check: (d) => d.hitsReceived === 0 },
        { stars: 2, label: 'At most 1 hit', check: (d) => d.hitsReceived <= 1 },
        { stars: 1, label: 'All 3 done',    check: (d) => true },
      ],
      spawnScript: [
        { time: 5.0, type: 'fallingWave', pattern: 'default' },
        { time: 12.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.doubleGapWall && window.CampaignPatterns.doubleGapWall({}); } catch(_){} } },
        { time: 20.0, type: 'pressureWave', duration: 4 },
        { time: 45.0, type: 'panicWave', duration: 6 }
        ,{ time: 28.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.spawnSideBlock && window.CampaignPatterns.spawnSideBlock({ side: (window.campaignRandom() < 0.5 ? 'left' : 'right') }); } catch(_){} } }
        ,{ time: 36.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.fakeEasyGapRiskyCoin && window.CampaignPatterns.fakeEasyGapRiskyCoin({}); } catch(_){} } }
      ],
      settings: {
        speedMult: 1.05, spawnInterval: 0.35, forbiddenInterval: 2.3,
        coinsEnabled: true, coinItemInterval: 4.0, powerupsEnabled: false,
        diffCap: { maxSpeedMult: 1.20, minSpawnInterval: 0.28, minForbiddenInterval: 1.8 },
        disablePanic: false, disableDoubleDanger: false,
        doubleTroubleAt: [25, 55], shrinkingArena: false, bossMode: false,
      },
    },
    {
      id: 10,
      name: 'The Panic Core',
      subtitle: 'Face the boss. Collect orbs to deal damage.',
      difficulty: 'Boss',
      difficultyColor: '#ec4899',
      objectiveType: 'boss_defeat',
      objectiveTarget: 10,
      timeLimit: 120,
      rewardCoins: 600,
      replayReward: 50,
      tip: 'Collect glowing orbs to damage the boss. Dodge its projectiles — they have warning lines.',
      starConditions: [
        { stars: 3, label: 'No hits',       check: (d) => d.hitsReceived === 0 },
        { stars: 2, label: 'Defeat boss',   check: (d) => d.bossDefeated === true },
        { stars: 1, label: 'Defeat boss',   check: (d) => d.bossDefeated === true },
      ],
      spawnScript: [
        { time: 2.0, type: 'bossAttack' },
        { time: 6.0, type: 'coinTrail', pattern: 'leftToRightArc', lane: 1, count: 3, orb: true },
        { time: 10.0, type: 'fallingWave', pattern: 'tight' },
        { time: 18.0, type: 'coinTrail', pattern: 'rightToLeftArc', lane: 3, count: 4, orb: true },
        { time: 30.0, type: 'pressureWave', duration: 5 },
        { time: 36.0, type: 'coinTrail', pattern: 'leftToRightArc', lane: 2, count: 3, orb: true },
        { time: 8.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.spawnSideBlock && window.CampaignPatterns.spawnSideBlock({ side: 'left', y: canvas ? Math.max(160, Math.min(canvas.height - 160, player ? player.y : canvas.height * 0.7)) }); } catch(_){} } },
        { time: 50.0, handler: function(ev) { try { window.CampaignPatterns && window.CampaignPatterns.spawnSideBlock && window.CampaignPatterns.spawnSideBlock({ side: 'right' }); } catch(_){} } }
      ],
      settings: {
        speedMult: 0.90, spawnInterval: 0.48, forbiddenInterval: 3.0,
        coinsEnabled: true, coinItemInterval: 4.5, powerupsEnabled: false,
        diffCap: { maxSpeedMult: 1.10, minSpawnInterval: 0.38, minForbiddenInterval: 2.5 },
        disablePanic: false, disableDoubleDanger: false,
        doubleTroubleAt: [], shrinkingArena: false, bossMode: true,
      },
    },
  ];

// Normalize level definitions to a single `rules` schema while keeping
// `settings` available for backwards compatibility. This lets designers
// author levels using `rules` going forward while the runtime can still
// use `lvl.settings` until all code is migrated.
function _convertRulesToSettings(r) {
  if (!r) r = {};
  const settings = {
    speedMult:         typeof r.speedMult === 'number' ? r.speedMult : (r.engine && r.engine.speedMult) || 1.0,
    spawnInterval:     typeof r.spawnInterval === 'number' ? r.spawnInterval : (r.engine && r.engine.spawnInterval) || 0.45,
    forbiddenInterval: typeof r.forbiddenInterval === 'number' ? r.forbiddenInterval : (r.engine && r.engine.forbiddenInterval) || 3.0,
    coinsEnabled:      typeof r.coinsEnabled === 'boolean' ? r.coinsEnabled : !!(r.coins && r.coins.enabled),
    coinItemInterval:  (r.coinItemInterval != null) ? r.coinItemInterval : (r.coins && r.coins.coinItemInterval) || null,
    powerupsEnabled:   typeof r.powerupsEnabled === 'boolean' ? r.powerupsEnabled : !!(r.powerups && r.powerups.enabled),
    diffCap:           r.diffCap || (r.engine && r.engine.diffCap) || null,
    disablePanic:      !!r.disablePanic || !!(r.flags && r.flags.disablePanic),
    disableDoubleDanger: !!r.disableDoubleDanger || !!(r.flags && r.flags.disableDoubleDanger),
    doubleTroubleAt:   (r.doubleTroubleAt || (r.flags && r.flags.doubleTroubleAt) || []).slice(),
    shrinkingArena:    !!r.shrinkingArena || !!(r.flags && r.flags.shrinkingArena),
    bossMode:          !!r.bossMode || !!(r.flags && r.flags.bossMode),
  };
  return settings;
}

// If old-style `settings` are present, create a `rules` object so new
// tooling can read a single canonical shape. Also ensure `settings` is
// always present for existing runtime code.
CAMPAIGN_LEVELS.forEach(lvl => {
  if (!lvl.rules && lvl.settings) {
    lvl.rules = {
      engine: {
        speedMult: lvl.settings.speedMult,
        spawnInterval: lvl.settings.spawnInterval,
        forbiddenInterval: lvl.settings.forbiddenInterval,
        diffCap: lvl.settings.diffCap || null,
      },
      coins: { enabled: !!lvl.settings.coinsEnabled, coinItemInterval: lvl.settings.coinItemInterval },
      powerups: { enabled: !!lvl.settings.powerupsEnabled },
      flags: {
        disablePanic: !!lvl.settings.disablePanic,
        disableDoubleDanger: !!lvl.settings.disableDoubleDanger,
        doubleTroubleAt: (lvl.settings.doubleTroubleAt || []).slice(),
        shrinkingArena: !!lvl.settings.shrinkingArena,
        bossMode: !!lvl.settings.bossMode,
      },
      previewPattern: lvl.previewPattern || null,
    };
  }
  // Ensure runtime-friendly `settings` exists (derived from rules when possible)
  if (!lvl.settings && lvl.rules) {
    lvl.settings = _convertRulesToSettings(Object.assign({}, lvl.rules.engine || {}, lvl.rules));
  } else if (lvl.rules) {
    // Keep settings in sync with rules for safety
    lvl.settings = Object.assign({}, lvl.settings || {}, _convertRulesToSettings(Object.assign({}, lvl.rules.engine || {}, lvl.rules)));
  }
});




// ============================================================
// SECTION 2: CAMPAIGN SAVE MANAGER
// Versioned progress stored in localStorage.
// Key: 'shiftPanicCampaign' - separate from all existing save keys.
// ============================================================
const CampaignSave = (() => {
  const LS_KEY  = 'shiftPanicCampaign';
  // Bump this VERSION to force older clients to reset their campaign save
  // to the defaults in `_default()` on next load. Incrementing clears
  // `localStorage.shiftPanicCampaign` for all players when the new code runs.
  const VERSION = 2;

  const _default = () => ({
    version: VERSION,
    highestUnlockedLevel: 1,
    completedLevels: {},
    starsByLevel: {},
    bestScoresByLevel: {},
    bestTimesByLevel: {},
    totalStars: 0,
    campaignCoinsEarned: 0,
    disabledBriefings: {},
  });

  let _data = null;

  function load() {
    if (_data) return _data;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { _data = _default(); return _data; }
      // Be defensive when parsing user data — attempt to recover malformed JSON
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (pe) {
        // Try to sanitize common issues: trailing commas and control chars
        try {
          const sanitized = raw.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001F]+/g, '');
          parsed = JSON.parse(sanitized);
        } catch (pe2) {
          // Try to grab the first JSON object in case of extra noise
          try {
            const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) parsed = JSON.parse(raw.slice(start, end + 1));
          } catch (_) { parsed = null; }
        }
      }

      if (!parsed) {
        // Could not parse user save — keep defaults in-memory but do not overwrite the stored raw data.
        _data = _default();
        return _data;
      }

      // Merge with defaults for forward compatibility but sanitize types so bad data can't crash the UI
      _data = Object.assign(_default(), parsed || {});
      // Coerce/validate fields
      _data.highestUnlockedLevel = Number.isFinite(Number(_data.highestUnlockedLevel)) ? Math.max(1, Number(_data.highestUnlockedLevel)) : 1;
      _data.completedLevels = (_data.completedLevels && typeof _data.completedLevels === 'object') ? _data.completedLevels : {};
      _data.starsByLevel = (_data.starsByLevel && typeof _data.starsByLevel === 'object') ? _data.starsByLevel : {};
      _data.bestScoresByLevel = (_data.bestScoresByLevel && typeof _data.bestScoresByLevel === 'object') ? _data.bestScoresByLevel : {};
      _data.bestTimesByLevel = (_data.bestTimesByLevel && typeof _data.bestTimesByLevel === 'object') ? _data.bestTimesByLevel : {};
      _data.disabledBriefings = (_data.disabledBriefings && typeof _data.disabledBriefings === 'object') ? _data.disabledBriefings : {};
      _data.campaignCoinsEarned = Number.isFinite(Number(_data.campaignCoinsEarned)) ? Number(_data.campaignCoinsEarned) : 0;
      // Recompute totalStars defensively
      _data.totalStars = Object.values(_data.starsByLevel || {}).reduce((s, n) => s + (Number(n) || 0), 0);
      // If parsed.version differs, perform a soft migration (preserve fields but bump version)
      if (parsed.version !== VERSION) {
        _data.version = VERSION;
        try { localStorage.setItem(LS_KEY, JSON.stringify(_data)); } catch (_) {}
      }
    } catch (_) {
      // If anything unexpected happens, fall back to defaults but avoid clobbering the user's saved raw string
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

  function isBriefingDisabled(levelId) {
    const d = load();
    return !!(d.disabledBriefings && d.disabledBriefings[levelId]);
  }

  function setBriefingDisabled(levelId, disabled) {
    const d = load();
    d.disabledBriefings = d.disabledBriefings || {};
    if (disabled) d.disabledBriefings[levelId] = true;
    else delete d.disabledBriefings[levelId];
    save();
  }

  return { load, save, get, isUnlocked, isCompleted, getStars, completeLevelResult, isBriefingDisabled, setBriefingDisabled };
})();

// Developer helpers: quick test utilities for local testing.
window.testLevel = function(id) {
  const lvl = CAMPAIGN_LEVELS.find(l => l.id === id);
  if (!lvl) { console.warn('[Campaign] testLevel: unknown id', id); return; }
  console.info('[Campaign] testLevel:', id, lvl.name);
  try { window.CampaignManager.selectLevel(lvl); } catch (e) { console.error(e); }
};

window.unlockAllCampaignLevels = function() {
  try {
    const d = CampaignSave.get();
    d.highestUnlockedLevel = CAMPAIGN_LEVELS.length;
    CampaignSave.save();
    console.info('[Campaign] All levels unlocked');
  } catch (e) { console.error(e); }
};

// Developer: debug helpers to validate and optionally start levels programmatically.
window.debugStartLevel = function(id) {
  try {
    window.DEBUG_CHALLENGE = true;
    const lvl = CAMPAIGN_LEVELS.find(l => l.id === id);
    if (!lvl) { console.error('[CampaignDebug] unknown level', id); return; }
    console.info('[CampaignDebug] Starting level', id, lvl.name);
    window.CampaignManager.selectLevel(lvl);
  } catch (e) { console.error('[CampaignDebug] debugStartLevel error', e); }
};

window.debugChallengeLevels = async function(runStart) {
  console.info('[CampaignDebug] Validating all campaign levels');
  for (const lvl of CAMPAIGN_LEVELS) {
    try {
      const problems = validateChallengeLevelStrict(lvl);
      const ok = !problems || problems.length === 0;
      console.log('[CampaignDebug] Level', lvl.id, '-', lvl.name, 'configValid=', ok, (ok ? '' : problems));
      if (runStart && ok) {
        console.log('[CampaignDebug] Attempting to start level', lvl.id);
        try {
          window.CampaignManager.selectLevel(lvl);
          // allow short startup time to observe spawns
          await new Promise(r => setTimeout(r, 1400));
          const obsCt = (typeof obstacles !== 'undefined') ? obstacles.length : 'n/a';
          const playerOk = (typeof player !== 'undefined');
          console.log('[CampaignDebug] afterStart', lvl.id, 'obstacles:', obsCt, 'playerPresent:', playerOk, 'state:', (typeof currentState !== 'undefined' ? currentState : 'n/a'));
        } catch (e) { console.error('[CampaignDebug] start failed for', lvl.id, e); }
        try { if (typeof CampaignUI !== 'undefined' && typeof CampaignUI.showLevelSelect === 'function') CampaignUI.showLevelSelect(); } catch (_) {}
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) { console.error('[CampaignDebug] validation error for', lvl && lvl.id, e); }
  }
  console.info('[CampaignDebug] Validation complete');
};

// Developer: debug helpers to validate and optionally start levels programmatically.
window.debugStartLevel = function(id) {
  try {
    window.DEBUG_CHALLENGE = true;
    const lvl = CAMPAIGN_LEVELS.find(l => l.id === id);
    if (!lvl) { console.error('[CampaignDebug] unknown level', id); return; }
    console.info('[CampaignDebug] Starting level', id, lvl.name);
    window.CampaignManager.selectLevel(lvl);
  } catch (e) { console.error('[CampaignDebug] debugStartLevel error', e); }
};

window.debugChallengeLevels = async function(runStart) {
  console.info('[CampaignDebug] Validating all campaign levels');
  for (const lvl of CAMPAIGN_LEVELS) {
    try {
      const problems = validateChallengeLevelStrict(lvl);
      const ok = !problems || problems.length === 0;
      console.log('[CampaignDebug] Level', lvl.id, '-', lvl.name, 'configValid=', ok, (ok ? '' : problems));
      if (runStart && ok) {
        console.log('[CampaignDebug] Attempting to start level', lvl.id);
        try {
          window.CampaignManager.selectLevel(lvl);
          // allow short startup time to observe spawns
          await new Promise(r => setTimeout(r, 1400));
          const obsCt = (typeof obstacles !== 'undefined') ? obstacles.length : 'n/a';
          const playerOk = (typeof player !== 'undefined');
          console.log('[CampaignDebug] afterStart', lvl.id, 'obstacles:', obsCt, 'playerPresent:', playerOk, 'state:', (typeof currentState !== 'undefined' ? currentState : 'n/a'));
        } catch (e) { console.error('[CampaignDebug] start failed for', lvl.id, e); }
        try { if (typeof CampaignUI !== 'undefined' && typeof CampaignUI.showLevelSelect === 'function') CampaignUI.showLevelSelect(); } catch (_) {}
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) { console.error('[CampaignDebug] validation error for', lvl && lvl.id, e); }
  }
  console.info('[CampaignDebug] Validation complete');
};

window.validateCampaignLevels = function() {
  const problems = [];
  CAMPAIGN_LEVELS.forEach(l => {
    if (!Number.isInteger(l.id) || l.id <= 0) problems.push(`Level missing id or invalid: ${l.name}`);
    if (!l.name) problems.push(`Level ${l.id} missing name`);
    if (!l.objectiveType) problems.push(`Level ${l.id} missing objectiveType`);
    if (l.rules == null) problems.push(`Level ${l.id} missing rules/config`);
  });
  if (problems.length === 0) console.info('[Campaign] validate: OK');
  else problems.forEach(p => console.warn('[Campaign] validate:', p));
  return problems;
};

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
    try { if (window.CAMPAIGN_DEBUG) console.log('[Challenge] ObjectiveTracker.onCoinCollected', _level && _level.id, 'hybridCoins:', _hybridCoins); } catch (_) {}
  }

  function onBlockDodged() {
    if (!_level) return;
    if (_level.objectiveType === 'hybrid') _hybridDodges++;
    try { if (window.CAMPAIGN_DEBUG) console.log('[Challenge] ObjectiveTracker.onBlockDodged', _level && _level.id, 'hybridDodges:', _hybridDodges); } catch (_) {}
  }

  function onHit() { _hitsReceived++; }
  try { if (window.CAMPAIGN_DEBUG) console.log('[Challenge] ObjectiveTracker ready'); } catch (_) {}

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
    // Ensure data object exists
    data = data || {};

    // Prefer sensible defaults based on objective type so designers
    // get consistent 1-3 star behavior without authoring lots of checks.
    try {
      const type = levelDef && levelDef.objectiveType;
      const hits = Number.isFinite(data.hitsReceived) ? data.hitsReceived : 0;
      const near = Number.isFinite(data.nearMisses) ? data.nearMisses : (Number.isFinite(data.nearMissesThisRun) ? data.nearMissesThisRun : 0);
      const maxCombo = Number.isFinite(data.maxCombo) ? data.maxCombo : 0;
      const powerups = Number.isFinite(data.powerupsThisRun) ? data.powerupsThisRun : (Number.isFinite(data.powerups) ? data.powerups : 0);
      const timeRemaining = (typeof data.timeRemaining === 'number') ? data.timeRemaining : (levelDef && levelDef.timeLimit ? (levelDef.timeLimit - (data.elapsed || 0)) : 0);

      if (type === 'survive_seconds') {
        if (hits === 0 && near >= 3) return 3; // excellent: clean + risky near-misses
        if (hits === 0 && powerups === 0) return 2; // good: clean run with no assist
        return 1; // baseline: completed objective
      }

      if (type === 'collect_coins') {
        if (timeRemaining >= 14) return 3; // excellent: finished early or grabbed bonus coins
        if (timeRemaining >= 8) return 2;  // good: finished with decent time left
        return 1;
      }

      if (type === 'dodge_blocks') {
        if (near >= 3 || maxCombo >= 10) return 3; // excellent: skillful near-miss/combo
        if (timeRemaining >= 8) return 2; // good: under a reasonable time cap
        return 1;
      }

      if (type === 'boss_defeat') {
        if (hits === 0) return 3; // clean boss clear
        if (timeRemaining >= 30) return 2; // defeated with decent time
        return (data.bossDefeated ? 1 : 1);
      }

      if (type === 'hybrid') {
        if (hits === 0) return 3;
        if (hits <= 1) return 2;
        return 1;
      }
    } catch (_) {}

    // Fallback to explicit level-defined conditions if present
    try {
      if (levelDef && Array.isArray(levelDef.starConditions) && levelDef.starConditions.length) {
        for (const cond of levelDef.starConditions) {
          try { if (cond && typeof cond.check === 'function' && cond.check(data)) return cond.stars; } catch(_) {}
        }
      }
    } catch(_) {}

    // Default baseline
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
  let _orbCharge   = 0;
  const ORBS_PER_PULSE = 5;
  const PULSE_DAMAGE = 12;
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
    _orbCharge   = 0;
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

  function collectOrbs(n) {
    if (!_active || _defeated) return;
    n = Math.max(0, Math.floor(n || 0));
    if (n === 0) return;
    _orbCharge += n;
    try { addFloating(_bossX, _bossY - 40, '+' + n + ' orbs', '#f472b6', 18); } catch(_){}
    try { AudioManager.playSound && AudioManager.playSound('powerup'); } catch(_){}
    // Fire pulses for every ORBS_PER_PULSE collected
    while (_orbCharge >= ORBS_PER_PULSE && !_defeated) {
      _orbCharge -= ORBS_PER_PULSE;
      // Visual pulse effect
      try {
        spawnParticles(_bossX, _bossY, '#f472b6', settings && settings.reducedMotion ? 8 : 26);
      } catch(_){}
      try { triggerShake(4, 0.18); } catch(_){}
      try { addFloating(_bossX, _bossY - 18, 'PULSE!', '#ffffff', 22); } catch(_){}
      // Apply damage
      damage(PULSE_DAMAGE);
      try { AudioManager.playSound && AudioManager.playSound('bossPulse'); } catch(_){}
    }
  }

  function getOrbCharge() { return _orbCharge; }

  function getProjectilesCount() { return _projectiles.length; }

  function triggerAttack(ev) {
    ev = ev || {};
    const action = ev.action || ev.name || 'generic';
    try {
      if (action === 'side_lasers') {
        // warn both side lanes then spawn side blocks
        const lanesCount = (typeof numLanes === 'function') ? numLanes() : 5;
        const left = 0;
        const right = Math.max(0, lanesCount - 1);
        try { window.CampaignPatterns && window.CampaignPatterns.spawnWarningLane && window.CampaignPatterns.spawnWarningLane(left, ev.warn || 1.0); } catch(_){}
        try { window.CampaignPatterns && window.CampaignPatterns.spawnWarningLane && window.CampaignPatterns.spawnWarningLane(right, ev.warn || 1.0); } catch(_){}
        setTimeout(() => {
          try { window.CampaignPatterns && window.CampaignPatterns.spawnSideBlock && window.CampaignPatterns.spawnSideBlock({ side: 'left' }); } catch(_){}
          try { window.CampaignPatterns && window.CampaignPatterns.spawnSideBlock && window.CampaignPatterns.spawnSideBlock({ side: 'right' }); } catch(_){}
        }, (ev.warn || 1.0) * 1000);
      } else if (action === 'panic_wave') {
        // escalate a short panic wave across the arena
        try { window.triggerPanicWave && window.triggerPanicWave({ announce: ev.warn || 1.0, duration: ev.duration || 5.0, speedMult: 1.15 }); } catch(_){}
      } else {
        // Default: aim at current player position
        try { const px = (typeof player !== 'undefined') ? player.x : (_canvas ? _canvas.width/2 : 320); const py = (typeof player !== 'undefined') ? player.y : 200; _doAttack(px, py); } catch(_) { _doAttack((_canvas? _canvas.width/2:320), 200); }
      }
    } catch(_){}
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

  return { init, tick, damage, isDefeated, getHp, isActive, deactivate, collectOrbs, getOrbCharge, getProjectilesCount, triggerAttack };
})();

// ============================================================
// SECTION 5: CAMPAIGN UI
// All HTML rendering for campaign screens.
// ============================================================
const CampaignUI = (() => {

  // ---- Level Select Screen ----
  function renderLevelSelect() {
    console.log('[CampaignUI] renderLevelSelect start – CAMPAIGN_LEVELS:', Array.isArray(CAMPAIGN_LEVELS) ? CAMPAIGN_LEVELS.length : 'NOT_ARRAY', 'CampaignSave:', typeof CampaignSave);
    const el = document.getElementById('campaign-levelselect');
    if (!el) return;
    // Defensive: CampaignSave may contain malformed fields — coerce before using
    const rawSave = CampaignSave.get() || {};
    const saveData = (rawSave && typeof rawSave === 'object') ? rawSave : {};
    const total = Array.isArray(CAMPAIGN_LEVELS) ? CAMPAIGN_LEVELS.length : 0;
    const completedLevels = (saveData.completedLevels && typeof saveData.completedLevels === 'object') ? saveData.completedLevels : {};
    const nCompleted = Object.keys(completedLevels).length;
    const starsByLevel = (saveData.starsByLevel && typeof saveData.starsByLevel === 'object') ? saveData.starsByLevel : {};
    const totalStars = Object.values(starsByLevel).reduce((s, n) => s + (Number(n) || 0), 0);
    const coinsEarned = Number(saveData.campaignCoinsEarned) || 0;
    const PER_CHAPTER = 5;
    const currentChapter = Math.ceil((nCompleted + 1) / PER_CHAPTER);
    const totalChapters = Math.max(1, Math.ceil(total / PER_CHAPTER));

    // Animated background particles (pure CSS animation)
    const PARTICLE_COLORS = ['#7c3aed','#0ea5e9','#ec4899','#22c55e','#f59e0b'];
    const particlesHtml = Array.from({ length: 18 }, (_, i) => {
      const c = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
      const sz  = (3 + (i * 1.7) % 5).toFixed(1);
      const lft = ((i * 17 + 7) % 97).toFixed(1);
      const dur = (9 + (i * 2.3) % 13).toFixed(1);
      const del = ((i * 1.9) % 11).toFixed(1);
      return `<div class="cmp-road-particle" style="left:${lft}%;width:${sz}px;height:${sz}px;background:${c};animation-duration:${dur}s;animation-delay:-${del}s"></div>`;
    }).join('');

    // Level path nodes
    const nodesHtml = CAMPAIGN_LEVELS.map((lvl, idx) => {
      const side = lvl.id === 10 ? 'boss' : (idx % 2 === 0 ? 'left' : 'right');
      return _buildLevelNode(lvl, saveData, side);
    }).join('');

    el.innerHTML = `
      <div class="cmp-road-outer">
        <div class="cmp-road-particles" aria-hidden="true">${particlesHtml}</div>
        <div class="cmp-road-inner">
          <button class="cmp-road-back" id="cmp-btn-back" aria-label="Back to main menu">&#8592; Menu</button>
          <header class="cmp-road-header">
            <h1 class="cmp-road-title">Shift Trials</h1>
            <p class="cmp-road-subtitle">Clear missions. Earn stars. Beat the Panic Core.</p>
            <div class="cmp-road-statsbar">
              <div class="cmp-road-stat">
                <span class="cmp-road-stat-val">${nCompleted}/${total}</span>
                <span class="cmp-road-stat-lbl">Complete</span>
              </div>
              <div class="cmp-road-stat-sep"></div>
              <div class="cmp-road-stat">
                <span class="cmp-road-stat-val">${totalStars}/${total * 3}</span>
                <span class="cmp-road-stat-lbl">Stars</span>
              </div>
              <div class="cmp-road-stat-sep"></div>
              <div class="cmp-road-stat">
                <span class="cmp-road-stat-val" style="color:#f59e0b">${coinsEarned}</span>
                <span class="cmp-road-stat-lbl">Coins Earned</span>
              </div>
              <div class="cmp-road-stat-sep"></div>
              <div class="cmp-road-stat">
                <span class="cmp-road-stat-val">Chapter ${currentChapter}/${totalChapters}</span>
                <span class="cmp-road-stat-lbl">Chapter</span>
              </div>
            </div>
          </header>
          <div class="cmp-road-map" role="list" aria-label="Panic Quest levels">
            ${nodesHtml}
          </div>
        </div>
      </div>`;

    // Wire back button
    const backBtn = el.querySelector('#cmp-btn-back');
    if (backBtn) backBtn.addEventListener('click', () => {
      try { if (typeof AudioFn !== 'undefined') AudioFn.uiClick(); } catch (_) {}
      hideLevelSelect();
      if (typeof returnHome === 'function') returnHome();
    });

    // Wire play/replay buttons
    el.querySelectorAll('.cmp-node-btn[data-level-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id  = parseInt(btn.dataset.levelId, 10);
        const lvl = CAMPAIGN_LEVELS.find(l => l.id === id);
        if (lvl && CampaignSave.isUnlocked(id)) {
          try { if (typeof AudioFn !== 'undefined') AudioFn.uiClick(); } catch (_) {}
          try { window.CampaignManager.selectLevel && window.CampaignManager.selectLevel(lvl); } catch(_) {}
        }
      });
    });

    // Wire info (?) buttons: show the intro/briefing without auto-start
    el.querySelectorAll('.cmp-node-info').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = parseInt(btn.dataset.infoLevel, 10);
        const lvl = CAMPAIGN_LEVELS.find(l => l.id === id);
        if (!lvl) return;
        try { if (typeof AudioFn !== 'undefined') AudioFn.uiClick(); } catch(_) {}
        try { CampaignUI.showLevelIntro(lvl, () => { try { window.CampaignManager.startLevelNow && window.CampaignManager.startLevelNow(lvl); } catch(_){} }); } catch(_) {}
      });
    });
  }

  function _buildLevelNode(lvl, saveData, side) {
    const unlocked  = CampaignSave.isUnlocked(lvl.id);
    const completed = CampaignSave.isCompleted(lvl.id);
    const stars     = CampaignSave.getStars(lvl.id);
    const isNext    = unlocked && !completed;

    // small mechanic icons per objective type
    const ICONS = {
      'survive_seconds': '<svg class="cmp-svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 8v5l3 3"/><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z"/></svg>',
      'collect_coins':   '<svg class="cmp-svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.6"/><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 9v6"/></svg>',
      'dodge_blocks':    '<svg class="cmp-svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l3-9 3 18 3-14 3 5h4"/></svg>',
      'boss_defeat':     '<svg class="cmp-svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 2l2.5 6H22l-5 3.8L19 22 12 17.8 5 22l2-10.2L2 8h7.5L12 2z"/></svg>',
      'hybrid':          '<svg class="cmp-svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="1.6"/></svg>'
    };
    const iconSvg = ICONS[lvl.objectiveType] || ICONS.hybrid;

    const diffClass = {
      'Easy':   'cmp-node--easy',
      'Medium': 'cmp-node--medium',
      'Hard':   'cmp-node--hard',
      'Expert': 'cmp-node--expert',
      'Boss':   'cmp-node--boss',
    }[lvl.difficulty] || 'cmp-node--easy';

    const stateClass = !unlocked    ? 'cmp-node--locked'
                     : completed    ? 'cmp-node--completed'
                     : isNext       ? 'cmp-node--unlocked cmp-node--current'
                     : 'cmp-node--unlocked';

    const rowClass = side === 'boss'  ? 'cmp-road-row--boss'
                   : side === 'left'  ? 'cmp-road-row--left'
                   : 'cmp-road-row--right';

    const starsHtml = [1,2,3].map(i =>
      `<span class="cmp-node-star${i <= stars ? ' cmp-node-star--on' : ''}" aria-hidden="true">&#9733;</span>`
    ).join('');

    const objText = _getObjectiveSummary(lvl);

    let btnHtml;
    if (!unlocked) {
      btnHtml = `<button class="cmp-node-btn cmp-node-btn--locked" disabled aria-label="Level ${lvl.id} locked">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg> Locked</button>`;
    } else if (completed) {
      btnHtml = `<button class="cmp-node-btn cmp-node-btn--replay" data-level-id="${lvl.id}" aria-label="Replay Level ${lvl.id}">Replay</button>`;
    } else {
      btnHtml = `<button class="cmp-node-btn" data-level-id="${lvl.id}" aria-label="Play Level ${lvl.id}: ${lvl.name}">Play</button>`;
    }

    const nodeHtml = `
      <div class="cmp-road-node ${diffClass} ${stateClass}"
           role="listitem"
           aria-label="Level ${lvl.id}: ${lvl.name}, ${!unlocked ? 'locked' : completed ? 'completed' : 'available'}">
        <div class="cmp-node-top">
          <div class="cmp-node-icon" aria-hidden="true">${iconSvg}</div>
          <div class="cmp-node-meta">
            <div class="cmp-node-header">
              <span class="cmp-node-num">LVL ${lvl.id}</span>
              <span class="cmp-node-diff" style="color:${lvl.difficultyColor}">${lvl.difficulty}</span>
            </div>
            <div class="cmp-node-title">${lvl.name}</div>
          </div>
        </div>
        <div class="cmp-node-obj">${objText}</div>
        <div class="cmp-node-stars" aria-label="${stars} of 3 stars">${starsHtml}</div>
        <div class="cmp-node-bottom">
          <span class="cmp-node-reward"><span class="coin-icon coin-sm" aria-hidden="true"></span>${lvl.rewardCoins}</span>
          ${btnHtml}
          <button class="cmp-node-info" data-info-level="${lvl.id}" aria-label="About Level ${lvl.id}">?</button>
        </div>
      </div>`;

    if (side === 'boss') {
      return `<div class="cmp-road-row ${rowClass} ${diffClass} ${stateClass}">${nodeHtml}</div>`;
    }
    const connectorHtml = `<div class="cmp-road-connector" aria-hidden="true"><div class="cmp-road-connector-dot"></div></div>`;
    const cardCell   = `<div class="cmp-road-cell cmp-road-cell--card">${nodeHtml}</div>`;
    const spacerCell = `<div class="cmp-road-cell cmp-road-cell--spacer" aria-hidden="true"></div>`;
    return `<div class="cmp-road-row ${rowClass} ${diffClass} ${stateClass}">
      ${side === 'left' ? cardCell + connectorHtml + spacerCell : spacerCell + connectorHtml + cardCell}
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
  // Briefing content for each level (short, punchy lines)
  const LEVEL_BRIEFINGS = {
    1: { mechanic: 'Avoid the forbidden color — read the top indicator.', tips: ['Move gently, don’t panic.', 'Read the color before you move.'] },
    2: { mechanic: 'Collect coin trails before the timer runs out.', tips: ['Follow coin trails for clusters.', 'Don’t chase coins into danger.'] },
    3: { mechanic: 'Dodge focused waves — anticipate openings.', tips: ['Small, early moves win.', 'Keep your eyes on the gaps.'] },
    4: { mechanic: 'Fast color switches — a warning appears before each change.', tips: ['Hold center before a switch.', 'React to the warning glow.'] },
    5: { mechanic: 'Narrow, tight gaps — precision required.', tips: ['Plan a clear path.', 'Make short, confident shifts.'] },
    6: { mechanic: 'Coin trails lure you — panic wave follows later.', tips: ['Grab coins quickly then retreat.', 'Avoid forbidden blocks when diving.'] },
    7: { mechanic: 'Surges at 15s, 30s, 45s — use warnings to hide.', tips: ['Find a safe spot on warning.', 'Brace during the surge, move after.'] },
    8: { mechanic: 'Arena shrinks over time — space gets tight.', tips: ['Hold the center as walls close.', 'Avoid getting trapped at edges.'] },
    9: { mechanic: 'Three objectives — balance speed, coins and dodges.', tips: ['Split your focus smartly.', 'Don’t overcommit to one task.'] },
    10: { mechanic: 'Boss fight: collect orbs to damage the Panic Core.', tips: ['Snag orbs to deal damage.', 'Dodge projectile warnings and strike openings.'] }
  };

  function showLevelIntro(lvl, onStart) {
    const el = document.getElementById('campaign-intro');
    if (!el) { if (onStart) onStart(); return; }

    const briefing = LEVEL_BRIEFINGS[lvl.id] || {};
    const objText = _getObjectiveSummary(lvl);

    const BIG_ICONS = {
      'survive_seconds': '<svg class="cmp-svg-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 8v5l3 3"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z"/></svg>',
      'collect_coins':   '<svg class="cmp-svg-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 9v6"/></svg>',
      'dodge_blocks':    '<svg class="cmp-svg-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l3-9 3 18 3-14 3 5h4"/></svg>',
      'boss_defeat':     '<svg class="cmp-svg-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 2l2.5 6H22l-5 3.8L19 22 12 17.8 5 22l2-10.2L2 8h7.5L12 2z"/></svg>',
      'hybrid':          '<svg class="cmp-svg-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="1.8"/></svg>'
    };

    const diffClass = {
      'Easy':   'cmp-intro--easy',
      'Medium': 'cmp-intro--medium',
      'Hard':   'cmp-intro--hard',
      'Expert': 'cmp-intro--expert',
      'Boss':   'cmp-intro--boss',
    }[lvl.difficulty] || 'cmp-intro--easy';

    el.innerHTML = `
      <div class="cmp-intro-box ${diffClass}" role="dialog" aria-modal="true" aria-label="Mission briefing for level ${lvl.id}">
        <div class="cmp-intro-top">
          <div class="cmp-intro-icon" aria-hidden="true">${BIG_ICONS[lvl.objectiveType] || BIG_ICONS.hybrid}</div>
          <div class="cmp-intro-head">
            <div class="cmp-intro-header">
              <span class="cmp-intro-num">LEVEL ${lvl.id}</span>
              <span class="cmp-intro-diff" style="color:${lvl.difficultyColor}">${lvl.difficulty}</span>
            </div>
            <h2 class="cmp-intro-name">${lvl.name}</h2>
            <p class="cmp-intro-sub">${lvl.subtitle}</p>
          </div>
        </div>

        <div class="cmp-intro-objective">
          <div class="cmp-intro-obj-label">Objective</div>
          <div class="cmp-intro-obj-text">${objText}</div>
        </div>

        <div class="cmp-intro-mechanic">
          <div class="cmp-intro-mech-label">Rule</div>
          <div class="cmp-intro-mech-text">${briefing.mechanic || ''}</div>
        </div>

        <ul class="cmp-intro-tips" aria-label="Tips">
          <li>${(briefing.tips && briefing.tips[0]) || lvl.tip || ''}</li>
          <li>${(briefing.tips && briefing.tips[1]) || ''}</li>
        </ul>

        <div class="cmp-intro-reward">
          <span class="coin-icon" aria-hidden="true"></span>
          <span class="cmp-intro-reward-val">${lvl.rewardCoins} coins</span>
          <span class="cmp-intro-reward-lbl">on completion</span>
        </div>

        <div class="cmp-intro-actions">
          <button class="cmp-intro-start-btn btn btn-primary" id="cmp-intro-start">Start Mission</button>
          <button class="cmp-intro-back-btn btn btn-secondary" id="cmp-intro-back">Level Select</button>
        </div>
      </div>`;

    el.hidden = false;
    try { currentState = STATE.BRIEFING; } catch (_) {}

    const startBtn = el.querySelector('#cmp-intro-start');
    const backBtn  = el.querySelector('#cmp-intro-back');

    if (backBtn) backBtn.addEventListener('click', () => {
      if (el._previewCancel) { try { el._previewCancel(); } catch (_) {} el._previewCancel = null; }
      el.hidden = true;
      showLevelSelect();
    });

    if (startBtn) startBtn.addEventListener('click', () => {
      // stop preview animation if running
      if (el._previewCancel) { try { el._previewCancel(); } catch (_) {} el._previewCancel = null; }
      try { _hideAllGameScreens(); } catch (_) {}
      try { if (typeof hideLevelSelect === 'function') hideLevelSelect(); } catch (_) {}
      try { if (typeof cleanupGameLoop === 'function') cleanupGameLoop(); } catch (_) {}
      try { showScreen('game-screen'); } catch (_) {}
      try { currentState = STATE.COUNTDOWN; } catch (_) {}
      try { resizeCanvas(); } catch (_) {}
      try { initPlayer(); } catch (_) {}
      try { render(performance.now()); } catch (_) {}

      _runCountdown(3, () => {
        if (onStart) onStart();
      });
    });

    // Small animated preview for the level (non-blocking)
    try {
      const previewEl = el.querySelector('#cmp-intro-preview');
      const pattern = lvl.previewPattern || (lvl.rules && lvl.rules.previewPattern) || (lvl.settings && lvl.settings.coinsEnabled ? 'coinTrail' : 'sideSwipe');
      if (window.CampaignPatterns && previewEl) {
        el._previewCancel = window.CampaignPatterns.previewPattern(previewEl, pattern);
      }
    } catch (_) {}
  }

  function _runCountdown(count, onDone) {
    const overlay = document.getElementById('campaign-countdown-overlay');
    if (!overlay) { if (onDone) onDone(); return; }

    // Idempotent: ignore if a countdown is already active
    if (window._cmpCountdownActive) {
      try { console.warn('[Challenge] countdown already active'); } catch (_) {}
      return;
    }
    window._cmpCountdownActive = true;

    // Clear any previous timers
    try { if (window._cmpCountdownTimerIds) { window._cmpCountdownTimerIds.forEach(id => clearTimeout(id)); } } catch (_) {}
    window._cmpCountdownTimerIds = [];

    // Global flag for other systems/tests
    try { window._campaignCountdownActive = true; } catch (_) {}

    // Ensure no live game loop is running while counting down
    try { if (typeof cleanupGameLoop === 'function') cleanupGameLoop(); } catch (_) {}

    // Ensure level select is hidden (avoid flashes)
    try { const ls = document.getElementById('campaign-levelselect'); if (ls) ls.hidden = true; } catch (_) {}

    // Reveal overlay and lock interactions
    overlay.hidden = false;
    overlay.style.zIndex = '99999';
    overlay.style.pointerEvents = 'auto';
    overlay.classList.remove('cmp-countdown-fadeout');
    overlay.classList.add('cmp-countdown-active');
    overlay.innerHTML = '<span class="cmp-cd-num" id="cmp-cd-num-el" aria-live="assertive" aria-atomic="true"></span>';
    const numEl = document.getElementById('cmp-cd-num-el');

    let current = count;
    // 700ms per step for consistent rhythm
    const STEP_MS = 700;

    function showNum(text, isGo) {
      if (!numEl) return;
      numEl.textContent = text;
      numEl.classList.remove('cmp-cd-pop', 'cmp-cd-go');
      void numEl.offsetWidth;
      numEl.classList.add(isGo ? 'cmp-cd-go' : 'cmp-cd-pop');
      try { if (typeof AudioManager !== 'undefined') AudioManager.playSound('countdown'); } catch (_) {}
    }

    function finish() {
      // brief pulse on GO
      try { document.body.classList.add('campaign-go-pulse'); setTimeout(() => { document.body.classList.remove('campaign-go-pulse'); }, 260); } catch (_) {}
      // fade overlay then hide
      overlay.classList.add('cmp-countdown-fadeout');
      const hid = setTimeout(() => {
        try { window._campaignCountdownActive = false; } catch (_) {}
        overlay.classList.remove('cmp-countdown-active');
        overlay.classList.remove('cmp-countdown-fadeout');
        overlay.style.pointerEvents = 'none';
        overlay.hidden = true;
        overlay.innerHTML = '';
        try { if (window._cmpCountdownTimerIds) { window._cmpCountdownTimerIds.forEach(id => clearTimeout(id)); window._cmpCountdownTimerIds = []; } } catch (_) {}
        window._cmpCountdownActive = false;
        if (onDone) onDone();
      }, 260);
      window._cmpCountdownTimerIds.push(hid);
    }

    function step() {
      const isGo = current <= 0;
      const text = isGo ? 'GO!' : String(current);
      showNum(text, isGo);
      if (isGo) {
        finish();
      } else {
        current--;
        const t = setTimeout(step, STEP_MS);
        window._cmpCountdownTimerIds.push(t);
      }
    }

    step();
  }

  function startCountdown(count, onDone) {
    try { _runCountdown(count, onDone); } catch (e) { console.error('[CampaignUI] startCountdown failed', e); if (onDone) onDone(); }
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
        const cur  = Math.min((typeof roundOrbs === 'number' ? roundOrbs : 0), orbs);
        prog.textContent = `Orbs: ${cur} / ${orbs}`;
        prog.style.setProperty('--obj-pct', Math.min(1, cur / orbs));
      } else if (type === 'hybrid') {
        const tgt = lvl.objectiveTarget;
        prog.textContent = `${Math.min(Math.floor(elapsed), tgt.seconds)}/${tgt.seconds}s  |  ${Math.min(roundCoins, tgt.coins)}/${tgt.coins} coins  |  ${Math.min(dodgeCount, tgt.dodges)}/${tgt.dodges} dodged`;
      }
    }

    // Time display and shrinking-arena HUD
    const arenaEl = document.getElementById('cmp-hud-arena');
    if (timer) {
      if (lvl.settings && lvl.settings.shrinkingArena) {
        // Show elapsed / total time and arena percent
        const total = (typeof lvl.timeLimit === 'number' && lvl.timeLimit > 0) ? lvl.timeLimit : (lvl.objectiveTarget || 50);
        const cur = Math.min(Math.floor(elapsed), total);
        timer.textContent = `Time: ${cur} / ${total}s`;
        timer.hidden = false;
        timer.style.color = (total - elapsed) < 8 ? '#ef4444' : '#f8fafc';
        try { if (typeof window !== 'undefined' && window._campaignShrinkFactor) {
          if (arenaEl) { arenaEl.textContent = `Arena: ${Math.round(window._campaignShrinkFactor * 100)}%`; arenaEl.hidden = false; }
        } } catch(_) {}
      } else if (timeLimit !== null && timeLimit !== undefined) {
        const remaining = Math.max(0, timeLimit - elapsed);
        timer.textContent = remaining > 0 ? `Time: ${Math.ceil(remaining)}s` : 'Time: 0s';
        timer.hidden = false;
        timer.style.color = remaining < 8 ? '#ef4444' : '#f8fafc';
      } else if (type === 'survive_seconds') {
        const remaining = Math.max(0, lvl.objectiveTarget - elapsed);
        const remInt = Math.ceil(remaining);
        timer.textContent = remInt > 0 ? `Time left: ${remInt}s` : 'Time: 0s';
        timer.hidden = false;
        timer.style.color = remaining < 8 ? '#ef4444' : '#f8fafc';
        try {
          if ((!timer._lastRemaining || remInt < timer._lastRemaining) && remInt <= 3) {
            if (typeof AudioManager !== 'undefined') AudioManager.playSound('countdown');
          }
        } catch (_) {}
        try { timer._lastRemaining = remInt; } catch (_) {}
      } else {
        timer.hidden = true;
        if (arenaEl) arenaEl.hidden = true;
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
    // reset countdown announcer state
    try { const t = document.getElementById('cmp-hud-timer'); if (t) t._lastRemaining = null; } catch(_) {}
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
    const title  = isLast ? 'Mission Complete!' : 'Level Complete!';
    const nextLvl = CAMPAIGN_LEVELS.find(l => l.id === lvl.id + 1);

    // Merge stateData with last-known progress if available
    const last = (typeof window !== 'undefined' && window._campaignLastProgress) ? window._campaignLastProgress : {};
    const sd = Object.assign({}, last, stateData || {});

    const prog = ObjectiveTracker.getProgress(sd.elapsed || 0, sd.roundCoins || 0, sd.dodgeCount || 0) || {};

    const starsHtml = `<div class="cmp-v-stars" role="img" aria-label="${stars} of 3 stars">
      ${[1,2,3].map((i, idx) => `<span class="cmp-v-star ${i <= stars ? 'cmp-v-star-on' : ''}" style="--delay:${idx * 0.18}s">&#9733;</span>`).join('')}
    </div>`;

    const rewardHtml = `<div class="cmp-v-reward"><span class="cmp-v-reward-icon coin-icon" aria-hidden="true"></span><span class="cmp-v-reward-amt" id="cmp-v-coin-amt">0</span> coins earned</div>`;

    const statsHtml = (prog.hybrid)
      ? `<div class="cmp-v-stats">${prog.seconds.current}/${prog.seconds.target}s · ${prog.coins.current}/${prog.coins.target} coins · ${prog.dodges.current}/${prog.dodges.target} dodges</div>`
      : (prog && typeof prog.current !== 'undefined')
        ? `<div class="cmp-v-stats">${prog.current}/${prog.target}${lvl.objectiveType === 'survive_seconds' ? 's' : (lvl.objectiveType === 'collect_coins' ? ' coins' : '')}</div>`
        : '';

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
        ${rewardHtml}
        ${statsHtml}
        <div class="cmp-v-btns">
          ${nextBtnHtml}
          <button class="cmp-v-btn btn ${!isLast && nextLvl ? 'btn-secondary' : 'btn-primary'}" id="cmp-v-replay">Replay</button>
          <button class="cmp-v-btn btn btn-secondary" id="cmp-v-select">Back to Map</button>
        </div>
      </div>`;

    el.hidden = false;

    // Confetti + coins animation
    setTimeout(() => _spawnConfetti(el.querySelector('#cmp-v-confetti')), 100);
    const coinAmtEl = el.querySelector('#cmp-v-coin-amt');
    try { animateCounter(0, rewardCoins, settings && settings.reducedMotion ? 0 : 850, coinAmtEl); } catch(_) { if (coinAmtEl) coinAmtEl.textContent = rewardCoins; }

    // New best / new-stars badge (state may include wasNewBest or wasNewStars)
    if (sd.wasNewBest || sd.wasNewStars || sd._wasNewBest) {
      const nb = document.createElement('div'); nb.className = 'cmp-v-newbest'; nb.textContent = 'New Best!';
      const box = el.querySelector('.cmp-v-box'); if (box) box.insertBefore(nb, box.firstChild.nextSibling);
    }

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
    // Focus primary action
    requestAnimationFrame(() => { if (replayBtn) replayBtn.focus(); });
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

    // Allow optional state data from last tick
    const sd = (typeof window !== 'undefined' && window._campaignLastProgress) ? window._campaignLastProgress : {};
    const prog = ObjectiveTracker.getProgress(sd.elapsed || 0, sd.roundCoins || 0, sd.dodgeCount || 0) || {};

    const reasonText = {
      hit_forbidden: 'You touched a forbidden color.',
      side_block:    'A side attack hit you.',
      time_up:       'Time ran out.',
      missed_coins:  'You didn\'t collect enough coins.',
      left_safe_zone:'You left the safe zone too long.',
      boss_hit:      'The Panic Core got you.',
    }[reason] || 'Objective not completed.';

    // Addiction microcopy
    let microcopy = '';
    try {
      if (lvl.objectiveType === 'collect_coins') {
        const cur = prog.current || 0; const tgt = prog.target || lvl.objectiveTarget || 0; const delta = Math.max(0, tgt - cur);
        if (delta === 0) microcopy = 'So close!';
        else if (delta <= 2) microcopy = `Only ${delta} coin${delta>1?'s':''} away!`;
        else if (delta <= 5) microcopy = 'So close! Keep trying.';
      } else if (reason === 'hit_forbidden') microcopy = 'Watch the forbidden color indicator — react fast!';
      else microcopy = 'Nice try — you can beat it on the next run!';
    } catch(_) { microcopy = ''; }

    const progressHtml = (prog.hybrid)
      ? `<div class="cmp-d-progress">${prog.seconds.current}/${prog.seconds.target}s · ${prog.coins.current}/${prog.coins.target} coins · ${prog.dodges.current}/${prog.dodges.target} dodges</div>`
      : (prog && typeof prog.current !== 'undefined')
        ? `<div class="cmp-d-progress">${prog.current}/${prog.target}${lvl.objectiveType === 'survive_seconds' ? 's' : (lvl.objectiveType === 'collect_coins' ? ' coins' : '')}</div>`
        : '';

    const tipText = lvl && lvl.tip ? lvl.tip : 'Use warnings and safe zones to survive the surges.';

    el.innerHTML = `
      <div class="cmp-d-box">
        <div class="cmp-d-icon" aria-hidden="true">&#215;</div>
        <h2 class="cmp-d-title">Try Again</h2>
        <p class="cmp-d-level">Level ${lvl.id}: ${lvl.name}</p>
        <p class="cmp-d-reason">${reasonText}</p>
        ${progressHtml}
        ${microcopy ? `<div class="cmp-d-micro">${microcopy}</div>` : ''}
        <div class="cmp-d-tip">${tipText}</div>
        <div class="cmp-d-btns">
          <button class="cmp-d-btn btn btn-primary cmp-d-retry" id="cmp-d-retry">Retry</button>
          <button class="cmp-d-btn btn btn-secondary" id="cmp-d-select">Back to Map</button>
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
    requestAnimationFrame(() => { if (retryBtn) retryBtn.focus(); });
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
    try {
      if (typeof phase === 'string') w.textContent = phase;
      else w.textContent = 'Arena Shrinking!';
    } catch(_) {}
    w.hidden = false;
    setTimeout(() => { try { w.hidden = true; } catch(_){} }, 2000);
  }

  // ---- Level select show / hide helpers ----
  function _renderLevelSelectFallback(el, err) {
    // Simple guaranteed-to-work fallback used if renderLevelSelect() crashes
    try {
      el.innerHTML = '<div style="min-height:100vh;padding:2rem;color:#f8fafc;font-family:Inter,sans-serif;box-sizing:border-box">'
        + '<button id="cmp-fb-back" style="padding:0.5rem 1.2rem;background:rgba(255,255,255,0.08);color:#f8fafc;border:1px solid rgba(255,255,255,0.15);border-radius:9px;cursor:pointer;margin-bottom:1.5rem;font-size:0.9rem">&#8592; Menu</button>'
        + '<h1 style="font-size:2rem;font-weight:800;margin:0 0 0.5rem">Panic Quest</h1>'
        + (err ? '<p style="color:#f87171;font-size:0.78rem;margin:0 0 1.5rem;background:rgba(239,68,68,0.1);padding:0.5rem 0.8rem;border-radius:6px">Render error (send this to dev): ' + String(err).replace(/</g, '&lt;').slice(0, 200) + '</p>' : '')
        + '<div style="display:flex;flex-direction:column;gap:0.5rem">'
        + (Array.isArray(CAMPAIGN_LEVELS) ? CAMPAIGN_LEVELS : []).map(function(lvl) {
            var unlocked = CampaignSave.isUnlocked(lvl.id);
            var completed = CampaignSave.isCompleted(lvl.id);
            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.9rem 1.2rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px">'
              + '<div><span style="color:rgba(255,255,255,0.45);font-size:0.75rem;margin-right:0.5rem">LVL ' + lvl.id + '</span><strong>' + lvl.name + '</strong>'
              + ' <span style="color:rgba(255,255,255,0.45);font-size:0.8rem">— ' + lvl.difficulty + '</span></div>'
              + (unlocked
                  ? '<button data-cmp-fb-id="' + lvl.id + '" style="padding:0.35rem 1rem;background:#7c3aed;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:0.85rem;font-weight:700">' + (completed ? 'Replay' : 'Play') + '</button>'
                  : '<span style="color:rgba(255,255,255,0.25);font-size:0.8rem">Locked</span>')
              + '</div>';
          }).join('')
        + '</div></div>';
      var backBtn = el.querySelector('#cmp-fb-back');
      if (backBtn) backBtn.addEventListener('click', function() {
        try { hideLevelSelect(); } catch(_) {}
        try { if (typeof returnHome === 'function') returnHome(); } catch(_) {}
      });
      el.querySelectorAll('[data-cmp-fb-id]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = parseInt(btn.dataset.cmpFbId, 10);
          var lvl = CAMPAIGN_LEVELS.find(function(l) { return l.id === id; });
          if (lvl) try { window.CampaignManager.selectLevel(lvl); } catch(e2) { console.error('[CampaignUI] selectLevel failed', e2); }
        });
      });
    } catch (fe) {
      console.error('[CampaignUI] fallback render also failed', fe);
      el.innerHTML = '<div style="padding:2rem;color:#f8fafc;font-family:sans-serif"><h2>Panic Quest</h2><p>Level map failed to load. Refresh the page.</p></div>';
    }
  }

  function showLevelSelect() {
    const el = document.getElementById('campaign-levelselect');
    if (!el) { console.error('[CampaignUI] campaign-levelselect element not found'); return; }
    // Only hide other screens once we know the level select container exists
    _hideAllGameScreens();
    try { currentState = STATE.LEVELMAP; } catch (_) {}
    el.hidden = false;
    console.log('[CampaignUI] showLevelSelect: rendering level map');
    try {
      renderLevelSelect();
      console.log('[CampaignUI] renderLevelSelect completed OK');
    } catch (e) {
      console.error('[CampaignUI] renderLevelSelect FAILED:', e);
      _renderLevelSelectFallback(el, e);
    }
  }

  function hideLevelSelect() {
    const el = document.getElementById('campaign-levelselect');
    if (el) el.hidden = true;
  }

  function _hideAllGameScreens() {
    ['home-screen', 'game-screen', 'campaign-levelselect'].forEach(id => {
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
    startCountdown,
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
window.CampaignUI = CampaignUI;
console.log('[Campaign] CampaignUI exported:', typeof CampaignUI);

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
  let _startOrbs       = 0;

  // Input diagnostics for challenge debug mode
  let _lastPlayerPosForInputCheck = { x: 0, y: 0 };
  let _inputStallAccum = 0;
  let _inputStallWarned = false;

  // Shrinking arena state
  let _arenaLeft     = 0;       // px from left  (0 = no restriction)
  let _arenaRight    = 0;       // px from right (0 = no restriction)
  let _arenaTimer    = 0;
  let _arenaShrinkInterval = 10; // seconds between each shrink step
  let _arenaShrinkStep     = 0;  // which step we're on
  const ARENA_SHRINK_STEPS = 4;  // 4 shrinks over 40s of a 50s level
  // shrink warning phases
  let _shrinkWarn1Shown = false;
  let _shrinkWarn2Shown = false;
  // pulse timer for visual flourish
  let _arenaPulse = 0;

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

  // Internal debug / failsafe timers
  let _failsafeTimer = 0;
  let _debugTicker = 0;
  let _lastRoundCoins = 0;
  let _sideSpawnTimer = 0;
  let _debugOverlayEl = null;

  function validateChallengeLevel(lvl) {
    if (!lvl) return false;
    if (!Number.isInteger(lvl.id) || lvl.id <= 0) return false;
    if (!lvl.name || !lvl.objectiveType) return false;
    if (typeof lvl.objectiveTarget === 'undefined') return false;
    return true;
  }

  // More thorough validator that returns an array of problems (empty = OK)
  function validateChallengeLevelStrict(lvl) {
    const problems = [];
    if (!lvl) { problems.push('Level definition is missing'); return problems; }
    if (!Number.isInteger(lvl.id) || lvl.id <= 0) problems.push('Invalid or missing `id`');
    if (!lvl.name) problems.push('Missing `name`');
    if (!lvl.objectiveType) problems.push('Missing `objectiveType`');
    if (typeof lvl.objectiveTarget === 'undefined') problems.push('Missing `objectiveTarget`');

    // Type-specific checks
    try {
      const t = lvl.objectiveType;
      const target = lvl.objectiveTarget;
      if (t === 'collect_coins') {
        if (typeof target !== 'number' || target <= 0) problems.push('`objectiveTarget` must be a positive number for collect_coins');
      } else if (t === 'survive_seconds') {
        if (typeof target !== 'number' || target <= 0) problems.push('`objectiveTarget` must be a positive number for survive_seconds');
      } else if (t === 'dodge_blocks') {
        if (typeof target !== 'number' || target <= 0) problems.push('`objectiveTarget` must be a positive number for dodge_blocks');
      } else if (t === 'boss_defeat') {
        if (!lvl.settings && !lvl.rules) problems.push('boss_defeat requires `settings.bossMode = true` (missing settings/rules)');
      } else if (t === 'hybrid') {
        if (!target || typeof target !== 'object') problems.push('hybrid requires an object `{ seconds, coins, dodges }`');
        else {
          if (typeof target.seconds !== 'number' || target.seconds <= 0) problems.push('hybrid.seconds must be a positive number');
          if (typeof target.coins !== 'number'   || target.coins <= 0)   problems.push('hybrid.coins must be a positive number');
          if (typeof target.dodges !== 'number'  || target.dodges <= 0)  problems.push('hybrid.dodges must be a positive number');
        }
      }
    } catch (e) { problems.push('Error validating objectiveTarget: ' + String(e)); }

    // Basic settings presence checks (rules can be converted to settings, so allow that path)
    if (!lvl.settings && !lvl.rules) problems.push('Missing `settings` and no `rules` to convert');
    if (lvl.settings) {
      if (typeof lvl.settings.spawnInterval === 'undefined') problems.push('settings.spawnInterval missing');
      if (typeof lvl.settings.speedMult === 'undefined') problems.push('settings.speedMult missing');
    }
    return problems;
  }

  function resetGameForChallenge(lvl) {
    console.log('[Challenge] reset game state');
    try { if (typeof cleanupGameLoop === 'function') cleanupGameLoop(); } catch (_) {}
    try {
      // Clear runtime arrays
      obstacles = [];
      particles = [];
      powerups = [];
      coinItems = [];
      floatingTexts = [];
      ringBursts = [];
      // Reset timers and counters
      spawnTimer = 0; powerupTimer = 0; coinItemTimer = 0; difficultyTimer = 0;
      difficultyBumps = 0; difficultyPhase = 0;
      score = 0; combo = 0; maxCombo = 0; roundCoins = 0;
      missionRun = { seconds: 0, score: 0, colorChanges: 0, powerupsThisRun: 0, nearMissesThisRun: 0, panicWavesSurvived: 0, maxCombo: 0 };
      // Powerup state
      activePowerupKey = null; activePowerupTimer = 0; activePowerupTotal = 0;
      player.hasShield = false; playerRadiusTarget = player.baseRadius; player.radius = player.baseRadius;
      // Boss + campaign auxiliary state
      window._campaignDefeatReason = null; window._campaignDodgeCount = 0;
      try { BossManager.deactivate(); } catch (_) {}
      try { _hideWallCanvas(); } catch (_) {}
      // Ensure UI is hidden and canvas updated
      try { CampaignUI.hideHUD(); } catch (_) {}
      try { document.getElementById('gameover-overlay').hidden = true; } catch (_) {}
      try { document.getElementById('pause-overlay').hidden = true; } catch (_) {}
      // Make sure player is positioned visibly
      try { resizeCanvas(); initPlayer(); render(performance.now()); } catch (_) {}
      // Reset skin abilities (do not auto-activate any ability)
      try { if (typeof SkinAbility !== 'undefined' && SkinAbility.reset) SkinAbility.reset(); } catch (_) {}
    } catch (err) {
      console.error('[Challenge] resetGameForChallenge error', err);
    }
  }

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
    // Clear pattern tick and deterministic RNG when exiting campaign
    try { window._campaignPatternTick = null; } catch(_) {}
    try { if (window.ChallengeSpawnDirector && typeof window.ChallengeSpawnDirector.stop === 'function') window.ChallengeSpawnDirector.stop(); } catch(_) {}
    try { window._campaignRng = null; } catch(_) {}
    try { window._campaignNextWaveShown = false; } catch(_) {}
    try { window._campaignSideWarnings = []; } catch(_) {}
    BossManager.deactivate();
    _hideWallCanvas();
    CampaignUI.hideHUD();
    // Restore skin ability HUD that may have been hidden for coin-disabled levels
    const abilityHud = document.getElementById('skin-ability-hud');
    if (abilityHud) abilityHud.hidden = false;
  }

  function selectLevel(lvl) {
    console.log('[Challenge] selected level', lvl && lvl.id, lvl && lvl.name);
    // Run strict validation and refuse to start if problems found
    try {
      const problems = validateChallengeLevelStrict(lvl);
      if (problems && problems.length > 0) {
        console.error('[Challenge] Level config validation failed for level', lvl && lvl.id, problems);
        try { alert('Level configuration error:\n' + problems.join('\n')); } catch (_) {}
        try { CampaignUI.showLevelSelect(); } catch (_) {}
        return;
      }
    } catch (e) {
      console.error('[Challenge] validation threw', e);
      try { alert('Level validation error — check console. Returning to select.'); } catch (_) {}
      try { CampaignUI.showLevelSelect(); } catch (_) {}
      return;
    }

    // Fall back to legacy check just in case
    if (!validateChallengeLevel(lvl)) {
      console.error('[Challenge] Invalid level config (basic)', lvl);
      try { alert('Invalid level configuration. Returning to level select.'); } catch (_) {}
      try { CampaignUI.showLevelSelect(); } catch (_) {}
      return;
    }

    _currentLevel = lvl;
    // Begin UI transition then start a countdown before launching the level
    try { _hideAllGameScreens(); } catch (_) {}
    try { if (typeof hideLevelSelect === 'function') hideLevelSelect(); } catch (_) {}
    try { if (typeof cleanupGameLoop === 'function') cleanupGameLoop(); } catch (_) {}
    try { showScreen('game-screen'); } catch (_) {}
    try { currentState = STATE.COUNTDOWN; } catch (_) {}
    try { resizeCanvas(); } catch (_) {}
    try { initPlayer(); } catch (_) {}
    try { render(performance.now()); } catch (_) {}
    try {
      if (CampaignUI && typeof CampaignUI.startCountdown === 'function') {
        CampaignUI.startCountdown(3, () => { try { _startLevel(lvl); } catch (e) { console.error('[Challenge] _startLevel after countdown failed', e); } });
      } else {
        _startLevel(lvl);
      }
    } catch (e) { console.error('[Challenge] startLevel failed', e); try { _startLevel(lvl); } catch(_) {} }
  }

  function startLevelNow(lvl) {
    if (!lvl) return;
    try { _currentLevel = lvl; _startLevel(lvl); } catch (e) { console.error('[Challenge] startLevelNow failed', e); }
  }

  function _startLevel(lvl) {
    console.log('[Challenge] _startLevel invoked', lvl && lvl.id, lvl && lvl.name, 'objective:', lvl && lvl.objectiveType, 'target:', lvl && lvl.objectiveTarget);
    _active       = true;
    _victoryFired = false;
    _defeatFired  = false;
    _isFirstTime  = !CampaignSave.isCompleted(lvl.id);
    _startCoins   = 0;
    try { _startOrbs = (typeof roundOrbs === 'number') ? roundOrbs : 0; } catch(_) { _startOrbs = 0; }
    _arenaLeft    = 0;
    _arenaRight   = 0;
    _arenaShrinkStep = 0;
    _arenaTimer   = 0;
    _dtQueue      = (lvl.settings.doubleTroubleAt || []).slice();
    _dtFired      = new Set();
    _dtPhase      = 'idle';
    _dtTimer      = 0;

    // Prefer canonical `rules` when present and derive runtime settings
    try {
      if (lvl && lvl.rules) {
        try {
          lvl.settings = _convertRulesToSettings(Object.assign({}, lvl.rules.engine || {}, lvl.rules));
        } catch (e) { console.error('[Campaign] error converting rules to settings', e); }
      }
    } catch (_) {}

    // Re-validate after attempting rules -> settings conversion
    try {
      const postProblems = validateChallengeLevelStrict(lvl);
      if (postProblems && postProblems.length > 0) {
        console.error('[Challenge] Aborting start: level settings invalid', lvl && lvl.id, postProblems);
        try { alert('Cannot start level due to configuration problems:\n' + postProblems.join('\n')); } catch (_) {}
        try { CampaignUI.showLevelSelect(); } catch (_) {}
        _active = false;
        return;
      }
    } catch (e) { console.error('[Challenge] validation error after conversion', e); }

    // Guarantee a clean runtime state before starting
    try { resetGameForChallenge(lvl); } catch (_) {}
    ObjectiveTracker.reset(lvl);
    console.log('[Challenge] objective initialized', lvl.id, lvl.objectiveType, lvl.objectiveTarget);

    // Set campaign settings for script.js to pick up in startGame()
    window._campaignSettings = {
      speedMult:              lvl.settings.speedMult,
      spawnInterval:          lvl.settings.spawnInterval,
      forbiddenInterval:      lvl.settings.forbiddenInterval,
      coinsEnabled:           lvl.settings.coinsEnabled,
      coinItemInterval:       lvl.settings.coinItemInterval,
      powerupsEnabled:        lvl.settings.powerupsEnabled,
      diffCap:                lvl.settings.diffCap,
      disablePanic:           !!lvl.settings.disablePanic,
      disableDoubleDanger:    !!lvl.settings.disableDoubleDanger,
    };
    window._campaignDodgeCount = 0;

    // Build a lightweight spawn config consumed by script.js spawners.
    try {
      const spawnRules = (lvl.rules && lvl.rules.spawn) || (lvl.settings && lvl.settings.spawn) || {};
      window._campaignSpawnConfig = {
        obstacleSpawnRate:      (typeof spawnRules.obstacleSpawnRate === 'number') ? spawnRules.obstacleSpawnRate : (lvl.settings.spawnInterval || null),
        coinSpawnRate:          (typeof spawnRules.coinSpawnRate === 'number')     ? spawnRules.coinSpawnRate     : (lvl.settings.coinItemInterval || null),
        sideObstacleSpawnRate:  (typeof spawnRules.sideObstacleSpawnRate === 'number') ? spawnRules.sideObstacleSpawnRate : null,
        sideObstacleCount:      (typeof spawnRules.sideObstacleCount === 'number') ? spawnRules.sideObstacleCount : 5,
        maxObstaclesOnScreen:   (typeof spawnRules.maxObstaclesOnScreen === 'number') ? spawnRules.maxObstaclesOnScreen : null,
        maxCoinsOnScreen:       (typeof spawnRules.maxCoinsOnScreen === 'number')   ? spawnRules.maxCoinsOnScreen : 12,
        obstacleSpeedMin:       (typeof spawnRules.obstacleSpeedMin === 'number') ? spawnRules.obstacleSpeedMin : null,
        obstacleSpeedMax:       (typeof spawnRules.obstacleSpeedMax === 'number') ? spawnRules.obstacleSpeedMax : null,
        safeStartSeconds:       (typeof spawnRules.safeStartSeconds === 'number') ? spawnRules.safeStartSeconds : 0.8,
      };
    } catch (_) { window._campaignSpawnConfig = null; }

    // Mark that the countdown finished and we're about to start the challenge
    window._challengeRunning = false; // will be set true right after startGame()

    // Hide skin ability HUD on levels without coins — it would show "Coin Magnet: Passive"
    // which confuses players. We restore it in deactivate().
    const abilityHud = document.getElementById('skin-ability-hud');
    if (abilityHud && !lvl.settings.coinsEnabled) abilityHud.hidden = true;

    // Hide all campaign overlays and show game screen
    ['campaign-levelselect', 'campaign-intro', 'campaign-victory', 'campaign-defeat'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.hidden = true;
    });

    // Start the actual game using the existing startGame() function
    if (typeof startGame === 'function') {
      console.log('[Challenge] starting engine via startGame()');
      // Mark when start was requested so spawners can honor safe-start windows
      try { window._campaignStartRequestedAt = performance.now(); } catch (_) { window._campaignStartRequestedAt = Date.now(); }
      try { console.log('[Challenge] spawnConfig pre-start', window._campaignSpawnConfig); } catch (_) {}
      try {
        startGame();
      } catch (e) {
        console.error('[Challenge] startGame threw', e);
      }
      // Defensive: ensure input handlers are present and RAF is running.
      try {
        if (!window._campaignInputRebound) {
          try { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); } catch (_) {}
          try { window.addEventListener('keydown', onKeyDown, { passive: false }); window.addEventListener('keyup', onKeyUp, { passive: false }); } catch (_) {}
          window._campaignInputRebound = true;
        }
      } catch (_) {}

      // Fallback: if startGame did not activate the loop or no obstacles spawned,
      // attempt a safe recovery after a short delay so first-level players aren't stuck.
      setTimeout(() => {
        try {
          if (typeof currentState === 'undefined' || currentState !== STATE.PLAYING) {
            console.warn('[Challenge] Forcing gameLoop start (fallback) — currentState:', currentState);
            try { currentState = STATE.PLAYING; } catch (_) {}
            try { if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; } } catch (_) {}
            try { lastFrameTime = performance.now(); rafHandle = requestAnimationFrame(gameLoop); } catch (_) {}
          }
          const obsCt = (typeof obstacles !== 'undefined') ? obstacles.length : 0;
          if (obsCt === 0) {
            console.warn('[Challenge] Fallback: no obstacles after start — spawning one');
            try { if (typeof spawnObstacle === 'function') spawnObstacle(); } catch (_) {}
          }
          if (lvl.objectiveType === 'collect_coins') {
            const coinCt = (typeof coinItems !== 'undefined') ? coinItems.length : 0;
            if (coinCt === 0) try { if (typeof spawnCoinItem === 'function') spawnCoinItem(); } catch (_) {}
          }
        } catch (e) { console.error('[Challenge] post-start fallback error', e); }
      }, 1100);
      window._challengeRunning = true;

      // Initialize deterministic campaign RNG and pattern tick for this level
      try {
        // Keep attempt counter for analytics, but use stable per-level seed
        window._campaignAttempt = (window._campaignAttempt || 0) + 1;
        const seed = (typeof lvl.id === 'number' ? lvl.id : 0) * 1009 + 7;
        try { window._campaignRng = seededRng(seed); } catch (_) { window._campaignRng = null; }
        try {
          // Prefer the deterministic CampaignPatterns for Dodge School (id:3)
          if (lvl && lvl.id === 3) {
            window._campaignPatternTick = window.CampaignPatterns.getSpawnPattern(lvl);
          } else if (window.ChallengeSpawnDirector && typeof window.ChallengeSpawnDirector.loadLevel === 'function') {
            try { window._campaignPatternTick = window.ChallengeSpawnDirector.loadLevel(lvl, { seed: seed }); }
            catch (e) { window._campaignPatternTick = null; console.error('[Campaign] spawn director load error', e); }
          } else {
            window._campaignPatternTick = window.CampaignPatterns.getSpawnPattern(lvl);
          }
        } catch (e) { window._campaignPatternTick = null; console.error('[Campaign] pattern factory error', e); }
        window._campaignNextWaveShown = false;
        window._campaignShrinkFactor = 1.0;
        // If this level requests a shrinking arena, compute default step count
        try {
          if (lvl.settings && lvl.settings.shrinkingArena) {
            const ttl = (typeof lvl.timeLimit === 'number' && lvl.timeLimit > 10) ? lvl.timeLimit : 50;
            window._campaignShrinkSteps = lvl.settings.shrinkSteps || Math.max(4, Math.floor(Math.max(1, ttl - 5)));
          } else {
            window._campaignShrinkSteps = null;
          }
        } catch (_) { window._campaignShrinkSteps = null; }
      } catch (e) { console.error('[Campaign] failed to init campaign pattern tick', e); }

      // Setup optional side-spawn timer from spawn config
      try {
        const cfg = window._campaignSpawnConfig;
        _sideSpawnTimer = (cfg && cfg.sideObstacleSpawnRate) ? cfg.sideObstacleSpawnRate : 0;
      } catch (_) { _sideSpawnTimer = 0; }

      try { console.log('[Challenge] startRequestedAt', window._campaignStartRequestedAt, 'state:', (typeof currentState !== 'undefined' ? currentState : 'n/a')); } catch (_) {}
    }

    // Post-start failsafe: ensure coins present quickly, and obstacles sooner to make level responsive
    setTimeout(() => {
      try {
        const coinCt = (typeof coinItems !== 'undefined') ? coinItems.length : 0;
        if (lvl.objectiveType === 'collect_coins' && coinCt === 0) {
          console.warn('[Challenge] Post-start failsafe (450ms): no coins — spawning coin item');
          if (typeof spawnCoinItem === 'function') spawnCoinItem();
        }
      } catch (e) { console.error('[Challenge] post-start coin failsafe error', e); }
    }, 450);

    // So earlier-levels feel responsive, ensure at least one obstacle within ~1s
    setTimeout(() => {
      try {
        const obsCt  = (typeof obstacles !== 'undefined') ? obstacles.length : 0;
        if ((lvl.objectiveType === 'survive_seconds' || lvl.objectiveType === 'dodge_blocks' || lvl.objectiveType === 'hybrid') && obsCt === 0) {
          console.warn('[Challenge] Post-start failsafe (900ms): no obstacles — spawning');
          if (typeof spawnObstacle === 'function') spawnObstacle();
        }
      } catch (e) { console.error('[Challenge] post-start obstacle failsafe error', e); }
    }, 900);

    // If still no obstacles after 3s, surface an error for diagnosis
    setTimeout(() => {
      try {
        const obsCt = (typeof obstacles !== 'undefined') ? obstacles.length : 0;
        if (obsCt === 0) {
          console.error('[Challenge] No obstacles spawned after 3 seconds - check spawn system');
        }
      } catch (_) {}
    }, 3000);

    console.log('[Challenge] spawners enabled');

    // After startGame, show campaign HUD
    setTimeout(() => {
      CampaignUI.showHUD(lvl);
      console.log('[Challenge] player initialized', player && { x: player.x, y: player.y, radius: player.radius });
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
      // Debug overlay (optional)
      try {
        if (window.CAMPAIGN_DEBUG || window.CAMPAIGN_DEV || window.DEBUG_CHALLENGE) {
          if (!_debugOverlayEl) {
            const d = document.createElement('div');
            d.id = 'campaign-debug-overlay';
            d.style.position = 'fixed';
            d.style.left = '8px';
            d.style.bottom = '8px';
            d.style.padding = '8px 10px';
            d.style.background = 'rgba(0,0,0,0.6)';
            d.style.color = '#fff';
            d.style.fontFamily = 'monospace';
            d.style.fontSize = '12px';
            d.style.zIndex = 9999;
            d.style.borderRadius = '6px';
            d.style.pointerEvents = 'none';
            document.body.appendChild(d);
            _debugOverlayEl = d;
          }
        }
      } catch (_) {}
      // Collect-coin levels: ensure initial coins are present quickly
      try {
        if (lvl.objectiveType === 'collect_coins') {
          // Spawn an initial column (4-6 coins) and ensure at least 3 visible
          spawnCoinItem();
          setTimeout(() => { if (coinItems.length < 3) spawnCoinItem(); }, 180);
        }
      } catch (e) { console.error('[Challenge] initial coin spawn error', e); }
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
    // Persist last tick progress so defeat/victory UIs can read it
    try {
      // collect mission-run stats when available (near misses, combos, powerups)
      let near = 0, mcombo = 0, pups = 0;
      try {
        const mr = (typeof missionRun !== 'undefined') ? missionRun : (typeof window !== 'undefined' ? window.missionRun : null);
        if (mr) {
          if (Number.isFinite(mr.nearMissesThisRun)) near = mr.nearMissesThisRun;
          if (Number.isFinite(mr.maxCombo)) mcombo = mr.maxCombo;
          if (Number.isFinite(mr.powerupsThisRun)) pups = mr.powerupsThisRun;
        }
      } catch(_) {}
      window._campaignLastProgress = { elapsed: elapsed, roundCoins: roundCoins, dodgeCount: dodgeCount, score: (gameState && gameState.score) ? gameState.score : 0, nearMisses: near, maxCombo: mcombo, powerupsThisRun: pups };
    } catch(_) { window._campaignLastProgress = { elapsed: elapsed, roundCoins: roundCoins, dodgeCount: dodgeCount }; }

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
        // Boss damage from orb collection (collect orbs since last tick)
        const newOrbs = (typeof roundOrbs === 'number' ? roundOrbs : 0) - _startOrbs;
        if (newOrbs > 0) {
          try { if (typeof BossManager !== 'undefined' && typeof BossManager.collectOrbs === 'function') BossManager.collectOrbs(newOrbs); } catch(_){}
          _startOrbs = (typeof roundOrbs === 'number' ? roundOrbs : 0);
        }
      }
    }

    // ---- Side-attack spawner (optional) ----
    try {
      if (window._campaignSpawnConfig && window._campaignSpawnConfig.sideObstacleSpawnRate && _sideSpawnTimer !== null) {
        _sideSpawnTimer -= dt;
        if (_sideSpawnTimer <= 0) {
          _sideSpawnTimer = window._campaignSpawnConfig.sideObstacleSpawnRate;
          try {
            const side = Math.random() < 0.5 ? 'left' : 'right';
            const count = window._campaignSpawnConfig.sideObstacleCount || 5;
            if (window.CampaignPatterns && typeof window.CampaignPatterns.spawnSideSwipePattern === 'function') {
              window.CampaignPatterns.spawnSideSwipePattern({ side, count });
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // ---- HUD update ----
    CampaignUI.updateHUD(
      lvl, elapsed, roundCoins, dodgeCount,
      lvl.settings.bossMode ? BossManager.getHp() : 100,
      lvl.timeLimit
    );

    // ---- Debug logging & failsafe checks (runs ~once/sec) ----
    try {
      _debugTicker += dt;
      if (_debugTicker >= 1.0) {
        _debugTicker = 0;
        const obsCt = gameState.obstacles ? gameState.obstacles.length : (typeof obstacles !== 'undefined' ? obstacles.length : 0);
        const coinCt = typeof coinItems !== 'undefined' ? coinItems.length : 0;
        let projCt = 0;
        try {
          if (typeof BossManager !== 'undefined' && typeof BossManager.getProjectilesCount === 'function') projCt = BossManager.getProjectilesCount();
          else if (typeof BossManager !== 'undefined' && BossManager._projectiles) projCt = BossManager._projectiles.length;
        } catch (_) { projCt = 0; }
        let objProgStr = 'n/a';
        try {
          const prog = ObjectiveTracker.getProgress(elapsed, roundCoins, dodgeCount);
          if (prog) {
            if (prog.hybrid) objProgStr = 'hybrid ' + Math.round((prog.overall || 0) * 100) + '%';
            else objProgStr = Math.round((prog.pct || 0) * 100) + '%';
          }
        } catch (_) {}
        console.log('[Challenge] tick', Math.floor(elapsed) + 's', 'obs:' + obsCt, 'coinsPicked:' + roundCoins, 'coinItems:' + coinCt, 'proj:' + projCt, 'obj:' + objProgStr, 'running:' + !!window._challengeRunning, 'countdown:' + !!window._campaignCountdownActive);
        if (_debugOverlayEl) {
          try {
            let pState = 'none';
            let pPos = '';
            let pVel = '';
            try {
              if (gameState && gameState.player) {
                pState = 'ok';
                pPos = 'x:' + Math.round(gameState.player.x) + ' y:' + Math.round(gameState.player.y);
                pVel = 'vx:' + (gameState.player.vx ? gameState.player.vx.toFixed(1) : '0') + ' vy:' + (gameState.player.vy ? gameState.player.vy.toFixed(1) : '0');
              }
            } catch (_) {}
            const inputStr = (typeof keys !== 'undefined') ? ('L:' + (keys.left?1:0) + ' R:' + (keys.right?1:0) + ' U:' + (keys.up?1:0) + ' D:' + (keys.down?1:0)) : '';
            const spawnInt = (typeof getActiveSpawnInterval === 'function') ? getActiveSpawnInterval().toFixed(2) : 'n/a';
            _debugOverlayEl.innerHTML =
              'Level: ' + (lvl ? lvl.id + ' - ' + lvl.name : 'n/a') + '<br>' +
              'Objective: ' + (lvl ? lvl.objectiveType : 'n/a') + ' (' + objProgStr + ')<br>' +
              'Elapsed: ' + Math.floor(elapsed) + 's<br>' +
              'Player: ' + pState + ' ' + pPos + ' ' + pVel + '<br>' +
              'Input: ' + inputStr + '<br>' +
              'SpawnInt: ' + spawnInt + 's<br>' +
              'Obstacles: ' + obsCt + '<br>' +
              'Coins(active): ' + coinCt + '<br>' +
              'RoundCoins: ' + roundCoins + '<br>' +
              'Projectiles: ' + projCt + '<br>' +
              'Running: ' + (!!window._challengeRunning) + '<br>' +
              'Countdown: ' + (!!window._campaignCountdownActive);
          } catch (_) {}
        }
      }

      // Input-stall detection for diagnostics
      try {
        if (window.DEBUG_CHALLENGE && gameState && gameState.player) {
          const hasInput = (typeof keys !== 'undefined') && (keys.left || keys.right || keys.up || keys.down || !!touchTarget);
          if (hasInput) {
            if (Math.abs(gameState.player.x - _lastPlayerPosForInputCheck.x) < 1) {
              _inputStallAccum += dt;
            } else {
              _inputStallAccum = 0;
              _inputStallWarned = false;
            }
            _lastPlayerPosForInputCheck.x = gameState.player.x;
            _lastPlayerPosForInputCheck.y = gameState.player.y;
            if (_inputStallAccum >= 0.6 && !_inputStallWarned) {
              console.error('[Challenge] Input detected but player position is not updating');
              _inputStallWarned = true;
            }
          } else {
            _inputStallAccum = 0;
            _inputStallWarned = false;
            if (gameState.player) {
              _lastPlayerPosForInputCheck.x = gameState.player.x;
              _lastPlayerPosForInputCheck.y = gameState.player.y;
            }
          }
        }
      } catch (_) {}

      // Detect coin pickups and spawn replacements shortly after pickup
      if (lvl.objectiveType === 'collect_coins') {
        if (roundCoins > _lastRoundCoins) {
          const picked = roundCoins - _lastRoundCoins;
          for (let i = 0; i < picked; i++) setTimeout(() => { try { if (typeof spawnCoinItem === 'function') spawnCoinItem(); } catch (_) {} }, 300);
          console.log('[Challenge] coin pickup detected, scheduled replacement(s):', picked);
        }
        _lastRoundCoins = roundCoins;
      }

      // Failsafe: ensure coins/obstacles/player present
      _failsafeTimer += dt;
      if (_failsafeTimer >= 1.0) {
        _failsafeTimer = 0;
        try {
          if (lvl.objectiveType === 'collect_coins' && (typeof coinItems === 'undefined' || coinItems.length === 0)) {
            console.warn('[Challenge] Failsafe triggered: no coins — spawning');
            if (typeof spawnCoinItem === 'function') spawnCoinItem();
          }
          if ((lvl.objectiveType === 'survive_seconds' || lvl.objectiveType === 'dodge_blocks' || lvl.objectiveType === 'hybrid') && (typeof obstacles === 'undefined' || obstacles.length === 0) && elapsed > 2.0) {
            console.warn('[Challenge] Failsafe triggered: no obstacles — spawning');
            if (typeof spawnObstacle === 'function') spawnObstacle();
          }
          if (!gameState.player || typeof gameState.player.x === 'undefined') {
            console.warn('[Challenge] Failsafe triggered: missing player — recreating');
            try { resizeCanvas(); initPlayer(); render(performance.now()); } catch (_) {}
          }
        } catch (e) { console.error('[Challenge] failsafe error', e); }
      }
    } catch (e) { console.error('[Challenge] tick debug error', e); }
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
    // Continuous shrink timeline:
    // 0-5s: normal
    // 5-30s: shrink steadily 100% -> 70%
    // 30-50s: shrink faster 70% -> 57.5%
    const ttl = (typeof _currentLevel !== 'undefined' && _currentLevel && (typeof _currentLevel.timeLimit === 'number')) ? _currentLevel.timeLimit : 50;
    const startSlow = 5.0;
    const midPoint  = 30.0;
    const endTime   = Math.max(50, ttl);
    const startFactor = 1.0;
    const midFactor = 0.70;
    const endFactor = 0.575; // target ~57.5%

    // show warnings at 5s and 30s exactly once
    if (elapsed >= startSlow && !_shrinkWarn1Shown) {
      _shrinkWarn1Shown = true;
      CampaignUI.showShrinkWarning('Arena shrinking!');
      try { if (typeof AudioManager !== 'undefined') AudioManager.playSound && AudioManager.playSound('warning'); } catch(_){}
    }
    if (elapsed >= midPoint && !_shrinkWarn2Shown) {
      _shrinkWarn2Shown = true;
      // use the DT bubble for a short additional message
      CampaignUI.showDoubleTrouble();
      try { const dtEl = document.getElementById('cmp-hud-dt'); if (dtEl) { dtEl.textContent = 'Less space!'; dtEl.hidden = false; dtEl.classList.remove('cmp-dt-pop'); void dtEl.offsetWidth; dtEl.classList.add('cmp-dt-pop'); setTimeout(()=>{ try{ dtEl.hidden=true }catch(_){} }, 2200); } } catch(_){}
      try { if (typeof AudioManager !== 'undefined') AudioManager.playSound && AudioManager.playSound('warning'); } catch(_){}
    }

    // compute factor
    let factor = startFactor;
    if (elapsed < startSlow) factor = startFactor;
    else if (elapsed < midPoint) {
      const p = (elapsed - startSlow) / Math.max(0.0001, (midPoint - startSlow));
      factor = startFactor + (midFactor - startFactor) * p;
    } else if (elapsed < endTime) {
      const p = (elapsed - midPoint) / Math.max(0.0001, (endTime - midPoint));
      factor = midFactor + (endFactor - midFactor) * p;
    } else {
      factor = endFactor;
    }

    // update global shrink factor used by spawners and HUD
    window._campaignShrinkFactor = factor;

    // compute pixel bounds centered on arena center
    const canvas = gameState.canvas;
    if (canvas) {
      const center = canvas.width * 0.5;
      const halfW  = (canvas.width * 0.5) * factor;
      _arenaLeft  = Math.max(0, Math.floor(center - halfW));
      _arenaRight = Math.min(canvas.width, Math.ceil(center + halfW));

      // pulse timer
      _arenaPulse += dt;
      const pulse = 0.5 + 0.5 * Math.sin(_arenaPulse * 4.0);

      // Draw wall overlay with pulse
      _drawWallOverlay(canvas, _arenaLeft, _arenaRight, pulse);

      // Expose bounds for spawners
      window._campaignArenaBounds = { left: _arenaLeft, right: _arenaRight, factor: factor };
    }

    // Clamp player inside active arena (do not instantly kill). This prevents crushing bugs
    try {
      const player = gameState.player;
      if (player && canvas) {
        const minX = _arenaLeft + player.radius + 4;
        const maxX = _arenaRight - player.radius - 4;
        if (minX < maxX) {
          if (player.x < minX) { player.x = minX; player.vx = 0; }
          if (player.x > maxX) { player.x = maxX; player.vx = 0; }
        }
      }
    } catch(_) {}

    // Stop updating wall after level ends
    if (elapsed >= endTime) {
      try { _hideWallCanvas(); } catch(_){}
      window._campaignArenaBounds = null;
      window._campaignShrinkFactor = endFactor;
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

  function _drawWallOverlay(gameCanvas, leftBound, rightBound, pulseAlpha) {
    const wc = document.getElementById('campaign-wall-canvas');
    if (!wc) return;
    const wctx = wc.getContext('2d');
    // Sync size
    if (wc.width !== gameCanvas.width || wc.height !== gameCanvas.height) {
      wc.width  = gameCanvas.width;
      wc.height = gameCanvas.height;
    }
    wctx.clearRect(0, 0, wc.width, wc.height);
    pulseAlpha = (typeof pulseAlpha === 'number') ? Math.max(0, Math.min(1, pulseAlpha)) : 0.6;

    // Darken outside area to emphasize inner arena
    wctx.save();
    wctx.fillStyle = 'rgba(0,0,0,0.45)';
    wctx.fillRect(0, 0, wc.width, wc.height);
    // Cut out inner arena (clear)
    wctx.globalCompositeOperation = 'destination-out';
    wctx.fillStyle = 'rgba(0,0,0,1)';
    wctx.fillRect(leftBound, 0, Math.max(0, rightBound - leftBound), wc.height);
    wctx.globalCompositeOperation = 'source-over';

    // Glowing gradient on edges (purple -> red pulse)
    const glowColor = `rgba(196, 88, 255, ${0.18 + 0.22 * pulseAlpha})`;
    const dangerColor = `rgba(255, 86, 86, ${0.5 * pulseAlpha})`;

    if (leftBound > 0) {
      const grad = wctx.createLinearGradient(Math.max(0, leftBound - 140), 0, leftBound + 30, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.6, 'rgba(124,58,237,0.06)');
      grad.addColorStop(1, glowColor);
      wctx.fillStyle = grad;
      wctx.fillRect(Math.max(0, leftBound - 140), 0, leftBound + 140, wc.height);

      // Glow line
      wctx.save();
      wctx.strokeStyle = dangerColor;
      wctx.lineWidth = 4 + 2 * pulseAlpha;
      wctx.shadowColor = glowColor;
      wctx.shadowBlur = 12 * pulseAlpha;
      wctx.beginPath();
      wctx.moveTo(leftBound + 0.5, 0);
      wctx.lineTo(leftBound + 0.5, wc.height);
      wctx.stroke();
      wctx.restore();
    }

    if (rightBound < gameCanvas.width) {
      const grad = wctx.createLinearGradient(rightBound - 30, 0, Math.min(wc.width, rightBound + 140), 0);
      grad.addColorStop(0, glowColor);
      grad.addColorStop(0.6, 'rgba(124,58,237,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      wctx.fillStyle = grad;
      wctx.fillRect(rightBound - 140, 0, (Math.min(wc.width, rightBound + 140) - (rightBound - 140)), wc.height);

      // Glow line
      wctx.save();
      wctx.strokeStyle = dangerColor;
      wctx.lineWidth = 4 + 2 * pulseAlpha;
      wctx.shadowColor = glowColor;
      wctx.shadowBlur = 12 * pulseAlpha;
      wctx.beginPath();
      wctx.moveTo(rightBound - 0.5, 0);
      wctx.lineTo(rightBound - 0.5, wc.height);
      wctx.stroke();
      wctx.restore();
    }

    wctx.restore();
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
      // Enrich incoming stateData with mission-run metrics when possible
      try {
        const last = (typeof window !== 'undefined' && window._campaignLastProgress) ? window._campaignLastProgress : {};
        const mr = (typeof missionRun !== 'undefined') ? missionRun : (typeof window !== 'undefined' ? window.missionRun : null);
        const enrich = Object.assign({}, last, stateData || {});
        if (mr) {
          if (Number.isFinite(mr.nearMissesThisRun)) enrich.nearMisses = mr.nearMissesThisRun;
          if (Number.isFinite(mr.maxCombo)) enrich.maxCombo = mr.maxCombo;
          if (Number.isFinite(mr.powerupsThisRun)) enrich.powerupsThisRun = mr.powerupsThisRun;
        }
        stateData = enrich;
      } catch (_) {}

      const stars  = ObjectiveTracker.calcStars(lvl, stateData);
      const reward = _isFirstTime ? lvl.rewardCoins : Math.round(lvl.rewardCoins * 0.1);

      // Award coins
      if (typeof settings !== 'undefined' && typeof saveSettings === 'function') {
        settings.coins = (settings.coins || 0) + reward;
        saveSettings();
        if (typeof updateCoinUI === 'function') updateCoinUI(true);
      }

      // Determine previous best to compute new-best flag
      const saveState = CampaignSave.get();
      const prevBest = (saveState && saveState.bestScoresByLevel && Number.isFinite(saveState.bestScoresByLevel[lvl.id])) ? saveState.bestScoresByLevel[lvl.id] : 0;
      const last = (typeof window !== 'undefined' && window._campaignLastProgress) ? window._campaignLastProgress : {};
      const runScore = (typeof stateData !== 'undefined' && Number.isFinite(stateData.score)) ? stateData.score : (last.score || 0);
      const wasNewBest = runScore > prevBest;
      const prevStars = (saveState && typeof saveState.starsByLevel === 'object') ? (saveState.starsByLevel[lvl.id] || 0) : 0;
      const wasNewStars = stars > prevStars;

      // Save progress (include runScore if available)
      CampaignSave.completeLevelResult(lvl.id, stars, runScore || 0, 0, reward, _isFirstTime);

      // Prepare UI state (merge last-known progress and stateData)
      const uiState = Object.assign({}, last, stateData || {});
      uiState.wasNewBest = wasNewBest;
      uiState.wasNewStars = wasNewStars;

      CampaignUI.hideHUD();
      BossManager.deactivate();
      _hideWallCanvas();
      try { currentState = STATE.VICTORY; } catch (_) {}

      CampaignUI.showVictory(lvl, stars, reward, _isFirstTime, uiState, wasNewBest);

      _active = false;
      window._campaignSettings = null;
      try { window._challengeRunning = false; } catch (_) {}
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
    try { window._challengeRunning = false; } catch (_) {}
    BossManager.deactivate();
    _hideWallCanvas();
    CampaignUI.hideHUD();
    try { currentState = STATE.DEFEAT; } catch (_) {}

    // Small delay so death animation plays first
    setTimeout(() => {
      try { document.getElementById('gameover-overlay').hidden = true; } catch (_) {}
      // Provide last-known progress to defeat UI
      const last = (typeof window !== 'undefined' && window._campaignLastProgress) ? window._campaignLastProgress : {};
      const stateData = Object.assign({}, last, { hitsReceived: ObjectiveTracker.getHitsReceived() });
      CampaignUI.showDefeat(lvl, reason, stateData);
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
    startLevelNow,
    tick,
    onDefeat,
  };
})();
