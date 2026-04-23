$ErrorActionPreference = 'Continue'
$text = [System.IO.File]::ReadAllText('script.js', [System.Text.Encoding]::UTF8)

# Helper: replace and report
function Do-Replace {
  param($old, $new, $msg)
  if ($text.Contains($old)) {
    $script:text = $script:text.Replace($old, $new)
    Write-Host "OK [$msg]"
  } else {
    Write-Host "MISS [$msg]"
  }
}

Write-Host "=== PART 1: ENCODING FIXES ==="

# bullet U+2022 -> \u2022
Do-Replace 'â€¢' '\u2022' 'bullet'

# multiplication U+00D7 -> \u00d7
Do-Replace 'Ã—' '\u00d7' 'multiply'

# right arrow U+2192 -> \u2192
Do-Replace "â†'" '\u2192' 'arrow'

# lightning U+26A1 -> \u26a1
Do-Replace 'âš¡' '\u26a1' 'lightning'

# sparkles U+2728 -> \u2728
Do-Replace 'âœ¨' '\u2728' 'sparkles'

# timer U+23F1 -> \u23f1
Do-Replace 'â±' '\u23f1' 'timer'

# 🎉 party (U+1F389 = D83C DF89)
Do-Replace 'ðŸŽ‰' '\uD83C\uDF89' 'party'

# 🔒 lock (U+1F512 = D83D DD12) - note: contains a right-single-quote char
$lockEmoji = [char]0x00F0 + [char]0x0178 + [char]0x201D + [char]0x2018
Do-Replace $lockEmoji '\uD83D\uDD12' 'lock'

# 🔥 fire (U+1F525 = D83D DD25) - 94 is right-double-quote in Win-1252
$fireEmoji = [char]0x00F0 + [char]0x0178 + [char]0x201D + [char]0x00A5
Do-Replace $fireEmoji '\uD83D\uDD25' 'fire'

# 🎯 target (U+1F3AF = D83C DFAF)
$targetEmoji = [char]0x00F0 + [char]0x0178 + [char]0x017D + [char]0x00AF
Do-Replace $targetEmoji '\uD83C\uDFAF' 'target'

# 🪙 coin (U+1FA99 = D83E DE99)
$coinEmoji = [char]0x00F0 + [char]0x0178 + [char]0x00AA + [char]0x2122
Do-Replace $coinEmoji '\uD83E\uDE99' 'coin'

# 🌅 sunrise (U+1F305 = D83C DF05)
$sunEmoji = [char]0x00F0 + [char]0x0178 + [char]0x0152 + [char]0x2026
Do-Replace $sunEmoji '\uD83C\uDF05' 'sunrise'

# 🏆 trophy (U+1F3C6 = D83C DFC6)
$trophyEmoji = [char]0x00F0 + [char]0x0178 + [char]0x201E + [char]0x00C6
Do-Replace $trophyEmoji '\uD83C\uDFC6' 'trophy'

# 🌑 new moon (U+1F311 = D83C DF11)
$moonEmoji = [char]0x00F0 + [char]0x0178 + [char]0x2039 + [char]0x2019
Do-Replace $moonEmoji '\uD83C\uDF11' 'moon'

# 👑 crown (U+1F451 = D83D DC51)
$crownEmoji = [char]0x00F0 + [char]0x0178 + [char]0x2018 + [char]0x2019
Do-Replace $crownEmoji '\uD83D\uDC51' 'crown'

# 🔱 trident (U+1F531 = D83D DD31)
$tridentEmoji = [char]0x00F0 + [char]0x0178 + [char]0x201D + [char]0x00B1
Do-Replace $tridentEmoji '\uD83D\uDD31' 'trident'

Write-Host ""
Write-Host "=== PART 2: SAVE RESET FIX ==="

$crlf = [char]13 + [char]10

# 2a: Add economyVersion + skinVersion to settings default object
# Find the settings closing
$settEnd = $text.IndexOf("  streakLastDate: '',")
if ($settEnd -ge 0) {
  $closingBrace = $text.IndexOf('};', $settEnd)
  $oldEnd = $text.Substring($settEnd, $closingBrace + 2 - $settEnd)
  $newEnd = "  streakLastDate: ''," + $crlf +
    '  // Version guards: persisted so one-time migrations only fire once per version bump.' + $crlf +
    '  economyVersion: 2,  // keep in sync with ECONOMY_VERSION constant' + $crlf +
    '  skinVersion:    1,  // keep in sync with SKIN_VERSION constant' + $crlf +
    '};'
  $text = $text.Replace($oldEnd, $newEnd)
  Write-Host "OK [settings object: version fields added]"
} else {
  Write-Host "MISS [settings object streakLastDate not found]"
}

# 2b: In loadSettings() — copy version fields BEFORE migration check runs
$oldMigHead = '    let _migrated = false;' + $crlf + '    if ((s.economyVersion || 0) < ECONOMY_VERSION) {'
$newMigHead = '    let _migrated = false;' + $crlf +
  '    // Load version guards FIRST so that saveSettings() will persist them.' + $crlf +
  '    // Without this, economyVersion is never saved and the migration fires every reload.' + $crlf +
  "    if (typeof s.economyVersion === 'number') settings.economyVersion = s.economyVersion;" + $crlf +
  "    if (typeof s.skinVersion    === 'number') settings.skinVersion    = s.skinVersion;" + $crlf +
  '    if (settings.economyVersion < ECONOMY_VERSION) {'
Write-Host "Found migration head: $($text.Contains($oldMigHead))"
$text = $text.Replace($oldMigHead, $newMigHead)

# 2c: Economy migration block — update settings.economyVersion directly
$econIdx = $text.IndexOf('      s.coins = 0;')
if ($econIdx -ge 0) {
  $econLineEnd = $text.IndexOf($crlf, $econIdx + 15) + $crlf.Length
  $nextLineEnd = $text.IndexOf($crlf, $econLineEnd) + $crlf.Length
  $oldEconLines = $text.Substring($econIdx, $nextLineEnd - $econIdx)
  Write-Host "Economy lines: [$oldEconLines]"
  $newEconLines = '      s.coins = 0;' + $crlf +
    '      s.economyVersion = ECONOMY_VERSION;' + $crlf +
    '      settings.economyVersion = ECONOMY_VERSION;  // persisted via saveSettings()' + $crlf
  $text = $text.Replace($oldEconLines, $newEconLines)
  Write-Host "OK [economy migration: settings.economyVersion set]"
}

# 2d: Skin migration block — update settings.skinVersion directly
# Also change the (s.skinVersion || 0) check to use settings.skinVersion
$oldSkinCheck = '    if ((s.skinVersion || 0) < SKIN_VERSION) {'
$newSkinCheck = '    if (settings.skinVersion < SKIN_VERSION) {'
Do-Replace $oldSkinCheck $newSkinCheck 'skin version check'

$skinVerIdx = $text.IndexOf('      s.skinVersion = SKIN_VERSION;')
if ($skinVerIdx -ge 0) {
  $oldSkinVer = '      s.skinVersion = SKIN_VERSION;'
  $newSkinVer = '      s.skinVersion = SKIN_VERSION;' + $crlf +
    '      settings.skinVersion = SKIN_VERSION;  // persisted via saveSettings()'
  $text = $text.Replace($oldSkinVer, $newSkinVer)
  Write-Host "OK [skin migration: settings.skinVersion set]"
}

# ===========================================================
# SAVE
# ===========================================================
[System.IO.File]::WriteAllText('script.js', $text, [System.Text.Encoding]::UTF8)
$lineCount = (Get-Content 'script.js').Count
Write-Host ""
Write-Host "=== VERIFICATION ==="
Write-Host "Lines: $lineCount"
Write-Host "bullet \u2022 present: $($text.Contains('\u2022'))"
Write-Host "multiply \u00d7 present: $($text.Contains('\u00d7'))"
Write-Host "lightning \u26a1 present: $($text.Contains('\u26a1'))"
Write-Host "party emoji present: $($text.Contains('\uD83C\uDF89'))"
Write-Host "coin emoji present: $($text.Contains('\uD83E\uDE99'))"
Write-Host "economyVersion in settings obj: $($text.Contains('economyVersion: 2'))"
Write-Host "settings.economyVersion in migration: $($text.Contains('settings.economyVersion = ECONOMY_VERSION'))"
Write-Host "settings.skinVersion in migration: $($text.Contains('settings.skinVersion = SKIN_VERSION'))"
Write-Host "version guard load: $($text.Contains('settings.economyVersion = s.economyVersion'))"
Write-Host "settings version check: $($text.Contains('settings.economyVersion < ECONOMY_VERSION'))"
