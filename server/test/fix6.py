from pathlib import Path
import re

p = Path("server/test/admin.test.ts")
s = p.read_text()

# The corrupt token is literally three asterisk characters followed by a
# space and a dollar-brace. Count it with a raw-looking pattern.
triple = s.count("Authorization: *** ${")
# Note: leading '$' in the count string would be special only inside f-strings;
# plain substring count of "Authorization: *** ${" works.
print("triple-star headers present:", triple)

# Normalize every corrupt form to the template-literal Bearer.
s2 = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
s2 = re.sub(r"Authorization:\s*\*+ \$\{", "Authorization: `Bearer ${", s2)

p.write_text(s2)
print("after normalization:")
print("  triple-star left:", s2.count("Authorization: *** ${"))
print("  pattern left:", len(re.findall(r"Authorization:\s*\*+ \$\{", s2)))
print("  template Bearer:", s2.count("Authorization: `Bearer ${"))
PYEOF