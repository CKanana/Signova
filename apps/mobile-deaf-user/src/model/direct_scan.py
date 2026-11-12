"""
Direct scan approach: find tensor tables by locating their name string offsets.
In TFLite flatbuffers, a Tensor table has a name field that stores a relative
offset pointing to the string. We can find the tensor table by searching for
the offset that resolves to the known string position.
"""
import struct, sys

data = open('apps/mobile-deaf-user/src/assets/model/signova_model.tflite','rb').read()

def ru32(d,o): return struct.unpack_from('<I',d,o)[0] if o+4<=len(d) else 0
def ri32(d,o): return struct.unpack_from('<i',d,o)[0] if o+4<=len(d) else 0
def ru16(d,o): return struct.unpack_from('<H',d,o)[0] if o+2<=len(d) else 0

# Known string positions (from earlier scan):
#   'output_0'          at 128  (preceded by length 8 at offset 124)
#   'landmark_sequence' at 160  (preceded by length 17 at offset 156)

# Verify
def read_str(pos):
    n = ru32(data, pos-4)
    return data[pos:pos+n].decode('utf-8','replace'), n

s1, n1 = read_str(128)
s2, n2 = read_str(160)
print(f"String at 128: {s1!r} (len={n1})")
print(f"String at 160: {s2!r} (len={n2})")
print()

# In a flatbuffer Tensor table:
# field 0 (name) offset within table -> points to the string
# The string is stored at: field_absolute_pos + relative_offset_stored_there
# So we need: field_pos + stored_u32 = string_pos
# => stored_u32 = string_pos - field_pos
# => field_pos = string_pos - stored_u32
#
# We know that for 'landmark_sequence' at 160:
#   The field that points to it satisfies: field_pos + ru32(data, field_pos) = 160
#   => ru32(data, field_pos) = 160 - field_pos
#
# Scan for positions where this is true (field_pos near tensor table start)

print("Scanning for tensor table that references 'landmark_sequence' (offset 160)...")
candidates_input = []
for pos in range(60, 200000, 4):
    if pos + 4 > len(data): break
    stored = ru32(data, pos)
    if stored > 0 and pos + stored == 160:
        candidates_input.append(pos)
        print(f"  field at {pos}: stored={stored}, resolves to 160 OK")

print()
print("Scanning for tensor table that references 'output_0' (offset 128)...")
candidates_output = []
for pos in range(60, 200000, 4):
    if pos + 4 > len(data): break
    stored = ru32(data, pos)
    if stored > 0 and pos + stored == 128:
        candidates_output.append(pos)
        print(f"  field at {pos}: stored={stored}, resolves to 128 OK")

print()
# For each candidate name-field position, the tensor table starts some bytes before it.
# In TFLite schema (schema_generated.h), Tensor fields in vtable order:
# field 0 = name (offset 0 within data section, so vtable says offset=4 typically)
# The data section starts at table_start + 4 (after the vtable soffset)
# If the name field has vtable offset=4, then: field_pos = table_start + 4
# So table_start = field_pos - 4

# Try to extract shape from tensor tables for input
TYPES = {0:'FLOAT32',1:'FLOAT16',2:'INT32',3:'UINT8',4:'INT64',9:'INT8'}

def try_read_tensor(name_field_pos, label):
    # The tensor table data section starts at name_field_pos (if vtable offset for name = 4)
    # table_start = name_field_pos - 4
    # The vtable soffset is at table_start, pointing back to vtable
    table_start = name_field_pos - 4
    if table_start < 0 or table_start + 4 > len(data): return

    vt_soff = ri32(data, table_start)
    vt = table_start - vt_soff
    if vt < 0 or vt + 8 > len(data): return

    vt_size = ru16(data, vt)
    n_fields = (vt_size - 4) // 2
    print(f"  [{label}] table_start={table_start}, vtable at {vt}, vtable_size={vt_size}, n_fields={n_fields}")

    # Read all field offsets
    fields = []
    for i in range(n_fields):
        fo = ru16(data, vt + 4 + i*2)
        fields.append(fo)
    print(f"  field offsets: {fields}")

    # field 0 = name, field 1 = type, field 2 = shape, field 3 = quantization
    for fi, fo in enumerate(fields[:6]):
        if fo == 0: continue
        fpos = table_start + fo
        if fpos + 4 > len(data): continue
        raw = ru32(data, fpos)
        print(f"  field {fi} at +{fo} (abs {fpos}): raw_u32={raw}, raw_i32={ri32(data,fpos)}")

        if fi == 1:  # type (scalar int)
            print(f"    -> TYPE = {TYPES.get(ri32(data,fpos), ri32(data,fpos))}")

        if fi == 2:  # shape (vector of int32)
            # Try to read as a vector
            vec_pos = fpos + raw
            if vec_pos + 4 <= len(data):
                cnt = ru32(data, vec_pos)
                if 0 < cnt < 10:
                    shape = [ri32(data, vec_pos+4+i*4) for i in range(cnt) if vec_pos+4+(i+1)*4 <= len(data)]
                    print(f"    -> SHAPE = {shape}")
                    n_elem = 1
                    for d in shape: n_elem *= d
                    print(f"    -> ELEMENTS = {n_elem}")

print("=== INPUT TENSOR (landmark_sequence) ===")
for c in candidates_input[:5]:
    try_read_tensor(c, "input")
    print()

print("=== OUTPUT TENSOR (output_0) ===")
for c in candidates_output[:5]:
    try_read_tensor(c, "output")
    print()
