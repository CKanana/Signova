from pathlib import Path

p = Path("server/test/admin.test.ts")
data = p.read_bytes()

# Corrupt token: "Authorization: *** ${"  (with trailing space before the dollar-brace)
backtick = b"`"
old_token = b"Authorization: *** ${"
new_token = b"Authorization: " + backtick + b"Bearer ${"
print("corrupt token occurrences:", data.count(old_token))
data = data.replace(old_token, new_token)

# Rename the duplicate `const bad` in the Gmail-policy section [6].
old_bad = b'const bad = await j("/api/admin/staff", {'
new_bad = b'const gmailBad = await j("/api/admin/staff", {'
print("duplicate const bad:", data.count(old_bad))
data = data.replace(old_bad, new_bad)

# Update the check referencing the renamed variable.
old_check = b'check("gmail policy 400", bad.status === 400, `got ${bad.status}`);'
new_check = b'check("gmail policy 400", gmailBad.status === 400, `got ${gmailBad.status}`);'
print("gmail check:", data.count(old_check))
data = data.replace(old_check, new_check)

p.write_bytes(data)
print("written:", p)

# Now verify in the same process.
data2 = p.read_bytes()
print("verify corrupt token:", data2.count(old_token))
print("verify template Bearer:", data2.count(b"Authorization: `" + backtick + b"Bearer ${"))
print("verify gmailBad:", data2.count(b"const gmailBad = await j"))
print("verify const bad decls:", data2.count(b"const bad = await j(\"/api/admin/staff\""))
