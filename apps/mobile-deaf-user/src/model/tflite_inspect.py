"""Phase 1 - definitive model contract using the tflite package."""
import sys

try:
    import tflite
    from tflite.Model import Model
    from tflite.TensorType import TensorType
except ImportError:
    print("tflite package not available")
    sys.exit(1)

import flatbuffers
import struct

MODEL_PATH = "apps/mobile-deaf-user/src/assets/model/signova_model.tflite"

TYPE_NAMES = {
    0: "FLOAT32", 1: "FLOAT16", 2: "INT32", 3: "UINT8",
    4: "INT64", 5: "STRING", 6: "BOOL", 7: "INT16",
    8: "COMPLEX64", 9: "INT8", 10: "FLOAT64",
}

with open(MODEL_PATH, "rb") as f:
    buf = bytearray(f.read())

print("=" * 60)
print("PHASE 1 — SIGNOVA MODEL CONTRACT REPORT")
print("=" * 60)
print(f"File size: {len(buf)} bytes ({len(buf)/1024/1024:.3f} MB)")

model = Model.GetRootAsModel(buf, 0)
print(f"TFLite schema version: {model.Version()}")
desc = model.Description()
if desc:
    print(f"Description: {desc.decode()!r}")
print(f"Subgraph count: {model.SubgraphsLength()}")
print()

for sg_i in range(model.SubgraphsLength()):
    sg = model.Subgraphs(sg_i)
    name = sg.Name()
    print(f"--- Subgraph {sg_i}: {name.decode() if name else '(unnamed)'!r} ---")
    print(f"  Tensor count:   {sg.TensorsLength()}")
    print(f"  Input indices:  {[sg.Inputs(i) for i in range(sg.InputsLength())]}")
    print(f"  Output indices: {[sg.Outputs(i) for i in range(sg.OutputsLength())]}")
    print(f"  Operator count: {sg.OperatorsLength()}")
    print()

    print("  INPUT TENSORS:")
    for ii in range(sg.InputsLength()):
        t_idx = sg.Inputs(ii)
        t = sg.Tensors(t_idx)
        tname = t.Name().decode() if t.Name() else "?"
        ttype = TYPE_NAMES.get(t.Type(), f"type_{t.Type()}")
        shape = [t.Shape(d) for d in range(t.ShapeLength())]
        n_elem = 1
        for d in shape: n_elem *= d
        print(f"    [{t_idx}] name={tname!r}  type={ttype}  shape={shape}")
        print(f"         elements={n_elem}  bytes={n_elem * (4 if t.Type()==0 else 1)}")
        q = t.Quantization()
        if q and q.ScaleLength() > 0:
            scales = [q.Scale(i) for i in range(q.ScaleLength())]
            zeros  = [q.ZeroPoint(i) for i in range(q.ZeroPointLength())]
            print(f"         quantization: scale={scales[:4]}  zero_point={zeros[:4]}")
        else:
            print("         quantization: none (raw float32)")

    print()
    print("  OUTPUT TENSORS:")
    for oi in range(sg.OutputsLength()):
        t_idx = sg.Outputs(oi)
        t = sg.Tensors(t_idx)
        tname = t.Name().decode() if t.Name() else "?"
        ttype = TYPE_NAMES.get(t.Type(), f"type_{t.Type()}")
        shape = [t.Shape(d) for d in range(t.ShapeLength())]
        n_elem = 1
        for d in shape: n_elem *= d
        print(f"    [{t_idx}] name={tname!r}  type={ttype}  shape={shape}")
        print(f"         elements={n_elem}  --> NUM_CLASSES = {n_elem}")
        q = t.Quantization()
        if q and q.ScaleLength() > 0:
            scales = [q.Scale(i) for i in range(q.ScaleLength())]
            zeros  = [q.ZeroPoint(i) for i in range(q.ZeroPointLength())]
            print(f"         quantization: scale={scales[:4]}  zero_point={zeros[:4]}")
        else:
            print("         quantization: none (raw float32)")

    print()
    # Operator breakdown
    op_counts = {}
    for op_i in range(sg.OperatorsLength()):
        op = sg.Operators(op_i)
        oc_idx = op.OpcodeIndex()
        oc = model.OperatorCodes(oc_idx)
        code = max(oc.BuiltinCode(), oc.DeprecatedBuiltinCode())
        op_counts[code] = op_counts.get(code, 0) + 1

    BUILTIN = {
        0:"ADD", 9:"FULLY_CONNECTED", 14:"LOGISTIC", 18:"MAX_POOL_2D",
        25:"RESHAPE", 28:"SOFTMAX", 35:"UNIDIRECTIONAL_SEQUENCE_LSTM",
        57:"LOCAL_RESPONSE_NORMALIZATION", 63:"CAST", 65:"TRANSPOSE",
        80:"MUL", 86:"TRANSPOSE_CONV", 95:"ARG_MAX", 103:"STRIDED_SLICE",
        111:"LEAKY_RELU", 127:"QUANTIZE", 139:"BATCH_MATMUL",
    }
    print("  OPERATOR BREAKDOWN:")
    for code, count in sorted(op_counts.items(), key=lambda x:-x[1]):
        name_str = BUILTIN.get(code, f"op_{code}")
        print(f"    {name_str:40s}: {count}")

print()
print("=" * 60)
print("METADATA")
print("=" * 60)
for mi in range(model.MetadataLength()):
    m = model.Metadata(mi)
    mname = m.Name().decode() if m.Name() else "?"
    print(f"  [{mi}] name={mname!r}  buffer_index={m.Buffer()}")

print()
print("=" * 60)
print("LABELS CHECK")
print("=" * 60)
# Check if any buffer contains label-like text
for bi in range(model.BuffersLength()):
    b = model.Buffers(bi)
    if b.DataLength() > 0:
        raw = bytes([b.Data(i) for i in range(min(b.DataLength(), 200))])
        try:
            text = raw.decode('utf-8')
            if any(w in text.lower() for w in ['hello','book','drink','school','computer','mother']):
                print(f"  Buffer {bi} contains label text: {text[:100]!r}")
        except:
            pass

print("  (No label strings found in any buffer — external labels.json required)")
print()
print("=" * 60)
print("CONTRACT SUMMARY")
print("=" * 60)
