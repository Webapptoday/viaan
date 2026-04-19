src = open('script.js','r',encoding='utf-8').read()
checks = [
  ('COIN_ITEM_INTERVAL=6.0', 'COIN_ITEM_INTERVAL  = 6.0' in src),
  ('coin_value_1-2', 'Math.random() * 2), // 1' in src),
  ('fromScore/200', 'Math.floor(finalScore / 200)' in src),
  ('fromSurvival/60', 'Math.floor(elapsedSecs / 60)' in src),
  ('fromMisses_cap3', 'nearMissesThisRun, 3)' in src),
  ('fromPanic_no_x2', 'missionRun.panicWavesSurvived;\n' in src),
  ('fromPowerups_half', 'Math.floor(missionRun.powerupsThisRun / 2)' in src),
  ('MISSION_easy10', 'coinReward: 10,' in src),
  ('MISSION_med20', 'coinReward: 20,' in src),
  ('MISSION_hard40', 'coinReward: 40,' in src),
  ('pool_coins15', 'coins: 15' in src),
  ('pool_coins25', 'coins: 25' in src),
  ('ECONOMY_VERSION_const', 'ECONOMY_VERSION = 1;' in src),
  ('loadSettings_reset', 'economyVersion || 0) < ECONOMY_VERSION' in src),
  ('saveSettings_in_reset', 'settings.economyVersion = ECONOMY_VERSION' in src),
]
for k,v in checks:
    print('PASS' if v else 'FAIL', k)
print('All passed:', all(v for _,v in checks))
