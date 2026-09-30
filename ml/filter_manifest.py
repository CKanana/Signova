"""
filter_manifest.py

After running extract_landmarks.py, some clips will fail (corrupted videos,
or frame_start/frame_end pointing past a shorter-than-expected file -- both
happen occasionally in WLASL). This drops those from the manifest so
train.py never trips over a missing .npy file.

Usage:
    python filter_manifest.py \
        --manifest manifest.csv \
        --landmarks_dir landmarks/ \
        --out manifest_clean.csv
"""

import argparse
import os
import pandas as pd


def main(args):
    df = pd.read_csv(args.manifest, dtype={"video_id": str})

    def has_landmarks(video_id):
        return os.path.exists(os.path.join(args.landmarks_dir, f"{video_id}.npy"))

    mask = df["video_id"].apply(has_landmarks)
    kept, dropped = df[mask], df[~mask]

    print(f"Kept {len(kept)} / {len(df)} clips ({len(dropped)} missing landmarks)")
    if len(dropped) > 0:
        print("Dropped video_ids:", ", ".join(dropped["video_id"].tolist()[:20]),
              "..." if len(dropped) > 20 else "")
        print("\nSplit breakdown after filtering:")
        print(kept["split"].value_counts())

    kept.to_csv(args.out, index=False)
    print(f"\nClean manifest saved to {args.out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--landmarks_dir", required=True)
    parser.add_argument("--out", default="manifest_clean.csv")
    args = parser.parse_args()
    main(args)
