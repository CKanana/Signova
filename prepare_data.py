"""
prepare_data.py

Parses the WLASL metadata file (WLASL_v0.3.json, from the official WLASL repo:
https://github.com/dxli94/WLASL) and cross-checks it against the video files
you've actually downloaded (e.g. via the WLASL2000 Kaggle mirror, which is far
more reliable than re-scraping YouTube links that have since gone dead).

Output: a manifest CSV with one row per usable clip:
    video_id, gloss, label, split, frame_start, frame_end, bbox

Usage:
    python prepare_data.py \
        --meta WLASL_v0.3.json \
        --videos_dir /path/to/videos \
        --out manifest.csv
"""

import argparse
import json
import os
import pandas as pd
from tqdm import tqdm


def build_manifest(meta_path: str, videos_dir: str) -> pd.DataFrame:
    with open(meta_path, "r") as f:
        content = json.load(f)

    rows = []
    label_map = {}  # gloss -> integer label, sorted for reproducibility
    for entry in content:
        gloss = entry["gloss"]
        if gloss not in label_map:
            label_map[gloss] = len(label_map)

    for entry in tqdm(content, desc="Scanning glosses"):
        gloss = entry["gloss"]
        label = label_map[gloss]
        for inst in entry["instances"]:
            video_id = inst["video_id"]
            video_path = os.path.join(videos_dir, f"{video_id}.mp4")
            if not os.path.exists(video_path):
                # Common with WLASL: some YouTube-sourced clips are no longer
                # retrievable. Skip silently, we log the total dropped below.
                continue
            rows.append({
                "video_id": video_id,
                "video_path": video_path,
                "gloss": gloss,
                "label": label,
                "split": inst.get("split", "train"),  # train/val/test given by WLASL
                "frame_start": inst.get("frame_start", 1),
                "frame_end": inst.get("frame_end", -1),
                "bbox": inst.get("bbox", None),
                "fps": inst.get("fps", 25),
                "signer_id": inst.get("signer_id", -1),
            })

    total_listed = sum(len(e["instances"]) for e in content)
    print(f"Total glosses in metadata: {len(label_map)}")
    print(f"Total instances found on disk: {len(rows)} / {total_listed} listed in metadata")

    if len(rows) == 0:
        raise SystemExit(
            "\nNo video files matched the metadata. This almost always means --videos_dir "
            "is pointing at the wrong folder, or you only have the WLASL_v0.3.json metadata "
            "file without the actual .mp4 video files. Check that --videos_dir contains files "
            "named like <video_id>.mp4 matching the video_id values in the metadata."
        )

    df = pd.DataFrame(rows)
    return df, label_map


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--meta", required=True, help="Path to WLASL_v0.3.json")
    parser.add_argument("--videos_dir", required=True, help="Directory of downloaded .mp4 clips")
    parser.add_argument("--out", default="manifest.csv")
    parser.add_argument("--label_map_out", default="label_map.json")
    args = parser.parse_args()

    df, label_map = build_manifest(args.meta, args.videos_dir)
    df.to_csv(args.out, index=False)
    with open(args.label_map_out, "w") as f:
        json.dump(label_map, f, indent=2)

    print(f"\nSplit breakdown:\n{df['split'].value_counts()}")
    print(f"\nManifest saved to {args.out}")
    print(f"Label map saved to {args.label_map_out} ({len(label_map)} classes)")
