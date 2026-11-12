import struct
data = open('apps/mobile-deaf-user/src/assets/model/signova_model.tflite','rb').read()
print("File size:", len(data))

# TFLite format: 16-byte magic + header + flatbuffer
# magic[16] = 1c 00 00 00 'TFL3' pad 20 00 1c 00 18 00
# The flatbuffer starts at offset 16
# Root offset is at offset 16 of the file

root = struct.unpack('<I', data[16:20])[0]
print("Root offset (in file):", root)

# Model table fields
subgraphs = struct.unpack('<I', data[root+12:root+16])[0]
tensor_array = struct.unpack('<I', data[root+16:root+20])[0]
buffers = struct.unpack('<I', data[root+56:root+60])[0]
buffer_offsets_arr = struct.unpack('<I', data[root+60:root+64])[0]
print("subgraphs:", subgraphs)
print("tensor_array:", tensor_array)
print("buffers:", buffers)
print("buffer_offsets_arr:", buffer_offsets_arr)

# Parse TensorArray
ta = data[root+tensor_array:]
num_tensors = struct.unpack('<I', ta[:4])[0]
print("num_tensors:", num_tensors)
tensor_offsets = []
for i in range(num_tensors):
    off = 4 + i*4
    tensor_offsets.append(struct.unpack('<I', ta[off:off+4])[0])
print("tensor_offsets:", tensor_offsets[:10])

# Parse BufferArray
ba = data[root+buffers:]
num_buffers = struct.unpack('<I', ba[:4])[0]
print("num_buffers:", num_buffers)
buf_offsets = []
for i in range(num_buffers):
    off = 4 + i*4
    buf_offsets.append(struct.unpack('<I', ba[off:off+4])[0])
print("buffer_offsets:", buf_offsets)

# Parse each Buffer
for bi, bo in enumerate(buf_offsets):
    buf_table = ba[bo:]
    b_size = struct.unpack('<I', buf_table[:4])[0]
    print(f"\nBuffer {bi}: size={b_size}")
    
    offsets = []
    for i in range(b_size):
        off = 4 + i*4
        offsets.append(struct.unpack('<I', buf_table[off:off+4])[0])
    raw_start = 4 + b_size*4
    raw = buf_table[raw_start:]
    print(f"  raw_data_len={len(raw)}")
    
    for t in offsets[:5]:
        td = raw[t:]
        t_type = struct.unpack('<i', td[:4])[0]
        t_quant = struct.unpack('<i', td[4:8])[0]
        num_dims = struct.unpack('<i', td[8:12])[0]
        dims = []
        for d in range(num_dims):
            dims.append(struct.unpack('<Q', td[12+d*8:20+d*8])[0])
        print(f"  tensor {t}: type={t_type}, quant={t_quant}, num_dims={num_dims}, dims={dims}")
        if t_type == 1:
            n = min(5, len(raw) - t - 12)
            floats = struct.unpack(f'<{n}f', raw[t+12:t+12+n*4])
            print(f"    first floats: {floats}")

# Search for names
print("\n=== Searching for tensor names ===")
ls = data.find(b'landmark_sequence')
out = data.find(b'output_0')
print("landmark_sequence at:", ls)
print("output_0 at:", out)

# Look for tensor at offset 160 (where landmark_sequence string is)
print("\n=== Tensor details near offset 160 ===")
for t in range(0, min(50, len(data))):
    td = data[t:t+40]
    if len(td) >= 20:
        t_type = struct.unpack('<i', td[0:4])[0]
        t_quant = struct.unpack('<i', td[4:8])[0]
        num_dims = struct.unpack('<i', td[8:12])[0]
        if t_type == 1 and num_dims == 3:
            dims = struct.unpack('<3Q', td[12:36])
            print(f"tensor {t}: type={t_type}, num_dims={num_dims}, dims={dims}")
            break
