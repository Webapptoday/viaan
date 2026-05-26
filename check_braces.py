src = open('campaign.js', 'r', encoding='utf-8').read()
lines = src.splitlines()

depth = 0
i = 0
n = len(src)
in_single = False
in_double = False
in_template = False
in_line_comment = False
in_block_comment = False
issues = []
line_no = 1

while i < n:
    c = src[i]
    if c == '\n':
        line_no += 1
        in_line_comment = False
        i += 1
        continue
    if in_block_comment:
        if c == '*' and i+1 < n and src[i+1] == '/':
            in_block_comment = False
            i += 2
        else:
            i += 1
        continue
    if in_line_comment:
        i += 1
        continue
    if in_single:
        if c == '\\':
            i += 2
        elif c == "'":
            in_single = False
            i += 1
        else:
            i += 1
        continue
    if in_double:
        if c == '\\':
            i += 2
        elif c == '"':
            in_double = False
            i += 1
        else:
            i += 1
        continue
    if in_template:
        if c == '\\':
            i += 2
        elif c == '`':
            in_template = False
            i += 1
        else:
            i += 1
        continue
    if c == '/' and i+1 < n:
        if src[i+1] == '/':
            in_line_comment = True
            i += 2
            continue
        if src[i+1] == '*':
            in_block_comment = True
            i += 2
            continue
    if c == "'":
        in_single = True
    elif c == '"':
        in_double = True
    elif c == '`':
        in_template = True
    elif c == '{':
        depth += 1
    elif c == '}':
        depth -= 1
        if depth < 0:
            issues.append((line_no, depth, lines[line_no-1].strip()[:100]))
            depth = 0
    i += 1

print('Final depth:', depth)
print('Under-runs (extra close braces):', len(issues))
for ln, d, content in issues[:20]:
    print(f'  Line {ln}: {content}')
