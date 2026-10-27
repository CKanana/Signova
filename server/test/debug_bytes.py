from pathlib import Path

p = Path("server/test/admin.test.ts")
raw = p.read_bytes()

# Find the exact corrupt token bytes in the file.
# The corruption is: "Authorization: *** ${"
# Let's find where it appears in the raw bytes of line 140.
lines = raw.split(b"\n")
l140 = lines[139]
print("line 140 len:", len(l140))
print("line 140 hex:", l140.hex(" "))

# Find "Authorization" in this line
idx = l140.find(b"Authorization")
print("Authorization at offset:", idx)
print("token bytes:", l140[idx:idx+30])
print("token hex:", l140[idx:idx+30].hex(" "))
