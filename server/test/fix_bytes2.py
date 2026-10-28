from pathlib import Path

p = Path("server/test/admin.test.ts")
raw = p.read_bytes()

# The corrupt token bytes: b"Authorization: *** ${"
old = b"Authorization: *** ${"
new = b"Authorization: `Bearer ${"

count = raw.count(old)
data = raw.replace(old, new)
p.write_bytes(data)
print("replaced:", count)
print("remaining old:", data.count(old))
print("template Bearer now:", data.count(new))
