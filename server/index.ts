import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { StoryboardSchema } from '../src/remotion/schema';
import { ASPECTS, SKILL_IDS } from '../src/remotion/types';
import { planStoryboard } from './ai';
import {
  AUDIO_DIR,
  RENDER_DIR,
  readSettings,
  ROOT,
  ensureDirs,
  publicSettings,
  writeSettings,
} from './config';
import { RenderQueue } from './jobs';
import { installSecurity, workLimiter } from './security';
import { ReferenceSchema } from './images';
import { editStoryboard } from './editor';
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
const renderQueue = new RenderQueue();

const app = express();
app.use(express.json({ limit: '8mb' }));
installSecurity(app, isProd);
const limitWork = workLimiter();
app.use(['/api/plan', '/api/edit', '/api/voice'], limitWork);

const message = (error: unknown) =>
  error instanceof z.ZodError
    ? error.issues[0]?.message || 'Invalid input.'
    : error instanceof Error
      ? error.message
      : String(error);
const fail = (res: Response, error: unknown, status = 400) =>
  res.status((error as { status?: number })?.status ?? status).json({ error: message(error) });

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

const PlanBody = z
  .object({
    brief: z.string().max(4000).default(''),
    references: z.array(ReferenceSchema).max(3).optional(),
    skill: z.enum(SKILL_IDS),
    aspect: z.enum(ASPECTS),
    targetSeconds: z.number().min(5).max(180),
    sceneCount: z.number().int().min(2).max(12),
  })
  .refine(
    (body) => body.brief.trim().length >= 3 || !!body.references?.length,
    'Add a brief or a reference image.',
  )
  .refine(
    (body) => body.targetSeconds <= body.sceneCount * 30,
    'Add more scenes for this duration (30 seconds maximum per scene).',
  );

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
  scenes: z
    .array(z.object({ id: z.string().min(1).max(100), text: z.string().max(600) }))
    .min(1)
    .max(24),
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

/* ------------------------------- AI editor ------------------------------ */
app.post('/api/edit', async (req, res) => {
  const parsed = z
    .object({
      storyboard: StoryboardSchema,
      instruction: z.string().trim().min(3).max(2000),
      sceneId: z.string().max(100).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return fail(res, parsed.error.issues[0]?.message ?? 'Invalid edit.');
  try {
    res.json(await editStoryboard(parsed.data.storyboard, parsed.data.instruction, parsed.data.sceneId));
  } catch (error) {
    fail(res, error, 502);
  }
});

/* ----------------------------- durable exports -------------------------- */
app.get('/api/jobs', (_req, res) => res.json({ jobs: renderQueue.list() }));
app.post('/api/jobs', (req, res) => {
  const parsed = z
    .object({ storyboard: StoryboardSchema, projectId: z.string().min(1).max(100).optional() })
    .safeParse(req.body);
  if (!parsed.success) return fail(res, parsed.error.issues[0]?.message ?? 'Invalid export.');
  try {
    res.status(202).json({ job: renderQueue.enqueue(parsed.data.storyboard, parsed.data.projectId) });
  } catch (error) {
    fail(res, error);
  }
});
app.get('/api/jobs/:id', (req, res) => {
  const job = renderQueue.get(req.params.id);
  if (!job) return fail(res, 'Export not found.', 404);
  res.json({ job });
});
app.delete('/api/jobs/:id', (req, res) => {
  const job = renderQueue.cancel(req.params.id);
  if (!job) return fail(res, 'Export not found.', 404);
  res.json({ job });
});

app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ error: `Unknown endpoint ${req.method} ${req.originalUrl}` });
});

/* ------------------------------ media + spa ----------------------------- */

app.use('/audio', express.static(AUDIO_DIR, { cacheControl: false }));
app.use(
  '/renders',
  express.static(RENDER_DIR, {
    cacheControl: false,
    setHeaders: (res) => res.setHeader('Content-Disposition', 'attachment'),
  }),
);
app.use(['/audio', '/renders'], (_req, res) => res.status(404).json({ error: 'Media file not found.' }));

app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  if (res.headersSent) return res.end();
  const status = (error as { status?: number }).status || 500;
  res
    .status(status)
    .json({
      error:
        status === 413
          ? 'Request is too large. Use up to three compressed reference images.'
          : status === 400
            ? 'Invalid JSON request.'
            : 'The server could not complete this request.',
    });
});

const serve = (server: http.Server) => {
  server.requestTimeout = 180_000;
  server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    renderQueue.start();
    console.log(`MotionForge · ${isProd ? 'production' : 'development'} · http://localhost:${PORT}`);
  });
  const shutdown = () => {
    server.close();
    void renderQueue.stop().finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 25_000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
};
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
    serve(server);
    return;
  }

  app.use((_req, res) => {
    res.status(404).send('Not found');
  });

  serve(http.createServer(app));
};

start().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
