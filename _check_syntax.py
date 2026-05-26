with open('campaign-mode.js', 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

# Find all backtick characters in lines 2435-2500 that might indicate unclosed template literals
for line_num in range(2435, 2500):
    line = lines[line_num - 1]
    if '`' in line:
        count = line.count('`')
        print(f'L{line_num} ({count} backtick{"s" if count>1 else ""}): {line.strip()[:100]}')

# Also check: what is string_char after line 2435?
print('\nTracking string state through 2435-2500:')
in_string = False
string_char = None
depth = 0
# First process lines 1-2435 to get proper state
for line_num in range(1, 2436):
    line = lines[line_num - 1]
    j = 0
    while j < len(line):
        ch = line[j]
        if in_string:
            if ch == '\\':
                j += 2
                continue
            if ch == string_char:
                in_string = False
        else:
            if ch in ('"', "'", '`'):
                in_string = True
                string_char = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
        j += 1

print(f'State at end of line 2435: in_string={in_string} string_char={repr(string_char)} depth={depth}')

# Now process 2436-2500 and report string state changes
for line_num in range(2436, 2500):
    line = lines[line_num - 1]
    j = 0
    prev_string = in_string
    while j < len(line):
        ch = line[j]
        if in_string:
            if ch == '\\':
                j += 2
                continue
            if ch == string_char:
                in_string = False
        else:
            if ch in ('"', "'", '`'):
                in_string = True
                string_char = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
        j += 1
    if in_string and not prev_string:
        print(f'L{line_num}: STRING OPENED but NOT CLOSED! char={repr(string_char)} depth={depth}')
        print(f'  Line: {line.strip()[:100]}')
    elif not in_string and prev_string:
        print(f'L{line_num}: string closed. depth={depth}')




