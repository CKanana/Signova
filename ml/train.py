"""
train.py

Trains the Signova BiLSTM gloss classifier on hand-landmark sequences.

Two modes:
  --kfold 1 (default): single stratified 70/15/15 train/val/test split.
  --kfold N (N>1):     stratified N-fold cross-validation over the
                        train+val portion (85%), per proposal Section 3.2.3,
                        reporting mean/std validation accuracy across folds,
                        then a final model trained on the full train+val
                        portion and evaluated once on the held-out test set.

Usage:
    python train.py \
        --manifest manifest.csv \
        --label_map label_map.json \
        --landmarks_dir landmarks/ \
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
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6
        ),
    ]


def train_single_split(args, num_classes):
    df = pd.read_csv(args.manifest, dtype={"video_id": str})
    df = make_stratified_split(df)  # explicit 70/15/15 per proposal

    X_train, y_train = load_split(df, args.landmarks_dir, "train", args.seq_len, num_classes)
    X_val, y_val = load_split(df, args.landmarks_dir, "val", args.seq_len, num_classes)
    X_test, y_test = load_split(df, args.landmarks_dir, "test", args.seq_len, num_classes)
    print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

    model = build_model(seq_len=args.seq_len, feature_dim=FEATURE_DIM, num_classes=num_classes)
    model.summary()

    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=make_callbacks(args.out_dir, "best_model.keras"),
    )

    test_loss, test_acc, test_top5 = model.evaluate(X_test, y_test)
    print(f"\nTest accuracy: {test_acc:.4f} | Test top-5 accuracy: {test_top5:.4f}")
    model.save(os.path.join(args.out_dir, "final_model.keras"))


def train_kfold(args, num_classes):
    manifest_df = pd.read_csv(args.manifest, dtype={"video_id": str})
    trainval_df, test_df, folds = get_kfold_splits(manifest_df, k=args.kfold)

    fold_accuracies = []
    for i, (fold_train_df, fold_val_df) in enumerate(folds):
        print(f"\n{'='*50}\nFold {i+1}/{args.kfold}\n{'='*50}")

        X_train, y_train = load_from_df(fold_train_df, args.landmarks_dir, args.seq_len, num_classes)
        X_val, y_val = load_from_df(fold_val_df, args.landmarks_dir, args.seq_len, num_classes)
        print(f"Fold {i+1} — Train: {X_train.shape}, Val: {X_val.shape}")

        model = build_model(seq_len=args.seq_len, feature_dim=FEATURE_DIM, num_classes=num_classes)
        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=args.epochs,
            batch_size=args.batch_size,
            callbacks=make_callbacks(args.out_dir, f"fold_{i+1}_best.keras"),
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

    X_train, y_train = load_from_df(final_train_df, args.landmarks_dir, args.seq_len, num_classes)
    X_val, y_val = load_from_df(final_val_df, args.landmarks_dir, args.seq_len, num_classes)
    X_test, y_test = load_from_df(test_df, args.landmarks_dir, args.seq_len, num_classes)
    print(f"Final train: {X_train.shape}, Final val: {X_val.shape}, Test: {X_test.shape}")

    model = build_model(seq_len=args.seq_len, feature_dim=FEATURE_DIM, num_classes=num_classes)
    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=make_callbacks(args.out_dir, "best_model.keras"),
    )

    test_loss, test_acc, test_top5 = model.evaluate(X_test, y_test)
    print(f"\nFinal test accuracy: {test_acc:.4f} | Final test top-5 accuracy: {test_top5:.4f}")
    model.save(os.path.join(args.out_dir, "final_model.keras"))


def train_test_split_stratified(df, val_frac=0.1, seed=42):
    from sklearn.model_selection import train_test_split
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

    if args.kfold and args.kfold > 1:
        train_kfold(args, num_classes)
    else:
        train_single_split(args, num_classes)

    print(f"\nModel(s) saved to {args.out_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--label_map", required=True)
    parser.add_argument("--landmarks_dir", required=True)
    parser.add_argument("--seq_len", type=int, default=60)
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--kfold", type=int, default=1,
                         help="Number of stratified CV folds. 1 = single split (default), 5 = per proposal.")
    parser.add_argument("--out_dir", default="checkpoints")
    args = parser.parse_args()
    main(args)
