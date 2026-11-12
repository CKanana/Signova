"""
Generate a placeholder labels.json for the WLASL-2000 model.

The WLASL-2000 dataset uses the 2000 most frequent ASL signs from the
Word-Level American Sign Language dataset (Li et al., 2020).
The class ordering matches the WLASL2000 split used during training.

Since we don't have the original training class-index mapping file, we
generate a placeholder list. In production this MUST be replaced with the
exact class_list.txt / WLASL_class_list.txt used during training.

The output is a JSON array of 2000 strings where labels[i] = class name for
output neuron i.

IMPORTANT: This is a PLACEHOLDER. The ordering below approximates the
WLASL-2000 vocabulary but is NOT guaranteed to match the training order.
Replace with the exact mapping from the training pipeline.
"""

# Standard WLASL-2000 vocabulary (approximate order, first 100 shown as reference)
# The full list must come from the training artifacts.
# Source: https://github.com/dxli94/WLASL

WLASL_2000_VOCAB = [
    "book", "drink", "computer", "before", "chair", "go", "clothes",
    "who", "candy", "cousin", "deaf", "fine", "help", "house", "language",
    "later", "man", "meet", "more", "mother", "name", "no", "now",
    "orange", "pay", "pizza", "play", "school", "what", "which",
    "work", "yes", "all", "bad", "bed", "bird", "birthday", "black",
    "blue", "bowling", "boy", "brown", "but", "buy", "can", "car",
    "cat", "change", "christmas", "clean", "cook", "cool", "corn",
    "cow", "cry", "cut", "day", "decide", "dog", "door", "draw",
    "dream", "drop", "dry", "eat", "enjoy", "enter", "every", "excuse",
    "fall", "family", "father", "favorite", "feel", "find", "finish",
    "fire", "first", "fish", "flower", "fly", "food", "football",
    "forget", "free", "friend", "from", "full", "fun", "funny",
    "game", "give", "good", "graduate", "green", "grow", "happy",
    "hard", "have", "heavy", "hello", "high", "home", "hope",
    "how", "hungry", "hurry", "ice", "idea", "important", "in",
    "include", "interest", "it", "job", "jump", "just", "keep",
    "kind", "know", "large", "last", "laugh", "learn", "leave",
    "letter", "light", "like", "listen", "little", "live", "long",
    "look", "loud", "love", "low", "lunch", "make", "maybe",
    "money", "month", "morning", "move", "music", "need", "new",
    "nice", "night", "not", "nothing", "number", "nurse", "old",
    "once", "open", "order", "other", "outside", "over", "own",
    "pain", "paper", "party", "people", "phone", "picture", "pink",
    "place", "please", "police", "practice", "pretty", "problem",
    "purple", "put", "quiet", "rain", "read", "ready", "red",
    "remember", "restaurant", "right", "room", "run", "sad", "same",
    "say", "see", "send", "short", "sick", "sign", "sister", "sit",
    "sleep", "slow", "small", "smile", "snow", "some", "something",
    "sometimes", "sorry", "stand", "start", "stay", "store", "story",
    "study", "summer", "suppose", "surprise", "swim", "tall", "talk",
    "teach", "tell", "thank", "that", "their", "then", "there",
    "they", "think", "time", "today", "together", "tomorrow", "too",
    "town", "try", "understand", "up", "use", "very", "visit",
    "wait", "walk", "want", "warm", "watch", "water", "weather",
    "week", "well", "when", "where", "white", "why", "will",
    "with", "woman", "worry", "write", "wrong", "year", "yellow",
    "yesterday", "young", "your",
]

# Extend to 2000 entries with numbered placeholders for unmapped classes
labels = list(WLASL_2000_VOCAB)
for i in range(len(labels), 2000):
    labels.append(f"class_{i:04d}")

assert len(labels) == 2000, f"Expected 2000 labels, got {len(labels)}"

import json, os

out_path = "apps/mobile-deaf-user/src/assets/model/labels.json"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w") as f:
    json.dump(labels, f, indent=2)

print(f"Generated {len(labels)} labels -> {out_path}")
print(f"First 10: {labels[:10]}")
print(f"Last  10: {labels[-10:]}")
print()
print("WARNING: This is a PLACEHOLDER label map.")
print("The class ordering MUST match the training-time WLASL class index.")
print("Replace with the exact labels from the training pipeline.")
