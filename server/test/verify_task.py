from pathlib import Path

p = Path("server/test/admin.test.ts")
data = p.read_bytes()
s = data.decode("utf-8")
print("bytes:", len(data))
print("Authorization occurrences:", s.count("Authorization"))
print("template Bearer:", s.count("Authorization: `Bearer"))
print("corrupt *** token:", s.count("Authorization: ***"))
print("gmailBad refs:", s.count("gmailBad"))
print("const bad decls:", s.count("const bad = await j"))
for i, ln in enumerate(s.split("\n"), 1):
    if "authorization" in ln.lower() or "const bad" in ln or "gmailBad" in ln:
        print(f"  {i}:", repr(ln[:90]))
