"""
evaluate.py

Runs detailed evaluation of a trained Signova model on the held-out test
split: top-1 accuracy, top-5 accuracy, test loss, per-class precision/recall/
F1, and a confusion matrix (which shows WHICH signs get mistaken for which,
not just that a class scores poorly).

Outputs (all saved to --out_dir):
    - Printed summary (top-1, top-5, test loss, macro-F1, weighted-F1)
    - classification_report.csv   -- per-class precision/recall/F1/support
    - worst_classes.csv           -- the N lowest-F1 classes
    - confusion_matrix.csv        -- raw NxN confusion counts, gloss-labeled
    - confusion_matrix.png        -- heatmap of the above
    - top_confusions.csv          -- the N most frequent (true, predicted)
      mix-ups, excluding the diagonal
    - summary.json                -- all headline numbers in one file

NOTE: this script runs as a separate process (!python ...), so it cannot
render plots inline in Colab. It saves confusion_matrix.png instead; display
it from a notebook cell with IPython.display.Image (see usage below).

Usage:
    python evaluate.py \
        --model checkpoints/best_model.keras \
        --manifest manifest_100.csv \
        --label_map label_map_100.json \
        --landmarks_dir landmarks_v2/ \
        --seq_len 60 \
        --out_dir eval_results/
"""

import argparse
import json
import os

import matplotlib
matplotlib.use("Agg")  # headless backend: we save figures, we don't show them
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix, top_k_accuracy_score

from dataset import load_split, make_stratified_split, FEATURE_DIM
# Importing AttentionPooling registers the custom layer with Keras so the
# saved checkpoint can be deserialized.
from model import AttentionPooling


def plot_confusion_matrix(cm: np.ndarray, labels: list, out_path: str):
    """Saves a heatmap of the confusion matrix. With ~100 classes the
    per-cell labels aren't individually readable -- this shows overall
    diagonal strength and visible confusion clusters at a glance;
    top_confusions.csv is the readable, specific breakdown."""
    n = len(labels)
    fig_size = max(10, n * 0.14)
    fig, ax = plt.subplots(figsize=(fig_size, fig_size))
    im = ax.imshow(cm, cmap="Blues")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    tick_fontsize = max(4, min(8, 400 / n))
    ax.set_xticklabels(labels, rotation=90, fontsize=tick_fontsize)
    ax.set_yticklabels(labels, fontsize=tick_fontsize)
    ax.set_xlabel("Predicted gloss")
    ax.set_ylabel("True gloss")
    ax.set_title("Confusion matrix (test set)")

    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)


def get_top_confusions(cm: np.ndarray, labels: list, n: int) -> pd.DataFrame:
    """Returns the n largest off-diagonal entries as (true, predicted, count)."""
    rows = []
    for i in range(len(labels)):
        for j in range(len(labels)):
            if i == j:
                continue
            count = cm[i, j]
            if count > 0:
                rows.append({"true_gloss": labels[i], "predicted_gloss": labels[j], "count": int(count)})
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    return df.sort_values("count", ascending=False).head(n).reset_index(drop=True)


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

    print(f"Loaded {len(X_test)} test clips ({len(set(y_test.tolist()))} distinct classes "
          f"present; label map size {num_classes})")

    model = tf.keras.models.load_model(
        args.model, custom_objects={"AttentionPooling": AttentionPooling}
    )

    # Fail early with a clear message if the label map doesn't match the model
    model_classes = model.output_shape[-1]
    if model_classes != num_classes:
        raise SystemExit(
            f"Model outputs {model_classes} classes but --label_map has {num_classes}. "
            f"Use the same label map (and manifest) that the model was trained with."
        )
    if X_test.shape[-1] != model.input_shape[-1]:
        raise SystemExit(
            f"Landmark files have {X_test.shape[-1]} features per frame but the model "
            f"expects {model.input_shape[-1]}. Use the same landmarks directory / "
            f"feature set that the model was trained with."
        )

    y_prob = model.predict(X_test, batch_size=args.batch_size)
    y_pred = np.argmax(y_prob, axis=1)

    # --- Top-1 / Top-5 accuracy (sklearn) ---
    top1_acc = np.mean(y_pred == y_test)
    top5_acc = top_k_accuracy_score(
        y_test, y_prob, k=5, labels=list(range(num_classes))
    )
    print(f"\nTop-1 accuracy: {top1_acc:.4f}")
    print(f"Top-5 accuracy: {top5_acc:.4f}")

    # --- Cross-check against Keras' own compiled metrics, plus test loss ---
    keras_metrics = model.evaluate(
        X_test, y_test_onehot, batch_size=args.batch_size, verbose=0, return_dict=True
    )
    test_loss = keras_metrics["loss"]
    print(f"\nTest loss (categorical cross-entropy): {test_loss:.4f}")
    print(f"Keras-computed top-1: {keras_metrics.get('accuracy', float('nan')):.4f}, "
          f"top-5: {keras_metrics.get('top5_acc', float('nan')):.4f} "
          f"(should match the sklearn values above)")

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

    # --- Worst-performing classes ---
    per_class = report_df.drop(["accuracy", "macro avg", "weighted avg"], errors="ignore")
    per_class = per_class[per_class["support"] > 0]
    worst = per_class.sort_values("f1-score").head(args.n_worst)
    worst.to_csv(os.path.join(args.out_dir, "worst_classes.csv"))

    print(f"\n{args.n_worst} worst-performing glosses (by F1):")
    print(worst[["precision", "recall", "f1-score", "support"]])

    # --- Confusion matrix ---
    cm = confusion_matrix(y_test, y_pred, labels=present_labels)
    cm_df = pd.DataFrame(cm, index=target_names, columns=target_names)
    cm_df.to_csv(os.path.join(args.out_dir, "confusion_matrix.csv"))
    plot_confusion_matrix(cm, target_names, os.path.join(args.out_dir, "confusion_matrix.png"))

    # --- Top confused sign pairs ---
    top_confusions = get_top_confusions(cm, target_names, args.n_confusions)
    top_confusions.to_csv(os.path.join(args.out_dir, "top_confusions.csv"), index=False)
    if not top_confusions.empty:
        print(f"\nTop {args.n_confusions} most frequent sign confusions (true -> predicted, count):")
        print(top_confusions.to_string(index=False))
    else:
        print("\nNo off-diagonal confusions found (every test prediction was correct).")

    # --- Summary file ---
    summary = {
        "num_test_clips": len(X_test),
        "num_classes_in_test": len(present_labels),
        "top1_accuracy": float(top1_acc),
        "top5_accuracy": float(top5_acc),
        "test_loss": float(test_loss),
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
    parser.add_argument("--n_confusions", type=int, default=20)
    parser.add_argument("--out_dir", default="eval_results")
    args = parser.parse_args()
    main(args)
