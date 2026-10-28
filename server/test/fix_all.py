from pathlib import Path

p = Path("server/test/admin.test.ts")
data = p.read_bytes()

# Count all corrupt token occurrences across the whole file.
token = b"Authorization: *** ${"
count = data.count(token)
print("corrupt token occurrences:", count)

# Fix them all in one pass.
data = data.replace(token, b"Authorization: `Bearer ${")

# Rename the duplicate `const bad` in section [6].
old_bad = b'const bad = await j("/api/admin/staff", {'
new_bad = b'const gmailBad = await j("/api/admin/staff", {'
data = data.replace(old_bad, new_bad)

# Update the check referencing the renamed variable.
old_check = b'check("gmail policy 400", bad.status === 400, `got ${bad.status}`);'
new_check = b'check("gmail policy 400", gmailBad.status === 400, `got ${gmailBad.status}`);'
data = data.replace(old_check, new_check)

p.write_bytes(data)
print("written:", p)
print("final corrupt token:", data.count(token))
print("final template Bearer:", data.count(b"Authorization: `Bearer ${"))
print("final gmailBad:", data.count(b"const gmailBad"))
