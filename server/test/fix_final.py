from pathlib import Path

p = Path("server/test/admin.test.ts")
s = p.read_text()

# Fix corrupt Authorization headers: "Authorization: *** ${A" -> "Authorization: `Bearer ${A"
s = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")

# Also catch the variant where a backtick sits before the asterisks.
s = s.replace("Authorization: `* `Bearer", "Authorization: `Bearer")

# Catch any residual "*** `"Bearer ..."
import re
s2 = re.sub(r"Authorization:\s*\*+ \`?Bearer\s*\$\{", "Authorization: `Bearer ${", s)
s = s2

p.write_text(s)

print("template Bearer headers:", s.count("Authorization: `Bearer ${"))
print("remaining ***:", s.count("Authorization: ***"))
