src = open('script.js', 'r', encoding='utf-8').read()
checks = []

# ── 1. Replace MISSION_DEFS with harder goals + streak missions ───────────────
old_defs = """const MISSION_DEFS = [
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
    description: 'Reach a 15\u00d7 combo in a single run.',
    stat: 'maxCombo',   goal: 15,   coinReward: 40,
  },
];"""

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

assert old_defs in src, 'FAIL: MISSION_DEFS'
src = src.replace(old_defs, new_defs)
checks.append('MISSION_DEFS updated')

# ── 2. Add streak tracking system ─────────────────────────────────────────────
# Insert streak helpers just before loadMissions()
old_load_missions = 'function loadMissions() {'
new_streak_block = '''// ── Daily streak tracking ──────────────────────────────────────────────────
// Stored in settings as: settings.streakLastDate (YYYY-MM-DD), settings.streakCount (int)

function todayDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function updateStreak() {
  const today = todayDateStr();
  const last  = settings.streakLastDate || '';
  if (last === today) return; // already recorded today

  const lastDate = last ? new Date(last) : null;
  const todayDate = new Date(today);
  const diffDays  = lastDate ? Math.round((todayDate - lastDate) / 86400000) : 0;

  if (diffDays === 1) {
    settings.streakCount = (settings.streakCount || 0) + 1; // consecutive day
  } else if (diffDays > 1) {
    settings.streakCount = 1; // streak broken — restart
  } else {
    settings.streakCount = 1; // first ever play
  }
  settings.streakLastDate = today;
  saveSettings();
}

function loadMissions() {'''

assert old_load_missions in src, 'FAIL: loadMissions anchor'
src = src.replace(old_load_missions, new_streak_block, 1)
checks.append('streak tracking added')

# ── 3. Add streakCount / streakLastDate to settings object ────────────────────
old_settings = '''  coins:          0,
  purchasedSkins: [],'''
new_settings = '''  coins:          0,
  purchasedSkins: [],
  streakCount:    0,
  streakLastDate: '','''
assert old_settings in src, 'FAIL: settings object'
src = src.replace(old_settings, new_settings, 1)
checks.append('settings streak fields')

# ── 4. Persist streakCount / streakLastDate in loadSettings ───────────────────
old_coins_load = "    if (typeof s.coins === 'number' && s.coins >= 0) settings.coins = s.coins;"
new_coins_load = ("    if (typeof s.coins === 'number' && s.coins >= 0) settings.coins = s.coins;\n"
                  "    if (typeof s.streakCount === 'number')    settings.streakCount    = s.streakCount;\n"
                  "    if (typeof s.streakLastDate === 'string') settings.streakLastDate = s.streakLastDate;")
assert old_coins_load in src, 'FAIL: loadSettings coins line'
src = src.replace(old_coins_load, new_coins_load)
checks.append('loadSettings streak fields')

# ── 5. Call updateStreak() at game start ─────────────────────────────────────
old_start = '    gameStartTime    = performance.now();'
new_start = '    updateStreak();  // record today\'s play for daily streak\n    gameStartTime    = performance.now();'
assert old_start in src, 'FAIL: gameStartTime anchor'
src = src.replace(old_start, new_start, 1)
checks.append('updateStreak() call in startGame')

# ── 6. Expose streak in missionRun so evaluateMissions can read it ────────────
old_eval_stat = "    if (m.cumulative) {\n      ms.progress += (missionRun[m.stat] || 0);"
new_eval_stat = ("    const statVal = m.stat === 'streak' ? (settings.streakCount || 0) : (missionRun[m.stat] || 0);\n"
                 "    if (m.cumulative) {\n      ms.progress += statVal;")
assert old_eval_stat in src, 'FAIL: evaluateMissions stat read'
src = src.replace(old_eval_stat, new_eval_stat)

old_eval_max = "    } else {\n      ms.progress = Math.max(ms.progress, missionRun[m.stat] || 0);\n    }"
new_eval_max = "    } else {\n      ms.progress = Math.max(ms.progress, statVal);\n    }"
assert old_eval_max in src, 'FAIL: evaluateMissions max'
src = src.replace(old_eval_max, new_eval_max, 1)
checks.append('evaluateMissions streak stat')

# ── 7. updateMissionUI — split active vs completed ───────────────────────────
old_ui = """function updateMissionUI() {
  const list = document.getElementById('missions-list');
  if (!list) return;
  list.innerHTML = '';
  MISSION_DEFS.forEach(m => {
    const done    = isMissionDone(m);
    const claimed = isMissionClaimed(m);
    const locked  = isTierLocked(m.difficulty);
    const prog    = getMissionProgress(m);
    const pct     = Math.min(100, Math.round((prog / m.goal) * 100));
    const prereq  = m.difficulty === 'medium' ? 'Easy' : 'Hard';

    const item = document.createElement('div');
    item.className = 'mission-item' +
      (locked ? ' mission-tier-locked' : done && claimed ? ' mission-done' : done ? ' mission-completed' : '');
    item.dataset.missionId = m.id;

    const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[m.difficulty] || '';
    const diffBadge = '<span class="mission-diff mission-diff-' + (m.difficulty || 'easy') + '">' + diffLabel + '</span>';
    const coinAmt   = m.coinReward || 20;
    const rewardBadge = (done && claimed) || locked ? '' :
      '<span class="mission-reward"><span class="coin-icon coin-sm" aria-hidden="true"></span>' + coinAmt + '</span>';

    let footer;
    if (locked) {
      const unlockTier = m.difficulty === 'medium' ? 'Easy' : 'Medium';
      footer = '<p class="mission-locked-label">🔒 Complete all ' + unlockTier + ' challenges to unlock</p>';
    } else if (done && claimed) {
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
}"""

new_ui = """function buildMissionCard(m) {
  const done    = isMissionDone(m);
  const claimed = isMissionClaimed(m);
  const locked  = isTierLocked(m.difficulty);
  const prog    = getMissionProgress(m);
  const pct     = Math.min(100, Math.round((prog / m.goal) * 100));

  const item = document.createElement('div');
  item.className = 'mission-item' +
    (locked ? ' mission-tier-locked' : done && !claimed ? ' mission-completed' : '');
  item.dataset.missionId = m.id;

  const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[m.difficulty] || '';
  const diffBadge = '<span class="mission-diff mission-diff-' + (m.difficulty || 'easy') + '">' + diffLabel + '</span>';
  const coinAmt   = m.coinReward || 20;
  const rewardBadge = locked ? '' :
    '<span class="mission-reward"><span class="coin-icon coin-sm" aria-hidden="true"></span>' + coinAmt + '</span>';

  let footer;
  if (locked) {
    const unlockTier = m.difficulty === 'medium' ? 'Easy' : 'Medium';
    footer = '<p class="mission-locked-label">🔒 Complete all ' + unlockTier + ' challenges to unlock</p>';
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
  const list      = document.getElementById('missions-list');
  const doneList  = document.getElementById('missions-completed-list');
  const doneWrap  = document.getElementById('missions-completed-section');
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
        '<p class="mission-claimed-label">\u2713 Claimed</p>';
      doneList.appendChild(item);
    });
  }

  // Wire claim buttons after DOM insertion
  list.querySelectorAll('.mission-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => claimMission(btn.dataset.claimId));
  });
}"""

assert old_ui in src, 'FAIL: updateMissionUI'
src = src.replace(old_ui, new_ui)
checks.append('updateMissionUI split active/completed')

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(src)

print('ALL PASS:')
for c in checks:
    print(' ', c)
print(f'Lines: {src.count(chr(10))+1}')
