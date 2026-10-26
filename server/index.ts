import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { StoryboardSchema } from '../src/remotion/schema';
import { ASPECTS, SKILL_IDS } from '../src/remotion/types';
import { planStoryboard } from './ai';
import { PUBLIC_DIR, readSettings, ROOT, ensureDirs, publicSettings, writeSettings } from './config';
import { pruneRenders, renderStoryboard } from './render';
import { listVoices, synthesizeScenes } from './tts';
import { getWorkspace, saveGeneration, saveProfile } from './workspace';

// Optional .env support (Node's built-in loader, no dependency). Real env vars win.
try {
  process.loadEnvFile(path.join(process.cwd(), '.env'));
} catch {
  /* no .env file — fine */
}

const isProd = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT ?? 3001);

ensureDirs();
pruneRenders();

const app = express();
app.use(express.json({ limit: '8mb' }));

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const fail = (res: Response, error: unknown, status = 400) => res.status(status).json({ error: message(error) });

/* ------------------------------- settings ------------------------------- */

const SettingsUpdate = z.object({
  ai: z
    .object({
      baseUrl: z.string().url().max(300).optional(),
      model: z.string().min(1).max(120).optional(),
      apiKey: z.string().max(500).optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
  elevenlabs: z
    .object({
      apiKey: z.string().max(500).optional(),
      voiceId: z.string().min(1).max(80).optional(),
      modelId: z.string().min(1).max(80).optional(),
      stability: z.number().min(0).max(1).optional(),
      similarity: z.number().min(0).max(1).optional(),
    })
    .optional(),
  render: z
    .object({
      concurrency: z.number().int().min(1).max(16).optional(),
      crf: z.number().int().min(12).max(32).optional(),
    })
    .optional(),
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: isProd ? 'production' : 'development' });
});

app.get('/api/workspace', (_req, res) => {
  res.json(getWorkspace());
});

app.put('/api/workspace/generations', (req, res) => {
  try {
    res.json({ generation: saveGeneration(req.body) });
  } catch (error) {
    fail(res, error);
  }
});

app.put('/api/workspace/profile', (req, res) => {
  try {
    res.json({ profile: saveProfile(req.body) });
  } catch (error) {
    fail(res, error);
  }
});

app.get('/api/settings', (_req, res) => {
  res.json(publicSettings());
});

app.put('/api/settings', (req, res) => {
  const parsed = SettingsUpdate.safeParse(req.body);
  if (!parsed.success) return fail(res, parsed.error.issues[0]?.message ?? 'Invalid settings');

  const current = readSettings();
  const patch = parsed.data;
  const next = {
    ai: { ...current.ai, ...(patch.ai ?? {}) },
    elevenlabs: { ...current.elevenlabs, ...(patch.elevenlabs ?? {}) },
    render: { ...current.render, ...(patch.render ?? {}) },
  };
  // A blank key field means "keep the saved key" — clearing is explicit.
  if (!patch.ai?.apiKey) next.ai.apiKey = current.ai.apiKey;
  if (!patch.elevenlabs?.apiKey) next.elevenlabs.apiKey = current.elevenlabs.apiKey;

  writeSettings(next);
  res.json(publicSettings());
});

app.delete('/api/settings/key/:provider', (req, res) => {
  const provider = req.params.provider;
  if (provider !== 'ai' && provider !== 'elevenlabs') return fail(res, 'Unknown provider');
  const current = readSettings();
  const next = { ...current, [provider]: { ...current[provider], apiKey: '' } };
  writeSettings(next);
  res.json(publicSettings());
});

/* -------------------------------- voices -------------------------------- */

app.get('/api/voices', async (_req, res) => {
  try {
    res.json(await listVoices());
  } catch (error) {
    fail(res, error, 502);
  }
});

/* --------------------------------- plan --------------------------------- */

const PlanBody = z.object({
  brief: z.string().min(3).max(4000),
  skill: z.enum(SKILL_IDS),
  aspect: z.enum(ASPECTS),
  targetSeconds: z.number().min(5).max(180),
  sceneCount: z.number().int().min(2).max(12),
});

app.post('/api/plan', async (req, res) => {
  const parsed = PlanBody.safeParse(req.body);
  if (!parsed.success) return fail(res, parsed.error.issues[0]?.message ?? 'Invalid brief');
  try {
    const result = await planStoryboard(parsed.data);
    res.json(result);
  } catch (error) {
    fail(res, error, 502);
  }
});

/* -------------------------------- voice --------------------------------- */

const VoiceBody = z.object({
  voiceId: z.string().max(80).optional(),
  scenes: z.array(z.object({ id: z.string().min(1), text: z.string().max(2000) })).min(1).max(24),
});

app.post('/api/voice', async (req, res) => {
  const parsed = VoiceBody.safeParse(req.body);
  if (!parsed.success) return fail(res, parsed.error.issues[0]?.message ?? 'Invalid voice request');
  try {
    const clips = await synthesizeScenes(parsed.data.scenes, parsed.data.voiceId);
    res.json({ clips });
  } catch (error) {
    fail(res, error, 502);
  }
});

/* -------------------------------- render -------------------------------- */

app.post('/api/render', async (req, res) => {
  const parsed = StoryboardSchema.safeParse((req.body as { storyboard?: unknown })?.storyboard ?? req.body);
  if (!parsed.success) return fail(res, parsed.error.issues[0]?.message ?? 'Invalid storyboard');

  res.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-accel-buffering', 'no');
  res.flushHeaders?.();

  const send = (payload: Record<string, unknown>) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(payload)}\n`);
  };

  try {
    const result = await renderStoryboard(parsed.data, `http://127.0.0.1:${PORT}`, (progress) =>
      send({ type: 'progress', progress }),
    );
    send({ type: 'done', ...result });
  } catch (error) {
    send({ type: 'error', message: message(error) });
  } finally {
    res.end();
  }
});

app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ error: `Unknown endpoint ${req.method} ${req.originalUrl}` });
});

/* ------------------------------ media + spa ----------------------------- */

app.use('/audio', express.static(path.join(PUBLIC_DIR, 'audio'), { maxAge: '7d', immutable: true }));
app.use('/renders', express.static(path.join(PUBLIC_DIR, 'renders'), { maxAge: '1h' }));

const start = async () => {
  if (isProd) {
    const dist = path.join(ROOT, 'dist');
    if (!fs.existsSync(dist)) {
      console.error('✖ dist/ is missing — run `npm run build` first, or use `npm run dev`.');
      process.exit(1);
    }
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    // The http server is created first so Vite can attach HMR to it — one port,
    // and the websocket survives reverse proxies.
    const server = http.createServer(app);
    const vite = await createServer({
      server: { middlewareMode: true, ws: { server } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use((_req, res) => res.status(404).send('Not found'));
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  MotionForge · development`);
      console.log(`  → http://localhost:${PORT}\n`);
    });
    return;
  }

  app.use((_req, res) => {
    res.status(404).send('Not found');
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  MotionForge · ${isProd ? 'production' : 'development'}`);
    console.log(`  → http://localhost:${PORT}\n`);
  });
};

start().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
