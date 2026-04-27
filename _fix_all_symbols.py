#!/usr/bin/env python3
"""Fix all mojibake / non-ASCII characters across all site files (v47.4)"""
import re, os

# Mojibake unit mappings:
# Each entry: (mojibake_unicode_sequence, ascii_replacement)
# These are double-encoded UTF-8 characters read back as unicode strings
MOJIBAKE_MAP = [
    # em-dash (U+2014) double-encoded: E2 80 94 misread as Latin-1 = â€" re-encoded
    ('\u00e2\u20ac\u201d', '-'),      # â€" → -
    # en-dash (U+2013) double-encoded: E2 80 93
    ('\u00e2\u20ac\u201c', '-'),      # â€" variant → -
    # box-drawing dash (U+2500) double-encoded: E2 94 80
    ('\u00e2\u201d\u20ac', '-'),      # â"€ → -
    # ellipsis (U+2026) double-encoded: E2 80 A6
    ('\u00e2\u20ac\u00a6', '...'),    # â€¦ → ...
    # checkmark (U+2713) double-encoded: E2 9C 93
    ('\u00e2\u0153\u201c', 'OK'),     # âœ" → OK  (used in mission claimed label etc.)
    # left single quote (U+2018): E2 80 98
    ('\u00e2\u20ac\u02dc', "'"),      # â€˜ → '
    # right single quote (U+2019): E2 80 99
    ('\u00e2\u20ac\u2122', "'"),      # â€™ → '
    # left double quote (U+201C): E2 80 9C  -- already used above as part of other seqs
    # right double quote (U+201D): already part of â€" above
    # right arrow (U+2192): E2 86 92 misread as â†'
    ('\u00e2\u2020\u2019', '->'),     # â†' → ->
    # plus-minus (U+00B1): C2 B1 misread as Â±
    ('\u00c2\u00b1', '+/-'),          # Â± → +/-
    # multiply sign (U+00D7): C3 97 misread as Ã—  (only if appearing as mojibake)
    # Note: genuine U+00D7 in HTML is fine, only fix in JS strings
    # bullet / bullet (U+2022): E2 80 A2 → â€¢
    ('\u00e2\u20ac\u00a2', '-'),      # â€¢ → -
    # â€" preceded / followed by spaces -- already covered
]

# Characters that are intentional Unicode (keep them)
# U+2192 (→), U+2713 (✓), U+00D7 (×), U+2013 (–), U+25B6 (▶), U+2605 (★),
# U+2726 (✦), U+2715 (✕), U+23F8 (⏸), U+21BA (↺), U+2026 (…), U+2714 (✔),
# U+2550 (═), emojis, etc. -- these are OK in HTML/CSS as user-visible content

def fix_mojibake(src):
    """Replace all known mojibake sequences with ASCII equivalents."""
    for bad, good in MOJIBAKE_MAP:
        src = src.replace(bad, good)
    return src

def remove_bom(src):
    return src.lstrip('\ufeff')

def fix_file(path, mode='full'):
    """
    mode='full'  - fix mojibake AND remove BOM, keep intentional Unicode in HTML/CSS
    mode='js'    - fix mojibake, remove BOM, also replace any remaining non-ASCII in
                   JS comments/strings with safe ASCII
    """
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    
    original = src
    src = remove_bom(src)
    src = fix_mojibake(src)
    
    if mode == 'js':
        # In JS: any remaining non-ASCII that slipped through -- replace with safe ASCII
        # Remaining patterns found in analysis:
        # U+2192 → (right arrow in JS comments) → ->
        src = src.replace('\u2192', '->')
        # U+00D7 in JS comments → x
        src = src.replace('\u00d7', 'x')
        # U+2013 (en-dash) in JS comments → -  
        src = src.replace('\u2013', '-')
        # U+2550 (double horizontal box) in JS comments → =
        src = src.replace('\u2550', '=')
    
    if src != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)
        return True
    return False

files = {
    r'c:\Users\dhair\viaan\script.js': 'js',
    r'c:\Users\dhair\viaan\index.html': 'full',
    r'c:\Users\dhair\viaan\style.css': 'full',
}

for path, mode in files.items():
    changed = fix_file(path, mode)
    fname = os.path.basename(path)
    print(f'{"Changed" if changed else "Unchanged"}: {fname}')

# Verify: count remaining non-ASCII
print('\nRemaining non-ASCII after fix:')
import re
for path in files:
    fname = os.path.basename(path)
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    matches = list(re.finditer(r'[^\x00-\x7F]+', src))
    for m in matches[:5]:
        line_num = src[:m.start()].count('\n') + 1
        print(f'  {fname} L{line_num}: {repr(m.group()[:40])}')
    if len(matches) > 5:
        print(f'  ... and {len(matches)-5} more in {fname}')
    if not matches:
        print(f'  {fname}: CLEAN')
