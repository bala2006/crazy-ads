import fs from 'node:fs';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, makeCancelSignal, renderMedia, selectComposition } from '@remotion/renderer';
import type { Storyboard } from '../src/remotion/types';
import { AUDIO_DIR, PUBLIC_DIR, RENDER_DIR, ROOT, readSettings } from './config';

const ENTRY_POINT = path.join(ROOT, 'src', 'remotion', 'index.ts');

/** The webpack bundle is built once per process and reused by every render. */
let serveUrlPromise: Promise<string> | null = null;

export const getServeUrl = (): Promise<string> => {
  const prebuilt = path.join(ROOT, 'render-bundle');
  if (
    (process.env.NODE_ENV === 'production' || process.argv.includes('--prod')) &&
    fs.existsSync(path.join(prebuilt, 'index.html'))
  )
    return Promise.resolve(prebuilt);
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
const withLocalAudio = (storyboard: Storyboard): Storyboard => ({
  ...storyboard,
  scenes: storyboard.scenes.map((scene) => {
    if (!scene.audio) return scene;
    const file = path.join(AUDIO_DIR, path.basename(scene.audio));
    if (!fs.existsSync(file))
      throw new Error('A voiceover clip is missing. Generate voiceover again before exporting.');
    return { ...scene, audio: `data:audio/mpeg;base64,${fs.readFileSync(file).toString('base64')}` };
  }),
});

export const renderStoryboard = (
  storyboard: Storyboard,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<RenderResult> =>
  (async () => {
    const startedAt = Date.now();
    const settings = readSettings();
    fs.mkdirSync(RENDER_DIR, { recursive: true });

    onProgress(0.01);
    signal?.throwIfAborted();
    const browserExecutable = process.env.CHROME_PATH || undefined;
    await ensureBrowser({ browserExecutable });
    onProgress(0.04);

    for (const scene of storyboard.scenes) {
      if (!scene.audio) continue;
      const file = path.join(AUDIO_DIR, path.basename(scene.audio));
      if (!fs.existsSync(file))
        throw new Error('A voiceover clip is missing. Regenerate voiceover before exporting.');
      const { format } = await parseFile(file, { duration: true });
      if (!format.duration || Math.round(scene.seconds * storyboard.fps) / storyboard.fps < format.duration)
        throw new Error('A scene is shorter than its voiceover. Extend the scene or regenerate narration.');
    }
    const serveUrl = await getServeUrl();
    const inputProps = { storyboard: withLocalAudio(storyboard) };
    const composition = await selectComposition({
      serveUrl,
      id: 'MotionGraphic',
      inputProps,
      browserExecutable,
    });
    onProgress(0.07);

    const fileName = `${slugify(storyboard.title)}-${Date.now().toString(36)}.mp4`;
    const output = path.join(RENDER_DIR, fileName);

    signal?.throwIfAborted();
    const { cancelSignal, cancel } = makeCancelSignal();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      await renderMedia({
        browserExecutable,
        cancelSignal,
        composition,
        serveUrl,
        codec: 'h264',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        enforceAudioTrack: true,
        outputLocation: output,
        inputProps,
        crf: settings.render.crf,
        concurrency: settings.render.concurrency,
        timeoutInMilliseconds: 180_000,
        onProgress: ({ progress }) => onProgress(0.07 + progress * 0.93),
      });

      signal?.throwIfAborted();
    } catch (error) {
      fs.rmSync(output, { force: true });
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
    onProgress(1);
    return {
      url: `/renders/${fileName}`,
      fileName,
      bytes: fs.statSync(output).size,
      ms: Date.now() - startedAt,
    };
  })();
