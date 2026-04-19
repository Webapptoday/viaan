import sys

with open('script.js', 'r', encoding='utf-8') as f:
    src = f.read()

orig = src
checks = []

# 1. COIN_ITEM_INTERVAL: 4.5 -> 6.0
old = 'const COIN_ITEM_INTERVAL  = 4.5;  // s between coin pickup spawns'
new = 'const COIN_ITEM_INTERVAL  = 6.0;  // s between coin pickup spawns'
assert old in src, 'FAIL: COIN_ITEM_INTERVAL'
src = src.replace(old, new); checks.append('COIN_ITEM_INTERVAL')

# 2. Coin item value: 1-3 -> 1-2
old = '    value: 1 + Math.floor(Math.random() * 3), // 1\u20133 coins'
new = '    value: 1 + Math.floor(Math.random() * 2), // 1\u20132 coins'
assert old in src, 'FAIL: coin value'
src = src.replace(old, new); checks.append('coin item value')

# 3. awardRunCoins earn rates
old = ('function awardRunCoins(finalScore, elapsedSecs) {\n'
       '  const fromScore    = Math.floor(finalScore / 50);\n'
       '  const fromSurvival = Math.floor(elapsedSecs / 30);\n'
       '  const fromMisses   = Math.min(missionRun.nearMissesThisRun, 5);\n'
       '  const fromPanic    = missionRun.panicWavesSurvived * 2;\n'
       '  const fromPowerups = missionRun.powerupsThisRun;')
new = ('function awardRunCoins(finalScore, elapsedSecs) {\n'
       '  const fromScore    = Math.floor(finalScore / 200);\n'
       '  const fromSurvival = Math.floor(elapsedSecs / 60);\n'
       '  const fromMisses   = Math.min(missionRun.nearMissesThisRun, 3);\n'
       '  const fromPanic    = missionRun.panicWavesSurvived;\n'
       '  const fromPowerups = Math.floor(missionRun.powerupsThisRun / 2);')
assert old in src, 'FAIL: awardRunCoins'
src = src.replace(old, new); checks.append('awardRunCoins')

# 4. MISSION_DEFS coinReward: easy 30->10, medium 60->20, hard 120->40
mission_subs = [
    ("stat: 'seconds',    goal: 45,   coinReward: 30,",  "stat: 'seconds',    goal: 45,   coinReward: 10,"),
    ("stat: 'score',      goal: 500,  coinReward: 30,",  "stat: 'score',      goal: 500,  coinReward: 10,"),
    ("stat: 'nearMissesThisRun', goal: 3, coinReward: 30,", "stat: 'nearMissesThisRun', goal: 3, coinReward: 10,"),
    ("stat: 'seconds',    goal: 90,   coinReward: 60,",  "stat: 'seconds',    goal: 90,   coinReward: 20,"),
    ("stat: 'score',      goal: 1500, coinReward: 60,",  "stat: 'score',      goal: 1500, coinReward: 20,"),
    ("stat: 'colorChanges', goal: 8,  coinReward: 60,",  "stat: 'colorChanges', goal: 8,  coinReward: 20,"),
    ("stat: 'powerupsThisRun', goal: 10, coinReward: 60, cumulative: true,", "stat: 'powerupsThisRun', goal: 10, coinReward: 20, cumulative: true,"),
    ("stat: 'seconds',    goal: 150,  coinReward: 120,", "stat: 'seconds',    goal: 150,  coinReward: 40,"),
    ("stat: 'score',      goal: 3000, coinReward: 120,", "stat: 'score',      goal: 3000, coinReward: 40,"),
    ("stat: 'panicWavesSurvived', goal: 3, coinReward: 120,", "stat: 'panicWavesSurvived', goal: 3, coinReward: 40,"),
    ("stat: 'maxCombo',   goal: 15,   coinReward: 120,", "stat: 'maxCombo',   goal: 15,   coinReward: 40,"),
]
for o, n in mission_subs:
    assert o in src, f'FAIL mission: {o}'
    src = src.replace(o, n)
checks.append('MISSION_DEFS rewards')

# 5. DailyChallenge POOL coins
pool_old = (
    "    { id: 'survive30',  label: 'Survive 30 seconds',           stat: 'elapsed',          goal: 30,  coins: 50 },\n"
    "    { id: 'survive60',  label: 'Survive 60 seconds',           stat: 'elapsed',          goal: 60,  coins: 75 },\n"
    "    { id: 'score300',   label: 'Reach a score of 300',         stat: 'score',            goal: 300, coins: 50 },\n"
    "    { id: 'score600',   label: 'Reach a score of 600',         stat: 'score',            goal: 600, coins: 75 },\n"
    "    { id: 'nearmiss2',  label: 'Land 2 near misses in one run', stat: 'nearMissesThisRun', goal: 2,  coins: 50 },\n"
    "    { id: 'colorchange5', label: 'Survive 5 color shifts',   stat: 'colorChanges',     goal: 5,  coins: 60 },\n"
    "    { id: 'combo8',     label: 'Reach an 8\u00d7 combo',           stat: 'maxCombo',         goal: 8,  coins: 65 },\n"
    "    { id: 'powerups3',  label: 'Collect 3 power-ups',         stat: 'powerupsThisRun',  goal: 3,  coins: 55 },"
)
pool_new = (
    "    { id: 'survive30',  label: 'Survive 30 seconds',           stat: 'elapsed',          goal: 30,  coins: 15 },\n"
    "    { id: 'survive60',  label: 'Survive 60 seconds',           stat: 'elapsed',          goal: 60,  coins: 25 },\n"
    "    { id: 'score300',   label: 'Reach a score of 300',         stat: 'score',            goal: 300, coins: 15 },\n"
    "    { id: 'score600',   label: 'Reach a score of 600',         stat: 'score',            goal: 600, coins: 25 },\n"
    "    { id: 'nearmiss2',  label: 'Land 2 near misses in one run', stat: 'nearMissesThisRun', goal: 2,  coins: 15 },\n"
    "    { id: 'colorchange5', label: 'Survive 5 color shifts',   stat: 'colorChanges',     goal: 5,  coins: 20 },\n"
    "    { id: 'combo8',     label: 'Reach an 8\u00d7 combo',           stat: 'maxCombo',         goal: 8,  coins: 22 },\n"
    "    { id: 'powerups3',  label: 'Collect 3 power-ups',         stat: 'powerupsThisRun',  goal: 3,  coins: 18 },"
)
assert pool_old in src, 'FAIL: DailyChallenge POOL'
src = src.replace(pool_old, pool_new); checks.append('DailyChallenge POOL')

# 6. Add ECONOMY_VERSION constant before settings let
old_sc = 'let settings = {'
new_sc = 'const ECONOMY_VERSION = 1; // increment to trigger a one-time coin balance reset\nlet settings = {'
assert old_sc in src, 'FAIL: settings let'
src = src.replace(old_sc, new_sc, 1); checks.append('ECONOMY_VERSION const')

# 7. Add reset logic in loadSettings
old_load = "    if (typeof s.sound         === 'boolean') settings.sound         = s.sound;"
new_load = ("    if ((s.economyVersion || 0) < ECONOMY_VERSION) {\n"
            "      // Economy was rebalanced — reset stored coin balance once\n"
            "      settings.economyVersion = ECONOMY_VERSION;\n"
            "      saveSettings();\n"
            "      return;\n"
            "    }\n"
            "    if (typeof s.sound         === 'boolean') settings.sound         = s.sound;")
assert old_load in src, 'FAIL: loadSettings target'
src = src.replace(old_load, new_load); checks.append('economy reset in loadSettings')

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(src)

print('ALL PASS:')
for c in checks:
    print(' ', c)
print(f'Lines: {src.count(chr(10))+1}')
