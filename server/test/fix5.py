from pathlib import Path

p = Path("server/test/admin.test.ts")
s = p.read_text()
print("count 'Authorization: *** ${':", s.count("Authorization: *** ${"))
print("count 'Authorization: * \${':", s.count("Authorization: * ${"))
print("count 'Authorization: **':", s.count("Authorization: **"))

# Show the exact 40 chars around first Authorization token
i = s.find("Authorization")
print("first Authorization context:", repr(s[i:i+40]))

# Normalize all corrupt forms to the template-literal Bearer form.
# Forms seen: "Authorization: *** ${", "Authorization: ** ${", "Authorization: * ${",
# "Authorization: * ${", possibly with a backtick before Bearer.
import re
s2 = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
s2 = re.sub(r"Authorization:\s*\*+ \$\{", "Authorization: `Bearer ${", s2)
p.write_text(s2)
print("after normalization:")
print("  triple-star:", s2.count("Authorization: *** ${"))
print("  pattern * + \${:", len(re.findall(r"Authorization:\s*\*+ \$\{", s2)))
print("  template Bearer:", s2.count("Authorization: `Bearer ${"))
PYEOF