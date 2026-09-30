"""
convert_to_tflite.py

Converts the trained Keras model to TensorFlow Lite for on-device inference
in the Android app, with post-training dynamic-range quantization to shrink
model size (important since the Dense projection + BiLSTM stack over a
1629-dim input is not small).

Usage:
    python convert_to_tflite.py \
        --model checkpoints/best_model.keras \
        --out signova_model.tflite
"""

import argparse
import tensorflow as tf


def convert(model_path: str, out_path: str, quantize: bool):
    model = tf.keras.models.load_model(model_path)

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    if quantize:
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        # Dynamic-range quantization: no representative dataset needed, ~4x
        # smaller weights, minimal accuracy loss. Good default for LSTMs.

    # LSTMs need this op set on-device (SELECT_TF_OPS covers ops the builtin
    # TFLite LSTM kernel doesn't support out of the box in some TF versions).
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS,
    ]

    tflite_model = converter.convert()
    with open(out_path, "wb") as f:
        f.write(tflite_model)

    print(f"Saved TFLite model to {out_path} ({len(tflite_model) / 1e6:.2f} MB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--out", default="signova_model.tflite")
    parser.add_argument("--no_quantize", action="store_true")
    args = parser.parse_args()
    convert(args.model, args.out, quantize=not args.no_quantize)
