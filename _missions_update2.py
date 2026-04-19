import re

LOCK_EMOJI = '\U0001F512'  # U+1F512 lock emoji safe construction
CHECKMARK  = '\u2713'

src = open('script.js', 'r', encoding='utf-8').read()
checks = []

# ── 1. Replace MISSION_DEFS ───────────────────────────────────────────────────
old_defs_start = "const MISSION_DEFS = ["
old_defs_end   = "  stat: 'maxCombo',   goal: 15,   coinReward: 40,\n  },\n];"
assert old_defs_start in src,  'FAIL: MISSION_DEFS start'
assert old_defs_end   in src,  'FAIL: MISSION_DEFS end'
start_idx = src.index(old_defs_start)
end_idx   = src.index(old_defs_end) + len(old_defs_end)
old_defs  = src[start_idx:end_idx]

new_defs = """const MISSION_DEFS = [
  // \u2500\u2500 Easy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
    description: 'Play Forbidden Color 3 days in a row.',
    stat: 'streak',     goal: 3,    coinReward: 10,
  },
  // \u2500\u2500 Medium \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
    description: 'Play Forbidden Color 7 days in a row.',
    stat: 'streak',     goal: 7,    coinReward: 20,
  },
  // \u2500\u2500 Hard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
    description: 'Reach a 20\u00d7 combo in a single run.',
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
    description: 'Play Forbidden Color 30 days in a row.',
    stat: 'streak',     goal: 30,   coinReward: 40,
  },
];"""

src = src[:start_idx] + new_defs + src[end_idx:]
checks.append('MISSION_DEFS replaced')

# ── 2. Add streak fields to settings object ───────────────────────────────────
old_s = '  coins:          0,\n  purchasedSkins: [],'
new_s = '  coins:          0,\n  purchasedSkins: [],\n  streakCount:    0,\n  streakLastDate: \'\','
assert old_s in src, 'FAIL: settings fields'
src = src.replace(old_s, new_s, 1)
checks.append('settings streak fields')

# ── 3. Add streak tracking helpers + inject before loadMissions ───────────────
streak_helpers = (
    '// \u2500\u2500 Daily streak tracking \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    'function todayDateStr() {\n'
    '  const d = new Date();\n'
    '  return d.getFullYear() + \'-\' + String(d.getMonth() + 1).padStart(2, \'0\') + \'-\' + String(d.getDate()).padStart(2, \'0\');\n'
    '}\n\n'
    'function updateStreak() {\n'
    '  const today = todayDateStr();\n'
    '  if (settings.streakLastDate === today) return;\n'
    '  const lastDate  = settings.streakLastDate ? new Date(settings.streakLastDate) : null;\n'
    '  const todayDate = new Date(today);\n'
    '  const diffDays  = lastDate ? Math.round((todayDate - lastDate) / 86400000) : 0;\n'
    '  if (diffDays === 1) {\n'
    '    settings.streakCount = (settings.streakCount || 0) + 1;\n'
    '  } else {\n'
    '    settings.streakCount = 1;\n'
    '  }\n'
    '  settings.streakLastDate = today;\n'
    '  saveSettings();\n'
    '}\n\n'
    'function loadMissions() {'
)
old_lm = 'function loadMissions() {'
assert old_lm in src, 'FAIL: loadMissions anchor'
src = src.replace(old_lm, streak_helpers, 1)
checks.append('streak helpers added')

# ── 4. Persist streak in loadSettings ────────────────────────────────────────
old_coins_load = "    if (typeof s.coins === 'number' && s.coins >= 0) settings.coins = s.coins;"
new_coins_load = (
    "    if (typeof s.coins === 'number' && s.coins >= 0) settings.coins = s.coins;\n"
    "    if (typeof s.streakCount === 'number')    settings.streakCount    = s.streakCount;\n"
    "    if (typeof s.streakLastDate === 'string') settings.streakLastDate = s.streakLastDate;"
)
assert old_coins_load in src, 'FAIL: loadSettings coins line'
src = src.replace(old_coins_load, new_coins_load)
checks.append('loadSettings streak persist')

# ── 5. Call updateStreak() at game start (once per session before startGame) ──
old_start = '    gameStartTime    = performance.now();'
new_start = '    updateStreak();  // record today\'s play for daily streak\n    gameStartTime    = performance.now();'
assert old_start in src, 'FAIL: gameStartTime anchor'
src = src.replace(old_start, new_start, 1)
checks.append('updateStreak() call')

# ── 6. evaluateMissions — read streak from settings not missionRun ────────────
old_ev1 = "    if (m.cumulative) {\n      ms.progress += (missionRun[m.stat] || 0);"
new_ev1 = (
    "    const statVal = m.stat === 'streak' ? (settings.streakCount || 0) : (missionRun[m.stat] || 0);\n"
    "    if (m.cumulative) {\n      ms.progress += statVal;"
)
assert old_ev1 in src, 'FAIL: evaluateMissions cumulative'
src = src.replace(old_ev1, new_ev1)

old_ev2 = "    } else {\n      ms.progress = Math.max(ms.progress, missionRun[m.stat] || 0);\n    }"
new_ev2 = "    } else {\n      ms.progress = Math.max(ms.progress, statVal);\n    }"
assert old_ev2 in src, 'FAIL: evaluateMissions max'
src = src.replace(old_ev2, new_ev2, 1)
checks.append('evaluateMissions streak stat')

# ── 7. Replace updateMissionUI to split active vs completed ──────────────────
old_ui_start = 'function updateMissionUI() {'
old_ui_end   = "    btn.addEventListener('click', () => claimMission(btn.dataset.claimId));\n  });\n}"
assert old_ui_start in src, 'FAIL: updateMissionUI start'
assert old_ui_end   in src, 'FAIL: updateMissionUI end'
ui_start = src.index(old_ui_start)
ui_end   = src.index(old_ui_end) + len(old_ui_end)

lock_label = LOCK_EMOJI + ' Complete all \' + unlockTier + \' challenges to unlock'

new_ui = (
    'function buildMissionCard(m) {\n'
    '  const done    = isMissionDone(m);\n'
    '  const claimed = isMissionClaimed(m);\n'
    '  const locked  = isTierLocked(m.difficulty);\n'
    '  const prog    = getMissionProgress(m);\n'
    '  const pct     = Math.min(100, Math.round((prog / m.goal) * 100));\n'
    '\n'
    '  const item = document.createElement(\'div\');\n'
    '  item.className = \'mission-item\' +\n'
    '    (locked ? \' mission-tier-locked\' : done ? \' mission-completed\' : \'\');\n'
    '  item.dataset.missionId = m.id;\n'
    '\n'
    '  const diffLabel = { easy: \'Easy\', medium: \'Medium\', hard: \'Hard\' }[m.difficulty] || \'\';\n'
    '  const diffBadge = \'<span class="mission-diff mission-diff-\' + (m.difficulty || \'easy\') + \'">\' + diffLabel + \'</span>\';\n'
    '  const coinAmt   = m.coinReward || 20;\n'
    '  const rewardBadge = locked ? \'\' :\n'
    '    \'<span class="mission-reward"><span class="coin-icon coin-sm" aria-hidden="true"></span>\' + coinAmt + \'</span>\';\n'
    '\n'
    '  let footer;\n'
    '  if (locked) {\n'
    '    const unlockTier = m.difficulty === \'medium\' ? \'Easy\' : \'Medium\';\n'
    '    footer = \'<p class="mission-locked-label">' + lock_label + '</p>\';\n'
    '  } else if (done) {\n'
    '    footer = \'<button class="mission-claim-btn" data-claim-id="\' + m.id + \'" \' +\n'
    '      \'aria-label="Claim \' + coinAmt + \' coins for \' + m.label + \'">\' +\n'
    '      \'Claim</button>\';\n'
    '  } else {\n'
    '    footer = \'<div class="mission-footer">\' +\n'
    '      \'<span class="mission-progress">\' + Math.min(prog, m.goal) + \' / \' + m.goal + \'</span>\' +\n'
    '      \'<div class="mission-bar-track" aria-hidden="true"><div class="mission-bar-fill" style="width:\' + pct + \'%"></div></div>\' +\n'
    '      \'</div>\';\n'
    '  }\n'
    '\n'
    '  item.innerHTML =\n'
    '    \'<div class="mission-row">\' +\n'
    '      \'<span class="mission-label">\' + m.label + \'</span>\' +\n'
    '      \'<span class="mission-meta">\' + rewardBadge + diffBadge + \'</span>\' +\n'
    '    \'</div>\' +\n'
    '    \'<p class="mission-desc">\' + m.description + \'</p>\' +\n'
    '    footer;\n'
    '\n'
    '  return item;\n'
    '}\n'
    '\n'
    'function updateMissionUI() {\n'
    '  const list     = document.getElementById(\'missions-list\');\n'
    '  const doneList = document.getElementById(\'missions-completed-list\');\n'
    '  const doneWrap = document.getElementById(\'missions-completed-section\');\n'
    '  if (!list) return;\n'
    '\n'
    '  list.innerHTML = \'\';\n'
    '  const completedItems = [];\n'
    '\n'
    '  MISSION_DEFS.forEach(m => {\n'
    '    if (isMissionClaimed(m)) {\n'
    '      completedItems.push(m);\n'
    '    } else {\n'
    '      list.appendChild(buildMissionCard(m));\n'
    '    }\n'
    '  });\n'
    '\n'
    '  // Completed section\n'
    '  if (doneList && doneWrap) {\n'
    '    doneList.innerHTML = \'\';\n'
    '    doneWrap.hidden = completedItems.length === 0;\n'
    '    completedItems.forEach(m => {\n'
    '      const item = document.createElement(\'div\');\n'
    '      item.className = \'mission-item mission-done\';\n'
    '      const diffLabel = { easy: \'Easy\', medium: \'Medium\', hard: \'Hard\' }[m.difficulty] || \'\';\n'
    '      item.innerHTML =\n'
    '        \'<div class="mission-row">\' +\n'
    '          \'<span class="mission-label">\' + m.label + \'</span>\' +\n'
    '          \'<span class="mission-meta">\' +\n'
    '            \'<span class="mission-diff mission-diff-\' + m.difficulty + \'">\' + diffLabel + \'</span>\' +\n'
    '          \'</span>\' +\n'
    '        \'</div>\' +\n'
    '        \'<p class="mission-desc">\' + m.description + \'</p>\' +\n'
    '        \'<p class="mission-claimed-label">\u2713 Claimed</p>\';\n'
    '      doneList.appendChild(item);\n'
    '    });\n'
    '  }\n'
    '\n'
    '  // Wire claim buttons after DOM insertion\n'
    '  list.querySelectorAll(\'.mission-claim-btn\').forEach(btn => {\n'
    '    btn.addEventListener(\'click\', () => claimMission(btn.dataset.claimId));\n'
    '  });\n'
    '}'
)

src = src[:ui_start] + new_ui + src[ui_end:]
checks.append('updateMissionUI split active/completed')

# ── Safety check: no surrogates ──────────────────────────────────────────────
for i, ch in enumerate(src):
    cp = ord(ch)
    if 0xD800 <= cp <= 0xDFFF:
        raise ValueError(f'Surrogate U+{cp:04X} at char {i}')

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(src)

print('ALL PASS:')
for c in checks:
    print(' ', c)
print(f'Lines: {src.count(chr(10))+1}')
