"""Fix corrupted Authorization header tokens in server/test/admin.test.ts.

Corrupt form: Authorization: *** ${token}``
The opening backtick has been replaced by "*** ".

This script builds all special characters via chr() so that no literal
backtick or dollar sign appears in this source. This avoids the
file-writer tool's template-literal mangling.
"""
from pathlib import Path

p = Path("server/test/admin.test.ts")
s = p.read_text(encoding="utf-8")

# Build special characters via chr()
BT = chr(96)   # backtick
DB = chr(36)   # dollar sign
SP = chr(32)   # space

# Corrupt pattern: "Authorization: *** ${"
corrupt_pat = "Authorization: " + "*** " + DB + "{"

before = s.count(corrupt_pat)
print("corrupt tokens before:", before)

# Restore: "*** ${" -> "`Bearer ${"
s = s.replace(corrupt_pat, "Authorization: " + BT + SP + "Bearer " + DB + "{")

p.write_text(s, encoding="utf-8")

# Verify
s2 = p.read_text(encoding="utf-8")
bt_pat = "Authorization: " + BT + SP + "Bearer " + DB + "{"
print("template Bearer headers:", s2.count(bt_pat))
print("remaining ***:", s2.count("Authorization: " + "*** "))
print("total Authorization:", s2.count("Authorization"))
