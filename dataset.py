"""
dataset.py  (Both-hands version + training-time augmentation + loud failures)

Loads .npy hand-landmark sequences (126-dim: left hand + right hand, 63 each),
normalizes each hand INDEPENDENTLY relative to its own wrist keypoint
(landmark index 0 within each 63-value block), pads/truncates to a fixed
length, and builds an explicit stratified 70/15/15 train/val/test split by
gloss label.

Recent changes:
- normalize_sequence works per-hand (left/right independent) since a frame
  can have one hand present and the other absent.
- augment_sequence applies scale + rotation + jitter + temporal-drop, AND a
  50% chance of left↔right mirroring (many signs are handedness-independent,
  so this roughly doubles effective data for free). Zero/no-detection frames
  are restored to exact zero after augmentation so Masking(mask_value=0.0)
  still works.
- make_stratified_split / get_kfold_splits drop classes with fewer than
  MIN_PER_CLASS clips (default 10) instead of the previous 3, since 3-clip
  classes can't be stratified across train/val/test cleanly and produce
  unstable gradients under a long-tail loss.
- load_split / load_from_df now (a) raise with a clear error when >10% of
  the expected .npy files are missing (wrong --landmarks_dir), and
  (b) raise if any loaded .npy has a feature dimension different from
  FEATURE_DIM (mixed landmarks_v1 63-dim and landmarks_v2 126-dim folders).
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split

HAND_N = 21
SINGLE_HAND_DIM = HAND_N * 3        # 63
FEATURE_DIM = SINGLE_HAND_DIM * 2   # 126 (left + right)
WRIST_IDX = 0

# Minimum clips a class must have in the manifest to survive train/val/test
# stratification. Below 10, sklearn can't cleanly split into 70/15/15 without
# leaving some class with < 2 members in one split, and the weighted loss gets
# unstable. This is the "class coverage vs. per-class quality" trade-off
# we report in the limitations section.
MIN_PER_CLASS = 10


def _normalize_hand_block(block: np.ndarray) -> np.ndarray:
    """block: [frames, 63]. Re-centers on this hand's own wrist; leaves
    all-zero (this hand not detected) frames untouched."""
    points = block.reshape(-1, HAND_N, 3)
    wrist = points[:, WRIST_IDX:WRIST_IDX + 1, :]
    nonzero_mask = block.any(axis=1, keepdims=True)
    shifted = (points - wrist).reshape(-1, SINGLE_HAND_DIM)
    return np.where(nonzero_mask, shifted, block)


def normalize_sequence(seq: np.ndarray) -> np.ndarray:
    """Re-centers each hand (left, right) independently on its own wrist."""
    left = seq[:, :SINGLE_HAND_DIM]
    right = seq[:, SINGLE_HAND_DIM:]
    return np.concatenate(
        [_normalize_hand_block(left), _normalize_hand_block(right)], axis=1
    )


def pad_or_truncate(seq: np.ndarray, target_len: int) -> np.ndarray:
    n = seq.shape[0]
    if n >= target_len:
        return seq[:target_len]
    pad = np.zeros((target_len - n, seq.shape[1]), dtype=seq.dtype)
    return np.concatenate([seq, pad], axis=0)


def mirror_sequence(seq: np.ndarray) -> np.ndarray:
    """Swap left↔right hand slots and reflect X within each hand.

    Many ASL signs are handedness-independent (a right-handed signer's "BOOK"
    is the mirror of a left-handed signer's "BOOK"), so this produces a
    semantically valid positive example for most classes. For the minority
    of signs where handedness matters (e.g. some two-handed asymmetric
    signs), the mirrored clip is ambiguous — but since we apply it with 50%
    probability only during training, the model still sees the natural
    version of every clip, and net benefit is positive.
    """
    seq = seq.copy()
    left = seq[:, :SINGLE_HAND_DIM].copy()
    right = seq[:, SINGLE_HAND_DIM:].copy()

    left_p = left.reshape(-1, HAND_N, 3)
    right_p = right.reshape(-1, HAND_N, 3)
    left_p[..., 0] *= -1.0   # reflect X
    right_p[..., 0] *= -1.0

    # Swap slots so "left" now holds the mirrored original right hand.
    return np.concatenate(
        [right_p.reshape(-1, SINGLE_HAND_DIM),
         left_p.reshape(-1, SINGLE_HAND_DIM)],
        axis=1,
    ).astype(np.float32)


def augment_sequence(seq: np.ndarray) -> np.ndarray:
    """Small random scale + rotation (x-y plane) + Gaussian jitter + light
    temporal jitter (dropping a couple of real frames) + 50% chance of
    left-right mirroring. Only ever called on training data.

    Frames with no detected hand data (all-zero across BOTH hand slots) are
    restored to exact zero after perturbation, so padding/masking is never
    corrupted.
    """
    seq = seq.copy()

    # 50% chance: mirror left↔right (mirror before scale/rotate so the
    # downstream rigid-body augmentations act on the mirrored geometry).
    if np.random.rand() < 0.5:
        seq = mirror_sequence(seq)

    frame_has_data = seq.any(axis=1)  # [frames] -- True if either hand present

    num_points = seq.shape[1] // 3  # 42 (21 x 2 hands)
    points = seq.reshape(-1, num_points, 3)

    scale = np.random.uniform(0.9, 1.1)
    points = points * scale

    angle = np.random.uniform(-np.pi / 12, np.pi / 12)  # +/- 15 degrees
    cos_a, sin_a = np.cos(angle), np.sin(angle)
    x = points[..., 0] * cos_a - points[..., 1] * sin_a
    y = points[..., 0] * sin_a + points[..., 1] * cos_a
    points = np.stack([x, y, points[..., 2]], axis=-1)

    points = points + np.random.normal(0, 0.01, points.shape).astype(np.float32)
    seq_aug = points.reshape(-1, seq.shape[1]).astype(np.float32)

    # restore fully-empty frames to exact zero (don't let jitter touch padding)
    seq_aug[~frame_has_data] = 0.0

    # light temporal jitter: randomly drop a couple of real frames, then
    # re-pad to the original length
    real_idx = np.where(frame_has_data)[0]
    if len(real_idx) > 5:
        max_drop = min(3, len(real_idx) // 4)
        n_drop = np.random.randint(0, max_drop + 1) if max_drop > 0 else 0
        if n_drop > 0:
            drop_idx = np.random.choice(real_idx, size=n_drop, replace=False)
            keep_mask = np.ones(seq.shape[0], dtype=bool)
            keep_mask[drop_idx] = False
            kept = seq_aug[keep_mask]
            pad_len = seq.shape[0] - kept.shape[0]
            pad = np.zeros((pad_len, seq.shape[1]), dtype=np.float32)
            seq_aug = np.concatenate([kept, pad], axis=0)

    return seq_aug


def _tf_augment(seq, label):
    seq_aug = tf.py_function(func=augment_sequence, inp=[seq], Tout=tf.float32)
    seq_aug.set_shape(seq.shape)
    return seq_aug, label


def make_stratified_split(manifest_df: pd.DataFrame, train_frac=0.70,
                          val_frac=0.15, test_frac=0.15, seed=42) -> pd.DataFrame:
    """Overwrites/creates a 'split' column with an explicit 70/15/15
    stratified split by label. Drops classes with < MIN_PER_CLASS clips."""
    assert abs(train_frac + val_frac + test_frac - 1.0) < 1e-6

    df = manifest_df.copy()
    counts = df["label"].value_counts()
    valid_labels = counts[counts >= MIN_PER_CLASS].index
    dropped = len(counts) - len(valid_labels)
    if dropped > 0:
        print(f"make_stratified_split: dropping {dropped} classes with fewer "
              f"than {MIN_PER_CLASS} clips (kept {len(valid_labels)} classes)")
    df = df[df["label"].isin(valid_labels)].reset_index(drop=True)

    if df.empty:
        raise ValueError(
            f"After filtering to classes with >= {MIN_PER_CLASS} clips, the "
            f"manifest is empty. Lower MIN_PER_CLASS or check your manifest."
        )

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


def _load_one(seq_path: str) -> np.ndarray:
    """Load a .npy landmark file, raising a clear error on bad shape."""
    seq = np.load(seq_path)
    if seq.ndim != 2 or seq.shape[1] != FEATURE_DIM:
        raise ValueError(
            f"{seq_path} has shape {seq.shape}, expected (frames, {FEATURE_DIM}). "
            f"This usually means you mixed landmarks_v1 (63-dim) and "
            f"landmarks_v2 (126-dim) folders. Re-extract to a clean folder "
            f"with the both-hands extract_landmarks.py."
        )
    return seq


def _load_many(df: pd.DataFrame, landmarks_dir: str, seq_len: int,
               num_classes: int):
    df = df.copy()
    df["video_id"] = df["video_id"].astype(str)

    X, y = [], []
    missing = []
    for _, row in df.iterrows():
        path = f"{landmarks_dir}/{row['video_id']}.npy"
        try:
            seq = _load_one(path)
        except FileNotFoundError:
            missing.append(row["video_id"])
            continue
        seq = normalize_sequence(seq)
        seq = pad_or_truncate(seq, seq_len)
        X.append(seq)
        y.append(row["label"])

    if missing:
        print(f"WARNING: {len(missing)}/{len(df)} landmark files not found in "
              f"{landmarks_dir}")
        print(f"  examples: {missing[:5]}")
        if len(missing) > 0.10 * len(df):
            raise FileNotFoundError(
                f"{len(missing)} of {len(df)} landmark files missing from "
                f"{landmarks_dir}. Wrong --landmarks_dir, or the extraction "
                f"folder doesn't cover this manifest."
            )

    if not X:
        raise ValueError(
            f"No clips loaded from {landmarks_dir}. Check --landmarks_dir "
            f"and the manifest."
        )

    X = np.stack(X).astype(np.float32)
    y = tf.keras.utils.to_categorical(y, num_classes=num_classes)
    return X, y


def load_split(manifest_df: pd.DataFrame, landmarks_dir: str, split: str,
               seq_len: int, num_classes: int):
    manifest_df = manifest_df.copy()
    subset = manifest_df[manifest_df["split"] == split]
    return _load_many(subset, landmarks_dir, seq_len, num_classes)


def load_from_df(df: pd.DataFrame, landmarks_dir: str, seq_len: int,
                 num_classes: int):
    """Generic loader for an arbitrary manifest subset (not filtered by 'split')."""
    return _load_many(df, landmarks_dir, seq_len, num_classes)


def get_kfold_splits(manifest_df: pd.DataFrame, k: int = 5,
                     test_frac: float = 0.15, seed: int = 42):
    """Holds out a stratified test set (test_frac), then returns k stratified
    train/val folds over the remaining data. Classes with fewer than
    max(k, MIN_PER_CLASS) clips are dropped."""
    from sklearn.model_selection import StratifiedKFold

    df = manifest_df.copy()
    counts = df["label"].value_counts()
    min_needed = max(k, MIN_PER_CLASS)
    valid_labels = counts[counts >= min_needed].index
    dropped = len(counts) - len(valid_labels)
    if dropped > 0:
        print(f"get_kfold_splits: dropping {dropped} classes with fewer than "
              f"{min_needed} clips (kept {len(valid_labels)} classes)")
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
                  use_explicit_split: bool = True, augment: bool = True):
    df = pd.read_csv(manifest_csv, dtype={"video_id": str})

    if use_explicit_split:
        df = make_stratified_split(df)

    X_train, y_train = load_split(df, landmarks_dir, "train", seq_len, num_classes)
    X_val, y_val = load_split(df, landmarks_dir, "val", seq_len, num_classes)
    X_test, y_test = load_split(df, landmarks_dir, "test", seq_len, num_classes)

    print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

    train_ds = tf.data.Dataset.from_tensor_slices((X_train, y_train)).shuffle(2048)
    if augment:
        train_ds = train_ds.map(_tf_augment, num_parallel_calls=tf.data.AUTOTUNE)
    train_ds = train_ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)

    val_ds = tf.data.Dataset.from_tensor_slices((X_val, y_val)) \
        .batch(batch_size).prefetch(tf.data.AUTOTUNE)
    test_ds = tf.data.Dataset.from_tensor_slices((X_test, y_test)) \
        .batch(batch_size).prefetch(tf.data.AUTOTUNE)

    return train_ds, val_ds, test_ds