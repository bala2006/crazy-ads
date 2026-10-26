# MotionForge · Crazy Ads

A private, self-hosted motion graphics studio. Turn a brief, reference images, or both into an editable video, direct changes with AI or the scene inspector, add ElevenLabs narration, and export an MP4.

**Visuals come from text-model JSON, typography, vector geometry, and Remotion. No image or video generation APIs are used.** References are understood by a vision-capable text model and translated into motion design; uploaded photographs are not pasted into the output.

## Create → edit → export

1. **Create:** provide a brief and/or up to three PNG, JPEG, or WebP references. Choose a duration, scene count, canvas, and one of eight art directions.
2. **Edit:** select scenes in the timeline. Ask AI to change one scene or the entire film; or edit copy, layout, timing, vectors, colors, transitions, and narration manually. Undo/redo, reorder, duplicate, add, and remove scenes. The preview uses the same composition as the renderer.
3. **Voice:** connect ElevenLabs and generate per-scene narration. Audio is cached, its duration is measured on the server, and scenes are extended to fit. Changed narration clears stale audio. Shortening a scene clears its clip; export also checks that narration will fit.
4. **Export:** queue an immutable snapshot for H.264 / AAC MP4. Continue editing or close the browser. Progress and downloads are stored on disk, with cancellation, failure messages, and restart recovery. Completed downloads are retained.

The responsive editor has a director panel, preview and scene timeline, and properties inspector. On phones, switch between these panels using the editor tabs. Projects autosave with revision checks; JSON import/export gives you a portable copy.

## Quick start

Requires **Node 22+**, npm, and Chrome's Linux system libraries (or Docker).

```sh
npm ci
cp .env.example .env
# Set STUDIO_PASSWORD to a unique password of at least 16 characters.
# Add provider keys now, or connect them in Settings after login.
npm run prepare:browser
npm run build
npm start
```

Open <http://localhost:3001>. For local development, use `npm run dev`. Development without a password is accessible to anyone who can reach that port; use a password when sharing a development server.

Without a text-model key, the app can make a clearly labelled **sample outline** from a text brief. Image understanding and AI edits require a configured text model. Provider failures are shown as errors and do not silently replace AI results with sample content.

## Providers

Set an **OpenAI-compatible `/chat/completions` base URL** and model/deployment name in Settings or environment variables. Hosted OpenAI, Azure OpenAI's `/openai/v1` endpoint, and compatible gateways are supported. Production requires HTTPS provider URLs. Models used with references must support `image_url` inputs. The provider must support JSON text output; explicit `response_format` incompatibility triggers one retry without that parameter. Responses API-only endpoints are not supported.

A creation or edit normally makes one text-model request. A selected-scene edit sends only that scene and project settings. The UI shows provider-reported input/output token usage when available. No agent fan-out, code execution, web browsing, or visual generation tools are attached to the model. The application executes validated storyboard, timing, safe SVG, and rendering operations.

ElevenLabs uses its text-to-speech API, independently from the text provider. Generating voice is an explicit action that consumes provider credits. Unchanged speech is cached and simultaneous identical requests are deduplicated.

Saved settings override environment variables, which override defaults. Keys remain on the server and public settings contain only a masked hint. Removing a key disables its environment fallback until the saved config override is removed.

## Deploy with Docker

```sh
cp .env.example .env
# Set STUDIO_PASSWORD and PUBLIC_ORIGIN, plus provider settings.
docker compose up --build -d
```

The image installs Linux dependencies, prepares Chrome, prebuilds both the UI and the Remotion bundle, runs as a non-root user, and has a health check. Compose binds the app to `127.0.0.1:3001` and mounts the persistent `studio-data` volume.

This deployment is a **single-owner workspace on one persistent Node process / one replica**. It is not a multi-tenant service. API keys, settings, projects, audio, and downloads are shared by people with the workspace password. Do not horizontally scale replicas against the same JSON storage or deploy this renderer to an ephemeral/serverless filesystem.

For public access:

- Put an HTTPS reverse proxy in front of port 3001. Set `PUBLIC_ORIGIN=https://your-domain.example`, with no trailing slash.
- Preserve the request Host. Set `TRUST_PROXY=1` only when one trusted proxy controls the forwarded headers; this enables Secure session cookies behind TLS termination.
- Allow request bodies up to 8 MB. Use a proxy timeout of at least 180 seconds for AI/audio requests. MP4 renders use short polling, so they do not require a long HTTP stream.
- Keep the volume persistent and back it up. Allow enough disk for 1080p outputs. Start with 2 CPU cores and 4 GB RAM; increase capacity after measuring your films. Jobs are serialized with a maximum of four active/queued snapshots.

A minimal Caddy reverse proxy:

```caddyfile
your-domain.example {
  reverse_proxy 127.0.0.1:3001
}
```

The API and media routes require a signed, HttpOnly, SameSite session. Login attempts and paid-work concurrency are limited. Browser writes are checked against the configured origin. Scene media paths are restricted to locally generated audio, and model SVG cannot contain scripts, links, foreign objects, external media, or entity escapes. Production sets a Content Security Policy and refuses to boot without a strong workspace password.

### Storage, backups, and upgrades

All runtime data lives under `DATA_DIR` (default `.data`):

| Path | Purpose |
| --- | --- |
| `config.json` | Provider settings and keys; file mode 0600 |
| `workspace.json` | Projects, revisions, profile, and matching render metadata |
| `jobs.json` | Queue snapshots, status, and output references |
| `audio/*.mp3` | Cached ElevenLabs speech |
| `renders/*.mp4` | Completed videos |

Back up the entire directory or Docker volume while the app is stopped. Treat backups as private because they contain provider keys. Restore to a directory writable by the app user, then start one replica. A corrupt store is reported instead of being overwritten with an empty workspace.

An export interrupted by a server restart is marked failed; queued jobs resume. Retry interrupted exports explicitly. Completed job history is bounded to 100 records; output files are not automatically deleted. Monitor disk space and remove unwanted files only after backing them up. An export attaches to a project only when the current storyboard still matches its snapshot; later edits are never marked as already rendered.

**Upgrade from the earlier version:** stop the app, back up `.data` and `public/audio` / `public/renders`, copy those media files into `.data/audio` and `.data/renders`, set `STUDIO_PASSWORD`, rebuild, and restart. Remote audio URLs previously imported in JSON are no longer accepted; regenerate those voiceovers. Do not delete the original backup until your projects and downloads have been checked.

## Validation

```sh
npm run typecheck
npm test                    # schemas, SVG safety, pacing, edits, auth, queue,
                            # revision conflicts, provider contracts, speech caching
npm run build               # Vite UI + prebuilt Remotion bundle
npm run prepare:browser
npm run test:e2e             # production app, desktop/tablet/mobile, editing,
                            # image input, persistence, and a REAL MP4 render/decode
npm audit --omit=dev
```

Browser tests run a password-protected production build with isolated `.data-e2e` storage. Text/speech provider calls are mocked to avoid spending credits. The MP4 render and browser decoding are real. CI runs type checks, tests, and builds on Node 22 and 24, with browser/render checks on Node 22.

Live account quotas, provider credentials, HTTPS reverse proxy configuration, and Docker host behavior must be checked in your deployment environment. No live provider keys are included in the repository.

## Implementation

- `server/model.ts`, `ai.ts`, `editor.ts`: text/vision model adapter, planning and scoped edit tool contracts.
- `src/remotion/`: shared deterministic composition, seven layouts, eight styles, and frame-based SVG motion.
- `server/tts.ts`: ElevenLabs speech, caching, concurrent deduplication, duration measurement.
- `server/jobs.ts`, `render.ts`: persistent serialized export queue, cancellation and Remotion H.264/AAC renderer.
- `server/security.ts`, `storage.ts`, `workspace.ts`: signed login, request protection, atomic storage and revision checks.
- `src/Studio.tsx`, `src/lib/autosave.ts`: responsive editor, live Player, history, manual controls and serialized saves.

Supported canvases: 16:9 at 1920×1080, 9:16 at 1080×1920, and 1:1 at 1080×1080. Videos can contain up to 24 scenes and 180 seconds. The UI and renderer use bundled fonts.

Review [Remotion's license](https://www.remotion.dev/license) for your commercial use case.
