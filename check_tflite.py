import struct, sys

path = "C:/Users/kanan/OneDrive/Desktop/Signova/apps/mobile-deaf-user/src/assets/model/signova_model.tflite"
data = open(path, "rb").read()
print("file size", len(data))

# TFLite file header
magic = data[:4]
version = struct.unpack("<I", data[4:8])[0]
pub = data[8:12]
buf_len = struct.unpack("<I", data[12:16])[0]
buf_offset = struct.unpack("<I", data[16:20])[0]
end_off = struct.unpack("<I", data[20:24])[0]
print("header: magic", magic.hex(), "version", version, "buf_len", buf_len, "buf_offset", buf_offset)

buf = data[buf_offset:]
print("buffer region len", len(buf))

def u32(b, o): return struct.unpack("<I", b[o:o+4])[0]
def s32(b, o): return struct.unpack("<i", b[o:o+4])[0]
def u64(b, o): return struct.unpack("<Q", b[o:o+8])[0]

# flatbuffer: root table
root = u32(buf, 0)
print("root offset", root)
vt = root - 4
vcount = u32(buf, vt)
print("vtable_size", vcount)

def field(i):
    return s32(buf, vt + 4 + i*4)

for i in range(vcount):
    print(f"field[{i}] offset {field(i)}")

tensors_off = field(11)  # tensors
print("tensors_off", tensors_off)

def read_vector_of_uint64(vec_off):
    if vec_off == 0:
        return 0, 0
    n = u32(buf, vec_off)
    d = vec_off + 4
    return n, d

def read_tensor(t_off):
    name_off = u64(buf, t_off + 3*8)
    num_dims = u32(buf, t_off + 8*8)
    dim_off = u64(buf, t_off + 9*8)
    dims = []
    if dim_off:
        n = u32(buf, dim_off)
        ddata = dim_off + 4
        for i in range(n):
            dims.append(struct.unpack("<q", buf[ddata+i*8 : ddata+i*8+8])[0])
    name = ""
    if name_off:
        ln = buf[name_off]
        name = buf[name_off+1:name_off+1+ln].decode("utf-8", errors="replace")
    return name, dims

def read_string(s_off):
    if s_off == 0: return ""
    ln = buf[s_off]
    return buf[s_off+1:s_off+1+ln].decode("utf-8", errors="replace")

n, d = read_vector_of_uint64(tensors_off)
print("num tensors", n)
for i in range(n):
    t_off = u64(buf, d + i*8)
    name, dims = read_tensor(t_off)
    print(f"tensor[{i}] {name} dims={dims}")

# inputs (field 16) and outputs (field 17)
print("--- INPUTS ---")
n_in, d_in = read_vector_of_uint64(field(16))
for i in range(n_in):
    t_off = u64(buf, d_in + i*8)
    name, dims = read_tensor(t_off)
    print(f"input[{i}] {name} dims={dims}")
print("--- OUTPUTS ---")
n_out, d_out = read_vector_of_uint64(field(17))
for i in range(n_out):
    t_off = u64(buf, d_out + i*8)
    name, dims = read_tensor(t_off)
    print(f"output[{i}] {name} dims={dims}")

# also find all tensor names via string search
print("--- all tensor-like names found in buffer ---")
import re
for m in re.finditer(rb'[a-zA-Z_][a-zA-Z0-9_]*', buf):
    s = m.group().decode('utf-8', errors='replace')
    if len(s) > 2 and (s.startswith('input') or s.startswith('output') or s in ('landmark_sequence','landmarks','labels','num_classes')):
        pass
