"""
dataset.py  (Hands-only version, matching approved proposal Section 3.2.2)

Loads the .npy hand-landmark sequences, normalizes each frame relative to
the wrist keypoint (landmark index 0 in MediaPipe's hand landmark layout),
pads/truncates to a fixed length, and builds an explicit stratified 70/15/15
train/val/test split by gloss label (rather than relying on WLASL's own
provided split column), per proposal Section 3.2.2.
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split

HAND_N = 21
FEATURE_DIM = HAND_N * 3  # 63
WRIST_IDX = 0


def normalize_sequence(seq: np.ndarray) -> np.ndarray:
    """Re-center each frame on the wrist keypoint; leaves zero (missing) frames alone."""
    seq = seq.copy()
    points = seq.reshape(-1, HAND_N, 3)
    wrist = points[:, WRIST_IDX:WRIST_IDX + 1, :]  # [frames, 1, 3]
    nonzero_mask = seq.any(axis=1, keepdims=True)

    shifted = points - wrist
    shifted = shifted.reshape(-1, FEATURE_DIM)
    return np.where(nonzero_mask, shifted, seq)


def pad_or_truncate(seq: np.ndarray, target_len: int) -> np.ndarray:
    n = seq.shape[0]
    if n >= target_len:
        return seq[:target_len]
    pad = np.zeros((target_len - n, seq.shape[1]), dtype=seq.dtype)
    return np.concatenate([seq, pad], axis=0)


def make_stratified_split(manifest_df: pd.DataFrame, train_frac=0.70,
                           val_frac=0.15, test_frac=0.15, seed=42) -> pd.DataFrame:
    """Overwrites/creates a 'split' column with an explicit 70/15/15 stratified
    split by label, per proposal Section 3.2.2, rather than trusting WLASL's own."""
    assert abs(train_frac + val_frac + test_frac - 1.0) < 1e-6

    df = manifest_df.copy()
    # Some classes may have too few samples to stratify across 3 splits; drop
    # those with fewer than 3 instances (can't stratify a single-example class).
    counts = df["label"].value_counts()
    valid_labels = counts[counts >= 3].index
    df = df[df["label"].isin(valid_labels)].reset_index(drop=True)

    train_df, temp_df = train_test_split(
        df, train_size=train_frac, stratify=df["label"], random_state=seed
    )
    relative_val = val_frac / (val_frac + test_frac)
    val_df, test_df = train_test_split(
        temp_df, train_size=relative_val, stratify=temp_df["label"], random_state=seed
    )

    train_df = train_df.assign(split="train")
    val_df = val_df.assign(split="val")
    test_df = test_df.assign(split="test")
    return pd.concat([train_df, val_df, test_df], ignore_index=True)


def load_split(manifest_df: pd.DataFrame, landmarks_dir: str, split: str,
                seq_len: int, num_classes: int):
    manifest_df = manifest_df.copy()
    manifest_df["video_id"] = manifest_df["video_id"].astype(str)
    subset = manifest_df[manifest_df["split"] == split]

    X, y = [], []
    for _, row in subset.iterrows():
        path = f"{landmarks_dir}/{row['video_id']}.npy"
        try:
            seq = np.load(path)
        except FileNotFoundError:
            continue
        seq = normalize_sequence(seq)
        seq = pad_or_truncate(seq, seq_len)
        X.append(seq)
        y.append(row["label"])

    X = np.stack(X).astype(np.float32)
    y = tf.keras.utils.to_categorical(y, num_classes=num_classes)
    return X, y


def load_from_df(df: pd.DataFrame, landmarks_dir: str, seq_len: int, num_classes: int):
    """Generic loader for an arbitrary manifest subset (not filtered by 'split' column)."""
    df = df.copy()
    df["video_id"] = df["video_id"].astype(str)

    X, y = [], []
    for _, row in df.iterrows():
        path = f"{landmarks_dir}/{row['video_id']}.npy"
        try:
            seq = np.load(path)
        except FileNotFoundError:
            continue
        seq = normalize_sequence(seq)
        seq = pad_or_truncate(seq, seq_len)
        X.append(seq)
        y.append(row["label"])

    X = np.stack(X).astype(np.float32)
    y = tf.keras.utils.to_categorical(y, num_classes=num_classes)
    return X, y


def get_kfold_splits(manifest_df: pd.DataFrame, k: int = 5, test_frac: float = 0.15, seed: int = 42):
    """Holds out a stratified test set (test_frac), then returns k stratified
    train/val folds over the remaining data -- per proposal Section 3.2.3
    ("Stratified k-fold cross-validation (k=5)"). Classes with too few
    examples to support stratification across k folds are dropped, with a
    printed count so this is visible/reportable as a limitation."""
    from sklearn.model_selection import StratifiedKFold

    df = manifest_df.copy()
    counts = df["label"].value_counts()
    min_needed = max(k, 3)  # need at least k examples per class to stratify k folds
    valid_labels = counts[counts >= min_needed].index
    dropped = len(counts) - len(valid_labels)
    if dropped > 0:
        print(f"Dropping {dropped} classes with fewer than {min_needed} examples "
              f"(insufficient for stratified {k}-fold)")
    df = df[df["label"].isin(valid_labels)].reset_index(drop=True)

    trainval_df, test_df = train_test_split(
        df, test_size=test_frac, stratify=df["label"], random_state=seed
    )
    trainval_df = trainval_df.reset_index(drop=True)

    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=seed)
    folds = []
    for train_idx, val_idx in skf.split(trainval_df, trainval_df["label"]):
        folds.append((trainval_df.iloc[train_idx], trainval_df.iloc[val_idx]))

    return trainval_df, test_df, folds


def make_datasets(manifest_csv: str, landmarks_dir: str, num_classes: int,
                   seq_len: int = 60, batch_size: int = 32,
                   use_explicit_split: bool = True):
    df = pd.read_csv(manifest_csv, dtype={"video_id": str})

    if use_explicit_split:
        df = make_stratified_split(df)

    X_train, y_train = load_split(df, landmarks_dir, "train", seq_len, num_classes)
    X_val, y_val = load_split(df, landmarks_dir, "val", seq_len, num_classes)
    X_test, y_test = load_split(df, landmarks_dir, "test", seq_len, num_classes)

    print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

    train_ds = tf.data.Dataset.from_tensor_slices((X_train, y_train)) \
        .shuffle(2048).batch(batch_size).prefetch(tf.data.AUTOTUNE)
    val_ds = tf.data.Dataset.from_tensor_slices((X_val, y_val)) \
        .batch(batch_size).prefetch(tf.data.AUTOTUNE)
    test_ds = tf.data.Dataset.from_tensor_slices((X_test, y_test)) \
        .batch(batch_size).prefetch(tf.data.AUTOTUNE)

    return train_ds, val_ds, test_ds
