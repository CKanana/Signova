from pathlib import Path

p = Path("server/test/admin.test.ts")
raw = p.read_bytes()

# Show the exact bytes of line 140
lines = raw.split(b"\n")
print("total bytes:", len(raw))
print("lines:", len(lines))
idx = 139  # line 140
print("line 140 bytes:", lines[idx])
print("line 140 hex:", lines[idx].hex(" "))

# The token is: bytes 69-90 of the line (within "Authorization: *** ${...")
# We'll do a targeted byte replacement on the exact 18-byte sequence.
old = b"Authorization: *** ${"
print("old count in file:", raw.count(old))
new = b"Authorization: `Bearer ${"
data = raw.replace(old, new)
print("new count:", data.count(new))
print("remaining old:", data.count(old))

p.write_bytes(data)
print("written")
