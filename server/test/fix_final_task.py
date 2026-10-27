from pathlib import Path

p = Path("server/test/admin.test.ts")
data = p.read_bytes()

# Corrupt token: b"Authorization: *** ${"
old = b"Authorization: *** ${"
new = b"Authorization: `Bearer ${"
print("corrupt token count:", data.count(old))
data = data.replace(old, new)

# Rename duplicate `const bad` in gmail-policy section [6]
old_bad = b'const bad = await j("/api/admin/staff", {'
new_bad = b'const gmailBad = await j("/api/admin/staff", {'
print("duplicate const bad count:", data.count(old_bad))
data = data.replace(old_bad, new_bad)

# Update check referencing renamed variable
old_check = b'check("gmail policy 400", bad.status === 400, `got ${bad.status}`);'
new_check = b'check("gmail policy 400", gmailBad.status === 400, `got ${gmailBad.status}`);'
print("gmail check count:", data.count(old_check))
data = data.replace(old_check, new_check)

p.write_bytes(data)
print("written")
