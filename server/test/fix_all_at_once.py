from pathlib import Path
import re

p = Path("server/test/admin.test.ts")
data = p.read_bytes()
s = data.decode("utf-8")

# Normalise CRLF -> LF (the corrupt writer wrote CRLF line endings).
s = s.replace("\r\n", "\n").replace("\r", "\n")

# Fix corrupt Authorization tokens:
#   "Authorization: *** ${"   ->   "Authorization: `Bearer ${"
s = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
# Variant with a stray backtick before the asterisks:
s = s.replace("Authorization: `* `Bearer", "Authorization: `Bearer")
# Regex fallback for any repeated-asterisk variant.
s = re.sub(r"Authorization:\s*\*+ \$\{", "Authorization: `Bearer ${", s)

# The duplicate `const bad`: section [2] keeps one `const bad` (non-admin
# blocked check). The Gmail-policy section must use a distinct name.
s = s.replace(
    'console.log("\\n[6] Staff creation + Gmail policy");\n  const bad = await j("/api/admin/staff", {',
    'console.log("\\n[6] Staff creation + Gmail policy");\n  const gmailBad = await j("/api/admin/staff", {',
)
s = s.replace(
    'check("gmail policy 400", bad.status === 400, `got ${bad.status}`);',
    'check("gmail policy 400", gmailBad.status === 400, `got ${gmailBad.status}`);',
)

p.write_text(s, encoding="utf-8")
print("fixed; template Bearer:", s.count("Authorization: `Bearer ${"), "remaining ***:", s.count("Authorization: ***"))
