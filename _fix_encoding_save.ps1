$ErrorActionPreference = 'Continue'
$text = [System.IO.File]::ReadAllText('script.js', [System.Text.Encoding]::UTF8)

function rep($old, $new, $label) {
  $count = 0
  $idx = $text.IndexOf($old)
  while ($idx -ge 0) { $count++; $idx = $text.IndexOf($old, $idx + 1) }
  if ($count -gt 0) {
    $script:text = $script:text.Replace($old, $new)
    Write-Host "$label: replaced $count occurrence(s)"
  } else {
    Write-Host "MISS: $label"
  }
}

# ===========================================================
# PART 1: FIX ENCODING ARTIFACTS IN JS STRING LITERALS
#
# Root cause: Non-ASCII chars were round-tripped through
# Windows-1252 / UTF-8 mismatch during prior PowerShell edits.
# Fix: Replace all mojibake sequences with \uXXXX escape sequences,
# which are encoding-independent and always correct.
# ===========================================================

# --- Simple Unicode characters (2-3 UTF-8 bytes, mangled to 2-3 latin chars) ---

# • (bullet, U+2022) — appears as â€¢ in string literals
# Visible in: milestone progress bar, floating text
rep 'â€¢' '\u2022' 'bullet â€¢ -> \u2022'

# × (multiplication, U+00D7) — appears as Ã— in challenge labels
# Visible in: "Near-miss Ã—2", "5Ã— combo", "20Ã— combo"
rep 'Ã—' '\u00d7' 'multiply Ã— -> \u00d7'

# → (right arrow, U+2192) — appears as â†' in powerup stat separator
rep 'â†'' '\u2192' 'arrow â†'' -> \u2192'

# ⚡ (lightning, U+26A1) — appears as âš¡ in powerup shop and mission icons
rep 'âš¡' '\u26a1' 'lightning âš¡ -> \u26a1'

# ✨ (sparkles, U+2728) — appears as âœ¨ in lifetime reward icons
rep 'âœ¨' '\u2728' 'sparkles âœ¨ -> \u2728'

# ⏱ (timer, U+23F1) — appears as â± in mini-goal icon
rep 'â±' '\u23f1' 'timer â± -> \u23f1'

# --- 4-byte emoji (mangled to 4 latin chars via Windows-1252 misread) ---
# Each emoji was F0 9F XX YY in UTF-8, then bytes misread as Win-1252 chars,
# then those chars re-encoded as UTF-8 → double-encoded garbage.

# 🎉 party popper (U+1F389 = \uD83C\uDF89)
rep 'ðŸŽ‰' '\uD83C\uDF89' 'party 🎉 -> \uD83C\uDF89'

# 🔒 lock (U+1F512 = \uD83D\uDD12)
rep 'ðŸ"''' '\uD83D\uDD12' 'lock 🔒 -> \uD83D\uDD12'

# 🔥 fire (U+1F525 = \uD83D\uDD25)
rep 'ðŸ"¥' '\uD83D\uDD25' 'fire 🔥 -> \uD83D\uDD25'

# 🎯 target (U+1F3AF = \uD83C\uDFAF)
rep 'ðŸŽ¯' '\uD83C\uDFAF' 'target 🎯 -> \uD83C\uDFAF'

# 🪙 coin (U+1FA99 = \uD83E\uDE99)
rep 'ðŸª™' '\uD83E\uDE99' 'coin 🪙 -> \uD83E\uDE99'

# 🌅 sunrise (U+1F305 = \uD83C\uDF05)
rep 'ðŸŒ…' '\uD83C\uDF05' 'sunrise 🌅 -> \uD83C\uDF05'

# 🏆 trophy (U+1F3C6 = \uD83C\uDFC6)
rep 'ðŸ†' '\uD83C\uDFC6' 'trophy 🏆 -> \uD83C\uDFC6'

# 🌑 new moon (U+1F311 = \uD83C\uDF11)
rep 'ðŸŒ''' '\uD83C\uDF11' 'moon 🌑 -> \uD83C\uDF11'

# 👑 crown (U+1F451 = \uD83D\uDC51)
rep "ðŸ''" '\uD83D\uDC51' 'crown 👑 -> \uD83D\uDC51'

# 🔱 trident (U+1F531 = \uD83D\uDD31)
rep 'ðŸ"±' '\uD83D\uDD31' 'trident 🔱 -> \uD83D\uDD31'

# --- Characters that only appear in comments (won't show in UI) ---
# These are cleaned up for code readability but don't affect gameplay.
# em dash (—, U+2014) in comments: â€"
# We leave these alone since they're only in comments, not rendered UI.

# ===========================================================
# PART 2: FIX SAVE SYSTEM — PROGRESS RESETS ON RELOAD
#
# Root cause: 'economyVersion' and 'skinVersion' are set on the
# temporary 's' object during migration but never copied to 'settings'.
# Since saveSettings() serialises 'settings' (not 's'), these version
# fields are never persisted to localStorage. On the next page load,
# the version check sees 0 < ECONOMY_VERSION → triggers migration
# again → coins reset to 0.
#
# Fix:
# 1. Add economyVersion + skinVersion to the settings default object
#    (prevents migration from ever firing for new players).
# 2. In loadSettings(), copy version values from 's' to 'settings'
#    BEFORE the migration check, so the guard sees the saved version.
# 3. The migration now updates 'settings' directly, so saveSettings()
#    will persist the version and the migration won't fire again.
# ===========================================================

$crlf = [char]13 + [char]10

# --- 2a. Add version fields to the settings default object ---
$oldSettings = '  streakCount:    0,' + $crlf + '  streakLastDate: ' + [char]39 + [char]39 + ',' + $crlf + '};'
$newSettings = '  streakCount:    0,' + $crlf + '  streakLastDate: ' + [char]39 + [char]39 + ',' + $crlf +
  '  // Version guards — ensure one-time migrations only fire once per version bump.' + $crlf +
  '  // IMPORTANT: these must be saved to localStorage or the migration re-runs every reload.' + $crlf +
  '  economyVersion: 2,  // must match ECONOMY_VERSION constant above' + $crlf +
  '  skinVersion:    1,  // must match SKIN_VERSION constant above' + $crlf +
  '};'
if ($text.Contains($oldSettings)) {
  $text = $text.Replace($oldSettings, $newSettings)
  Write-Host "2a (settings object): economyVersion + skinVersion added"
} else {
  Write-Host "MISS 2a — trying alternative ending"
  # Try without exact ending
  $idx = $text.IndexOf("  streakLastDate: '',")
  if ($idx -ge 0) {
    $endIdx = $text.IndexOf('};', $idx)
    if ($endIdx -ge 0) {
      Write-Host "  Found at index $idx, end at $endIdx"
      $oldS = $text.Substring($idx, $endIdx + 2 - $idx)
      Write-Host "  Old: [$oldS]"
    }
  }
}

# --- 2b. Fix loadSettings() — copy version fields before migration check,
#         and update settings (not just s) during migration ---

# Find the exact migration block in loadSettings
$oldMigBlock = '    let _migrated = false;' + $crlf +
  '    if ((s.economyVersion || 0) < ECONOMY_VERSION) {' + $crlf

$newMigBlock = '    let _migrated = false;' + $crlf +
  '    // Load version guards first — MUST happen before migration checks' + $crlf +
  '    // so that saveSettings() will persist them and the migration only fires once.' + $crlf +
  '    if (typeof s.economyVersion === ' + [char]39 + 'number' + [char]39 + ') settings.economyVersion = s.economyVersion;' + $crlf +
  '    if (typeof s.skinVersion    === ' + [char]39 + 'number' + [char]39 + ') settings.skinVersion    = s.skinVersion;' + $crlf +
  '    if (settings.economyVersion < ECONOMY_VERSION) {' + $crlf

Write-Host "Found migration block: $($text.Contains($oldMigBlock))"
$text = $text.Replace($oldMigBlock, $newMigBlock)

# Also update the economy migration to reset settings.coins (not just s.coins)
$oldEcoReset = '      // Economy was rebalanced ' + [char]0xe2 + [char]0x80 + [char]0x94 + ' reset coins only, preserve everything else' + $crlf +
  '      s.coins = 0;' + $crlf +
  '      s.economyVersion = ECONOMY_VERSION;' + $crlf +
  '      _migrated = true;'

# Try just finding and replacing via index
$migrIdx = $text.IndexOf('      s.coins = 0;')
if ($migrIdx -ge 0) {
  $migrEnd = $text.IndexOf('_migrated = true;', $migrIdx) + 17
  $oldMigrSection = $text.Substring($migrIdx, $migrEnd - $migrIdx)
  Write-Host "Economy reset section: [$oldMigrSection]"
  $newMigrSection = '      s.coins = 0;' + $crlf +
    '      s.economyVersion = ECONOMY_VERSION;' + $crlf +
    '      settings.economyVersion = ECONOMY_VERSION;  // persist so migration never re-runs' + $crlf +
    '      _migrated = true;'
  $text = $text.Replace($oldMigrSection, $newMigrSection)
  Write-Host "2b-economy: settings.economyVersion update added"
}

# Update the skin migration similarly
$skinIdx = $text.IndexOf('      s.skinVersion = SKIN_VERSION;')
if ($skinIdx -ge 0) {
  $skinEnd = $text.IndexOf('_migrated = true;', $skinIdx) + 17
  $oldSkinSection = $text.Substring($skinIdx, $skinEnd - $skinIdx)
  Write-Host "Skin reset section: [$oldSkinSection]"
  $newSkinSection = '      s.skinVersion = SKIN_VERSION;' + $crlf +
    '      settings.skinVersion = SKIN_VERSION;  // persist so migration never re-runs' + $crlf +
    '      _migrated = true;'
  $text = $text.Replace($oldSkinSection, $newSkinSection)
  Write-Host "2b-skin: settings.skinVersion update added"
}

# Also update the (s.skinVersion check to use settings.skinVersion
$oldSkinCheck = '    if ((s.skinVersion || 0) < SKIN_VERSION) {'
$newSkinCheck = '    if (settings.skinVersion < SKIN_VERSION) {'
if ($text.Contains($oldSkinCheck)) {
  $text = $text.Replace($oldSkinCheck, $newSkinCheck)
  Write-Host "2c (skin version check): updated to use settings"
}

# ===========================================================
# SAVE
# ===========================================================
[System.IO.File]::WriteAllText('script.js', $text, [System.Text.Encoding]::UTF8)
$lineCount = (Get-Content 'script.js').Count
Write-Host "`nAll fixes applied. Line count: $lineCount"
Write-Host "Verify:"
Write-Host "  bullet \u2022: $($text.Contains('\u2022'))"
Write-Host "  multiply \u00d7: $($text.Contains('\u00d7'))"
Write-Host "  arrow \u2192: $($text.Contains('\u2192'))"
Write-Host "  party \uD83C: $($text.Contains('\uD83C\uDF89'))"
Write-Host "  economyVersion in settings: $($text.Contains('economyVersion: 2'))"
Write-Host "  settings.economyVersion in migration: $($text.Contains('settings.economyVersion = ECONOMY_VERSION'))"
Write-Host "  settings.skinVersion in migration: $($text.Contains('settings.skinVersion = SKIN_VERSION'))"
Write-Host "  version guard load before check: $($text.Contains('settings.economyVersion = s.economyVersion'))"
