"""
train.py

Trains the Signova BiLSTM gloss classifier on hand-landmark sequences.

Two modes:
  --kfold 1 (default): single stratified 70/15/15 train/val/test split.
  --kfold N (N>1):     stratified N-fold cross-validation over the
                        train+val portion, reporting mean/std val accuracy
                        across folds, then a final model trained on the full
                        train+val portion and evaluated once on the held-out
                        test set.

Recent changes:
- Loss is now label-smoothed (--label_smoothing, default 0.1) and the
  optimizer uses a cosine-decay LR schedule sized to total training steps.
  Both are applied by re-compiling AFTER build_model() so model.py stays
  unchanged.
- Inverse-frequency class weights (compute_class_weight "balanced") are
  passed to model.fit to counter WLASL's long-tail class distribution.
  Disable with --no_class_weights.
- ReduceLROnPlateau callback is removed, since the cosine schedule now owns
  LR control and the two would fight each other.
- The model is re-compiled with plain Adam+CategoricalCrossentropy just
  before save(), so best_model.keras / final_model.keras can be loaded by
  evaluate.py / convert_to_tflite.py without needing custom_objects for
  CosineDecay, and their reported "test loss" is the true (non-smoothed)
  categorical cross-entropy.

Usage:
    python train.py \
        --manifest manifest.csv \
        --label_map label_map.json \
        --landmarks_dir landmarks_v2/ \
        --seq_len 60 \
        --epochs 100 \
        --kfold 5 \
        --out_dir checkpoints/
"""

import argparse
import json
import os

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight

from dataset import (
    FEATURE_DIM, load_from_df, load_split, make_stratified_split, get_kfold_splits
)
from model import build_model


def make_callbacks(out_dir, checkpoint_name):
    return [
        tf.keras.callbacks.ModelCheckpoint(
            os.path.join(out_dir, checkpoint_name),
            monitor="val_accuracy", save_best_only=True, mode="max"
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy", patience=15, restore_best_weights=True
        ),
        # NOTE: ReduceLROnPlateau was removed because the training compile
        # uses a CosineDecay LR schedule (below); the two would fight.
    ]


def compile_with_training_extras(model, num_train_samples, batch_size, epochs,
                                  label_smoothing):
    """Re-compile the freshly-built model with (a) cosine-decay LR sized to
    total training steps, and (b) label-smoothed categorical CE. We do this
    here rather than in model.build_model() so model.py doesn't need to know
    dataset size or training epochs."""
    steps_per_epoch = max(1, num_train_samples // batch_size)
    total_steps = max(1, steps_per_epoch * epochs)
    lr_schedule = tf.keras.optimizers.schedules.CosineDecay(
        initial_learning_rate=1e-3,
        decay_steps=total_steps,
        alpha=1e-5,
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=lr_schedule),
        loss=tf.keras.losses.CategoricalCrossentropy(
            label_smoothing=label_smoothing
        ),
        metrics=[
            "accuracy",
            tf.keras.metrics.TopKCategoricalAccuracy(k=5, name="top5_acc"),
        ],
    )
    return model


def recompile_for_export(model, num_classes):
    """Recompile with plain Adam+CE before save(), so the checkpoint loads
    without a CosineDecay custom_objects and evaluate() reports the true
    (non-smoothed) CE loss. Weights are unaffected."""
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss="categorical_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.TopKCategoricalAccuracy(k=5, name="top5_acc"),
        ],
    )
    return model


def compute_balanced_class_weights(y_onehot):
    """Inverse-frequency class weights ('balanced'), for WLASL's long tail.
    Only classes present in y are keyed; absent classes never appear in the
    loss term, so leaving them out is fine."""
    y = np.argmax(y_onehot, axis=1)
    present = np.unique(y)
    cw = compute_class_weight("balanced", classes=present, y=y)
    return {int(c): float(w) for c, w in zip(present, cw)}


def _report_class_weights(cw):
    if cw is None:
        print("Class weights: disabled (--no_class_weights)")
        return
    vals = list(cw.values())
    print(f"Class weights: min={min(vals):.3f}, max={max(vals):.3f}, "
          f"mean={np.mean(vals):.3f}  (over {len(cw)} present classes)")


def train_single_split(args, num_classes):
    df = pd.read_csv(args.manifest, dtype={"video_id": str})
    df = make_stratified_split(df)  # explicit 70/15/15 + class filter

    X_train, y_train = load_split(df, args.landmarks_dir, "train", args.seq_len, num_classes)
    X_val, y_val = load_split(df, args.landmarks_dir, "val", args.seq_len, num_classes)
    X_test, y_test = load_split(df, args.landmarks_dir, "test", args.seq_len, num_classes)
    print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

    if X_train.shape[0] == 0 or X_val.shape[0] == 0:
        raise ValueError("Empty train/val split — check --landmarks_dir and --manifest.")

    model = build_model(seq_len=args.seq_len, feature_dim=FEATURE_DIM,
                        num_classes=num_classes)
    model = compile_with_training_extras(
        model, X_train.shape[0], args.batch_size, args.epochs,
        args.label_smoothing
    )
    model.summary()

    cw = None if args.no_class_weights else compute_balanced_class_weights(y_train)
    _report_class_weights(cw)

    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=make_callbacks(args.out_dir, "best_model.keras"),
        class_weight=cw,
    )

    test_loss, test_acc, test_top5 = model.evaluate(X_test, y_test)
    print(f"\nTest accuracy: {test_acc:.4f} | Test top-5 accuracy: {test_top5:.4f}")

    recompile_for_export(model, num_classes)
    model.save(os.path.join(args.out_dir, "final_model.keras"))


def train_kfold(args, num_classes):
    manifest_df = pd.read_csv(args.manifest, dtype={"video_id": str})
    trainval_df, test_df, folds = get_kfold_splits(manifest_df, k=args.kfold)

    fold_accuracies = []
    for i, (fold_train_df, fold_val_df) in enumerate(folds):
        print(f"\n{'='*50}\nFold {i+1}/{args.kfold}\n{'='*50}")

        X_train, y_train = load_from_df(fold_train_df, args.landmarks_dir,
                                        args.seq_len, num_classes)
        X_val, y_val = load_from_df(fold_val_df, args.landmarks_dir,
                                    args.seq_len, num_classes)
        print(f"Fold {i+1} — Train: {X_train.shape}, Val: {X_val.shape}")

        model = build_model(seq_len=args.seq_len, feature_dim=FEATURE_DIM,
                            num_classes=num_classes)
        model = compile_with_training_extras(
            model, X_train.shape[0], args.batch_size, args.epochs,
            args.label_smoothing
        )

        cw = None if args.no_class_weights else compute_balanced_class_weights(y_train)
        _report_class_weights(cw)

        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=args.epochs,
            batch_size=args.batch_size,
            callbacks=make_callbacks(args.out_dir, f"fold_{i+1}_best.keras"),
            class_weight=cw,
            verbose=1,
        )
        best_val_acc = max(history.history["val_accuracy"])
        fold_accuracies.append(best_val_acc)
        print(f"Fold {i+1} best val_accuracy: {best_val_acc:.4f}")

    mean_acc = float(np.mean(fold_accuracies))
    std_acc = float(np.std(fold_accuracies))
    print(f"\n{args.kfold}-fold CV results: {mean_acc:.4f} +/- {std_acc:.4f}")
    print(f"Per-fold accuracies: {[round(a, 4) for a in fold_accuracies]}")

    with open(os.path.join(args.out_dir, "kfold_results.json"), "w") as f:
        json.dump({
            "k": args.kfold,
            "fold_accuracies": fold_accuracies,
            "mean_accuracy": mean_acc,
            "std_accuracy": std_acc,
        }, f, indent=2)

    # Final model: train on the full train+val portion, evaluate once on the
    # untouched held-out test set. Carve a small internal validation slice
    # purely for early-stopping/checkpoint monitoring (not a CV fold).
    print(f"\n{'='*50}\nTraining final model on full train+val portion\n{'='*50}")
    final_train_df, final_val_df = train_test_split_stratified(trainval_df, val_frac=0.1)

    X_train, y_train = load_from_df(final_train_df, args.landmarks_dir,
                                    args.seq_len, num_classes)
    X_val, y_val = load_from_df(final_val_df, args.landmarks_dir,
                                args.seq_len, num_classes)
    X_test, y_test = load_from_df(test_df, args.landmarks_dir,
                                  args.seq_len, num_classes)
    print(f"Final train: {X_train.shape}, Final val: {X_val.shape}, Test: {X_test.shape}")

    model = build_model(seq_len=args.seq_len, feature_dim=FEATURE_DIM,
                        num_classes=num_classes)
    model = compile_with_training_extras(
        model, X_train.shape[0], args.batch_size, args.epochs,
        args.label_smoothing
    )

    cw = None if args.no_class_weights else compute_balanced_class_weights(y_train)
    _report_class_weights(cw)

    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=make_callbacks(args.out_dir, "best_model.keras"),
        class_weight=cw,
    )

    test_loss, test_acc, test_top5 = model.evaluate(X_test, y_test)
    print(f"\nFinal test accuracy: {test_acc:.4f} | Final test top-5 accuracy: {test_top5:.4f}")

    recompile_for_export(model, num_classes)
    model.save(os.path.join(args.out_dir, "final_model.keras"))


def train_test_split_stratified(df, val_frac=0.1, seed=42):
    from sklearn.model_selection import train_test_split
    # >= 2 is sufficient here: this is the final internal monitoring split,
    # applied AFTER the main >= MIN_PER_CLASS filter inside get_kfold_splits.
    counts = df["label"].value_counts()
    valid_labels = counts[counts >= 2].index
    df = df[df["label"].isin(valid_labels)]
    train_df, val_df = train_test_split(
        df, test_size=val_frac, stratify=df["label"], random_state=seed
    )
    return train_df, val_df


def main(args):
    os.makedirs(args.out_dir, exist_ok=True)

    with open(args.label_map) as f:
        label_map = json.load(f)
    num_classes = len(label_map)
    print(f"Label map: {num_classes} classes "
          f"(note: only classes with >= MIN_PER_CLASS clips will be kept)")

    if args.kfold and args.kfold > 1:
        train_kfold(args, num_classes)
    else:
        train_single_split(args, num_classes)

    print(f"\nModel(s) saved to {args.out_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--label_map", required=True)
    parser.add_argument("--landmarks_dir", required=True,
                        help="Folder with 126-dim .npy landmark files (landmarks_v2)")
    parser.add_argument("--seq_len", type=int, default=60)
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--kfold", type=int, default=1,
                        help="Number of stratified CV folds. 1 = single split (default), 5 = per proposal.")
    parser.add_argument("--label_smoothing", type=float, default=0.1,
                        help="Label smoothing for CE loss (0 disables).")
    parser.add_argument("--no_class_weights", action="store_true",
                        help="Disable inverse-frequency class weights.")
    parser.add_argument("--out_dir", default="checkpoints")
    args = parser.parse_args()
    main(args)