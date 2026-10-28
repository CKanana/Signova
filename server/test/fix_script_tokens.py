from pathlib import Path

p = Path("server/test/rebuild_admin3.py")
s = p.read_text()

# 1) Fix Authorization header corruption in the script itself.
s = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
s = s.replace("Authorization: *** `${", "Authorization: `Bearer ${")

# 2) Rename the duplicate `const bad` in section [6] so it does not clash
#    with the one declared in section [2].
s = s.replace(
    'console.log("\\n[6] Staff creation + Gmail policy");\n  const bad = await j("/api/admin/staff", {',
    'console.log("\\n[6] Staff creation + Gmail policy");\n  const gmailBad = await j("/api/admin/staff", {',
)

p.write_text(s)
print("auth fixes applied:", s.count("Authorization: `Bearer ${"))
print("gmailBad refs:", s.count("gmailBad"))
print("dup bad in section6:", s.count('console.log("\\n[6] Staff creation + Gmail policy");\n  const bad'))
