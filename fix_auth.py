from pathlib import Path

p = Path("server/test/admin.test.ts")
s = p.read_text(encoding="utf-8")

# Replace the corrupted line
old = "const authHeaders = (token: string) => ({ Authorization: *** ${token}` } as const);"
new = "const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` } as const);"

if old in s:
    s = s.replace(old, new)
    print("Replaced!")
else:
    print("Corruption not found")
    # Show all lines containing 'authHeaders'
    lines = s.split("\n")
    for i, line in enumerate(lines):
        if "authHeaders" in line:
            print(f"Line {i+1}: {repr(line)}")

p.write_text(s, encoding="utf-8")
print("Done")
