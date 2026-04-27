#!/usr/bin/env python3
"""Apply gameplay overhaul changes to script.js (v47.3)"""
import re

with open('script.js', 'r', encoding='utf-8') as f:
    src = f.read()

original = src

# ---- 1. Fix panicSpawnRate / panicSpeedMult / activeForbiddenRatio ----
old = r"""function panicSpawnRate\(\) \{
  // Was: spawnRate \* 0\.34 \(~3x faster\)\. Now 60% of normal.*
  return panicPhase === 'wave' \? spawnRate \* DIFFICULTY_CONFIG\.panicSpawnMult : spawnRate;
\}
function panicSpeedMult\(\) \{
  // Was: 1\.32.*
  return panicPhase === 'wave' \? DIFFICULTY_CONFIG\.panicSpeedBonus : 1\.0;
\}
function activeForbiddenRatio\(\) \{
  if \(panicPhase === 'wave'\) return 0\.72;
  return Math\.min\(0\.58 \+ difficultyBumps \* 0\.012, 0\.68\);
\}"""

new = """function panicSpawnRate() {
  return panicPhase === 'wave' ? spawnRate * DIFFICULTY_CONFIG.panicSpawnMult : spawnRate;
}
function panicSpeedMult() {
  return panicPhase === 'wave' ? DIFFICULTY_CONFIG.panicSpeedBonus : 1.0;
}
function activeForbiddenRatio() {
  if (panicPhase === 'wave') return DIFFICULTY_CONFIG.panicForbidRatio;
  if (ddPhase === 'active') return 0.58; // slightly elevated; DD color logic handles dual-threat
  return Math.min(0.62 + difficultyBumps * 0.013, 0.74);
}"""

result = re.sub(old, new, src, count=1)
if result == src:
    print("FAIL: panicSpawnRate/activeForbiddenRatio block not replaced")
else:
    print("OK: panicSpawnRate/activeForbiddenRatio")
src = result

# ---- 2. Fix panicDuration (panic wave length: 2-4s -> 3-6.5s) ----
old2 = "panicDuration = 2.0 + Math.random() * 2.0;"
new2 = "panicDuration = 3.0 + Math.random() * 3.5; // 3-6.5 s -- longer, more impactful waves"
if old2 in src:
    src = src.replace(old2, new2, 1)
    print("OK: panicDuration")
else:
    print("FAIL: panicDuration")

# ---- 3. Fix ddDuration (DD length: 2-4s -> 4-8s) ----
old3 = "ddDuration = 2.0 + Math.random() * 2.0;"
new3 = "ddDuration = 4.0 + Math.random() * 4.0; // 4-8 s -- longer DD for real impact"
if old3 in src:
    src = src.replace(old3, new3, 1)
    print("OK: ddDuration")
else:
    print("FAIL: ddDuration")

# ---- 4. Add pickObstacleColorIndex() before spawnObstacle() ----
HELPER_FN = """// Returns a color index for a newly-spawned obstacle, centralising all forbidden-ratio logic.
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

"""

ANCHOR = "function spawnObstacle() {"
if ANCHOR in src:
    src = src.replace(ANCHOR, HELPER_FN + ANCHOR, 1)
    print("OK: pickObstacleColorIndex added")
else:
    print("FAIL: spawnObstacle anchor not found")

# ---- 5. Replace color selection in spawnObstacle() ----
old5 = """  // Color: 60/40 forbidden/neutral post-grace, but drops to 30/70 while the warning
  // phase is active so new spawns don't pile up forbidden blocks during color transitions.
  let colorIndex;
  if (graceTimer < GRACE_PERIOD) {
    colorIndex = Math.floor(Math.random() * GAME_COLORS.length);
    if (colorIndex === forbiddenIndex) colorIndex = (colorIndex + 1) % GAME_COLORS.length;
  } else {
    const forbRatio = warningActive ? 0.34 : activeForbiddenRatio();
    if (Math.random() < forbRatio) {
      colorIndex = forbiddenIndex;
    } else {
      colorIndex = Math.floor(Math.random() * GAME_COLORS.length);
      if (colorIndex === forbiddenIndex) colorIndex = (colorIndex + 1) % GAME_COLORS.length;
    }
  }"""

new5 = "  // Color: centralised logic handles grace, warning, panic, and Double Danger.\n  let colorIndex = pickObstacleColorIndex();"

if old5 in src:
    src = src.replace(old5, new5, 1)
    print("OK: spawnObstacle color selection replaced")
else:
    print("FAIL: spawnObstacle color selection not found")

# ---- 6. Fix spawnObstacle() panic targeting (isCamping check) ----
old6 = """  const isCamping = _samePlayerLaneWaves >= CAMPING_WAVE_LIMIT;
  const shieldPlayerLane = !isCamping && _playerLaneShieldStreak < MAX_PLAYER_LANE_SHIELD;
  const _laneW      = canvas.width / NUM_LANES;
  const flowTargeting = getFlowTargetingBonus();
  const spawnSafeR  = Math.max(4, player.radius + (shieldPlayerLane ? 26 : (isCamping ? 6 : 10)) - flowTargeting * 18);"""

new6 = """  const isPanic = panicPhase === 'wave';
  const isCamping = isPanic || _samePlayerLaneWaves >= CAMPING_WAVE_LIMIT;
  const shieldPlayerLane = !isCamping && _playerLaneShieldStreak < MAX_PLAYER_LANE_SHIELD;
  const _laneW      = canvas.width / NUM_LANES;
  const flowTargeting = getFlowTargetingBonus();
  // During panic: very small safe radius -- blocks can spawn right next to player
  const spawnSafeR  = Math.max(4, player.radius + (shieldPlayerLane ? 26 : (isPanic ? 2 : (isCamping ? 6 : 10))) - flowTargeting * 18);"""

if old6 in src:
    src = src.replace(old6, new6, 1)
    print("OK: spawnObstacle isCamping/panic targeting")
else:
    print("FAIL: spawnObstacle isCamping block not found")

# ---- 7. Fix spawnWave() panic targeting (isCamping check) ----
old7 = """  const beforeLen = obstacles.length;
  const isCamping = _samePlayerLaneWaves >= CAMPING_WAVE_LIMIT;
  const flowTargeting = getFlowTargetingBonus();
  const wavePressure = Math.min(0.95, (isCamping ? 0.85 : 0.65) + flowTargeting);"""

new7 = """  const beforeLen = obstacles.length;
  const isPanic = panicPhase === 'wave';
  const isCamping = isPanic || _samePlayerLaneWaves >= CAMPING_WAVE_LIMIT;
  const flowTargeting = getFlowTargetingBonus();
  const wavePressure = Math.min(0.98, (isPanic ? 0.95 : (isCamping ? 0.85 : 0.65)) + flowTargeting);"""

if old7 in src:
    src = src.replace(old7, new7, 1)
    print("OK: spawnWave isCamping/panic targeting")
else:
    print("FAIL: spawnWave isCamping block not found")

# ---- 8. Replace color selection in spawnWave() ----
old8 = """    // Color: honor warning-phase fairness (30% forbidden during color transition)
    let colorIndex;
    if (!postGrace) {
      colorIndex = Math.floor(Math.random() * GAME_COLORS.length);
      if (colorIndex === forbiddenIndex) colorIndex = (colorIndex + 1) % GAME_COLORS.length;
    } else {
      const forbRatio = warningActive ? 0.34 : activeForbiddenRatio();
      if (Math.random() < forbRatio) {
        colorIndex = forbiddenIndex;
      } else {
        colorIndex = Math.floor(Math.random() * GAME_COLORS.length);
        if (colorIndex === forbiddenIndex) colorIndex = (colorIndex + 1) % GAME_COLORS.length;
      }
    }"""

new8 = "    // Color: centralised logic handles grace, warning, panic, and Double Danger.\n    let colorIndex = pickObstacleColorIndex();"

if old8 in src:
    src = src.replace(old8, new8, 1)
    print("OK: spawnWave color selection replaced")
else:
    print("FAIL: spawnWave color selection not found")

# ---- 9. Fix spawnWave safe-radius during panic ----
old9 = "    // Never spawn inside player safe radius\n    if (Math.abs(cx - player.x) < Math.max(6, player.radius + (_samePlayerLaneWaves >= CAMPING_WAVE_LIMIT ? 10 : 18) - flowTargeting * 14)) continue;"
new9 = """    // Never spawn inside player safe radius (smaller radius during panic for tighter targeting)
    const waveMinSafeR = Math.max(4, player.radius + (isPanic ? 2 : (isCamping ? 10 : 18)) - flowTargeting * 14);
    if (Math.abs(cx - player.x) < waveMinSafeR) continue;"""

if old9 in src:
    src = src.replace(old9, new9, 1)
    print("OK: spawnWave safe radius")
else:
    print("FAIL: spawnWave safe radius not found")

# ---- 10. Fix tickDifficulty phase-transition floating text (remove emoji symbol) ----
# Search for the addFloating call with the lightning bolt Unicode
import re as _re
old10_pattern = r"addFloating\(canvas\.width / 2, canvas\.height / 3, '\\u26a1 ' \+ label,"
new10_repl = "addFloating(canvas.width / 2, canvas.height / 3, label + ' Phase',"
result10 = _re.sub(old10_pattern, new10_repl, src, count=1)
if result10 != src:
    src = result10
    print("OK: tickDifficulty floating text")
else:
    # Try direct string match
    old10b = "addFloating(canvas.width / 2, canvas.height / 3, '\\u26a1 ' + label,"
    if old10b in src:
        src = src.replace(old10b, "addFloating(canvas.width / 2, canvas.height / 3, label + ' Phase',", 1)
        print("OK: tickDifficulty floating text (direct)")
    else:
        print("FAIL: tickDifficulty floating text")

# ---- 11. GAME_CONFIG spawnRate: 1.35 -> 1.10 (initial rate before first tickDifficulty) ----
old11 = "const GAME_CONFIG = { playerSpeed: 255, spawnRate: 1.35,"
new11 = "const GAME_CONFIG = { playerSpeed: 255, spawnRate: 1.10,"
if old11 in src:
    src = src.replace(old11, new11, 1)
    print("OK: GAME_CONFIG spawnRate")
else:
    print("FAIL: GAME_CONFIG spawnRate")

if src != original:
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(src)
    print("\nscript.js updated successfully.")
else:
    print("\nWARNING: No changes were made!")
