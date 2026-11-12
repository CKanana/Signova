#!/usr/bin/env python3
"""
Parse TFLite tensor dims from the binary.
"""
import struct

PATH = "apps/mobile-deaf-user/src/assets/model/signova_model.tflite"

def read_varint(data, offset):
    result = 0
    shift = 0
    while offset < len(data):
        byte = data[offset]
        result |= (byte & 0x7F) << shift
        offset += 1
        if not (byte & 0x80):
            break
        shift += 7
        if shift > 63:
            return None, -1
    return result, offset

def main():
    with open(PATH, 'rb') as f:
        data = f.read()

    print(f"File size: {len(data)}")

    # TFLite header (28 bytes)
    magic = data[0:4]
    print(f"Magic: {magic}")

    # root_offset is at bytes 20-23 of the file
    # (after magic(4), pad(4), version(4), total_len(4), ctx_count(4), root_offset(4))
    root_offset = struct.unpack('<I', data[20:24])[0]
    print(f"Root offset: {root_offset}")

    # The model struct starts at root_offset
    model_start = root_offset
    print(f"Model struct at: {model_start}")

    # Model struct fields (from tensorflow/lite/schema/schema.fbs):
    # uint16 num_subgraphs (offset 0)
    # uint16 num_tensors (offset 2)
    # uint16 num_ops (offset 4)
    # uint16 unused (offset 6)
    # uint16 unused2 (offset 8)
    # uint16 unused3 (offset 10)
    # uint16 unused4 (offset 12)
    # uint16 unused5 (offset 14)
    # uint32 external_tensor_types (offset 16)
    # uint32 subgraph_indices (offset 20)
    # uint32 tensors (offset 24)
    # uint32 input_tensors (offset 28)
    # uint32 output_tensors (offset 32)
    # ...

    # Read the Model struct
    num_subgraphs = struct.unpack('<H', data[model_start:model_start+2])[0]
    num_tensors = struct.unpack('<H', data[model_start+2:model_start+4])[0]
    num_ops = struct.unpack('<H', data[model_start+4:model_start+6])[0]
    print(f"num_subgraphs={num_subgraphs}, num_tensors={num_tensors}, num_ops={num_ops}")

    # Vtable is at model_start + 4
    vtable = model_start + 4
    print(f"Vtable at: {vtable}")

    # Vtable entries are int32 relative offsets (to functions in the file)
    # Model vtable layout:
    # +0: uint16 num_subgraphs (offset 0)
    # +2: uint16 num_tensors (offset 2)
    # +4: uint16 num_ops (offset 4)
    # +6: uint16 unused
    # +8: uint16 unused2
    # +10: uint16 unused3
    # +12: uint16 unused4
    # +14: uint16 unused5
    # +16: uint32 external_tensor_types
    # +20: uint32 subgraph_indices
    # +24: uint32 tensors
    # +28: uint32 input_tensors
    # +32: uint32 output_tensors

    # Read all vtable entries
    print("\nVtable entries (int32 offsets):")
    for i in range(36):
        entry = struct.unpack('<I', data[vtable + i*4 : vtable + i*4 + 4])[0]
        # Only print non-zero
        if entry != 0:
            print(f"  [{i*4:2d}]: {entry}")

    # The tensors pointer is at vtable + 24
    tensors_ptr = struct.unpack('<I', data[vtable + 24 : vtable + 28])[0]
    print(f"\nTensors pointer (in Model struct): {tensors_ptr}")

    # TensorArray is at model_start + 4 + tensors_ptr
    tensor_array_start = model_start + 4 + tensors_ptr
    print(f"TensorArray at: {tensor_array_start}")

    # TensorArray struct:
    # uint64 unused (offset 0)
    # int32_t* data (offset 8) - array of tensor offsets
    # uint32_t num_tensors (offset 16)
    unused64 = struct.unpack('<Q', data[tensor_array_start : tensor_array_start + 8])[0]
    print(f"TensorArray unused (first 8 bytes): {unused64}")

    data_ptr = struct.unpack('<I', data[tensor_array_start + 8 : tensor_array_start + 12])[0]
    print(f"TensorArray data pointer: {data_ptr}")

    num_tensors_in_array = struct.unpack('<I', data[tensor_array_start + 16 : tensor_array_start + 20])[0]
    print(f"Number of tensors in array: {num_tensors_in_array}")

    # Tensor offsets are relative to model_start + 4 + data_ptr
    tensor_data_base = model_start + 4 + data_ptr
    print(f"Tensor offsets base: {tensor_data_base}")

    print("\nFirst 10 tensor offsets:")
    for i in range(min(10, num_tensors_in_array)):
        offset = struct.unpack('<I', data[tensor_data_base + i*4 : tensor_data_base + i*4 + 4])[0]
        print(f"  [{i}]: {offset}")

    # Find the input tensor (at index 0, likely 'landmark_sequence')
    # and output tensor (at index 28, likely 'output_0')
    input_offset = struct.unpack('<I', data[tensor_data_base + 0*4 : tensor_data_base + 0*4 + 4])[0]
    output_offset = struct.unpack('<I', data[tensor_data_base + 28*4 : tensor_data_base + 28*4 + 4])[0]
    print(f"\nInput tensor offset: {input_offset}")
    print(f"Output tensor offset: {output_offset}")

    # Read the tensor at input_offset
    def read_tensor(tensor_start, label):
        print(f"\n=== {label} ===")
        print(f"  Tensor table at file offset: {tensor_start}")

        # Read fields (from schema.fbs struct Tensor):
        # uint64_t allocation_size;           // +0
        # uint64_t quantization_params_offset;// +8
        # uint64_t buffer_offset;             // +16
        # uint64_t importer_context_offset;   // +24
        # uint32_t name_offset;               // +32
        # int32_t version;                    // +36
        # int32_t* subgraph;                  // +40
        # uint8_t type;                       // +44
        # TensorQuantizationParams quantization; // +48
        # vector<int64_t> dims;               // +56 (offset to vector data)
        # string name;                        // +64 (offset to string data)

        alloc_size = struct.unpack('<Q', data[tensor_start:tensor_start+8])[0]
        qpo = struct.unpack('<Q', data[tensor_start+8:tensor_start+16])[0]
        buf_off = struct.unpack('<Q', data[tensor_start+16:tensor_start+24])[0]
        imp_off = struct.unpack('<Q', data[tensor_start+24:tensor_start+32])[0]
        name_off = struct.unpack('<I', data[tensor_start+32:tensor_start+36])[0]
        version = struct.unpack('<i', data[tensor_start+36:tensor_start+40])[0]
        subgraph_ptr = struct.unpack('<i', data[tensor_start+40:tensor_start+44])[0]
        tensor_type = data[tensor_start+44]
        print(f"  allocation_size: {alloc_size}")
        print(f"  quantization_params_offset: {qpo}")
        print(f"  buffer_offset: {buf_off}")
        print(f"  importer_context_offset: {imp_off}")
        print(f"  name_offset: {name_off}")
        print(f"  version: {version}")
        print(f"  subgraph_ptr: {subgraph_ptr}")
        print(f"  type: {tensor_type}")

        # dims is at +56 (offset to the vector data within the table)
        dims_offset = struct.unpack('<I', data[tensor_start+56:tensor_start+60])[0]
        # The vector data is at: tensor_start + 4 + dims_offset
        dims_data_start = tensor_start + 4 + dims_offset
        print(f"  dims offset (within table): {dims_offset}")
        print(f"  dims data at: {dims_data_start}")

        # Read dims: first 4 bytes = count (int32)
        count = struct.unpack('<i', data[dims_data_start:dims_data_start+4])[0]
        print(f"  dims count: {count}")

        dims = []
        for i in range(abs(count)):
            val = struct.unpack('<q', data[dims_data_start+4+i*8:dims_data_start+4+i*8+8])[0]
            dims.append(val)

        print(f"  dims: {dims}")

        # Read name string
        if name_off != 0:
            # The string data is at tensor_start + 4 + name_off
            # But actually strings in flatbuffers are at a different offset...
            # Let me look at the actual layout
            pass

        return dims

    input_dims = read_tensor(model_start + 4 + input_offset, "Input tensor (landmark_sequence)")
    output_dims = read_tensor(model_start + 4 + output_offset, "Output tensor (output_0)")

if __name__ == '__main__':
    main()
