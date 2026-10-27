from pathlib import Path
import re

p = Path("server/test/admin.test.ts")
s = p.read_text()

# The corrupt payload was written as "Authorization: *** ${" (three asterisks,
# a space, a dollar, an open brace). Replace the three asterisks with the
# template-literal open-backtick so every header reads
# "Authorization: `Bearer ${".
s2 = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
s2 = re.sub(r"Authorization:\s*\*+ \$\{", "Authorization: `Bearer ${", s2)
s2 = s2.replace("Authorization: ***`", "Authorization: `Bearer")
s2 = s2.replace("Authorization:`Bearer", "Authorization: `Bearer")

p.write_text(s2)
print("replaced triples:", s.count("Authorization: ***"))
print("remaining ***:", s2.count("Authorization: ***"))
print("backend literals:", s2.count("`Bearer"))
PYEOF