# Signova

Real-time American Sign Language (ASL) to text/speech translation for service environments — enabling Deaf and hard-of-hearing individuals to communicate directly with hearing staff at institutional service points (banks, hospitals, government offices) without a human interpreter.

Developed as a final-year Computer Science research project at Strathmore University (ICS 4102 — Machine Learning), supervised by Ms. Salome Chemiat.

## Problem

Deaf and hard-of-hearing individuals in Kenya and similar contexts routinely face communication barriers at service counters, where a hearing staff member has no way to understand sign language and no interpreter is available on demand. Signova removes that dependency by translating a Deaf user's signed input into text and speech that hearing staff can immediately understand — in real time, at the point of service.

## How it works

1. A Deaf user signs into a tablet/mobile camera at the service point.
2. MediaPipe extracts hand-landmark sequences from the video in real time.
3. A trained BiLSTM classifier recognizes the signed word (gloss) from the landmark sequence.
4. The Deaf user validates the recognized sign (accept or retry) before it's sent.
5. Hearing staff sees the translated text and hears it spoken aloud.

Target inference latency: **under 500ms**, so the interaction feels conversational rather than like a slow lookup tool.

## System architecture

Signova is a **white-label system** with three distinct interfaces, not a single app — each institution can deploy and brand its own instance:

| Interface | Who uses it | Purpose |
|---|---|---|
| Mobile app (Deaf user) | Deaf/hard-of-hearing service user | Sign input, live translation, validate/retry |
| Web dashboard (Hearing staff) | Counter/front-desk staff | View translated text, hear spoken output, send text responses |
| Web admin portal (Administrator) | Institution IT/ops staff | Configure and manage the organisation's Signova deployment |

## Tech stack

| Layer | Technology |
|---|---|
| Mobile app | React Native |
| Web apps (staff + admin) | React |
| Backend / API | Node.js |
| Database | MongoDB Atlas |
| Sign recognition model | TensorFlow / TensorFlow Lite, BiLSTM |
| Landmark extraction | MediaPipe |

## Project structure

```
Signova/
├── .github/
│   └── workflows/              # CI/CD pipelines
├── apps/
│   ├── mobile-deaf-user/
│   │   └── src/                # React Native app — Deaf user interface
│   ├── web-admin-portal/
│   │   └── src/                # React app — organisation admin interface
│   └── web-hearing-staff/
│       └── src/                # React app — hearing staff dashboard
├── docs/
│   ├── design/                 # Figma specs, design system, wireframes
│   ├── proposal/                # Research proposal chapters
│   └── use-case-diagrams/       # UML use-case diagrams and documentation
├── server/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       └── routes/
├── shared/
│   ├── constants/               # Shared constants across apps
│   └── types/                   # Shared TypeScript types/interfaces
└── signova_ml/                  # Machine learning pipeline (see below)
    └── scripts/
```

### Machine learning pipeline (`signova_ml/scripts/`)

The sign recognition model is trained through a staged pipeline, each stage a separate script:

| Script | Purpose |
|---|---|
| `prepare_data.py` | Builds the video manifest and label map from WLASL metadata |
| `extract_landmarks.py` | Runs MediaPipe over each video, saves fixed-length hand-landmark sequences |
| `filter_manifest.py` | Cross-checks the manifest against successfully extracted landmark files |
| `dataset.py` | Loads landmark sequences into train/val/test splits (stratified by class) |
| `model.py` | Defines the BiLSTM architecture |
| `train.py` | Trains the model and evaluates on the held-out test split |
| `evaluate.py` | Post-training evaluation and diagnostics |
| `convert_to_tflite.py` | Converts the trained model to TensorFlow Lite for on-device deployment |

**Current status:** baseline BiLSTM trained on a WLASL100 subset (100 signs) — 35.9% test accuracy, 67.3% top-5 accuracy. Planned improvements: both-hands + pose landmarks, data augmentation, and an attention layer over the BiLSTM output.

## Development

Machine learning work is developed on a dedicated branch (`feature/bilstm-model`) before merging into `main`, run via Google Colab against scripts stored in Google Drive.

## Course context

Signova is developed both as a personal project and as a research deliverable.