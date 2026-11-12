import struct
data=open('apps/mobile-deaf-user/src/assets/model/signova_model.tflite','rb').read()

def ru32(d,o): return struct.unpack_from('<I',d,o)[0] if o+4<=len(d) else 0
def ri32(d,o): return struct.unpack_from('<i',d,o)[0] if o+4<=len(d) else 0
def ru16(d,o): return struct.unpack_from('<H',d,o)[0] if o+2<=len(d) else 0

def vtf(d, tbl, fi):
    vts = ri32(d, tbl)
    vt = tbl - vts
    if vt<0 or vt+4>len(d): return None
    vtsz = ru16(d, vt)
    nf = (vtsz - 4) // 2
    if fi >= nf: return None
    fo = ru16(d, vt + 4 + fi*2)
    return (tbl + fo) if fo else None

def fol(d, pos):
    r = ru32(d, pos)
    return pos + r if r else None

root = ru32(data, 0)
sg_f = vtf(data, root, 2)
sg_vec_pos = fol(data, sg_f)
ep = sg_vec_pos + 4
sg = ep + ru32(data, ep)
tv_f = vtf(data, sg, 0)
tv = fol(data, tv_f)
total = ru32(data, tv)
print("Total tensors:", total)

inp_f = vtf(data, sg, 1)
inp_vec = fol(data, inp_f)
out_f = vtf(data, sg, 2)
out_vec = fol(data, out_f)

inp_indices = [ri32(data, inp_vec+4+i*4) for i in range(ru32(data, inp_vec))]
out_indices = [ri32(data, out_vec+4+i*4) for i in range(ru32(data, out_vec))]
print("Input tensor indices:", inp_indices)
print("Output tensor indices:", out_indices)

TYPES = {0:'FLOAT32',1:'FLOAT16',2:'INT32',3:'UINT8',4:'INT64',9:'INT8'}

def tensor_info(idx):
    ep2 = tv + 4 + idx*4
    if ep2+4 > len(data): return {}
    t_rel = ru32(data, ep2)
    t_start = ep2 + t_rel
    info = {'idx': idx}
    nf = vtf(data, t_start, 0)
    if nf:
        noff = fol(data, nf)
        if noff:
            nlen = ru32(data, noff)
            info['name'] = data[noff+4:noff+4+nlen].decode('utf-8','replace')
    tf2 = vtf(data, t_start, 1)
    if tf2: info['type'] = TYPES.get(ri32(data, tf2), str(ri32(data, tf2)))
    sf = vtf(data, t_start, 2)
    if sf:
        soff = fol(data, sf)
        if soff and soff+4 <= len(data):
            cnt = ru32(data, soff)
            if cnt < 20 and soff+4+cnt*4 <= len(data):
                info['shape'] = [ri32(data, soff+4+i*4) for i in range(cnt)]
    qf = vtf(data, t_start, 3)
    if qf:
        qoff = fol(data, qf)
        if qoff:
            sc_f = vtf(data, qoff, 2)
            if sc_f:
                sv = fol(data, sc_f)
                if sv and sv+4 <= len(data):
                    cnt_s = ru32(data, sv)
                    if cnt_s < 100 and sv+4+cnt_s*4 <= len(data):
                        info['quant_scales'] = [struct.unpack_from('<f',data,sv+4+i*4)[0] for i in range(cnt_s)]
            zp_f = vtf(data, qoff, 3)
            if zp_f:
                zv = fol(data, zp_f)
                if zv and zv+4 <= len(data):
                    cnt_z = ru32(data, zv)
                    if cnt_z < 100 and zv+4+cnt_z*4 <= len(data):
                        info['quant_zp'] = [ri32(data, zv+4+i*4) for i in range(cnt_z)]
    return info

print()
print("=== INPUT TENSORS ===")
for idx in inp_indices:
    info = tensor_info(idx)
    print(f"  [{idx}] name={info.get('name','?')!r}  type={info.get('type','?')}  shape={info.get('shape','?')}")
    qs = info.get('quant_scales',[])
    qz = info.get('quant_zp',[])
    if qs:
        print(f"       quant scale={qs}  zero={qz}")
    else:
        print("       no quantization (float32)")
    if 'shape' in info:
        n_elem = 1
        for d in info['shape']: n_elem *= d
        print(f"       elements={n_elem}  bytes={n_elem*4}")

print()
print("=== OUTPUT TENSORS ===")
for idx in out_indices:
    info = tensor_info(idx)
    print(f"  [{idx}] name={info.get('name','?')!r}  type={info.get('type','?')}  shape={info.get('shape','?')}")
    qs = info.get('quant_scales',[])
    qz = info.get('quant_zp',[])
    if qs:
        print(f"       quant scale={qs}  zero={qz}")
    else:
        print("       no quantization (float32)")
    if 'shape' in info:
        n_elem = 1
        for d in info['shape']: n_elem *= d
        print(f"       elements={n_elem}  -> NUM CLASSES = {n_elem}")
