from pathlib import Path

p = Path("server/test/admin.test.ts")
raw = p.read_bytes()
# Decode with UTF-8, preserving CRLF for canonical line handling.
s = raw.decode("utf-8")
# First normalise CRLF -> LF so the substring replace works regardless of line endings.
s = s.replace("\r\n", "\n")

before = s.count("Authorization: *** ${")
# Replace the corrupt token: "Authorization: *** ${" -> "Authorization: `Bearer ${"
s = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
# Also handle the variant with a backtick before the asterisks if any.
s = s.replace("Authorization: `* `Bearer", "Authorization: `Bearer")

p.write_text(s)
print("replaced:", before)
print("remaining ***:", s.count("Authorization: ***"))
print("template Bearer count:", s.count("Authorization: `Bearer ${"))
# Re-encode CRLF (the project uses CRLF; keep it consistent).
p.write_bytes((s.replace("\n", "\r\n")).encode("utf-8"))
print("final CRLF lines:", raw.decode("utf-8").count("\r\n"))
