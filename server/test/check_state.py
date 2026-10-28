from pathlib import Path

# Read the existing file to check its state.
p = Path("server/test/admin.test.ts")
print("exists:", p.exists())
print("size:", p.stat().st_size if p.exists() else 0)
print("first line:", p.read_text(encoding="utf-8").splitlines()[0] if p.exists() else "")
