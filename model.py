"""
model.py

BiLSTM classifier over hand-landmark sequences (63-dim/frame: 21 keypoints
x,y,z from a single detected hand, per proposal Section 3.2.2/3.2.3).

Design notes:
- Input is low-dimensional (63 features/frame, hands-only), so unlike the
  earlier Holistic-based version, no Dense projection layer is needed before
  the LSTM stack -- that was only there to compress a much larger 1629-dim
  input; feeding 63-dim landmark vectors directly into the BiLSTM is
  standard and avoids unnecessary extra parameters given WLASL's long-tailed
  class distribution and limited per-class examples.
- Bidirectional LSTM chosen over a unidirectional LSTM per proposal Section
  3.2.3: since the model classifies a complete, pre-segmented sign sequence
  (not a live unbounded stream), it can use both forward and backward
  temporal context within each sign for improved accuracy.
- Masking(mask_value=0.0) lets the LSTM ignore padded/no-detection frames.
  Because a no-detection frame can occur mid-sequence (not just in the
  padded tail), the resulting mask is not guaranteed to be pure
  right-padding -- which cuDNN's fused LSTM kernel requires. use_cudnn=False
  is set on both LSTM layers below to fall back to the standard TensorFlow
  LSTM implementation, which has no such restriction on mask shape. This is
  a correctness-over-speed trade-off worth noting in the report's
  implementation/limitations section.
"""

import tensorflow as tf
from tensorflow.keras import layers, models


def build_model(seq_len: int, feature_dim: int, num_classes: int,
                 lstm_units: int = 128, dense_units: int = 128,
                 dropout: float = 0.4) -> tf.keras.Model:
    inputs = layers.Input(shape=(seq_len, feature_dim), name="landmark_sequence")

    x = layers.Masking(mask_value=0.0)(inputs)

    x = layers.Bidirectional(layers.LSTM(lstm_units, return_sequences=True, use_cudnn=False))(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Bidirectional(layers.LSTM(lstm_units // 2, use_cudnn=False))(x)
    x = layers.Dropout(dropout)(x)

    x = layers.Dense(dense_units, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="gloss")(x)

    model = models.Model(inputs, outputs, name="signova_bilstm")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.TopKCategoricalAccuracy(k=5, name="top5_acc")],
    )
    return model


if __name__ == "__main__":
    # Quick sanity check of shapes
    m = build_model(seq_len=60, feature_dim=63, num_classes=100)
    m.summary()
