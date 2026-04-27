#!/usr/bin/env python3
# Fix remaining symbols/mojibake in script.js
with open(r'c:\Users\dhair\viaan\script.js', 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# em-dash mojibake: â€" = U+00E2 U+20AC U+201D
EMDASH = '\u00e2\u20ac\u201d'
# checkmark mojibake: âœ" = U+00E2 U+0153 U+201C
CHECKMARK = '\u00e2\u0153\u201c'

# Fix rank #1 message: remove trophy JS escape + fix em-dash
content = content.replace(
    "\\uD83C\\uDFC6 <span class=\"go-rank-highlight\">#' + rank + ' Global</span> " + EMDASH + " Incredible!",
    "<span class=\"go-rank-highlight\">#' + rank + ' Global</span> - Incredible!"
)

# Fix rank toast em-dash
content = content.replace(
    "' + rank + ' " + EMDASH + " New Best Score!'",
    "' + rank + ' - New Best Score!'"
)

# Fix lp-s-claimed checkmark (two variants)
content = content.replace(
    '<span class="lp-s-claimed">' + CHECKMARK + ' \' + (reward.type',
    '<span class="lp-s-claimed">\' + (reward.type'
)
content = content.replace(
    '<span class="lp-s-claimed">' + CHECKMARK + ' Unlocked</span>',
    '<span class="lp-s-claimed">Unlocked</span>'
)

# Fix lp-dot-check checkmark
content = content.replace(
    '<div class="lp-dot-check">' + CHECKMARK + '</div>',
    '<div class="lp-dot-check">\u2713</div>'
)

# Fix goal complete floating text: literal \u2713 in JS source -> remove it
content = content.replace("'\\u2713 Goal: '", "'Goal: '")

# Fix MISSION_DEFS description with literal \u00d7 (x cross) -> x
content = content.replace('\\u00d7', 'x')

# Fix arrow literal \u2192 -> to
content = content.replace('\\u2192', ' to ')

if content != original:
    with open(r'c:\Users\dhair\viaan\script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Changes written")
    # Count changes
    for label, old, new in [
        ('rank#1', EMDASH, ''),
        ('lp-s-claimed', CHECKMARK, ''),
    ]:
        if old in original and old not in content:
            print(f"  Fixed: {label}")
else:
    print("No changes - checking what didn't match...")
    if EMDASH in content:
        print("  em-dash still present")
    if CHECKMARK in content:
        print("  checkmark still present")
