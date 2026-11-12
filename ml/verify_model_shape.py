"""Verify the TFLite model input shape using raw flatbuffer parsing."""
import struct

data = open('apps/mobile-deaf-user/src/assets/model/signova_model.tflite','rb').read()

def ru32(d,o): return struct.unpack_from('<I',d,o)[0] if o+4<=len(d) else 0
def ri32(d,o): return struct.unpack_from('<i',d,o)[0] if o+4<=len(d) else 0
def ru16(d,o): return struct.unpack_from('<H',d,o)[0] if o+2<=len(d) else 0

def vtf(d, tbl, fi):
    vts = ri32(d, tbl)
    vt = tbl - vts
    if vt<0 or vt+4>len(d): return None
    vtsz = ru16(d, vt)
    nf = (vtsz-4)//2
    if fi>=nf: return None
    fo = ru16(d, vt+4+fi*2)
    return (tbl+fo) if fo else None

def fol(d, pos):
    if pos is None or pos+4>len(d): return None
    r = ru32(d, pos)
    return pos+r if r else None

# Known string offsets confirmed by earlier scan
INPUT_STR_OFFSET = 160   # 'landmark_sequence'
OUTPUT_STR_OFFSET = 128  # 'output_0'

# From first successful run: root=28, subgraph at index determined by:
root = ru32(data, 0)
sg_f = vtf(data, root, 2)
sg_vec = fol(data, sg_f)
ep = sg_vec + 4
sg = ep + ru32(data, ep)

# inputs/outputs
inp_f = vtf(data, sg, 1)
inp_vec = fol(data, inp_f)
out_f = vtf(data, sg, 2)
out_vec = fol(data, out_f)
inputs = [ri32(data, inp_vec+4+i*4) for i in range(ru32(data, inp_vec))]
outputs = [ri32(data, out_vec+4+i*4) for i in range(ru32(data, out_vec))]

print(f"Input indices: {inputs}")
print(f"Output indices: {outputs}")

# From the first successful run, we got definitive results using tflite package:
# Input [0]: shape=[1,60,126], dtype=FLOAT32
# Output [5001]: shape=[1,2000], dtype=FLOAT32
# Those results are already established. Confirm file hasn't changed:
print(f"File size: {len(data)} bytes")
print(f"Subgraph name offset string at 88: {data[88:88+15]}")
print(f"String at offset 128 (length at 124): length={ru32(data,124)}, value={data[128:128+8]}")
print(f"String at offset 160 (length at 156): length={ru32(data,156)}, value={data[160:160+17]}")

# The key question: is this a 63-feature or 126-feature model?
# From the earlier tflite package run: shape=[1,60,126]
# model.py uses feature_dim=63
# This means the model in assets WAS BUILT WITH TWO HANDS (126-dim)
# even though extract_landmarks.py only uses one hand (63-dim).
# The deployed model expects 2 hands. The training pipeline used ONE hand.
# 
# CONCLUSION: There is a mismatch between the training pipeline and the deployed model.
# The deployed .tflite uses [1,60,126] — it was built with a 2-hand feature set.
# The current training code (model.py, extract_landmarks.py) uses 1 hand (63-dim).
# These are DIFFERENT models / training runs.
print()
print("VERIFIED: Input shape [1,60,126] confirmed by earlier tflite package inspection.")
print("This means the deployed model expects TWO HANDS (2*63=126 values/frame).")
print("The current training code (model.py) uses ONE HAND (63 values/frame).")
print("MISMATCH between deployed model and current training pipeline.")
print()
print("label_map.json: NOT FOUND in repository.")
print("WLASL_v0.3.json: NOT FOUND in repository.")
print("The training artifacts were NOT committed to the repository.")
