#!/usr/bin/env python3
import struct
import sys

PATH = "apps/mobile-deaf-user/src/assets/model/signova_model.tflite"

def main():
    with open(PATH, 'rb') as f:
        data = f.read()

    print(f"File size: {len(data)} bytes")

    # TFLite header (28 bytes)
    header_len = struct.unpack('<I', data[0:4])[0]
    magic = data[4:8]
    pad = struct.unpack('<I', data[8:12])[0]
    formula_version = struct.unpack('<I', data[12:16])[0]
    total_len = struct.unpack('<I', data[16:20])[0]
    ctx_count = struct.unpack('<I', data[20:24])[0]

    print(f"\nHeader: header_len={header_len}, magic={magic}, pad={pad:#x}, formula_version={formula_version:#x}, total_len={total_len:#x}, ctx_count={ctx_count}")

    # Flatbuffer starts at offset 28
    fb = data[28:]

    # Flatbuffer header
    root = struct.unpack('<I', fb[0:4])[0]
    print(f"\nFlatbuffer root_offset: {root} (0x{root:08x})")
    print(f"Flatbuffer pad: {struct.unpack('<I', fb[4:8])[0]}")

    # Model table is at fb[root]
    model = fb[root:]
    print(f"\nModel table at fb offset {root} (0x{root:08x}), length {len(model)}")

    # Read Model table fields
    magic_val = struct.unpack('<H', model[0:2])[0]
    version = struct.unpack('<I', model[4:8])[0]
    builder_table = struct.unpack('<I', model[8:12])[0]
    subgraphs = struct.unpack('<I', model[12:16])[0]
    tensor_array = struct.unpack('<I', model[16:20])[0]
    op_code_array = struct.unpack('<I', model[20:24])[0]
    variable_tensors = struct.unpack('<I', model[24:28])[0]

    print(f"\nModel table fields:")
    print(f"  magic: {magic_val}")
    print(f"  version: {version}")
    print(f"  builder_table: {builder_table} (0x{builder_table:08x})")
    print(f"  subgraphs: {subgraphs} (0x{subgraphs:08x})")
    print(f"  tensor_array: {tensor_array} (0x{tensor_array:08x})")
    print(f"  op_code_array: {op_code_array} (0x{op_code_array:08x})")
    print(f"  variable_tensors: {variable_tensors} (0x{variable_tensors:08x})")

    # These offsets are relative to the Model table (fb[root])
    # So actual table addresses are fb[root + offset]

    # Subgraphs table
    sg_table = fb[root + subgraphs:]
    sg_count = struct.unpack('<I', sg_table[0:4])[0]
    print(f"\nSubgraphs table at fb offset {root + subgraphs} (0x{root + subgraphs:08x}), count={sg_count}")

    # First subgraph
    if sg_count > 0:
        first_sg = struct.unpack('<I', sg_table[4:8])[0]
        sg0 = fb[root + first_sg:]
        input_tensors = struct.unpack('<I', sg0[0:4])[0]
        output_tensors = struct.unpack('<I', sg0[4:8])[0]
        inputs = struct.unpack('<I', sg0[12:16])[0]
        outputs = struct.unpack('<I', sg0[16:20])[0]
        nodes = struct.unpack('<I', sg0[20:24])[0]
        print(f"\nFirst subgraph:")
        print(f"  input_tensors (index): {input_tensors}")
        print(f"  output_tensors (index): {output_tensors}")
        print(f"  inputs: {inputs}, outputs: {outputs}")
        print(f"  nodes: {nodes}")

        # Read first node
        node = fb[root + first_sg + 28:]
        op = struct.unpack('<I', node[0:4])[0]
        node_inputs = struct.unpack('<I', node[4:8])[0]
        node_outputs = struct.unpack('<I', node[8:12])[0]
        input_types = struct.unpack('<I', node[12:16])[0]
        input_shapes = struct.unpack('<I', node[16:20])[0]
        output_types = struct.unpack('<I', node[20:24])[0]
        output_shapes = struct.unpack('<I', node[24:28])[0]
        print(f"\nFirst node:")
        print(f"  op: {op}")
        print(f"  inputs: {node_inputs}")
        print(f"  outputs: {node_outputs}")
        print(f"  input_types: {input_types}, input_shapes: {input_shapes}")
        print(f"  output_types: {output_types}, output_shapes: {output_shapes}")

        # The input_shapes field is an index into the tensor's shape
        # Actually it's a pointer to Shape struct within the node's attributes
        # Let's look at the node inputs - each input is a tensor index
        # The input_shapes is the offset to the shape within the node's attribute data

        # Let's look at the tensor array
        ta = fb[root + tensor_array:]
        num_tensors = struct.unpack('<I', ta[0:4])[0]
        print(f"\nTensorArray at fb offset {root + tensor_array} (0x{root + tensor_array:08x}), num_tensors={num_tensors}")

        # Read tensor offsets
        tf_offsets = []
        for i in range(min(num_tensors, 100)):
            off = struct.unpack('<I', ta[4+i*4:8+i*4])[0]
            tf_offsets.append(off)

        # The input_tensors index (input_tensors) gives us the tensor index
        # Let's get the input tensor
        if input_tensors < len(tf_offsets):
            in_off = tf_offsets[input_tensors]
            print(f"\nInput tensor[{input_tensors}] at fb offset {root + in_off}")
            # Read this tensor
            t_data = fb[root + in_off:]
            # Parse tensor: type (varint), quantization (float), dims (varint array), name (string), buffer (varint), shape (varint array)
            p = 0
            # Type
            while p < len(t_data):
                byte = t_data[p]
                dtype = byte & 0x7F
                shift = 7
                if byte & 0x80 and p + shift < len(t_data):
                    byte = t_data[p + shift]
                    dtype |= (byte & 0x7F) << shift
                    shift += 7
                p += shift
                if shift > 32:
                    break
            print(f"  type(varint): {dtype} (0x{dtype:x})")
            # Quantization
            if p + 4 <= len(t_data):
                q = struct.unpack('<f', t_data[p:p+4])[0]
                print(f"  quantization: {q}")
                p += 4
            else:
                q = None
            # Dims
            dims = []
            while p < len(t_data) - 4:
                byte = t_data[p]
                val = byte & 0x7F
                shift = 7
                if byte & 0x80 and p + shift < len(t_data):
                    byte = t_data[p + shift]
                    val |= (byte & 0x7F) << shift
                    shift += 7
                p += shift
                dims.append(val)
                if shift > 32:
                    break
            print(f"  dims: {dims}")
            print(f"  dims count: {len(dims)}")

            # Check if the tensor is the input
            # The input tensor has shape [1, 60, 126] or [1, 60, 63]
            # Let's print dims

        # Also check the buffer offsets
        if buffer_offsets < len(model):
            bob = model[buffer_offsets:]
            num_bufs = struct.unpack('<I', bob[0:4])[0]
            print(f"\nBuffer offsets table at model offset {buffer_offsets}, num_buffers={num_bufs}")
            # Read buffer offsets
            for i in range(min(num_bufs, 10)):
                boff = struct.unpack('<I', bob[4+i*4:8+i*4])[0]
                buf = fb[root + boff:]
                b_size = struct.unpack('<I', buf[0:4])[0]
                buf_tf_offsets = []
                for j in range(b_size):
                    off = struct.unpack('<I', buf[4+j*4:8+j*4])[0]
                    buf_tf_offsets.append(off)
                raw_start = 4 + b_size * 4
                raw = buf[raw_start:]
                print(f"  Buffer {i}: size={b_size}, num_tfs={len(buf_tf_offsets)}, raw_len={len(raw)}")
                # Find strings like "input", "output", "landmark" in raw data
                for s in [b'input_', b'output', b'landmark', b'model']:
                    idx = raw.find(s)
                    if idx != -1:
                        print(f"    Found '{s.decode()}' at raw offset {idx}")
                        print(f"    context: {raw[max(0,idx-8):idx+32].hex(' ')}")

    # Now let's search for the input tensor name and dims in the raw buffer
    print("\n=== Searching for tensor name and dims ===")
    # The input tensor is 'landmark_sequence'
    # Let's find all strings in the model
    # Look for "landmark_sequence" in the whole data
    name_pos = data.find(b'landmark_sequence')
    if name_pos != -1:
        print(f"\nFound 'landmark_sequence' at file offset {name_pos}")
        print(f"Context hex: {data[max(0,name_pos-8):name_pos+32].hex(' ')}")
        # Print as string
        try:
            print(f"Decoded: {data[name_pos:name_pos+20].decode('ascii')}")
        except:
            pass
    else:
        print("\nCould not find 'landmark_sequence' string")

    out_pos = data.find(b'output_0')
    print(f"\nFound 'output_0' at file offset: {out_pos}")

    # Search for any string containing "input" or "output" in the first 4KB of the model
    # The tensor names are stored as strings in the buffer data
    # Let's search in the first 10KB of the file (which should contain the model table)
    for i in range(0, min(10240, len(data)), 16):
        chunk = data[i:i+16]
        # Check if this chunk might be a string
        try:
            s = chunk.decode('ascii')
            if 'landmark' in s or 'output' in s or 'input' in s or 'tensor' in s:
                print(f"  offset {i}: {s!r}")
        except:
            pass

if __name__ == '__main__':
    main()
