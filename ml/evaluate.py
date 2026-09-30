"""
evaluate.py

Runs detailed evaluation of a trained Signova model on the held-out test
split: top-1 accuracy, top-5 accuracy, and per-class precision/recall/F1
(the last one matters a lot for WLASL specifically, since long-tail classes
with few training examples can look fine on aggregate accuracy while
performing badly individually -- per-class F1 is what actually surfaces that).

Outputs:
    - Printed summary (top-1, top-5, macro-F1, weighted-F1)
    - classification_report.csv -- per-class precision/recall/F1/support
    - worst_classes.csv -- the N lowest-F1 classes, for the "where does this
      model struggle" discussion in your report

Usage:
    python evaluate.py \
        --model checkpoints/best_model.keras \
        --manifest manifest_clean.csv \
        --label_map label_map.json \
        --landmarks_dir landmarks/ \
        --seq_len 60 \
        --out_dir eval_results/
"""

import argparse
import json
import os

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import classification_report, top_k_accuracy_score

from dataset import load_split, make_stratified_split, FEATURE_DIM


def main(args):
    os.makedirs(args.out_dir, exist_ok=True)

    with open(args.label_map) as f:
        label_map = json.load(f)
    num_classes = len(label_map)
    idx_to_gloss = {v: k for k, v in label_map.items()}

    manifest_df = pd.read_csv(args.manifest, dtype={"video_id": str})
    manifest_df = make_stratified_split(manifest_df)  # same explicit 70/15/15 as training
    X_test, y_test_onehot = load_split(
        manifest_df, args.landmarks_dir, "test", args.seq_len, num_classes
    )
    y_test = np.argmax(y_test_onehot, axis=1)

    print(f"Loaded {len(X_test)} test clips across {num_classes} classes")

    model = tf.keras.models.load_model(args.model)
    y_prob = model.predict(X_test, batch_size=args.batch_size)
    y_pred = np.argmax(y_prob, axis=1)

    # --- Top-1 / Top-5 accuracy ---
    top1_acc = np.mean(y_pred == y_test)
    # top_k_accuracy_score needs the full label set explicitly when not
    # every class appears in y_test (common with WLASL's long tail)
    top5_acc = top_k_accuracy_score(
        y_test, y_prob, k=5, labels=list(range(num_classes))
    )
    print(f"\nTop-1 accuracy: {top1_acc:.4f}")
    print(f"Top-5 accuracy: {top5_acc:.4f}")

    # --- Per-class precision/recall/F1 ---
    present_labels = sorted(set(y_test.tolist()))
    target_names = [idx_to_gloss[i] for i in present_labels]

    report_dict = classification_report(
        y_test, y_pred,
        labels=present_labels,
        target_names=target_names,
        output_dict=True,
        zero_division=0,
    )
    report_df = pd.DataFrame(report_dict).transpose()
    report_df.to_csv(os.path.join(args.out_dir, "classification_report.csv"))

    macro_f1 = report_dict["macro avg"]["f1-score"]
    weighted_f1 = report_dict["weighted avg"]["f1-score"]
    print(f"Macro F1 (unweighted across classes): {macro_f1:.4f}")
    print(f"Weighted F1 (weighted by class support): {weighted_f1:.4f}")

    # --- Worst-performing classes (useful for your "limitations" discussion) ---
    per_class = report_df.drop(["accuracy", "macro avg", "weighted avg"], errors="ignore")
    per_class = per_class[per_class["support"] > 0]
    worst = per_class.sort_values("f1-score").head(args.n_worst)
    worst.to_csv(os.path.join(args.out_dir, "worst_classes.csv"))

    print(f"\n{args.n_worst} worst-performing glosses (by F1):")
    print(worst[["precision", "recall", "f1-score", "support"]])

    # --- Summary file ---
    summary = {
        "num_test_clips": len(X_test),
        "num_classes_in_test": len(present_labels),
        "top1_accuracy": float(top1_acc),
        "top5_accuracy": float(top5_acc),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
    }
    with open(os.path.join(args.out_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nFull results saved to {args.out_dir}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--label_map", required=True)
    parser.add_argument("--landmarks_dir", required=True)
    parser.add_argument("--seq_len", type=int, default=60)
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--n_worst", type=int, default=20)
    parser.add_argument("--out_dir", default="eval_results")
    args = parser.parse_args()
    main(args)
