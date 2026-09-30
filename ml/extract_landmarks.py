"""
extract_landmarks.py  (Hands-only version, matching approved proposal Section 3.2.2)

Extracts 21 three-dimensional hand keypoints per frame using MediaPipe's
HandLandmarker (Tasks API -- the legacy mp.solutions.hands module is no
longer functional on current package builds, see notes in earlier project
history). Only the single highest-confidence hand per frame is kept, giving
a 63-value feature vector per frame (21 keypoints x 3 coordinates), matching
the proposal's specified input representation exactly.

Frames with no detected hand are zero-padded (per proposal Section 3.2.2).

Usage:
    python extract_landmarks.py \
        --manifest manifest.csv \
        --out_dir landmarks/ \
        --max_frames 60
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

HAND_N = 21  # keypoints per hand
FEATURE_DIM = HAND_N * 3  # 63

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
            num_hands=2,  # detect up to 2, we keep only the best-scoring one
        )
    )


def extract_frame_landmarks(hand_landmarker, mp_image) -> np.ndarray:
    result = hand_landmarker.detect(mp_image)

    if not result.hand_landmarks:
        return np.zeros(FEATURE_DIM, dtype=np.float32)

    # Keep only the single highest-confidence hand (proposal specifies one
    # hand, 21 keypoints -- not left+right separately)
    best_idx = 0
    if len(result.handedness) > 1:
        scores = [h[0].score for h in result.handedness]
        best_idx = int(np.argmax(scores))

    landmarks = result.hand_landmarks[best_idx]
    return np.array(
        [[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32
    ).flatten()


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
    parser.add_argument("--out_dir", default="landmarks")
    parser.add_argument("--max_frames", type=int, default=60)
    args = parser.parse_args()
    main(args)
