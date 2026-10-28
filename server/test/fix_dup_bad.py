from pathlib import Path

p = Path("server/test/admin.test.ts")
s = p.read_text()

# 1) Fix the single corrupt header in the Gmail-policy block:
#    "Authorization: *** ${a}`" -> "Authorization: `Bearer ${a}`"
s = s.replace("Authorization: *** ${a}", "Authorization: `Bearer ${a}")

# 2) Rename the duplicate `const bad` in section [6] so it doesn't clash
#    with the one declared in section [2].
old = "console.log(\"\\n[6] Staff creation + Gmail policy\");\n  const bad = await j(\"/api/admin/staff\", {"
new = "console.log(\"\\n[6] Staff creation + Gmail policy\");\n  const gmailBad = await j(\"/api/admin/staff\", {"
if old in s:
    s = s.replace(old, new)
    print("renamed section-6 const bad -> gmailBad")
else:
    print("section-6 block NOT found")

# 3) Update the check that referenced the renamed variable.
old_check = 'check("gmail policy 400", bad.status === 400, `got ${bad.status}`);'
new_check = 'check("gmail policy 400", gmailBad.status === 400, `got ${gmailBad.status}`);'
if old_check in s:
    s = s.replace(old_check, new_check)
    print("updated gmail policy check to gmailBad")
else:
    print("gmail policy check block NOT found")

p.write_text(s)
print("template Bearer headers:", s.count("Authorization: `Bearer ${"))
print("remaining ***:", s.count("Authorization: ***"))
print("gmailBad refs:", s.count("gmailBad"))
print("duplicate const bad:", s.count("const bad = await j(\"/api/admin/staff\""))
