$ErrorActionPreference = 'Stop'
$content = Get-Content script.js -Raw -Encoding UTF8

# ============================================================
# PATCH 2: Update FLOW_CONFIG spawn/gap acceleration values
# ============================================================
$content = $content.Replace(
  '  spawnIntervalPerCombo: 0.022,' + "`n" + '  spawnIntervalCap: 0.34,' + "`n" + '  gapTightenPerCombo: 0.95,' + "`n" + '  gapTightenCap: 15,',
  '  spawnIntervalPerCombo: 0.007,  // was 0.022 - less combo-driven spawn acceleration' + "`n" + '  spawnIntervalCap: 0.14,         // was 0.34 - max 14% spawn boost from combo' + "`n" + '  gapTightenPerCombo: 0.42,       // was 0.95 - gentler gap shrink at high combo' + "`n" + '  gapTightenCap: 8,              // was 15'
)
Write-Host "Patch 2 (FLOW_CONFIG): $($content.Contains('spawnIntervalPerCombo: 0.007'))"

# ============================================================
# PATCH 3: Add difficultyPhase state variable
# ============================================================
$content = $content.Replace(
  'let difficultyBumps   = 0;' + "`n" + 'let difficultyTimer   = 0;' + "`n" + 'let speedMultiplier   = 1.0;',
  'let difficultyBumps   = 0;' + "`n" + 'let difficultyTimer   = 0;' + "`n" + 'let speedMultiplier   = 1.0;' + "`n" + 'let difficultyPhase   = 0;   // 0=Intro 1=Build 2=Engage 3=Intense 4=Expert'
)
Write-Host "Patch 3 (difficultyPhase): $($content.Contains('difficultyPhase   = 0'))"

# ============================================================
# PATCH 4: Replace getActiveSpawnInterval floor
# ============================================================
$content = $content.Replace(
  'function getActiveSpawnInterval() {' + "`n" + '  const comboReduction = Math.min(combo * FLOW_CONFIG.spawnIntervalPerCombo, FLOW_CONFIG.spawnIntervalCap);' + "`n" + '  const campReduction  = flowState.campPressure * 0.12;' + "`n" + '  return Math.max(0.085, panicSpawnRate() * (1 - comboReduction - campReduction));' + "`n" + '}',
  'function getActiveSpawnInterval() {' + "`n" + '  const comboReduction = Math.min(combo * FLOW_CONFIG.spawnIntervalPerCombo, FLOW_CONFIG.spawnIntervalCap);' + "`n" + '  const campReduction  = flowState.campPressure * 0.08;' + "`n" + '  return Math.max(DIFFICULTY_CONFIG.spawnIntervalFloor, panicSpawnRate() * (1 - comboReduction - campReduction));' + "`n" + '}'
)
Write-Host "Patch 4 (getActiveSpawnInterval): $($content.Contains('DIFFICULTY_CONFIG.spawnIntervalFloor, panicSpawnRate'))"

# ============================================================
# PATCH 5: Replace panicSpawnRate, panicSpeedMult, activeForbiddenRatio, currentClusterChance
# ============================================================
$oldPanic = 'function panicSpawnRate() {' + "`n" + '  return panicPhase === ' + "'" + 'wave' + "'" + ' ? spawnRate * 0.34 : spawnRate; // ~3' + [char]0xc3 + [char]0x97 + ' faster during wave' + "`n" + '}' + "`n" + 'function panicSpeedMult() {' + "`n" + '  return panicPhase === ' + "'" + 'wave' + "'" + ' ? 1.32 : 1.0; // 32 % faster obstacle velocity during wave' + "`n" + '}'

# Search for these functions more broadly
$panicIdx = $content.IndexOf('function panicSpawnRate()')
Write-Host "panicSpawnRate found at index: $panicIdx"

# Build replacement block
$newPanicBlock = @'
// --- Difficulty helper functions ---

// Returns the current elapsed play time in seconds (used by all phase-aware helpers)
function getElapsedPlayTime() {
  if (gameStartTime <= 0) return 0;
  return Math.max(0, (performance.now() - gameStartTime - pausedDuration) / 1000);
}

// Returns the phase index (0-4) for the given elapsed time
function getDiffPhase(elapsed) {
  const phases = DIFFICULTY_CONFIG.phases;
  for (let i = 0; i < phases.length - 1; i++) {
    if (elapsed < phases[i].endAt) return i;
  }
  return phases.length - 1;
}

// Smoothstep-interpolated value between current and previous phase
function lerpDiff(elapsed, key) {
  const phases = DIFFICULTY_CONFIG.phases;
  const pi     = getDiffPhase(elapsed);
  if (pi === 0) return phases[0][key];
  const prev   = phases[pi - 1];
  const cur    = phases[pi];
  const t      = Math.min(1, (elapsed - prev.endAt) / DIFFICULTY_CONFIG.blendWindow);
  const ease   = t * t * (3 - 2 * t); // smoothstep
  return prev[key] + (cur[key] - prev[key]) * ease;
}

// Phase-aware max obstacle count (soft cap, never exceeds hard cap)
function getPhaseMaxObstacles() {
  const elapsed = getElapsedPlayTime();
  return Math.min(Math.round(lerpDiff(elapsed, 'mo')), DIFFICULTY_CONFIG.maxObstaclesHardCap);
}

// Weighted random pattern selection based on current phase
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

function panicSpawnRate() {
  // Was: spawnRate * 0.34 (nearly 3x faster) — now 60% of normal interval
  return panicPhase === 'wave' ? spawnRate * DIFFICULTY_CONFIG.panicSpawnMult : spawnRate;
}
function panicSpeedMult() {
  // Was: 1.32 — now 1.14 (much less extreme)
  return panicPhase === 'wave' ? DIFFICULTY_CONFIG.panicSpeedBonus : 1.0;
}
'@

# Find and replace the panic functions section
$oldBlock1 = 'function panicSpawnRate() {' + "`r`n" + '  return panicPhase === ' + [char]39 + 'wave' + [char]39 + ' ? spawnRate * 0.34 : spawnRate;'
$oldBlock2 = 'function panicSpawnRate() {' + "`n" + '  return panicPhase === ' + [char]39 + 'wave' + [char]39 + ' ? spawnRate * 0.34 : spawnRate;'

if ($content.Contains($oldBlock2)) {
  Write-Host "Found panicSpawnRate (LF)"
} elseif ($content.Contains($oldBlock1)) {
  Write-Host "Found panicSpawnRate (CRLF)"
}

# Extract the range to replace
$startMarker = 'function panicSpawnRate() {'
$si = $content.IndexOf($startMarker)
# Find the end after panicSpeedMult closing brace
$endMarker = '}' + "`n" + 'function activeForbiddenRatio()'
$ei = $content.IndexOf($endMarker, $si)
if ($ei -gt 0) {
  $oldPanicSection = $content.Substring($si, $ei - $si)
  Write-Host "Old panic section length: $($oldPanicSection.Length)"
  Write-Host "Old section start: $($oldPanicSection.Substring(0, [Math]::Min(80, $oldPanicSection.Length)))"
  $content = $content.Replace($oldPanicSection, $newPanicBlock)
  Write-Host "Patch 5 (panic functions): replaced"
} else {
  Write-Host "WARNING: Could not find end of panic section"
}

# ============================================================
# PATCH 6: Update activeForbiddenRatio and currentClusterChance
# ============================================================
$oldForbRatio = 'function activeForbiddenRatio() {' + "`n" + '  if (panicPhase === ' + [char]39 + 'wave' + [char]39 + ') return 0.74;' + "`n" + '  return Math.min(0.62 + difficultyBumps * 0.02, 0.72);' + "`n" + '}'
$newForbRatio = 'function activeForbiddenRatio() {' + "`n" + '  if (panicPhase === ' + [char]39 + 'wave' + [char]39 + ') return 0.72;' + "`n" + '  // Scale more gently with bumps; cap lower to keep screen readable' + "`n" + '  return Math.min(0.58 + difficultyBumps * 0.012, 0.68);' + "`n" + '}'
if ($content.Contains($oldForbRatio)) {
  $content = $content.Replace($oldForbRatio, $newForbRatio)
  Write-Host "Patch 6a (activeForbiddenRatio): replaced"
} else {
  Write-Host "WARNING: activeForbiddenRatio not found with exact string"
}

$oldCluster = 'function currentClusterChance() {' + "`n" + '  const earlyRamp = Math.min(graceTimer, 8) * 0.015;' + "`n" + '  return Math.min(CLUSTER_CHANCE + earlyRamp + difficultyBumps * 0.035, 0.82);' + "`n" + '}'
$newCluster = 'function currentClusterChance() {' + "`n" + '  // Phase-driven cluster chance — replaces old difficultyBumps-based formula' + "`n" + '  const elapsed = getElapsedPlayTime();' + "`n" + '  const base    = lerpDiff(elapsed, ' + [char]39 + 'cc' + [char]39 + ');' + "`n" + '  return Math.min(base + Math.min(graceTimer, 6) * 0.006, 0.76);' + "`n" + '}'
if ($content.Contains($oldCluster)) {
  $content = $content.Replace($oldCluster, $newCluster)
  Write-Host "Patch 6b (currentClusterChance): replaced"
} else {
  Write-Host "WARNING: currentClusterChance not found with exact string"
}

# ============================================================
# PATCH 7: Replace tickDifficulty() entirely
# ============================================================
$startTD = 'function tickDifficulty(dt) {'
$si = $content.IndexOf($startTD)
$endTD = "`n}" + "`n`n// ============================================================`n// SECTION 17: SCREEN SHAKE"
$ei = $content.IndexOf($endTD, $si)
if ($ei -gt 0) {
  $oldTD = $content.Substring($si, $ei - $si)
  Write-Host "Old tickDifficulty length: $($oldTD.Length)"
  $newTD = @'
function tickDifficulty(dt) {
  const elapsed    = getElapsedPlayTime();
  const prevPhase  = difficultyPhase;
  difficultyPhase  = getDiffPhase(elapsed);

  // Smoothly interpolate all difficulty values from phase data
  const newSpeedMult = Math.min(lerpDiff(elapsed, 'spd'), DIFFICULTY_CONFIG.speedMultHardCap);
  const newSpawnRate = Math.max(lerpDiff(elapsed, 'si'),  DIFFICULTY_CONFIG.spawnIntervalFloor);

  // If speed increased, rescale existing on-screen obstacles immediately
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

  // Derived legacy counter used by lane-selection helpers (0-12 range)
  // Keeps existing helper functions working without full refactor.
  difficultyBumps = Math.min(12, Math.round(elapsed / 7));

  // Phase transition announcement
  if (difficultyPhase !== prevPhase && difficultyPhase > 0 && !settings.reducedMotion) {
    const label = DIFFICULTY_CONFIG.phases[difficultyPhase].name;
    addFloating(canvas.width / 2, canvas.height / 3, '\u26a1 ' + label, '#f97316', 20);
  }

  Music.setTempo(speedMultiplier);
}
'@
  $content = $content.Replace($oldTD, $newTD.TrimEnd())
  Write-Host "Patch 7 (tickDifficulty): replaced"
} else {
  Write-Host "WARNING: Could not locate tickDifficulty end"
}

# ============================================================
# PATCH 8: Fix obstacle type speed multipliers in spawnObstacle
# Old: case 3 vy=base*1.55+rand*85, case 4 vy=base*1.85+rand*100
# New: use DIFFICULTY_CONFIG.typeSpeedMults
# ============================================================
$oldSpeeds = '    case 0: w = 28 + Math.random()*16;  h = w;                         vy = base + Math.random()*80;       break;' + "`n" + '    case 1: w = 26 + Math.random()*14;  h = w;                         vy = base*0.85 + Math.random()*50;  break;' + "`n" + '    case 2: w = 52 + Math.random()*20;  h = 38 + Math.random()*14;     vy = base*0.60 + Math.random()*28;  break; // medium-large, not room-filling' + "`n" + '    case 3: w = 14 + Math.random()*10;  h = 52 + Math.random()*28;     vy = base*1.55 + Math.random()*85;  break;' + "`n" + '    case 4: w = 12 + Math.random()*8;   h = 12 + Math.random()*8;      vy = base*1.85 + Math.random()*100; break;'
$newSpeeds = '    case 0: w = 28 + Math.random()*16;  h = w;                         vy = base * DIFFICULTY_CONFIG.typeSpeedMults[0] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[0]; break;' + "`n" + '    case 1: w = 26 + Math.random()*14;  h = w;                         vy = base * DIFFICULTY_CONFIG.typeSpeedMults[1] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[1]; break;' + "`n" + '    case 2: w = 52 + Math.random()*20;  h = 38 + Math.random()*14;     vy = base * DIFFICULTY_CONFIG.typeSpeedMults[2] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[2]; break;' + "`n" + '    case 3: w = 14 + Math.random()*10;  h = 52 + Math.random()*28;     vy = base * DIFFICULTY_CONFIG.typeSpeedMults[3] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[3]; break;' + "`n" + '    case 4: w = 12 + Math.random()*8;   h = 12 + Math.random()*8;      vy = base * DIFFICULTY_CONFIG.typeSpeedMults[4] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[4]; break;'
if ($content.Contains($oldSpeeds)) {
  $content = $content.Replace($oldSpeeds, $newSpeeds)
  Write-Host "Patch 8 (spawnObstacle speeds): replaced"
} else {
  Write-Host "WARNING: spawnObstacle speed cases not found exactly — trying partial"
  $old3 = '    case 3: w = 14 + Math.random()*10;  h = 52 + Math.random()*28;     vy = base*1.55 + Math.random()*85;  break;'
  $new3 = '    case 3: w = 14 + Math.random()*10;  h = 52 + Math.random()*28;     vy = base * DIFFICULTY_CONFIG.typeSpeedMults[3] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[3]; break;'
  $old4 = '    case 4: w = 12 + Math.random()*8;   h = 12 + Math.random()*8;      vy = base*1.85 + Math.random()*100; break;'
  $new4 = '    case 4: w = 12 + Math.random()*8;   h = 12 + Math.random()*8;      vy = base * DIFFICULTY_CONFIG.typeSpeedMults[4] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[4]; break;'
  if ($content.Contains($old3)) { $content = $content.Replace($old3, $new3); Write-Host "  case 3 replaced" }
  if ($content.Contains($old4)) { $content = $content.Replace($old4, $new4); Write-Host "  case 4 replaced" }
}

# ============================================================
# PATCH 9: Fix spawnObstacle MAX_OBSTACLES check -> phase-aware
# ============================================================
$oldMaxCheck = 'function spawnObstacle() {' + "`n" + '  if (obstacles.length >= MAX_OBSTACLES) return;'
$newMaxCheck = 'function spawnObstacle() {' + "`n" + '  if (obstacles.length >= getPhaseMaxObstacles()) return;'
if ($content.Contains($oldMaxCheck)) {
  $content = $content.Replace($oldMaxCheck, $newMaxCheck)
  Write-Host "Patch 9 (spawnObstacle max cap): replaced"
} else {
  Write-Host "WARNING: spawnObstacle MAX_OBSTACLES check not found"
}

# ============================================================
# PATCH 10: Fix spawnWave MAX_OBSTACLES check + speed multipliers + add pattern selection
# ============================================================
$oldWaveMax = 'function spawnWave() {' + "`n" + '  if (obstacles.length >= MAX_OBSTACLES) return;'
$newWaveMax = 'function spawnWave() {' + "`n" + '  if (obstacles.length >= getPhaseMaxObstacles()) return;'
if ($content.Contains($oldWaveMax)) {
  $content = $content.Replace($oldWaveMax, $newWaveMax)
  Write-Host "Patch 10a (spawnWave max cap): replaced"
} else {
  Write-Host "WARNING: spawnWave MAX_OBSTACLES check not found"
}

# Fix wave speed multipliers
$oldWaveSpeed = '    const speedScale = wType === 4 ? 1.65 : (wType === 3 ? 1.35 : (wType === 2 ? 0.62 : 1.0));' + "`n" + '    const vyR = base * speedScale + Math.random() * 70;'
$newWaveSpeed = '    const speedScale = DIFFICULTY_CONFIG.typeSpeedMults[wType] ?? 1.0;' + "`n" + '    const speedRandV = DIFFICULTY_CONFIG.typeSpeedRand[wType] ?? 28;' + "`n" + '    const vyR = base * speedScale + Math.random() * speedRandV;'
if ($content.Contains($oldWaveSpeed)) {
  $content = $content.Replace($oldWaveSpeed, $newWaveSpeed)
  Write-Host "Patch 10b (spawnWave speed scale): replaced"
} else {
  Write-Host "WARNING: spawnWave speedScale not found"
}

# Add pattern selection to spawnWave — inject before buildWavePlan call
$oldBuildCall = '  const playerLane = getPlayerLane();' + "`n" + '  observePlayerLaneForSpawn(playerLane);' + "`n" + '  const plan = buildWavePlan(lanes, playerLane, lw, postGrace);'
$newBuildCall = '  const playerLane = getPlayerLane();' + "`n" + '  observePlayerLaneForSpawn(playerLane);' + "`n`n" + '  // Pattern selection — chooses safe-lane strategy based on current phase' + "`n" + '  const patternId  = selectSpawnPattern();' + "`n" + '  const midLane    = Math.floor(NUM_LANES / 2);' + "`n" + '  let   safeLaneHint = -1;  // -1 = use default drift logic' + "`n" + '  if (patternId === ' + [char]39 + 'CENTER_PUSH' + [char]39 + ') {' + "`n" + '    // Danger in center, safe on edges' + "`n" + '    safeLaneHint = Math.random() < 0.5 ? 0 : NUM_LANES - 1;' + "`n" + '  } else if (patternId === ' + [char]39 + 'SIDE_PUSH' + [char]39 + ' || patternId === ' + [char]39 + 'PINCER' + [char]39 + ') {' + "`n" + '    // Danger on sides, safe in center' + "`n" + '    safeLaneHint = Math.max(1, Math.min(NUM_LANES - 2, midLane + (Math.random() < 0.5 ? 0 : -1)));' + "`n" + '  } else if (patternId === ' + [char]39 + 'HALF_FILL' + [char]39 + ') {' + "`n" + '    // Half open on the side away from player' + "`n" + '    safeLaneHint = playerLane <= midLane ? NUM_LANES - 1 : 0;' + "`n" + '  }' + "`n" + '  const plan = buildWavePlan(lanes, playerLane, lw, postGrace, safeLaneHint);'
if ($content.Contains($oldBuildCall)) {
  $content = $content.Replace($oldBuildCall, $newBuildCall)
  Write-Host "Patch 10c (spawnWave pattern): replaced"
} else {
  Write-Host "WARNING: spawnWave buildWavePlan call not found"
}

# ============================================================
# PATCH 11: Update buildWavePlan to accept optional safeLane hint
# ============================================================
$oldBWP = 'function buildWavePlan(laneCenters, playerLane, laneW, postGrace) {'
$newBWP = 'function buildWavePlan(laneCenters, playerLane, laneW, postGrace, safeLaneHint) {' + "`n" + '  // If a pattern-specific safe lane is requested, try it first' + "`n" + '  if (safeLaneHint >= 0) {' + "`n" + '    const blocked = pickBlockedLanes(safeLaneHint, playerLane);' + "`n" + '    if (!postGrace || validateEscapeRoute(laneCenters, blocked, laneW)) {' + "`n" + '      return { safeLane: safeLaneHint, blocked };' + "`n" + '    }' + "`n" + '  }'
if ($content.Contains($oldBWP)) {
  $content = $content.Replace($oldBWP, $newBWP)
  Write-Host "Patch 11 (buildWavePlan hint): replaced"
} else {
  Write-Host "WARNING: buildWavePlan not found"
}

# ============================================================
# PATCH 12: Reduce pre-fill from 24 to 8 obstacles
# ============================================================
$oldPrefill = '    // Pre-fill obstacles so there' + [char]39 + 's immediate on-screen pressure' + "`n" + '    const preCount = 24;' + "`n" + '    for (let _i = 0; _i < preCount; _i++) {' + "`n" + '      spawnObstacle();' + "`n" + '      if (obstacles.length > 0) {' + "`n" + '        const ob = obstacles[obstacles.length - 1];' + "`n" + '        // Tight stagger ' + [char]0xe2 + [char]0x80 + [char]0x94 + ' blocks arrive in a quick opening rush.' + "`n" + '        ob.y = -(ob.h + 10) - _i * (canvas.height * 0.082 + 4);' + "`n" + '        // Demote big blocks on pre-fill ' + [char]0xe2 + [char]0x80 + [char]0x94 + ' opening screen stays readable' + "`n" + '        if (ob.type === 2) { ob.type = 0; ob.w = 28 + Math.random()*16; ob.h = ob.w; }' + "`n" + '      }' + "`n" + '    }'

# Try to find and replace with a simpler approach
$prefillIdx = $content.IndexOf('    const preCount = 24;')
if ($prefillIdx -ge 0) {
  $prefillEnd = $content.IndexOf('    }', $prefillIdx + 100) + 5
  $oldPrefillSection = $content.Substring($prefillIdx, $prefillEnd - $prefillIdx)
  Write-Host "Old prefill section: $($oldPrefillSection.Substring(0, [Math]::Min(120, $oldPrefillSection.Length)))"
  $newPrefillSection = @'
    const preCount = 8;  // was 24 -- gentle opening, player can read the field
    for (let _i = 0; _i < preCount; _i++) {
      spawnObstacle();
      if (obstacles.length > 0) {
        const ob = obstacles[obstacles.length - 1];
        // Gentle spread -- blocks arrive gradually so the first second is readable
        ob.y = -(ob.h + 10) - _i * (canvas.height * 0.15 + 8);
        if (ob.type === 2) { ob.type = 0; ob.w = 28 + Math.random()*16; ob.h = ob.w; }
      }
    }
'@
  $content = $content.Replace($oldPrefillSection, $newPrefillSection.TrimEnd())
  Write-Host "Patch 12 (pre-fill): replaced"
} else {
  Write-Host "WARNING: pre-fill count not found"
}

# ============================================================
# PATCH 13: Add debug overlay function + call it in render
# ============================================================
$debugFn = @'

// ============================================================
// DEVELOPER DEBUG OVERLAY
// Enable via: DIFFICULTY_CONFIG.debugOverlay = true  (in browser console)
// Shows live difficulty stats for tuning without guessing.
// ============================================================
function drawDebugOverlay() {
  const elapsed  = getElapsedPlayTime();
  const ph       = DIFFICULTY_CONFIG.phases[difficultyPhase] || {};
  const spawnInt = getActiveSpawnInterval().toFixed(3);
  const lines    = [
    'Phase: ' + (ph.name || '?') + ' (' + difficultyPhase + ')   t=' + elapsed.toFixed(1) + 's',
    'SpeedMult: ' + speedMultiplier.toFixed(3) + ' / cap=' + DIFFICULTY_CONFIG.speedMultHardCap,
    'SpawnInterval: ' + spawnRate.toFixed(3) + 's raw   active=' + spawnInt + 's',
    'ClusterChance: ' + (currentClusterChance() * 100).toFixed(0) + '%',
    'ForbidInterval: ' + forbiddenInterval.toFixed(2) + 's',
    'Obstacles: ' + obstacles.length + ' / softcap=' + getPhaseMaxObstacles() + ' / hardcap=' + DIFFICULTY_CONFIG.maxObstaclesHardCap,
    'Combo: ' + combo + '  Camp: ' + flowState.campPressure.toFixed(2) + '  DiffBumps: ' + difficultyBumps,
    'Panic: ' + panicPhase + '  DD: ' + ddPhase,
    'Pattern: ' + (typeof _lastPattern !== ' undefined' ? _lastPattern : 'n/a'),
  ];
  ctx.save();
  ctx.font = '11px monospace';
  ctx.textBaseline = 'top';
  const pad = 7;
  const lh  = 15;
  const bw  = 340;
  const bh  = lines.length * lh + pad * 2;
  ctx.fillStyle   = 'rgba(0,0,0,0.76)';
  ctx.fillRect(2, 2, bw, bh);
  ctx.strokeStyle = 'rgba(139,92,246,0.65)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(2, 2, bw, bh);
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#f97316' : i >= 5 ? '#94a3b8' : '#e2e8f0';
    ctx.fillText(line, 2 + pad, 2 + pad + i * lh);
  });
  ctx.restore();
}
'@

# Insert before render function
$renderIdx = $content.IndexOf('function render(ts) {')
if ($renderIdx -ge 0) {
  $content = $content.Insert($renderIdx, $debugFn + "`n")
  Write-Host "Patch 13a (drawDebugOverlay function): inserted"
} else {
  Write-Host "WARNING: render() not found"
}

# Add debug overlay call inside render, before ctx.restore()
$oldRenderEnd = '  ctx.restore();' + "`n" + '}' + "`n`n// ============================================================`n// SECTION 19: GAME LOOP"
$newRenderEnd = '  if (DIFFICULTY_CONFIG.debugOverlay) drawDebugOverlay();' + "`n" + '  ctx.restore();' + "`n" + '}' + "`n`n// ============================================================`n// SECTION 19: GAME LOOP"
if ($content.Contains($oldRenderEnd)) {
  $content = $content.Replace($oldRenderEnd, $newRenderEnd)
  Write-Host "Patch 13b (debug overlay call): replaced"
} else {
  Write-Host "WARNING: render end not found"
}

# ============================================================
# PATCH 14: Add difficultyPhase reset in startGame
# ============================================================
$oldReset = '  spawnTimer = 0; powerupTimer = 0; coinItemTimer = 0; difficultyTimer = 0; difficultyBumps = 0;'
$newReset = '  spawnTimer = 0; powerupTimer = 0; coinItemTimer = 0; difficultyTimer = 0; difficultyBumps = 0; difficultyPhase = 0;'
if ($content.Contains($oldReset)) {
  $content = $content.Replace($oldReset, $newReset)
  Write-Host "Patch 14 (startGame reset): replaced"
} else {
  Write-Host "WARNING: startGame reset line not found"
}

# ============================================================
# SAVE
# ============================================================
$content | Set-Content script.js -Encoding UTF8
Write-Host "`nAll patches done. Line count: $((Get-Content script.js).Count)"
