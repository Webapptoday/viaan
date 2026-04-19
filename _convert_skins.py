src = open('script.js', 'r', encoding='utf-8').read()
orig = src
checks = []

# ── 1. Convert score-unlock skins to coin-cost skins ─────────────────────────
# neon (common, was unlock 100) → coinCost 75
old = "{ id: 'neon',    name: 'Neon',    unlock:  100, rarity: 'common', effect: 'pulse',   color1: '#ccfdf2', color2: '#06b6d4', glow: '#06b6d4', shape: 'circle', trail: true  },"
new = "{ id: 'neon',    name: 'Neon',    unlock: 0, coinCost:  75, rarity: 'common', effect: 'pulse',   color1: '#ccfdf2', color2: '#06b6d4', glow: '#06b6d4', shape: 'circle', trail: true  },"
assert old in src, 'FAIL: neon'
src = src.replace(old, new); checks.append('neon → coinCost 75')

# ice (rare, was unlock 300) → coinCost 150
old = "{ id: 'ice',     name: 'Ice',     unlock:  300, rarity: 'rare',   effect: 'shimmer', color1: '#e0f2fe', color2: '#38bdf8', glow: '#7dd3fc', shape: 'circle', trail: true  },"
new = "{ id: 'ice',     name: 'Ice',     unlock: 0, coinCost: 150, rarity: 'rare',   effect: 'shimmer', color1: '#e0f2fe', color2: '#38bdf8', glow: '#7dd3fc', shape: 'circle', trail: true  },"
assert old in src, 'FAIL: ice'
src = src.replace(old, new); checks.append('ice → coinCost 150')

# lava (rare, was unlock 600) → coinCost 175
old = "{ id: 'lava',    name: 'Lava',    unlock:  600, rarity: 'rare',   effect: 'flicker', color1: '#fef08a', color2: '#ef4444', glow: '#f97316', shape: 'circle', trail: true  },"
new = "{ id: 'lava',    name: 'Lava',    unlock: 0, coinCost: 175, rarity: 'rare',   effect: 'flicker', color1: '#fef08a', color2: '#ef4444', glow: '#f97316', shape: 'circle', trail: true  },"
assert old in src, 'FAIL: lava'
src = src.replace(old, new); checks.append('lava → coinCost 175')

# gold (epic, was unlock 1000) → coinCost 300
old = "{ id: 'gold',    name: 'Gold',    unlock: 1000, rarity: 'epic',   effect: 'shimmer', color1: '#fefce8', color2: '#eab308', glow: '#fbbf24', shape: 'star',   trail: false },"
new = "{ id: 'gold',    name: 'Gold',    unlock: 0, coinCost: 300, rarity: 'epic',   effect: 'shimmer', color1: '#fefce8', color2: '#eab308', glow: '#fbbf24', shape: 'star',   trail: false },"
assert old in src, 'FAIL: gold'
src = src.replace(old, new); checks.append('gold → coinCost 300')

# void (epic, was unlock 2000) → coinCost 425
old = "{ id: 'void',     name: 'Void',     unlock: 2000, rarity: 'epic',      effect: 'void',     color1: '#ddd6fe', color2: '#3b0764', glow: '#c084fc', shape: 'star',   trail: true  },"
new = "{ id: 'void',     name: 'Void',     unlock: 0, coinCost: 425, rarity: 'epic',      effect: 'void',     color1: '#ddd6fe', color2: '#3b0764', glow: '#c084fc', shape: 'star',   trail: true  },"
assert old in src, 'FAIL: void'
src = src.replace(old, new); checks.append('void → coinCost 425')

# ── 2. Add SKIN_VERSION constant after ECONOMY_VERSION ───────────────────────
old_ev = 'const ECONOMY_VERSION = 1; // increment to trigger a one-time coin balance reset'
new_ev = ('const ECONOMY_VERSION = 1; // increment to trigger a one-time coin balance reset\n'
          'const SKIN_VERSION    = 1; // increment to trigger a one-time purchased-skins reset')
assert old_ev in src, 'FAIL: ECONOMY_VERSION line'
src = src.replace(old_ev, new_ev); checks.append('SKIN_VERSION const')

# ── 3. Add skin reset in loadSettings after economy reset block ───────────────
old_load = (
    '    if ((s.economyVersion || 0) < ECONOMY_VERSION) {\n'
    '      // Economy was rebalanced \u2014 reset stored coin balance once\n'
    '      settings.economyVersion = ECONOMY_VERSION;\n'
    '      saveSettings();\n'
    '      return;\n'
    '    }\n'
)
new_load = (
    '    if ((s.economyVersion || 0) < ECONOMY_VERSION) {\n'
    '      // Economy was rebalanced \u2014 reset stored coin balance once\n'
    '      settings.economyVersion = ECONOMY_VERSION;\n'
    '      saveSettings();\n'
    '      return;\n'
    '    }\n'
    '    if ((s.skinVersion || 0) < SKIN_VERSION) {\n'
    '      // Skin shop converted to coin-only \u2014 reset purchased skins once\n'
    '      settings.skinVersion = SKIN_VERSION;\n'
    '      settings.purchasedSkins = [];\n'
    '      settings.selectedSkin = \'classic\';\n'
    '      saveSettings();\n'
    '      return;\n'
    '    }\n'
)
assert old_load in src, 'FAIL: loadSettings economy block'
src = src.replace(old_load, new_load); checks.append('skin reset in loadSettings')

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(src)

print('ALL PASS:')
for c in checks:
    print(' ', c)
print(f'Lines: {src.count(chr(10))+1}')
