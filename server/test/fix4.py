from pathlib import Path
import re

p = Path("server/test/admin.test.ts")
s = p.read_text()

# 1) Normalize the Authorization header corruption: three asterisks
#    "Authorization: *** ${" -> "Authorization: `Bearer ${"
before = s.count("Authorization: *** ${")
s = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
s = re.sub(r"Authorization:\s*\*+ \$\{", "Authorization: `Bearer ${", s)
print("triple-asterisk headers before:", before, "remaining:", s.count("Authorization: *** ${"))
print("template-literal Bearer headers:", s.count("Authorization: `Bearer ${"))

# 2) The gmail-policy test redeclares `const bad` which shadows/clashes with
#    the one from the "Non-admin access" test (let/const in same block scope).
#    Rename the gmail-policy one to `gmailBad` and point the check at it.
s = s.replace(
    'const bad = await j("/api/admin/staff", {\n    method: "POST",\n    headers: { Authorization: `Bearer ${adminAToken}` },\n    body: JSON.stringify({ name: "Bad"',
    'const gmailBad = await j("/api/admin/staff", {\n    method: "POST",\n    headers: { Authorization: `Bearer ${adminAToken}` },\n    body: JSON.stringify({ name: "Bad"',
)
s = s.replace(
    "check(\"gmail policy 400\", bad.status === 400, `got ${bad.status}`);",
    "check(\"gmail policy 400\", gmailBad.status === 400, `got ${gmailBad.status}`);",
)
s = s.replace(
    "const good = await j(\"/api/admin/staff\", {\n    method: \"POST\",\n    headers: { Authorization: `Bearer ${adminAToken}` },\n    body: JSON.stringify({ name: \"Good\"",
    "const good = await j(\"/api/admin/staff\", {\n    method: \"POST\",\n    headers: { Authorization: `Bearer ${adminAToken}` },\n    body: JSON.stringify({ name: \"Good\"",
)

p.write_text(s)
print("final template-literal Bearer headers:", s.count("Authorization: `Bearer ${"))
print("gmailBad references:", s.count("gmailBad"))
print("remaining const bad in gmail block:", s.count("const bad = await j(\"/api/admin/staff\""))
