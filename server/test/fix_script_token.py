from pathlib import Path
import re

p = Path("server/test/rebuild_admin2.py")
s = p.read_text()
before = s.count("Authorization: *** ${")
s = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
s = re.sub(r"Authorization:\s*\*+ \$\{", "Authorization: `Bearer ${", s)
p.write_text(s)
print("fixed in script:", before)
PYEOF