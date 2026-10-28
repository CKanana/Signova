from pathlib import Path
import re

p = Path("server/test/admin.test.ts")
data = p.read_bytes()
s = data.decode("utf-8")

# Corruption pattern: "Authorization: *** ${"
bad_tokens = re.findall(r"Authorization:\s*\*+ \$\{", s)
print("bad tokens found:", len(bad_tokens))
for t in bad_tokens:
    print("  ", repr(t))

# Backtick Bearer count
print("template Bearer headers:", s.count("Authorization: `Bearer ${"))

# Duplicate const bad declarations
print("const bad decls:", s.count("const bad = await j(\"/api/admin/staff\""))

# gmailBad references
print("gmailBad refs:", s.count("gmailBad"))

# Show line 140
lines = s.split("\n")
print("--- line 140 ---")
print(repr(lines[139]))
