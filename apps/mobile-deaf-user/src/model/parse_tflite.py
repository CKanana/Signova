#!/usr/bin/env python3
"""
Parse TFLite model to find input tensor shape.
Uses flatbuffer structural parse.
"""
import struct
import sys

PATH = "apps/mobile-deaf-user/src/assets/model/signova_model.tflite"

def read_varint(data, offset):
    result = 0
    shift = 0
    start = offset
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

    print(f"File size: {len(data)} bytes")

    # TFLite header is 28 bytes
    # bytes 0-3: magic 'TFL3'
    # bytes 4-7: padding
    # bytes 8-11: version
    # bytes 12-15: total_len
    # bytes 16-19: ctx_count
    # bytes 20-23: root_offset

    root_offset = struct.unpack('<I', data[24:28])[0]
    print(f"Flatbuffer root offset: {root_offset} (0x{root_offset:08x})")

    # Root is at offset 20 from file start
    # Model table: first 4 bytes = vtable offset (relative to table start)
    # At offset 20 + 4 = 24 is the vtable pointer (relative)
    model_vtable_rel = struct.unpack('<I', data[20:24])[0]
    print(f"Model table vtable offset: {model_vtable_rel}")

    # Vtable is at offset 20 + 4 + model_vtable_rel
    vtable = 24 + model_vtable_rel
    print(f"Vtable at offset: {vtable} (0x{vtable:08x})")

    # Vtable entries are 4-byte relative offsets (to functions in the file)
    # Model vtable layout (from tensorflow/lite/schema/schema.fbs):
    # +0:  uint16_t num_subgraphs;
    # +2:  uint16_t num_tensors;
    # +4:  uint16_t num_ops;
    # +6:  uint16_t unused;
    # +8:  uint16_t unused2;
    # +10: uint16_t unused3;
    # +12: uint16_t unused4;
    # +14: uint16_t unused5;
    # +16: uint32_t external_tensor_types;
    # +20: uint32_t subgraph_indices;
    # +24: uint32_t tensors;
    # +28: uint32_t input_tensors;
    # +32: uint32_t output_tensors;

    print("\n=== Vtable entries (read as int32 relative offsets) ===")
    for i in range(36):
        entry = struct.unpack('<I', data[vtable + i*4 : vtable + i*4 + 4])[0]
        print(f"  [{i*4:3d}]: {entry}")

    # The tensors pointer is at vtable + 24
    tensors_ptr = struct.unpack('<I', data[vtable + 24 : vtable + 28])[0]
    print(f"\nTensors pointer (relative to table start): {tensors_ptr}")
    # Actual tensor array data starts at table_start + 4 + tensors_ptr
    tensor_array = 24 + tensors_ptr
    print(f"Tensor array data at offset: {tensor_array}")

    # TensorArray struct:
    # uint64_t unused;      // at table_start + 0
    # int32_t* data;        // at table_start + 8
    # uint32_t num_tensors; // at table_start + 16
    unused64 = struct.unpack('<Q', data[tensor_array : tensor_array + 8])[0]
    print(f"TensorArray unused: {unused64}")

    data_ptr = struct.unpack('<I', data[tensor_array + 8 : tensor_array + 12])[0]
    print(f"TensorArray data pointer: {data_ptr}")
    data_start = 24 + data_ptr  # relative to file start

    num_tensors = struct.unpack('<I', data[tensor_array + 16 : tensor_array + 20])[0]
    print(f"Number of tensors in array: {num_tensors}")

    # Read the first 20 tensor offsets (relative to data_start)
    print("\nFirst 20 tensor offsets:")
    for i in range(min(20, num_tensors)):
        off = struct.unpack('<I', data[data_start + i*4 : data_start + i*4 + 4])[0]
        print(f"  tensor {i}: offset {off} (0x{off:08x})")

    # Read tensor at offset 20 (should be input tensor)
    tensor_offset = struct.unpack('<I', data[data_start + 0*4 : data_start + 0*4 + 4])[0]
    print(f"\nTensor entry 0 offset (relative to data_start): {tensor_offset}")
    tensor_start = data_start + tensor_offset
    print(f"Tensor table at file offset: {tensor_start}")

    # Tensor struct (from schema.fbs):
    # uint64_t  allocation_size;          // +0
    # uint64_t  quantization_params_offset;// +8
    # uint64_t  buffer_offset;            // +16
    # uint64_t  importer_context_offset;  // +24
    # uint32_t  name_offset;              // +32
    # int32_t   version;                  // +36
    # int32_t*  subgraph;                 // +40
    # TensorType type;                    // +44  (uint8_t)
    # TensorQuantizationParams quantization; // +48
    # std::vector<int64_t> dims;          // +56 (varint array)
    # ...
    # std::string name;                   // +64 (offset to string table)

    # Let's read the tensor at tensor_start
    print("\n=== Tensor 0 (expected input 'landmark_sequence') ===")
    print(f"Tensor table at file offset: {tensor_start}")

    # Read allocation_size (uint64)
    alloc_size = struct.unpack('<Q', data[tensor_start : tensor_start + 8])[0]
    print(f"  allocation_size: {alloc_size}")

    # Quantization params offset
    qpo = struct.unpack('<Q', data[tensor_start + 8 : tensor_start + 16])[0]
    print(f"  quantization_params_offset: {qpo}")

    # buffer_offset
    buf_off = struct.unpack('<Q', data[tensor_start + 16 : tensor_start + 24])[0]
    print(f"  buffer_offset: {buf_off}")

    # importer_context_offset
    imp_off = struct.unpack('<Q', data[tensor_start + 24 : tensor_start + 32])[0]
    print(f"  importer_context_offset: {imp_off}")

    # name_offset
    name_off = struct.unpack('<I', data[tensor_start + 32 : tensor_start + 36])[0]
    print(f"  name_offset: {name_off}")

    # version
    version = struct.unpack('<i', data[tensor_start + 36 : tensor_start + 40])[0]
    print(f"  version: {version}")

    # subgraph pointer
    subgraph_ptr = struct.unpack('<I', data[tensor_start + 40 : tensor_start + 44])[0]
    print(f"  subgraph pointer: {subgraph_ptr}")

    # type (TensorType) - uint8
    tensor_type = data[tensor_start + 44]
    print(f"  type: {tensor_type}")

    # quantization
    print(f"  quantization: ({list(data[tensor_start+48:tensor_start+56])})")

    # dims start at +56
    dims, _ = read_varint(data, tensor_start + 56)
    print(f"  dims first varint: {dims}")
    # We need to read the array properly - read all dims
    # After the first varint, there may be more
    # dims is a vector<int64_t>, which is a flatbuffer array
    # The array data starts right after the vector header
    # For vector<int64_t>, the header is at offset within the struct + something
    # Actually for flatbuffers, vectors are stored as vtable offsets within the struct
    # The dims field is at +56 relative to struct start
    # Wait, that's wrong. In flatbuffers, member offsets are relative to the struct start.
    # The dims is a vector, which is stored as an offset to the vector data.
    # The vector data itself starts at offset within the table.
    # Let me re-read...

    # Actually, in flatbuffers:
    # The Tensor struct has members with offsets within the struct.
    # dims is at offset +56 (within the 8-byte-aligned struct)
    # But for a vector field, the struct stores the vector offset (relative to table)
    # Wait, the dims field offset within the struct is +56, but that's the offset to the vector data within the table.
    # Actually no - for a table, each field's value is stored at an offset within the table,
    # and the vtable tells you where the fields are.
    # But for a struct (like Tensor), the fields are at fixed offsets within the struct.
    # The vtable is only for the root table (Model).

    # Let me look at the Tensor struct more carefully.
    # Actually, Tensor is a struct, so fields are at fixed offsets.
    # dims is a vector<int64>.
    # The vector data (the actual int64 array) has its own offset within the table.
    # But wait - the Tensor struct is embedded in the table's data section.
    # Each field of the struct is at a specific offset within the struct.
    # For a vector field, the struct stores the offset to the vector's data section
    # relative to the table start.

    # Actually, I think the issue is that I'm reading the struct wrong.
    # Let me check: the tensor table starts at tensor_start.
    # The struct data is right there.
    # dims is at offset +56 from struct start.
    # But wait - that might be wrong. Let me check the schema.

    # Actually, let me try reading the string at name_offset
    # The name is stored in a string table
    # The string data is after the table data
    # First, let me find how big the tensor data is
    print(f"  String table pointer at +{32}: {name_off}")

    # The string table is at file offset: table_start + 4 + name_off
    string_start = tensor_start + 4 + name_off
    print(f"  String data at: {string_start}")

    # Read string
    str_end = data.find(b'\x00', string_start)
    tensor_name = data[string_start:str_end].decode('ascii', errors='replace')
    print(f"  Tensor name: '{tensor_name}'")

    # Now the dims - let me look at the schema more carefully
    # From schema.fbs:
    # struct Tensor {
    #   TensorType type;
    #   TensorQuantizationParams quantization;
    #   vector<int64_t> dims;
    #   string name;
    #   int32_t version = 0;
    #   vector<int32_t> subgraph;
    #   int32_t allocation_deallocation_callbacks;
    #   ...
    # };
    # The actual offsets depend on the flatbuffer layout.
    # For flatbuffers, the struct fields are stored with 4-byte alignment.
    # field name_offset at +32 (0x20)
    # field version at +36 (0x24)
    # field subgraph at +40 (0x28)
    # field type at +44 (0x2C)
    # field quantization at +48 (0x30)
    # field dims at +56 (0x38) - this is a vector, so it's an offset to vector data
    # field name at +64 (0x40) - this is a string, so it's an offset to string data

    # So dims is an offset to the vector data.
    # Let me read the vector data.
    # The vector is stored as: 4-byte length, then the data
    # Wait, in flatbuffers, the vector data has a header first
    # Actually for flatbuffers, vectors are stored with:
    # 4-byte length (int32)
    # Then the data (padded to 4-byte boundaries)
    # The offset within the table points to the length field.

    dims_offset = struct.unpack('<I', data[tensor_start + 56 : tensor_start + 60])[0]
    print(f"  dims offset (within table): {dims_offset}")
    dims_data_start = tensor_start + 4 + dims_offset
    print(f"  dims data at: {dims_data_start}")

    # Read dims
    # First byte is the count (int32)
    # Let me read it
    # Actually for flatbuffers, the vtable for tensor is at table_start + vtable_offset
    # The vtable tells where dims is in the data section.
    # Hmm, this is getting complex. Let me try a simpler approach.

    # Let me read the dims vector data directly
    # The vector data pointer is 4 bytes before the actual data start (the length is inline)
    # Actually no - for vector<int64_t>, the data layout is:
    # 4-byte count (int32), then 4-byte-aligned count*8 bytes of int64 data
    # Wait, the count is stored inline at the start of the data.
    # Let me read it.

    print(f"\n  Reading dims at {dims_data_start}:")
    count = struct.unpack('<i', data[dims_data_start : dims_data_start + 4])[0]
    print(f"  dims count: {count}")

    # Read the int64 values
    print(f"  dims values:")
    for i in range(abs(count)):
        val = struct.unpack('<q', data[dims_data_start + 4 + i*8 : dims_data_start + 4 + i*8 + 8])[0]
        print(f"    [{i}]: {val}")

    # Now also read the tensor at offset 28 (should be output tensor)
    output_tensor_offset = struct.unpack('<I', data[data_start + 28*4 : data_start + 28*4 + 4])[0]
    print(f"\n=== Tensor entry 28 (expected output 'output_0') ===")
    print(f"Tensor offset: {output_tensor_offset}")
    tensor_start2 = data_start + output_tensor_offset
    print(f"Tensor table at: {tensor_start2}")

    # Quick fields
    name_off2 = struct.unpack('<I', data[tensor_start2 + 32 : tensor_start2 + 36])[0]
    string_start2 = tensor_start2 + 4 + name_off2
    str_end2 = data.find(b'\x00', string_start2)
    tensor_name2 = data[string_start2:str_end2].decode('ascii', errors='replace')
    print(f"  Tensor name: '{tensor_name2}'")

    # dims
    dims_off2 = struct.unpack('<I', data[tensor_start2 + 56 : tensor_start2 + 60])[0]
    dims_data_start2 = tensor_start2 + 4 + dims_off2
    count2 = struct.unpack('<i', data[dims_data_start2 : dims_data_start2 + 4])[0]
    print(f"  dims count: {count2}")
    print(f"  dims values:")
    for i in range(abs(count2)):
        val = struct.unpack('<q', data[dims_data_start2 + 4 + i*8 : dims_data_start2 + 4 + i*8 + 8])[0]
        print(f"    [{i}]: {val}")

    print("\n=== SUMMARY ===")
    print(f"Input tensor 'landmark_sequence': dims = {[struct.unpack('<q', data[dims_data_start + 4 + i*8 : dims_data_start + 4 + i*8 + 8])[0] for i in range(abs(count))]}")
    print(f"Output tensor 'output_0': dims = {[struct.unpack('<q', data[dims_data_start2 + 4 + i*8 : dims_data_start2 + 4 + i*8 + 8])[0] for i in range(abs(count2))]}")

if __name__ == '__main__':
    main()
