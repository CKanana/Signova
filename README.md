# Signova

Real-time American Sign Language (ASL) to text/speech translation for service environments enabling Deaf and hard-of-hearing individuals to communicate directly with hearing staff at institutional service points (banks, hospitals, government offices) without a human interpreter.

Developed as a final-year Computer Science research project at Strathmore University.
## Problem

Deaf and hard-of-hearing individuals in Kenya and similar contexts routinely face communication barriers at service counters, where a hearing staff member has no way to understand sign language and no interpreter is available on demand. Signova removes that dependency by translating a Deaf user's signed input into text and speech that hearing staff can immediately understand in real time, at the point of service.

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

## Development setup

The app workspace uses Expo with React Native for the Deaf-user mobile app and React with Vite for the staff and admin web apps. Use Node.js 22.12 or later and npm 10 or later.

```powershell
npm install
npm run dev:mobile
npm run dev:staff
npm run dev:admin
```

`npm run dev` starts only the Deaf-user mobile app. The staff and admin web apps are paused for feature work; when needed, start either with `npm run dev:staff` or `npm run dev:admin`, or start all three with `npm run dev:all`. Vite serves the staff app at `http://localhost:5173` and the admin portal at `http://localhost:5174`. Expo prints a QR code for opening the mobile app in Expo Go or a simulator.

Shared design tokens are in `shared/constants/theme.ts`; web apps apply those tokens as CSS variables and the mobile app consumes them directly. Start with the defined Royal Purple, Cornsilk, neutral, and status colours rather than introducing app-specific variants.

### App entry points and assets

The native app uses `apps/mobile-deaf-user/App.tsx` as its Expo entry point; it does not need an `index.html`. Keep mobile-only images, icons, and fonts in `apps/mobile-deaf-user/src/assets/`.

Each web app has its own `index.html` at the app root. That file loads `src/main.tsx`, which mounts `src/App.tsx`; `.tsx` is used instead of `.jsx` so the UI can be type-checked. Keep web-only assets beside the web app that owns them. Put brand assets genuinely reused by multiple apps in `shared/assets/` and import those shared source files from each app. Never import web assets from the mobile app's `src/assets/` folder.

## Project structure

```
Signova/
├── .github/
│   └── workflows/                   # CI/CD pipelines
├── apps/
│   ├── mobile-deaf-user/
│   │   ├── package.json
│   │   └── src/
│   │       ├── assets/
│   │       ├── components/
│   │       ├── navigation/
│   │       ├── screens/
│   │       └── services/
│   ├── web-admin-portal/
│   │   ├── package.json
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       └── services/
│   └── web-hearing-staff/
│       ├── package.json
│       └── src/
│           ├── components/
│           ├── pages/
│           └── services/
├── docs/
│   ├── design/                       # Figma specs, design system, wireframes
│   ├── proposal/                     # Research proposal chapters
│   └── use-case-diagrams/            # UML use-case diagrams and documentation
├── ml/                                # Machine learning pipeline — see ml/README.md
│   ├── convert_to_tflite.py
│   ├── dataset.py
│   ├── evaluate.py
│   ├── extract_landmarks.py
│   ├── filter_manifest.py
│   ├── model.py
│   ├── prepare_data.py
│   ├── README.md
│   └── train.py
├── server/
│   ├── .env
│   ├── package.json
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       └── routes/
└── shared/
    ├── constants/                     # Shared constants across apps
    └── types/                         # Shared TypeScript types/interfaces
```

### Machine learning pipeline (`ml/`)

The sign recognition model is trained through a staged pipeline, each stage a separate script — see `ml/README.md` for full setup and run instructions.

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

**Development environment:** the `ml/` scripts are edited locally (synced via Google Drive) and trained on Google Colab, which mounts the same Drive folder to access both the code and the GPU runtime. Training work is developed on a dedicated branch (`feature/bilstm-model`) before merging into `main`.

## Course context

Signova is developed both as a personal project and as a research deliverable.