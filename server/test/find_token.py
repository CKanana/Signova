from pathlib import Path

p = Path("server/test/admin.test.ts")
data = p.read_bytes()

# Find the exact corrupt token bytes. The token is:
#   Authorization: *** ${g.body.challengeToken}
# i.e. the bytes for "Authorization: *** ${" followed by "g.body.challengeToken`"
# Let's enumerate all occurrences of "Authorization" in the file.
idx = 0
count = 0
while True:
    i = data.find(b"Authorization", idx)
    if i == -1:
        break
    count += 1
    print(f"Authorization #{count} at byte {i}:")
    print("   ", data[i:i+40])
    idx = i + 8

print("total Authorization occurrences:", count)
