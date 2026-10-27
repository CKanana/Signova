from pathlib import Path

p = Path("server/test/admin.test.ts")
data = p.read_bytes()
lines = data.split(b"\n")
l140 = lines[139]

print("line 140 repr:")
print(repr(l140))
print()
print("len:", len(l140))
print()
for i in range(0, len(l140), 16):
    chunk = l140[i:i+16]
    hexstr = chunk.hex(" ")
    ascii_str = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
    print(f"{i:3d}  {hexstr:<47}  {ascii_str}")
