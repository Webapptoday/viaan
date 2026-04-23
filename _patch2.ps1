$ErrorActionPreference = 'Continue'
$text = [System.IO.File]::ReadAllText('script.js', [System.Text.Encoding]::UTF8)
$crlf = [char]13 + [char]10
$n = $crlf  # shorthand

function rep($old, $new) {
  if ($text.Contains($old)) {
    $script:text = $script:text.Replace($old, $new)
    return $true
  }
  return $false
}

# ============================================================
# PATCH 5: Replace panicSpawnRate + panicSpeedMult functions
# ============================================================
$oldPanic = 'function panicSpawnRate() {' + $n +
  '  return panicPhase === ' + [char]39 + 'wave' + [char]39 + ' ? spawnRate * 0.34 : spawnRate; // ~3' + [char]0xc3 + [char]0x97 + ' faster during wave' + $n +
  '}'
Write-Host "panicSpawnRate exact: $($text.Contains($oldPanic))"

# Try without the encoding artifact
$oldPanic2 = 'function panicSpawnRate() {' + $n + '  return panicPhase === '
$idx = $text.IndexOf($oldPanic2)
Write-Host "panicSpawnRate index: $idx"
if ($idx -ge 0) {
  $endIdx = $text.IndexOf('}', $idx + 30) + 1
  $oldSection = $text.Substring($idx, $endIdx - $idx)
  Write-Host "Old panicSpawnRate: [$oldSection]"
}

# Replace panicSpawnRate
$panicStart = $text.IndexOf('function panicSpawnRate() {')
if ($panicStart -ge 0) {
  $panicEnd1 = $text.IndexOf('}', $panicStart) + 1
  $old5a = $text.Substring($panicStart, $panicEnd1 - $panicStart)
  $new5a = 'function panicSpawnRate() {' + $n +
    '  // Was: spawnRate * 0.34 (~3x faster). Now 60% of normal — still urgent but not insane.' + $n +
    '  return panicPhase === ' + [char]39 + 'wave' + [char]39 + ' ? spawnRate * DIFFICULTY_CONFIG.panicSpawnMult : spawnRate;' + $n +
    '}'
  $text = $text.Replace($old5a, $new5a)
  Write-Host "Patch 5a (panicSpawnRate): replaced"
}

# Replace panicSpeedMult
$pmIdx = $text.IndexOf('function panicSpeedMult() {')
if ($pmIdx -ge 0) {
  $pmEnd = $text.IndexOf('}', $pmIdx) + 1
  $old5b = $text.Substring($pmIdx, $pmEnd - $pmIdx)
  $new5b = 'function panicSpeedMult() {' + $n +
    '  // Was: 1.32 — now 1.14. Less extreme multiplier on already-high base speed.' + $n +
    '  return panicPhase === ' + [char]39 + 'wave' + [char]39 + ' ? DIFFICULTY_CONFIG.panicSpeedBonus : 1.0;' + $n +
    '}'
  $text = $text.Replace($old5b, $new5b)
  Write-Host "Patch 5b (panicSpeedMult): replaced"
}

# ============================================================
# PATCH 6a: Replace activeForbiddenRatio
# ============================================================
$afrIdx = $text.IndexOf('function activeForbiddenRatio() {')
if ($afrIdx -ge 0) {
  $afrEnd = $text.IndexOf('}', $afrIdx) + 1
  $oldAfr = $text.Substring($afrIdx, $afrEnd - $afrIdx)
  $newAfr = 'function activeForbiddenRatio() {' + $n +
    '  if (panicPhase === ' + [char]39 + 'wave' + [char]39 + ') return 0.72;' + $n +
    '  return Math.min(0.58 + difficultyBumps * 0.012, 0.68);' + $n +
    '}'
  $text = $text.Replace($oldAfr, $newAfr)
  Write-Host "Patch 6a (activeForbiddenRatio): replaced"
}

# ============================================================
# PATCH 6b: Replace currentClusterChance
# ============================================================
$cccIdx = $text.IndexOf('function currentClusterChance() {')
if ($cccIdx -ge 0) {
  $cccEnd = $text.IndexOf('}', $cccIdx) + 1
  $oldCcc = $text.Substring($cccIdx, $cccEnd - $cccIdx)
  $newCcc = 'function currentClusterChance() {' + $n +
    '  // Phase-driven cluster chance — replaces old fixed-ramp difficultyBumps formula' + $n +
    '  const elapsed = getElapsedPlayTime();' + $n +
    '  const base    = lerpDiff(elapsed, ' + [char]39 + 'cc' + [char]39 + ');' + $n +
    '  return Math.min(base + Math.min(graceTimer, 6) * 0.006, 0.76);' + $n +
    '}'
  $text = $text.Replace($oldCcc, $newCcc)
  Write-Host "Patch 6b (currentClusterChance): replaced"
}

# ============================================================
# PATCH 7: Inject helper functions before tickDifficulty
# ============================================================
$helpers = '// --- Phase-aware difficulty helpers (added v47) ---' + $n +
  $n +
  'function getElapsedPlayTime() {' + $n +
  '  if (gameStartTime <= 0) return 0;' + $n +
  '  return Math.max(0, (performance.now() - gameStartTime - pausedDuration) / 1000);' + $n +
  '}' + $n +
  $n +
  'function getDiffPhase(elapsed) {' + $n +
  '  const phases = DIFFICULTY_CONFIG.phases;' + $n +
  '  for (let i = 0; i < phases.length - 1; i++) {' + $n +
  '    if (elapsed < phases[i].endAt) return i;' + $n +
  '  }' + $n +
  '  return phases.length - 1;' + $n +
  '}' + $n +
  $n +
  'function lerpDiff(elapsed, key) {' + $n +
  '  const phases = DIFFICULTY_CONFIG.phases;' + $n +
  '  const pi     = getDiffPhase(elapsed);' + $n +
  '  if (pi === 0) return phases[0][key];' + $n +
  '  const prev   = phases[pi - 1];' + $n +
  '  const cur    = phases[pi];' + $n +
  '  const t      = Math.min(1, (elapsed - prev.endAt) / DIFFICULTY_CONFIG.blendWindow);' + $n +
  '  const ease   = t * t * (3 - 2 * t);' + $n +
  '  return prev[key] + (cur[key] - prev[key]) * ease;' + $n +
  '}' + $n +
  $n +
  'function getPhaseMaxObstacles() {' + $n +
  '  const elapsed = getElapsedPlayTime();' + $n +
  '  return Math.min(Math.round(lerpDiff(elapsed, ' + [char]39 + 'mo' + [char]39 + ')), DIFFICULTY_CONFIG.maxObstaclesHardCap);' + $n +
  '}' + $n +
  $n +
  'function selectSpawnPattern() {' + $n +
  '  const elapsed  = getElapsedPlayTime();' + $n +
  '  const phaseIdx = getDiffPhase(elapsed);' + $n +
  '  let total = 0;' + $n +
  '  for (const p of PATTERN_LIBRARY) total += (p.phaseWeights[phaseIdx] || 0);' + $n +
  '  if (total <= 0) return ' + [char]39 + 'STAGGER' + [char]39 + ';' + $n +
  '  let r = Math.random() * total;' + $n +
  '  for (const p of PATTERN_LIBRARY) {' + $n +
  '    r -= (p.phaseWeights[phaseIdx] || 0);' + $n +
  '    if (r <= 0) return p.id;' + $n +
  '  }' + $n +
  '  return PATTERN_LIBRARY[0].id;' + $n +
  '}' + $n +
  $n

$tdIdx = $text.IndexOf('function tickDifficulty(dt) {')
if ($tdIdx -ge 0) {
  $text = $text.Insert($tdIdx, $helpers)
  Write-Host "Patch 7a (helper functions): inserted before tickDifficulty"
} else {
  Write-Host "WARNING: tickDifficulty not found"
}

# ============================================================
# PATCH 7b: Replace tickDifficulty body
# ============================================================
$tdIdx = $text.IndexOf('function tickDifficulty(dt) {')
if ($tdIdx -ge 0) {
  # Find the end: look for closing } followed by blank line + SECTION comment
  $searchFrom = $tdIdx + 30
  $braceDepth = 0
  $funcEnd = -1
  for ($i = $tdIdx; $i -lt $text.Length; $i++) {
    if ($text[$i] -eq '{') { $braceDepth++ }
    elseif ($text[$i] -eq '}') {
      $braceDepth--
      if ($braceDepth -eq 0) { $funcEnd = $i + 1; break }
    }
  }
  if ($funcEnd -gt 0) {
    $oldTD = $text.Substring($tdIdx, $funcEnd - $tdIdx)
    Write-Host "Old tickDifficulty length: $($oldTD.Length)"
    $newTD = 'function tickDifficulty(dt) {' + $n +
      '  // Smooth phase-based difficulty. No more sudden bumps every 6 seconds.' + $n +
      '  const elapsed    = getElapsedPlayTime();' + $n +
      '  const prevPhase  = difficultyPhase;' + $n +
      '  difficultyPhase  = getDiffPhase(elapsed);' + $n +
      $n +
      '  const newSpeedMult = Math.min(lerpDiff(elapsed, ' + [char]39 + 'spd' + [char]39 + '), DIFFICULTY_CONFIG.speedMultHardCap);' + $n +
      '  const newSpawnRate = Math.max(lerpDiff(elapsed, ' + [char]39 + 'si' + [char]39 + '),  DIFFICULTY_CONFIG.spawnIntervalFloor);' + $n +
      $n +
      '  // Rescale on-screen obstacles when speed increases' + $n +
      '  if (newSpeedMult > speedMultiplier && speedMultiplier > 0) {' + $n +
      '    const ratio  = newSpeedMult / speedMultiplier;' + $n +
      '    const isSlow = activePowerupKey === ' + [char]39 + 'SLOW' + [char]39 + ';' + $n +
      '    obstacles.forEach(o => {' + $n +
      '      o.baseVy *= ratio;' + $n +
      '      o.vy      = isSlow ? o.baseVy * 0.4 : o.baseVy;' + $n +
      '    });' + $n +
      '  }' + $n +
      $n +
      '  speedMultiplier   = newSpeedMult;' + $n +
      '  spawnRate         = newSpawnRate;' + $n +
      '  forbiddenInterval = lerpDiff(elapsed, ' + [char]39 + 'fi' + [char]39 + ');' + $n +
      $n +
      '  // Legacy counter used by lane-selection helpers (0-12 range over 84s arc)' + $n +
      '  difficultyBumps = Math.min(12, Math.round(elapsed / 7));' + $n +
      $n +
      '  // Phase transition announcement' + $n +
      '  if (difficultyPhase !== prevPhase && difficultyPhase > 0 && !settings.reducedMotion) {' + $n +
      '    const label = DIFFICULTY_CONFIG.phases[difficultyPhase].name;' + $n +
      '    addFloating(canvas.width / 2, canvas.height / 3, ' + [char]39 + '\u26a1 ' + [char]39 + ' + label, ' + [char]39 + '#f97316' + [char]39 + ', 20);' + $n +
      '  }' + $n +
      $n +
      '  Music.setTempo(speedMultiplier);' + $n +
      '}'
    $text = $text.Replace($oldTD, $newTD)
    Write-Host "Patch 7b (tickDifficulty body): replaced"
  }
}

# ============================================================
# PATCH 8: spawnObstacle — fix speed cases (case 3, case 4)
# ============================================================
$old3 = '    case 3: w = 14 + Math.random()*10;  h = 52 + Math.random()*28;     vy = base*1.55 + Math.random()*85;  break;'
$new3 = '    case 3: w = 14 + Math.random()*10;  h = 52 + Math.random()*28;     vy = base * DIFFICULTY_CONFIG.typeSpeedMults[3] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[3]; break;'
if (rep $old3 $new3) { Write-Host "Patch 8a (case 3 speed): replaced" } else { Write-Host "WARNING: case 3 not found" }

$old4 = '    case 4: w = 12 + Math.random()*8;   h = 12 + Math.random()*8;      vy = base*1.85 + Math.random()*100; break;'
$new4 = '    case 4: w = 12 + Math.random()*8;   h = 12 + Math.random()*8;      vy = base * DIFFICULTY_CONFIG.typeSpeedMults[4] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[4]; break;'
if (rep $old4 $new4) { Write-Host "Patch 8b (case 4 speed): replaced" } else { Write-Host "WARNING: case 4 not found" }

# Fix case 0 and 2 as well
$old0 = '    case 0: w = 28 + Math.random()*16;  h = w;                         vy = base + Math.random()*80;       break;'
$new0 = '    case 0: w = 28 + Math.random()*16;  h = w;                         vy = base * DIFFICULTY_CONFIG.typeSpeedMults[0] + Math.random() * DIFFICULTY_CONFIG.typeSpeedRand[0]; break;'
if (rep $old0 $new0) { Write-Host "Patch 8c (case 0 speed): replaced" } else { Write-Host "NOTE: case 0 not found with exact string" }

# ============================================================
# PATCH 9: spawnObstacle MAX_OBSTACLES -> getPhaseMaxObstacles()
# ============================================================
$oldSpawnCheck = 'function spawnObstacle() {' + $n + '  if (obstacles.length >= MAX_OBSTACLES) return;'
$newSpawnCheck = 'function spawnObstacle() {' + $n + '  if (obstacles.length >= getPhaseMaxObstacles()) return;'
if (rep $oldSpawnCheck $newSpawnCheck) { Write-Host "Patch 9 (spawnObstacle cap): replaced" } else { Write-Host "WARNING: spawnObstacle MAX_OBSTACLES not found" }

# ============================================================
# PATCH 10a: spawnWave MAX_OBSTACLES -> getPhaseMaxObstacles()
# ============================================================
$oldWaveCheck = 'function spawnWave() {' + $n + '  if (obstacles.length >= MAX_OBSTACLES) return;'
$newWaveCheck = 'function spawnWave() {' + $n + '  if (obstacles.length >= getPhaseMaxObstacles()) return;'
if (rep $oldWaveCheck $newWaveCheck) { Write-Host "Patch 10a (spawnWave cap): replaced" } else { Write-Host "WARNING: spawnWave MAX_OBSTACLES not found" }

# ============================================================
# PATCH 10b: spawnWave speed formula
# ============================================================
$oldWaveSpd = '    const speedScale = wType === 4 ? 1.65 : (wType === 3 ? 1.35 : (wType === 2 ? 0.62 : 1.0));' + $n +
  '    const vyR = base * speedScale + Math.random() * 70;'
$newWaveSpd = '    const speedScale = DIFFICULTY_CONFIG.typeSpeedMults[wType] ?? 1.0;' + $n +
  '    const speedRandV = DIFFICULTY_CONFIG.typeSpeedRand[wType] ?? 28;' + $n +
  '    const vyR = base * speedScale + Math.random() * speedRandV;'
if (rep $oldWaveSpd $newWaveSpd) { Write-Host "Patch 10b (spawnWave speed): replaced" } else { Write-Host "WARNING: spawnWave speedScale not found" }

# ============================================================
# PATCH 10c: Add pattern selection in spawnWave before buildWavePlan
# ============================================================
$oldBuild = '  const playerLane = getPlayerLane();' + $n +
  '  observePlayerLaneForSpawn(playerLane);' + $n +
  '  const plan = buildWavePlan(lanes, playerLane, lw, postGrace);'
$newBuild = '  const playerLane = getPlayerLane();' + $n +
  '  observePlayerLaneForSpawn(playerLane);' + $n +
  $n +
  '  // Pattern-based safe lane selection' + $n +
  '  const patternId  = selectSpawnPattern();' + $n +
  '  const midLane    = Math.floor(NUM_LANES / 2);' + $n +
  '  let   safeLaneHint = -1;' + $n +
  '  if (patternId === ' + [char]39 + 'CENTER_PUSH' + [char]39 + ') {' + $n +
  '    safeLaneHint = Math.random() < 0.5 ? 0 : NUM_LANES - 1;' + $n +
  '  } else if (patternId === ' + [char]39 + 'SIDE_PUSH' + [char]39 + ' || patternId === ' + [char]39 + 'PINCER' + [char]39 + ') {' + $n +
  '    safeLaneHint = Math.max(1, Math.min(NUM_LANES - 2, midLane + (Math.random() < 0.5 ? 0 : -1)));' + $n +
  '  } else if (patternId === ' + [char]39 + 'HALF_FILL' + [char]39 + ') {' + $n +
  '    safeLaneHint = playerLane <= midLane ? NUM_LANES - 1 : 0;' + $n +
  '  }' + $n +
  '  const plan = buildWavePlan(lanes, playerLane, lw, postGrace, safeLaneHint);'
if (rep $oldBuild $newBuild) { Write-Host "Patch 10c (spawnWave pattern): replaced" } else { Write-Host "WARNING: spawnWave buildWavePlan call not found" }

# ============================================================
# PATCH 11: Update buildWavePlan signature
# ============================================================
$oldBWP = 'function buildWavePlan(laneCenters, playerLane, laneW, postGrace) {'
$newBWP = 'function buildWavePlan(laneCenters, playerLane, laneW, postGrace, safeLaneHint) {' + $n +
  '  // If a pattern hint is provided, try that safe lane first' + $n +
  '  if (safeLaneHint !== undefined && safeLaneHint >= 0) {' + $n +
  '    const blocked = pickBlockedLanes(safeLaneHint, playerLane);' + $n +
  '    if (!postGrace || validateEscapeRoute(laneCenters, blocked, laneW)) {' + $n +
  '      return { safeLane: safeLaneHint, blocked };' + $n +
  '    }' + $n +
  '  }'
if (rep $oldBWP $newBWP) { Write-Host "Patch 11 (buildWavePlan): replaced" } else { Write-Host "WARNING: buildWavePlan not found" }

# ============================================================
# PATCH 12: Reduce pre-fill count from 24 to 8
# ============================================================
$prefillIdx = $text.IndexOf('    const preCount = 24;')
if ($prefillIdx -ge 0) {
  # Find the entire for loop block
  $loopStart = $prefillIdx
  $braceCount = 0
  $loopEnd = -1
  $seenBrace = $false
  for ($i = $loopStart; $i -lt $text.Length; $i++) {
    if ($text[$i] -eq '{') { $braceCount++; $seenBrace = $true }
    elseif ($text[$i] -eq '}') {
      $braceCount--
      if ($seenBrace -and $braceCount -eq 0) { $loopEnd = $i + 1; break }
    }
  }
  $oldPre = $text.Substring($loopStart, $loopEnd - $loopStart)
  Write-Host "Old pre-fill snippet: $($oldPre.Substring(0, [Math]::Min(80, $oldPre.Length)))"
  $newPre = '    const preCount = 8;  // was 24 -- gentle opening so the first 2s are readable' + $n +
    '    for (let _i = 0; _i < preCount; _i++) {' + $n +
    '      spawnObstacle();' + $n +
    '      if (obstacles.length > 0) {' + $n +
    '        const ob = obstacles[obstacles.length - 1];' + $n +
    '        // Wider stagger -- blocks arrive gradually, not all at once' + $n +
    '        ob.y = -(ob.h + 10) - _i * (canvas.height * 0.15 + 8);' + $n +
    '        if (ob.type === 2) { ob.type = 0; ob.w = 28 + Math.random()*16; ob.h = ob.w; }' + $n +
    '      }' + $n +
    '    }'
  $text = $text.Replace($oldPre, $newPre)
  Write-Host "Patch 12 (pre-fill): replaced"
} else {
  Write-Host "WARNING: pre-fill count not found"
}

# ============================================================
# PATCH 13: Add drawDebugOverlay function + call in render
# ============================================================
$debugFn = $n +
  '// --- Developer debug overlay (DIFFICULTY_CONFIG.debugOverlay = true to enable) ---' + $n +
  'function drawDebugOverlay() {' + $n +
  '  const elapsed  = getElapsedPlayTime();' + $n +
  '  const ph       = DIFFICULTY_CONFIG.phases[difficultyPhase] || {};' + $n +
  '  const lines    = [' + $n +
  '    ' + [char]39 + 'Phase: ' + [char]39 + ' + (ph.name||' + [char]39 + '?' + [char]39 + ') + ' + [char]39 + ' (' + [char]39 + ' + difficultyPhase + ' + [char]39 + ')  t=' + [char]39 + ' + elapsed.toFixed(1) + ' + [char]39 + 's' + [char]39 + ',' + $n +
  '    ' + [char]39 + 'SpeedMult: ' + [char]39 + ' + speedMultiplier.toFixed(3) + ' + [char]39 + ' / cap=' + [char]39 + ' + DIFFICULTY_CONFIG.speedMultHardCap,' + $n +
  '    ' + [char]39 + 'SpawnRate: ' + [char]39 + ' + spawnRate.toFixed(3) + ' + [char]39 + 's raw  active=' + [char]39 + ' + getActiveSpawnInterval().toFixed(3) + ' + [char]39 + 's' + [char]39 + ',' + $n +
  '    ' + [char]39 + 'ClusterChance: ' + [char]39 + ' + (currentClusterChance()*100).toFixed(0) + ' + [char]39 + '%' + [char]39 + ',' + $n +
  '    ' + [char]39 + 'ForbidInterval: ' + [char]39 + ' + forbiddenInterval.toFixed(2) + ' + [char]39 + 's' + [char]39 + ',' + $n +
  '    ' + [char]39 + 'Obstacles: ' + [char]39 + ' + obstacles.length + ' + [char]39 + ' / soft=' + [char]39 + ' + getPhaseMaxObstacles() + ' + [char]39 + ' / hard=' + [char]39 + ' + DIFFICULTY_CONFIG.maxObstaclesHardCap,' + $n +
  '    ' + [char]39 + 'Combo: ' + [char]39 + ' + combo + ' + [char]39 + '  Camp: ' + [char]39 + ' + flowState.campPressure.toFixed(2) + ' + [char]39 + '  DiffBumps: ' + [char]39 + ' + difficultyBumps,' + $n +
  '    ' + [char]39 + 'Panic: ' + [char]39 + ' + panicPhase + ' + [char]39 + '  DD: ' + [char]39 + ' + ddPhase,' + $n +
  '  ];' + $n +
  '  ctx.save();' + $n +
  '  ctx.font = ' + [char]39 + '11px monospace' + [char]39 + ';' + $n +
  '  ctx.textBaseline = ' + [char]39 + 'top' + [char]39 + ';' + $n +
  '  const pad=7, lh=15, bw=340, bh=lines.length*lh+pad*2;' + $n +
  '  ctx.fillStyle = ' + [char]39 + 'rgba(0,0,0,0.78)' + [char]39 + ';' + $n +
  '  ctx.fillRect(2, 2, bw, bh);' + $n +
  '  ctx.strokeStyle = ' + [char]39 + 'rgba(139,92,246,0.65)' + [char]39 + ';' + $n +
  '  ctx.lineWidth = 1;' + $n +
  '  ctx.strokeRect(2, 2, bw, bh);' + $n +
  '  lines.forEach((line, i) => {' + $n +
  '    ctx.fillStyle = i === 0 ? ' + [char]39 + '#f97316' + [char]39 + ' : i >= 5 ? ' + [char]39 + '#94a3b8' + [char]39 + ' : ' + [char]39 + '#e2e8f0' + [char]39 + ';' + $n +
  '    ctx.fillText(line, 2 + pad, 2 + pad + i * lh);' + $n +
  '  });' + $n +
  '  ctx.restore();' + $n +
  '}' + $n + $n

$renderIdx = $text.IndexOf('function render(ts) {')
if ($renderIdx -ge 0) {
  $text = $text.Insert($renderIdx, $debugFn)
  Write-Host "Patch 13a (drawDebugOverlay fn): inserted"
} else {
  Write-Host "WARNING: render(ts) not found"
}

# Add debug overlay call in render body before final ctx.restore()
# Find the render function and its last ctx.restore()
$renderStart = $text.IndexOf('function render(ts) {')
if ($renderStart -ge 0) {
  # Find the closing brace of render by brace counting
  $bd = 0
  $renderEnd = -1
  for ($i = $renderStart; $i -lt $text.Length; $i++) {
    if ($text[$i] -eq '{') { $bd++ }
    elseif ($text[$i] -eq '}') { $bd--; if ($bd -eq 0) { $renderEnd = $i + 1; break } }
  }
  if ($renderEnd -gt 0) {
    $renderBody = $text.Substring($renderStart, $renderEnd - $renderStart)
    # Find the last ctx.restore() before the closing brace
    $lastRestore = $renderBody.LastIndexOf('  ctx.restore();')
    if ($lastRestore -ge 0) {
      $insertAt = $renderStart + $lastRestore
      $text = $text.Insert($insertAt, '  if (DIFFICULTY_CONFIG.debugOverlay) drawDebugOverlay();' + $n)
      Write-Host "Patch 13b (debug overlay call): inserted"
    }
  }
}

# ============================================================
# SAVE
# ============================================================
[System.IO.File]::WriteAllText('script.js', $text, [System.Text.Encoding]::UTF8)
$lineCount = (Get-Content 'script.js').Count
Write-Host "`nAll patches applied. Lines: $lineCount"
Write-Host "Verify key changes:"
Write-Host "  DIFFICULTY_CONFIG: $($text.Contains('const DIFFICULTY_CONFIG'))"
Write-Host "  PATTERN_LIBRARY: $($text.Contains('const PATTERN_LIBRARY'))"
Write-Host "  difficultyPhase var: $($text.Contains('difficultyPhase   = 0'))"
Write-Host "  getElapsedPlayTime: $($text.Contains('function getElapsedPlayTime'))"
Write-Host "  getDiffPhase: $($text.Contains('function getDiffPhase'))"
Write-Host "  lerpDiff: $($text.Contains('function lerpDiff'))"
Write-Host "  getPhaseMaxObstacles: $($text.Contains('function getPhaseMaxObstacles'))"
Write-Host "  selectSpawnPattern: $($text.Contains('function selectSpawnPattern'))"
Write-Host "  drawDebugOverlay: $($text.Contains('function drawDebugOverlay'))"
Write-Host "  tickDifficulty rewritten: $($text.Contains('getElapsedPlayTime()') -and $text.Contains('function tickDifficulty'))"
Write-Host "  panicSpawnMult used: $($text.Contains('DIFFICULTY_CONFIG.panicSpawnMult'))"
Write-Host "  typeSpeedMults used: $($text.Contains('DIFFICULTY_CONFIG.typeSpeedMults'))"
Write-Host "  spawnInterval floor: $($text.Contains('DIFFICULTY_CONFIG.spawnIntervalFloor'))"
Write-Host "  buildWavePlan hint: $($text.Contains('safeLaneHint'))"
Write-Host "  preCount 8: $($text.Contains('preCount = 8'))"
