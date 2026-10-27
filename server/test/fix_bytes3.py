from pathlib import Path

p = Path("server/test/admin.test.ts")
raw = p.read_bytes()

# The corrupt token on line 140 is:
#   Authorization: *** ${g.body.challengeToken}
# i.e. "Authorization: *** ${" (17 bytes, ending with '{') followed by "g.body..."
old = b"Authorization: *** ${"
new = b"Authorization: `Bearer ${"

print("count of old:", raw.count(old))
data = raw.replace(old, new)
print("after replace, count of old:", data.count(old))
print("count of new:", data.count(new))

p.write_bytes(data)
print("written")
