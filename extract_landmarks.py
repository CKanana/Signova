"""
extract_landmarks.py  (Both-hands version)

Extracts 21 three-dimensional keypoints for EACH detected hand per frame
using MediaPipe's HandLandmarker (Tasks API). Both left and right hands are
kept in fixed left/right slots -- 63 values each -- giving a 126-value
feature vector per frame (21 keypoints x 3 coordinates x 2 hands).

This replaces the earlier single-hand (63-dim, best-confidence-only)
extraction. Single-handed classification was dropping information for any
two-handed sign, which was identified as the largest accuracy bottleneck --
see project notes on the single-hand vs. both-hands accuracy comparison.

A hand that isn't detected in a given frame (either because the signer
only used one hand for that sign, or MediaPipe missed a detection) gets its
63-value slot zero-filled. A frame with NEITHER hand detected is therefore
an all-zero 126-vector, which is what the Masking(mask_value=0.0) layer in
model.py checks for -- masking behavior is unchanged, it just now checks
across both hand slots instead of one.

Usage:
    python extract_landmarks.py \
        --manifest manifest.csv \
        --out_dir landmarks_v2/ \
        --max_frames 60

IMPORTANT: point --out_dir at a NEW directory, not the old single-hand one.
This script skips any video whose output .npy already exists (for resumable
runs) -- reusing the old directory would silently mix old 63-dim single-hand
arrays with new 126-dim both-hands arrays, which will break downstream
shape assumptions in dataset.py.
"""

import argparse
import os
import urllib.request

import cv2
import numpy as np
import pandas as pd
from tqdm import tqdm

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

HAND_N = 21                        # keypoints per hand
SINGLE_HAND_DIM = HAND_N * 3        # 63
FEATURE_DIM = SINGLE_HAND_DIM * 2   # 126 (left + right)

MODEL_DIR = "mp_task_models"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"


def ensure_model() -> str:
    os.makedirs(MODEL_DIR, exist_ok=True)
    path = os.path.join(MODEL_DIR, "hand_landmarker.task")
    if not os.path.exists(path):
        print("Downloading hand landmarker model...")
        urllib.request.urlretrieve(MODEL_URL, path)
    return path


def build_landmarker():
    model_path = ensure_model()
    return vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=model_path),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=2,  # now keeping both, not just the best-scoring one
        )
    )


def extract_frame_landmarks(hand_landmarker, mp_image) -> np.ndarray:
    result = hand_landmarker.detect(mp_image)

    left = np.zeros(SINGLE_HAND_DIM, dtype=np.float32)
    right = np.zeros(SINGLE_HAND_DIM, dtype=np.float32)

    for hand_landmarks, handedness in zip(result.hand_landmarks, result.handedness):
        label = handedness[0].category_name  # "Left" or "Right"
        vec = np.array(
            [[lm.x, lm.y, lm.z] for lm in hand_landmarks], dtype=np.float32
        ).flatten()
        if label == "Left":
            left = vec
        elif label == "Right":
            right = vec
        # if MediaPipe ever returns an unexpected label, that hand is simply
        # dropped for this frame rather than crashing the run

    return np.concatenate([left, right])  # (126,)


def process_video(video_path, frame_start, frame_end, max_frames, hand_landmarker):
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    start = max(frame_start - 1, 0)
    end = total if frame_end == -1 else min(frame_end, total)

    if start >= total:
        cap.release()
        return None

    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    sequence = []
    frame_idx = start
    while frame_idx < end and len(sequence) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        sequence.append(extract_frame_landmarks(hand_landmarker, mp_image))
        frame_idx += 1

    cap.release()
    if len(sequence) == 0:
        return None
    return np.stack(sequence)


def main(args):
    os.makedirs(args.out_dir, exist_ok=True)
    df = pd.read_csv(args.manifest, dtype={"video_id": str})
    hand_landmarker = build_landmarker()

    failed = []
    for _, row in tqdm(df.iterrows(), total=len(df), desc="Extracting landmarks"):
        out_path = os.path.join(args.out_dir, f"{row['video_id']}.npy")
        if os.path.exists(out_path):
            continue

        seq = process_video(
            row["video_path"], row["frame_start"], row["frame_end"],
            args.max_frames, hand_landmarker,
        )
        if seq is None:
            failed.append(str(row["video_id"]))
            continue
        np.save(out_path, seq)

    hand_landmarker.close()

    print(f"\nDone. {len(df) - len(failed)} succeeded, {len(failed)} failed.")
    if failed:
        with open(os.path.join(args.out_dir, "_failed.txt"), "w") as f:
            f.write("\n".join(failed))
        print(f"Failed video_ids logged to {args.out_dir}/_failed.txt")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--out_dir", default="landmarks_v2")
    parser.add_argument("--max_frames", type=int, default=60)
    args = parser.parse_args()
    main(args)
