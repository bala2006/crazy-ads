# MotionForge

[![CI](https://github.com/bala2006/crazy-ads/actions/workflows/ci.yml/badge.svg)](https://github.com/bala2006/crazy-ads/actions/workflows/ci.yml)

A self-hosted motion-graphics studio. Describe a video, pick a **skill** (an art direction
with its own palette, typography and motion grammar), let an AI write the script, generate
voiceover with ElevenLabs, preview it live, and render an MP4 on your own machine with
Remotion.

Everything runs from one Node process: the API, the studio UI, the renderer and the media
files. No accounts, no cloud rendering, no telemetry.

```
brief ──► AI storyboard ──► skill theme ──► ElevenLabs voice ──► Remotion ──► MP4
```

## Features

- **8 skills** — Swiss Editorial, Neon Cyber, Paper Craft, Glass Aurora, Retro Future,
  Mono Luxe, Data Dash, Bold Pop. One click re-themes every scene; the skill also steers the
  AI's copy tone.
- **7 scene layouts** — hero, kinetic statement, list, big number (with count-up), quote,
  split with an animated orb, outro with CTA.
- **AI storyboarding** — any OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, Ollama,
  LM Studio…). Without a key you still get a usable offline draft.
- **Voiceover** — one ElevenLabs clip per scene; scenes are automatically retimed to the
  length of their speech.
- **Live preview** — the real Remotion composition in the browser via `@remotion/player`.
- **Real renders** — `@remotion/renderer` + a bundled headless Chrome, H.264 + AAC MP4 with
  streaming progress over NDJSON.
- **Local fonts, offline renders** — fonts come from npm packages, never a CDN.
- **Settings UI** — keys are stored server-side (`.data/config.json`, mode 600) and only
  ever leave the server as a `••••1234` hint.

## Quickstart

```bash
npm install
npm run dev          # http://localhost:3001
```

Open the studio, click a skill, press **Load example** to see a finished storyboard in the
player, then hit **Render MP4**.

To use the AI and voice features, open **Settings** and paste:

| Field | Where to get it |
| --- | --- |
| AI base URL + model | `https://api.openai.com/v1` + `gpt-4o-mini`, or any compatible server |
| AI API key | Your provider's dashboard |
| ElevenLabs API key | <https://elevenlabs.io> → Profile → API keys |
| Voice | Press **Fetch** to list the voices on your account, or paste a voice ID |

Nothing else needs configuring. The first render downloads Chrome Headless Shell (~100 MB)
and warms a webpack bundle; after that renders start immediately.

### Environment variables

The settings screen is optional — env vars work too (saved settings win):

```bash
AI_API_KEY=sk-...            # or OPENAI_API_KEY
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
PORT=3001
```

### Production

```bash
npm run build
npm start            # serves dist/ + the API on :3001
```

Put it behind any reverse proxy; the app needs no special headers. Renders are serialised
so two jobs never fight for the CPU. Files older than 24 hours are pruned from
`public/renders` on boot.

## Checks

```bash
npm test            # unit tests: schema, skills, planner normalisation, frame maths
npm run typecheck   # strict TypeScript across app, server and tests
npm run build       # production bundle
npm run check:bundle # builds the Remotion composition with webpack (no browser needed)
npm run ci          # everything the GitHub Actions pipeline runs
```

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on Node 20 and 22: install with
`npm ci`, typecheck, tests, build, the Remotion bundle smoke test, then boots the
production server and hits `/api/health`, `/api/settings` and `/api/plan`.

### Docker

```bash
docker build -t motionforge .
docker run -p 3001:3001 -v "$PWD/.data:/app/.data" -v "$PWD/public/renders:/app/public/renders" motionforge
```

The image installs the system libraries Chrome needs; on a bare Linux host see below.

### Linux prerequisites

Remotion drives a real Chrome, which needs NSS and friends. On Debian/Ubuntu:

```bash
sudo apt-get update && sudo apt-get install -y \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2 libatspi2.0-0
```

If Chrome fails with `error while loading shared libraries: libnspr4.so`, those packages are
missing. macOS and Windows need nothing extra.

## How it is built

```
server/                 Express: API routes, Vite middleware, static media
  index.ts              routes: /api/plan, /api/voice, /api/render, /api/settings
  config.ts             settings store with env fallback, masked public shape
  ai.ts                 OpenAI-compatible planner + offline fallback + normaliser
  tts.ts                ElevenLabs synth, content-hashed clip cache
  render.ts             bundle caching, serialised renders, progress, pruning
src/
  remotion/             the video engine (pure React, no server imports)
    skills.ts           the 8 skill packs: palette, type, motion, background
    layouts.tsx         the 7 layouts and their motion
    Backdrop.tsx        animated per-skill backgrounds, grain, vignette
    Video.tsx           scene sequencing, audio, footer chrome, exit transitions
    Root.tsx            the single `MotionGraphic` composition (dynamic metadata)
    fonts.ts            locally bundled fonts + delayRender handle
  Studio.tsx            brief, skill picker, player, voice, render
  SceneList.tsx         inline storyboard editing
  SettingsPage.tsx      API keys and render defaults
  lib/                  typed API client + storyboard helpers
```

The composition is **data-only**: the server passes a validated `Storyboard` JSON into
`inputProps`, so the renderer never generates code and never needs a rebuild when the
script changes. Adding a style is one object in `skills.ts`; adding a layout is one
component in `layouts.tsx` plus its id in `types.ts`/`schema.ts`.

### API

| Route | Purpose |
| --- | --- |
| `POST /api/plan` | brief → storyboard (`{ brief, skill, aspect, targetSeconds, sceneCount }`) |
| `POST /api/voice` | `{ scenes: [{ id, text }], voiceId }` → `{ clips: [{ id, audio }] }` |
| `POST /api/render` | `{ storyboard }` → NDJSON progress events, then `{ url }` |
| `GET/PUT /api/settings` | public settings / partial update (blank key = keep existing) |
| `DELETE /api/settings/key/:provider` | remove a saved key |
| `GET /api/voices` | the voices on your ElevenLabs account |

## Notes

- **Aspect ratios**: 16:9 (1920×1080), 9:16 (1080×1920), 1:1 (1080×1080), all at 30 fps.
- **Voiceover cost**: ElevenLabs bills per character. Generating voiceover is a separate
  button from generating the script, so nothing is spent without asking.
- **Editing narration** clears that scene's audio so stale speech can't ship by accident.
- **Storage**: `.data/config.json`, `public/audio/*.mp3` (content-hashed, reusable),
  `public/renders/*.mp4`. All ignored by git.
- Remotion requires a company licence for commercial use above a certain size — see
  <https://remotion.dev/license>.
