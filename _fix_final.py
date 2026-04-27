#!/usr/bin/env python3
import re

with open(r'c:\Users\dhair\viaan\script.js', 'r', encoding='utf-8') as f:
    src = f.read()

# Fix rank 1 crown emoji escape -> '1st'
src = src.replace("const RANK_ICONS = { 1: '\\uD83D\\uDC51', 2: '2nd', 3: '3rd' }",
                  "const RANK_ICONS = { 1: '1st', 2: '2nd', 3: '3rd' }")

# Fix leftover variation-selector (U+FE0F) at start of toast message
src = src.replace('\ufe0f Reward cancelled', 'Reward cancelled')

with open(r'c:\Users\dhair\viaan\script.js', 'w', encoding='utf-8') as f:
    f.write(src)

remaining = list(re.finditer(r'[^\x00-\x7F]+', src))
print(f'Done. Non-ASCII remaining: {len(remaining)}')
for m in remaining:
    ln = src[:m.start()].count('\n') + 1
    print(f'  L{ln}: {repr(m.group())}')
