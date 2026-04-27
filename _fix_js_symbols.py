#!/usr/bin/env python3
"""Fix remaining mojibake/non-ASCII in script.js only."""
import re

with open(r'c:\Users\dhair\viaan\script.js', 'r', encoding='utf-8') as f:
    src = f.read()

original = src

# All remaining non-ASCII and what to replace them with:
fixes = [
    # L1045: real checkmark U+2713 in '<div class="lp-dot-check">✓</div>'
    ('\u2713</div>', 'Done</div>'),
    # L1164: sparkle mojibake U+00E2 U+0153 U+00A6 in badge label
    ('\u00e2\u0153\u00a6 MAX', 'MAX'),
    # L2507: play-button mojibake -- U+00E2 alone + U+00B6 (split remnants)
    # Context: "â-¶ Try" -- fix: "Try"
    ('\u00e2-\u00b6 Try', 'Try'),
    # L2569: clock emoji mojibake U+00F0 U+0178 U+2022 U+2019
    ('\u00f0\u0178\u2022\u2019 ', ''),
    # L3044: warning emoji mojibake U+00E2 U+0161 U+00A0 followed by variation selector
    ('\u00e2\u0161\u00a0\ufe0f', 'Warning:'),
    # L3190: superscript-2 mojibake U+00C2 U+00B2 (in comment, but fix anyway)
    ('\u00c2\u00b2', '^2'),
    # L6556: game controller emoji mojibake in share text
    (' \u00f0\u0178\u017d\u00ae', ''),
    # L6865: silver medal 2nd place
    ('\u00f0\u0178\u00a5\u02c6', '2nd'),
    # L6865: bronze medal 3rd place
    ('\u00f0\u0178\u00a5\u2030', '3rd'),
    # L6947: game controller emoji in empty state
    ('\u00f0\u0178\u017d\u00ae', ''),
]

for bad, good in fixes:
    count = src.count(bad)
    if count:
        src = src.replace(bad, good)
        print(f'Fixed x{count}: {repr(bad[:20])} -> {repr(good)}')
    else:
        print(f'Skip (0 found): {repr(bad[:20])}')

# Check for any other remaining non-ASCII
remaining = list(re.finditer(r'[^\x00-\x7F]+', src))
if remaining:
    print(f'\nStill {len(remaining)} non-ASCII remaining -- forcing all to ASCII:')
    for m in remaining:
        ln = src[:m.start()].count('\n') + 1
        print(f'  L{ln}: {repr(m.group())}  cps: {" ".join(f"U+{ord(c):04X}" for c in m.group())}')
    # Nuclear option: remove any remaining non-ASCII character that isn't intentional
    # (Only apply to script.js where non-ASCII should never appear in user-visible strings)
    src = re.sub(r'[^\x00-\x7F]', '', src)
    print('All remaining non-ASCII stripped.')

if src != original:
    with open(r'c:\Users\dhair\viaan\script.js', 'w', encoding='utf-8') as f:
        f.write(src)
    print('\nscript.js saved.')
else:
    print('\nNo changes needed.')

# Final verification
with open(r'c:\Users\dhair\viaan\script.js', 'r', encoding='utf-8') as f:
    verify = f.read()
final = list(re.finditer(r'[^\x00-\x7F]+', verify))
print(f'\nFinal check: {len(final)} non-ASCII chars remaining in script.js')
