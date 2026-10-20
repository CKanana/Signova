"""
model.py

BiLSTM classifier over hand-landmark sequences (126-dim/frame: 21 keypoints
x,y,z for each of two hands, left + right, per proposal Section 3.2.2/3.2.3).

Design notes:
- Input is low-dimensional (126 features/frame, hands-only), so no Dense
  projection layer is needed before the LSTM stack -- feeding the landmark
  vectors directly into the BiLSTM avoids unnecessary extra parameters given
  WLASL's long-tailed class distribution and limited per-class examples.
- Bidirectional LSTM chosen over a unidirectional LSTM per proposal Section
  3.2.3: the model classifies a complete, pre-segmented sign sequence (not a
  live unbounded stream), so it can use both forward and backward temporal
  context within each sign.
- Masking(mask_value=0.0) lets the LSTM ignore padded/no-detection frames.
  Because a no-detection frame can occur mid-sequence (not just in the
  padded tail), the mask is not guaranteed to be pure right-padding, which
  cuDNN's fused LSTM kernel requires. use_cudnn=False is therefore set on
  both LSTM layers (standard TensorFlow LSTM, no mask-shape restriction).
- AttentionPooling replaces "take the last hidden state": the model learns a
  weighted combination over ALL timesteps, emphasizing the most
  discriminative frames, and respects the mask so padded/no-detection frames
  get ~zero attention weight.
- AttentionPooling is registered as a Keras serializable class so that a
  saved checkpoint (best_model.keras) can be reloaded in other scripts
  (evaluate.py, convert_to_tflite.py). Any script that loads the model must
  import this module (or pass custom_objects={"AttentionPooling": ...}).
"""

import tensorflow as tf
from tensorflow.keras import layers, models

# Registering the custom layer lets Keras find it when reloading a saved
# checkpoint. NOTE: `tf.keras.saving` does not exist on some TF/Keras builds
# (it raised AttributeError on Colab), so import from the standalone keras
# package, with a fallback for older TF versions.
try:
    from keras.saving import register_keras_serializable
except ImportError:
    from tensorflow.keras.utils import register_keras_serializable


@register_keras_serializable(package="signova")
class AttentionPooling(layers.Layer):
    """Learns a weighted average over the time dimension instead of taking
    only the last hidden state. Respects an incoming Keras mask so padded
    timesteps are excluded from the pooled representation."""

    def __init__(self, units=64, **kwargs):
        super().__init__(**kwargs)
        self.units = units
        self.score_dense = layers.Dense(units, activation="tanh")
        self.score_out = layers.Dense(1)

    def build(self, input_shape):
        input_shape = tuple(input_shape)  # may arrive as a list when reloading
        self.score_dense.build(input_shape)
        self.score_out.build(input_shape[:-1] + (self.units,))
        super().build(input_shape)

    def call(self, inputs, mask=None):
        # inputs: (batch, time, features)
        scores = self.score_out(self.score_dense(inputs))   # (batch, time, 1)
        scores = tf.squeeze(scores, axis=-1)                 # (batch, time)

        if mask is not None:
            mask = tf.cast(mask, scores.dtype)
            # push masked (padded) timesteps to ~-inf before softmax
            scores = scores + (1.0 - mask) * -1e9

        weights = tf.nn.softmax(scores, axis=-1)             # (batch, time)
        weights = tf.expand_dims(weights, axis=-1)           # (batch, time, 1)
        context = tf.reduce_sum(inputs * weights, axis=1)    # (batch, features)
        return context

    def compute_mask(self, inputs, mask=None):
        # Output has no time dimension left, so no mask propagates downstream.
        return None

    def get_config(self):
        config = super().get_config()
        config.update({"units": self.units})
        return config


def build_model(seq_len: int, feature_dim: int, num_classes: int,
                 lstm_units: int = 128, dense_units: int = 128,
                 dropout: float = 0.4) -> tf.keras.Model:
    inputs = layers.Input(shape=(seq_len, feature_dim), name="landmark_sequence")

    x = layers.Masking(mask_value=0.0)(inputs)

    x = layers.Bidirectional(layers.LSTM(lstm_units, return_sequences=True, use_cudnn=False))(x)
    x = layers.Dropout(dropout)(x)
    # return_sequences=True: attention needs the full sequence of hidden states
    x = layers.Bidirectional(layers.LSTM(lstm_units // 2, return_sequences=True, use_cudnn=False))(x)
    x = layers.Dropout(dropout)(x)

    x = AttentionPooling(units=64)(x)

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
    m = build_model(seq_len=60, feature_dim=126, num_classes=100)
    m.summary()
