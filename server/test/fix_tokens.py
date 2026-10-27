from pathlib import Path

p = Path("server/test/admin.test.ts")
s = p.read_text()

# The corruption is the literal 3-asterisk placeholder inserted by the shell
# backtick mangling: "Authorization: *** ${"  (three *, space, dollar, brace).
# The correct header form is "Authorization: `Bearer ${".
old = "Authorization: *** ${"
new = "Authorization: `Bearer ${"
count = s.count(old)
s = s.replace(old, new)
p.write_text(s)
print("replaced:", count)
print("remaining ***:", s.count(old))
# Ensure no header lacks a backtick before Bearer
import re
bad = re.findall(r"Authorization: [^\`]+Bearer", s)
print("headers without backtick:", bad[:5])
PYEOF