import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import type { Storyboard } from '../src/remotion/types';
import { PUBLIC_DIR, RENDER_DIR, ROOT, readSettings } from './config';

const ENTRY_POINT = path.join(ROOT, 'src', 'remotion', 'index.ts');

/** The webpack bundle is built once per process and reused by every render. */
let serveUrlPromise: Promise<string> | null = null;

export const getServeUrl = (): Promise<string> => {
  if (!serveUrlPromise) {
    serveUrlPromise = bundle({
      entryPoint: ENTRY_POINT,
      publicDir: PUBLIC_DIR,
      onProgress: () => undefined,
    }).catch((error: unknown) => {
      serveUrlPromise = null;
      throw error;
    });
  }
  return serveUrlPromise;
};

/** Renders are heavy; keep them strictly serial so a queued job can't starve the machine. */
let queue: Promise<unknown> = Promise.resolve();
const withLock = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};

const slugify = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'video';

export type RenderResult = { url: string; fileName: string; bytes: number; ms: number };

/**
 * Voiceover files live in `public/audio`. In the browser `staticFile()` handles
 * that, but a render happens long after the webpack bundle was built, so we hand
 * Chromium absolute URLs served by this same process instead.
 */
const withMediaBase = (storyboard: Storyboard, mediaBase: string): Storyboard => ({
  ...storyboard,
  scenes: storyboard.scenes.map((scene) =>
    scene.audio && !/^https?:\/\//.test(scene.audio)
      ? { ...scene, audio: `${mediaBase.replace(/\/+$/, '')}/${scene.audio.replace(/^\/+/, '')}` }
      : scene,
  ),
});

export const renderStoryboard = (
  storyboard: Storyboard,
  mediaBase: string,
  onProgress: (progress: number) => void,
): Promise<RenderResult> =>
  withLock(async () => {
    const startedAt = Date.now();
    const settings = readSettings();
    fs.mkdirSync(RENDER_DIR, { recursive: true });

    onProgress(0.01);
    await ensureBrowser();
    onProgress(0.04);

    const serveUrl = await getServeUrl();
    const inputProps = { storyboard: withMediaBase(storyboard, mediaBase) };
    const composition = await selectComposition({ serveUrl, id: 'MotionGraphic', inputProps });
    onProgress(0.07);

    const fileName = `${slugify(storyboard.title)}-${Date.now().toString(36)}.mp4`;
    const output = path.join(RENDER_DIR, fileName);

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: output,
      inputProps,
      crf: settings.render.crf,
      concurrency: settings.render.concurrency,
      timeoutInMilliseconds: 180_000,
      onProgress: ({ progress }) => onProgress(0.07 + progress * 0.93),
    });

    onProgress(1);
    return {
      url: `/renders/${fileName}`,
      fileName,
      bytes: fs.statSync(output).size,
      ms: Date.now() - startedAt,
    };
  });

/** Keep the media folder from growing forever on long-lived self-hosted installs. */
export const pruneRenders = (maxAgeMs = 1000 * 60 * 60 * 24) => {
  try {
    if (!fs.existsSync(RENDER_DIR)) return;
    const now = Date.now();
    for (const file of fs.readdirSync(RENDER_DIR)) {
      const full = path.join(RENDER_DIR, file);
      if (now - fs.statSync(full).mtimeMs > maxAgeMs) fs.rmSync(full, { force: true });
    }
  } catch {
    /* cleanup is best-effort */
  }
};
