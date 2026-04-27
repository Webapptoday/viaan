$text = [System.IO.File]::ReadAllText('C:\Users\dhair\viaan\script.js', [System.Text.Encoding]::UTF8)
$orig = $text.Length

# --- ICON FIELDS: blank all emoji icons in data arrays ---
# These are pure ASCII escape sequences in the file
$text = $text.Replace("icon: '\uD83E\uDE99'", "icon: ''")   # coin
$text = $text.Replace("icon: '\uD83C\uDFAF'", "icon: ''")   # target
$text = $text.Replace("icon: '\uD83D\uDD25'", "icon: ''")   # fire
$text = $text.Replace("icon: '\uD83C\uDF05'", "icon: ''")   # sunrise
$text = $text.Replace("icon: '\uD83C\uDFC6'", "icon: ''")   # trophy
$text = $text.Replace("icon: '\uD83C\uDF11'", "icon: ''")   # moon
$text = $text.Replace("icon: '\uD83D\uDC51'", "icon: ''")   # crown
$text = $text.Replace("icon: '\uD83D\uDD31'", "icon: ''")   # trident
$text = $text.Replace("icon: '\u26a1'",        "icon: ''")   # lightning lowercase
$text = $text.Replace("icon: '\u26A1'",        "icon: ''")   # lightning uppercase
$text = $text.Replace("icon: '\u2728'",        "icon: ''")   # sparkles lowercase
$text = $text.Replace("icon: '\u2728'",        "icon: ''")   # sparkles uppercase (same)
$text = $text.Replace("icon: '\u23f1'",        "icon: ''")   # timer lowercase
$text = $text.Replace("icon: '\u23F1'",        "icon: ''")   # timer uppercase

# --- LABELS: × → x ---
$text = $text.Replace('\u00d7', 'x')

# --- LIFETIME DETAIL: bullet → dash ---
$text = $text.Replace(" \u2022 ", " - ")

# --- MISSION TOAST: remove party emoji ---
$text = $text.Replace('\uD83C\uDF89 <strong>', '<strong>')

# --- MISSION LOCKED: remove lock emoji ---
$text = $text.Replace('\uD83D\uDD12 Complete all ', 'Complete all ')

# --- LIFETIME HEADER: remove party emoji from "all unlocked" ---
$text = $text.Replace('\uD83C\uDF89 All rewards unlocked!', 'All rewards unlocked!')

# --- POWERUP SUMMARY: remove lightning ---
$text = $text.Replace('\u26a1 Max level 3 each', 'Max level 3 each')

# --- COIN BREAKDOWN: remove emoji from stat labels ---
$text = $text.Replace("'\ud83e\ude99 Pickups'", "'Pickups'")
$text = $text.Replace("'\ud83c\udfaf Score'",   "'Score'")
$text = $text.Replace("'\u26a1 Near-miss'",     "'Near-miss'")
$text = $text.Replace("'\ud83d\udd25 Combo'",   "'Combo'")
$text = $text.Replace("'\u23f1 Survival'",      "'Survival'")

# --- RANK #1 MESSAGE: remove trophy emoji ---
$text = $text.Replace('\uD83C\uDFC6 <span class="go-rank-highlight">', '<span class="go-rank-highlight">')

# --- RANK TOP 10: remove party emoji ---
$text = $text.Replace(' \uD83C\uDF89 Top 10!', ' - Top 10!')

# --- RANK MESSAGES: fix em-dash mojibake â€" → - ---
$emDash = [char]0x00E2 + [char]0x20AC + [char]0x201C
$text = $text.Replace(' ' + $emDash + ' Incredible!', ' - Incredible!')
$text = $text.Replace(' ' + $emDash + ' New Best Score!', ' - New Best Score!')

# --- LP-S-CLAIMED and LP-DOT-CHECK: fix checkmark mojibake ---
# âœ" = U+00E2, U+0153, U+201C in double-encoded form
$ck = [char]0x00E2 + [char]0x009C + [char]0x201C
if ($text.Contains($ck)) {
    $text = $text.Replace($ck + ' ', '')   # remove from claimed label prefix
    $text = $text.Replace($ck, '\u2713')   # keep as proper checkmark in dot
    Write-Host "OK [checkmark fixed]"
} else {
    Write-Host "MISS [checkmark]"
}

# --- GOAL COMPLETE: remove \u2713 from floating text ---
$text = $text.Replace("'\u2713 Goal: '", "'Goal: '")

[System.IO.File]::WriteAllText('C:\Users\dhair\viaan\script.js', $text, [System.Text.Encoding]::UTF8)
$newLen = $text.Length
Write-Host "Done. Chars: $orig -> $newLen"
Write-Host "near-miss x2: $($text.Contains('Near-miss x2'))"
Write-Host "coin breakdown clean: $($text.Contains("'Pickups'"))"
Write-Host "trophy gone: $(-not $text.Contains('\uD83C\uDFC6 <span'))"
Write-Host "icon blanked: $($text.Contains("icon: ''"))"
