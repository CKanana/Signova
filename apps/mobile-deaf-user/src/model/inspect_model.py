#!/usr/bin/env python3
"""Phase 1 - TFLite model contract inspection (safe version)."""
import struct, sys

MODEL_PATH = "apps/mobile-deaf-user/src/assets/model/signova_model.tflite"

def ru32(data, off): return struct.unpack_from('<I', data, off)[0] if off + 4 <= len(data) else 0
def ri32(data, off): return struct.unpack_from('<i', data, off)[0] if off + 4 <= len(data) else 0
def ru16(data, off): return struct.unpack_from('<H', data, off)[0] if off + 2 <= len(data) else 0

def follow(data, pos):
    if pos is None or pos + 4 > len(data): return None
    rel = ru32(data, pos)
    return (pos + rel) if rel else None

def read_str(data, off):
    if off is None or off + 4 > len(data): return ""
    n = ru32(data, off)
    if off + 4 + n > len(data): return ""
    return data[off+4:off+4+n].decode('utf-8', errors='replace')

def read_vec_i32(data, off):
    if off is None or off + 4 > len(data): return []
    n = ru32(data, off)
    out = []
    for i in range(n):
        p = off + 4 + i * 4
        if p + 4 > len(data): break
        out.append(ri32(data, p))
    return out

def vtable_field(data, table, field_idx):
    if table is None or table + 4 > len(data): return None
    vt_soff = ri32(data, table)
    vt = table - vt_soff
    if vt + 4 > len(data): return None
    vt_size = ru16(data, vt)
    n_fields = (vt_size - 4) // 2
    if field_idx >= n_fields: return None
    foff = ru16(data, vt + 4 + field_idx * 2)
    return (table + foff) if foff else None

def get_tensor_info(data, tens_vec, t_idx):
    if t_idx < 0: return None
    n = ru32(data, tens_vec)
    if t_idx >= n: return None
    ep = tens_vec + 4 + t_idx * 4
    if ep + 4 > len(data): return None
    rel = ru32(data, ep)
    t_start = ep + rel

    TYPES = {0:'FLOAT32',1:'FLOAT16',2:'INT32',3:'UINT8',4:'INT64',
             5:'STRING',6:'BOOL',7:'INT16',8:'COMPLEX64',9:'INT8',10:'FLOAT64'}

    name = ""
    nf = vtable_field(data, t_start, 0)
    if nf:
        noff = follow(data, nf)
        name = read_str(data, noff)

    ttype = 0
    tf = vtable_field(data, t_start, 1)
    if tf and tf + 4 <= len(data):
        ttype = ri32(data, tf)

    shape = []
    sf = vtable_field(data, t_start, 2)
    if sf:
        soff = follow(data, sf)
        if soff:
            shape = read_vec_i32(data, soff)

    # Quantization (field 3) — scale and zero_point
    qscale, qzp = [], []
    qf = vtable_field(data, t_start, 3)
    if qf:
        qoff = follow(data, qf)
        if qoff:
            # QuantizationParameters: 0=min, 1=max, 2=scale, 3=zero_point
            scale_f = vtable_field(data, qoff, 2)
            if scale_f:
                sv = follow(data, scale_f)
                if sv:
                    cnt = ru32(data, sv)
                    for i in range(min(cnt, 4)):
                        p = sv + 4 + i * 4
                        if p + 4 <= len(data):
                            qscale.append(struct.unpack_from('<f', data, p)[0])
            zp_f = vtable_field(data, qoff, 3)
            if zp_f:
                zpv = follow(data, zp_f)
                if zpv:
                    cnt = ru32(data, zpv)
                    for i in range(min(cnt, 4)):
                        p = zpv + 4 + i * 4
                        if p + 4 <= len(data):
                            qzp.append(ri32(data, p))

    return {
        'name': name,
        'type': TYPES.get(ttype, f'?{ttype}'),
        'shape': shape,
        'quant_scale': qscale,
        'quant_zero': qzp,
    }

def main():
    data = open(MODEL_PATH, 'rb').read()
    print("=" * 60)
    print("SIGNOVA MODEL CONTRACT REPORT")
    print("=" * 60)
    print(f"Size: {len(data)} bytes ({len(data)/1024/1024:.3f} MB)")

    root = ru32(data, 0)
    desc_f = vtable_field(data, root, 3)
    if desc_f:
        print(f"Description: {read_str(data, follow(data, desc_f))!r}")

    sg_f = vtable_field(data, root, 2)
    sg_vec = follow(data, sg_f)
    sg_count = ru32(data, sg_vec)
    print(f"Subgraphs: {sg_count}")
    print()

    for sg_i in range(sg_count):
        ep = sg_vec + 4 + sg_i * 4
        sg = ep + ru32(data, ep)

        name_f = vtable_field(data, sg, 4)
        sg_name = read_str(data, follow(data, name_f)) if name_f else ""
        print(f"--- Subgraph {sg_i}: {sg_name!r} ---")

        inp_f = vtable_field(data, sg, 1)
        inputs = read_vec_i32(data, follow(data, inp_f)) if inp_f else []
        out_f = vtable_field(data, sg, 2)
        outputs = read_vec_i32(data, follow(data, out_f)) if out_f else []
        print(f"  Input indices:  {inputs}")
        print(f"  Output indices: {outputs}")

        tens_f = vtable_field(data, sg, 0)
        tv = follow(data, tens_f)
        total = ru32(data, tv) if tv else 0
        print(f"  Total tensors:  {total}")
        print()

        print("  INPUT TENSORS:")
        for idx in inputs:
            info = get_tensor_info(data, tv, idx)
            if info:
                n_elements = 1
                for d in info['shape']: n_elements *= d
                n_bytes = n_elements * (4 if info['type'] == 'FLOAT32' else 1)
                print(f"    [{idx}] name={info['name']!r}")
                print(f"         type={info['type']}  shape={info['shape']}")
                print(f"         elements={n_elements}  bytes={n_bytes}")
                if info['quant_scale']:
                    print(f"         quant scale={info['quant_scale']}  zero={info['quant_zero']}")
                else:
                    print(f"         quantization: none (float32)")

        print()
        print("  OUTPUT TENSORS:")
        for idx in outputs:
            info = get_tensor_info(data, tv, idx)
            if info:
                n_elements = 1
                for d in info['shape']: n_elements *= d
                print(f"    [{idx}] name={info['name']!r}")
                print(f"         type={info['type']}  shape={info['shape']}")
                print(f"         elements={n_elements}  (= num classes)")
                if info['quant_scale']:
                    print(f"         quant scale={info['quant_scale']}  zero={info['quant_zero']}")
                else:
                    print(f"         quantization: none (float32)")

    print()
    print("=" * 60)
    print("OPERATOR / LAYER SCAN")
    print("=" * 60)
    # Count operators to infer architecture
    for sg_i in range(min(1, sg_count)):
        ep = sg_vec + 4 + sg_i * 4
        sg = ep + ru32(data, ep)
        ops_f = vtable_field(data, sg, 3)
        ops_vec = follow(data, ops_f)
        if ops_vec:
            n_ops = ru32(data, ops_vec)
            print(f"  Operator count: {n_ops}")

    # Operator codes (from root Model table, field 1)
    oc_f = vtable_field(data, root, 1)
    oc_vec = follow(data, oc_f)
    if oc_vec:
        n_oc = ru32(data, oc_vec)
        print(f"  Unique operator types: {n_oc}")
        # BuiltinOperator enum (partial)
        BUILTIN = {0:'ADD',1:'AVG_POOL_2D',3:'CONV_2D',4:'DEPTHWISE_CONV_2D',
                   6:'DEQUANTIZE',7:'EMBEDDING_LOOKUP',9:'FULLY_CONNECTED',
                   14:'LOGISTIC',18:'MAX_POOL_2D',25:'RESHAPE',26:'RESIZE_BILINEAR',
                   27:'RNN',28:'SOFTMAX',29:'SPACE_TO_DEPTH',31:'TANH',
                   35:'UNIDIRECTIONAL_SEQUENCE_LSTM',44:'EXP',55:'PACK',
                   56:'L2_NORMALIZATION',57:'LOCAL_RESPONSE_NORMALIZATION',
                   63:'CAST',65:'TRANSPOSE',70:'BATCH_TO_SPACE_ND',71:'SPACE_TO_BATCH_ND',
                   80:'MUL',81:'ABS',82:'SPLIT',83:'SIN',84:'TILE',85:'NEG',
                   86:'TRANSPOSE_CONV',87:'SPARSE_TO_DENSE',88:'SHAPE',89:'POW',
                   90:'REDUCE_PROD',91:'REDUCE_MAX',92:'PACK',93:'SLICE',
                   94:'SUM',95:'ARG_MAX',96:'ARG_MIN',99:'LESS',100:'GREATER',
                   103:'STRIDED_SLICE',104:'SQRT',105:'RSQRT',106:'SHAPE',
                   107:'FILL',108:'FLOOR_MOD',109:'RANGE',110:'RESIZE_NEAREST_NEIGHBOR',
                   111:'LEAKY_RELU',112:'SQUARED_DIFFERENCE',113:'MIRROR_PAD',
                   114:'ABS',115:'SPLIT_V',116:'UNIQUE',117:'CEIL',118:'REVERSE_V2',
                   119:'ADD_N',120:'GATHER_ND',121:'COS',122:'WHERE',
                   123:'RANK',124:'ELU',125:'REVERSE_SEQUENCE',126:'MATRIX_DIAG',
                   127:'QUANTIZE',128:'MATRIX_SET_DIAG',129:'ROUND',
                   130:'HARD_SWISH',131:'IF',132:'WHILE',133:'NON_MAX_SUPPRESSION_V4',
                   134:'NON_MAX_SUPPRESSION_V5',135:'SCATTER_ND',136:'SELECT_V2',
                   137:'DENSIFY',138:'SEGMENT_SUM',139:'BATCH_MATMUL',
                   141:'PLACEHOLDER_FOR_GREATER_OP_CODES',142:'CUMSUM',
                   143:'CALL_ONCE',144:'BROADCAST_TO',145:'RFFT2D',146:'CONV_3D',
                   147:'IMAG',148:'REAL',149:'COMPLEX_ABS',150:'HASHTABLE',
                   151:'HASHTABLE_FIND',152:'HASHTABLE_IMPORT',153:'HASHTABLE_SIZE',
                   154:'REDUCE_ALL',155:'CONV_3D_TRANSPOSE',156:'VAR_HANDLE',
                   157:'READ_VARIABLE',158:'ASSIGN_VARIABLE',159:'BROADCAST_ARGS',
                   160:'RANDOM_STANDARD_NORMAL',161:'BUCKETIZE',162:'RANDOM_UNIFORM',
                   163:'MULTINOMIAL',164:'GELU',165:'DYNAMIC_UPDATE_SLICE',
                   166:'RELU_0_TO_1',167:'UNSORTED_SEGMENT_PROD',168:'UNSORTED_SEGMENT_MAX',
                   169:'UNSORTED_SEGMENT_SUM',170:'ATAN2',171:'SIGN',172:'BITCAST',
                   173:'BITWISE_XOR',174:'RIGHT_SHIFT',}

        unique_codes = set()
        for i in range(n_oc):
            ep = oc_vec + 4 + i * 4
            oc_start = ep + ru32(data, ep)
            # OperatorCode: field 0 = builtin_code (int8/deprecated), field 4 = builtin_code_new (int32)
            bc_f = vtable_field(data, oc_start, 0)
            bc_new_f = vtable_field(data, oc_start, 4)
            code = 0
            if bc_new_f and bc_new_f + 4 <= len(data):
                code = ri32(data, bc_new_f)
            elif bc_f and bc_f + 1 <= len(data):
                code = data[bc_f]
            unique_codes.add(code)
        named = [BUILTIN.get(c, f'op_{c}') for c in sorted(unique_codes)]
        print(f"  Op types: {named}")

    print()
    print("=" * 60)
    print("LABEL / METADATA SCAN")
    print("=" * 60)
    # Scan for label-like strings
    label_candidates = []
    i = 0
    while i < len(data) - 1:
        if 65 <= data[i] <= 122:  # A-z
            j = i
            while j < len(data) and (65 <= data[j] <= 122 or data[j] == 95 or 48 <= data[j] <= 57):
                j += 1
            word_len = j - i
            if 3 <= word_len <= 20 and data[j] == 0:
                word = data[i:j].decode('ascii')
                label_candidates.append((i, word))
            i = j
        else:
            i += 1

    # Filter for likely ASL/sign vocabulary words
    asl_likely = ['book', 'chair', 'before', 'clothes', 'computer', 'cousin',
                  'drink', 'go', 'hot', 'how', 'language', 'later', 'man',
                  'meet', 'more', 'mother', 'name', 'no', 'now', 'orange',
                  'play', 'school', 'study', 'tall', 'think', 'walk', 'what',
                  'who', 'woman', 'yes', 'your', 'fine', 'help', 'love',
                  'work', 'time', 'water', 'food', 'day', 'good', 'bad',
                  'big', 'come', 'want', 'stop', 'thank', 'please', 'sorry']
    found_vocab = [(off, w) for off, w in label_candidates if w.lower() in asl_likely]
    if found_vocab:
        print(f"  Found {len(found_vocab)} likely vocabulary words embedded in model:")
        for off, w in found_vocab[:20]:
            print(f"    offset {off:8d}: {w!r}")
    else:
        print("  No vocabulary words found embedded in model binary.")
        print("  Labels are NOT embedded — external labels.json is required.")

    # Check for MLIR/TFLite metadata
    known_meta = [b'TFLITE_METADATA', b'min_runtime_version', b'CONVERSION_METADATA',
                  b'serving_default', b'landmark_sequence', b'output_0']
    for kw in known_meta:
        pos = data.find(kw)
        if pos != -1:
            ctx = data[max(0,pos-10):min(len(data),pos+60)]
            printable = ''.join(chr(b) if 32<=b<=126 else '.' for b in ctx)
            print(f"  {kw!r:30s} @ {pos}: {printable!r}")

if __name__ == '__main__':
    main()
