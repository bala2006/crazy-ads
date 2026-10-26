import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { installSecurity } from '../server/security';
import { applyEdit } from '../server/editor';
import { ReferenceSchema } from '../server/images';
import { StoryboardSchema } from '../src/remotion/schema';
import { sanitizeInlineSvg } from '../src/lib/svg';
import { normalizePlan } from '../server/ai';
import { RenderQueue } from '../server/jobs';
import { readJson, writeJson } from '../server/storage';
import type { Storyboard } from '../src/remotion/types';

const board: Storyboard = {
  title: 'Test film',
  skill: 'swiss-editorial',
  aspect: '16:9',
  fps: 30,
  scenes: [
    {
      id: 'one',
      layout: 'hero',
      headline: 'Hello',
      narration: 'Hello world',
      seconds: 2,
      transition: 'fade',
      audio: 'audio/0123456789abcdef.mp3',
    },
    { id: 'two', layout: 'outro', headline: 'Start today', seconds: 2, transition: 'cut' },
  ],
};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'motionforge-tests-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('renderer rejects remote media, traversal, duplicate IDs, invalid accents and runaway duration', () => {
  for (const audio of [
    'http://169.254.169.254/latest',
    '../../secret',
    'data:audio/mp3;abc',
    'audio/../secret.mp3',
  ]) {
    assert.equal(
      StoryboardSchema.safeParse({ ...board, scenes: [{ ...board.scenes[0], audio }] }).success,
      false,
    );
  }
  assert.equal(
    StoryboardSchema.safeParse({ ...board, scenes: [board.scenes[0], board.scenes[0]] }).success,
    false,
  );
  assert.equal(
    StoryboardSchema.safeParse({ ...board, scenes: [{ ...board.scenes[0], accent: 'url(http://test)' }] })
      .success,
    false,
  );
  assert.equal(
    StoryboardSchema.safeParse({
      ...board,
      scenes: Array.from({ length: 7 }, (_, i) => ({ ...board.scenes[0], id: `s${i}`, seconds: 30 })),
    }).success,
    false,
  );
});

test('SVG tool accepts passive vectors and rejects entity escapes, unbalanced XML and network paint', () => {
  assert.ok(
    sanitizeInlineSvg('<svg viewBox="0 0 400 400"><circle cx="20" cy="20" r="10" fill="#123456"/></svg>'),
  );
  for (const svg of [
    '<svg><g></svg>',
    '<svg></svg><svg></svg>',
    '<svg><path fill="u&#114;l(https://evil.com)"/></svg>',
    '<svg><path fill="url(https://evil.com)"/></svg>',
    '<svg><image href="https://evil.com"/></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"></svg>',
  ])
    assert.equal(sanitizeInlineSvg(svg), undefined, svg);
});

test('AI edits are scoped, validated, preserve untouched scenes and invalidate changed narration audio', () => {
  const result = applyEdit(
    board,
    { summary: 'Shorter headline', scenes: [{ ...board.scenes[0], headline: 'Hi', audio: undefined }] },
    'one',
  );
  assert.equal(result.storyboard.scenes[0]?.audio, board.scenes[0]?.audio);
  assert.deepEqual(result.storyboard.scenes[1], board.scenes[1]);
  const changed = applyEdit(
    board,
    { summary: 'New narration', scenes: [{ ...board.scenes[0], narration: 'A different line' }] },
    'one',
  );
  assert.equal(changed.storyboard.scenes[0]?.audio, undefined);
  assert.throws(() => applyEdit(board, { summary: 'Wrong scene', scenes: [board.scenes[1]] }, 'one'));
  assert.throws(() =>
    applyEdit(board, { summary: 'Bad timing', scenes: [{ ...board.scenes[0], seconds: 99 }] }),
  );
});

test('image input validates content signatures and blocks SVG and oversized data', () => {
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=';
  assert.equal(ReferenceSchema.safeParse({ name: 'ref.png', dataUrl: png }).success, true);
  for (const dataUrl of [
    'data:image/png;base64,PHNjcmlwdD5ldmlsPC9zY3JpcHQ+',
    'data:image/svg+xml;base64,AAAA',
    'https://evil.com/image.png',
  ]) {
    assert.equal(ReferenceSchema.safeParse({ name: 'ref', dataUrl }).success, false);
  }
});

test('long-form pacing respects target time and per-scene bounds', () => {
  for (const targetSeconds of [15, 30, 90, 180]) {
    const result = normalizePlan(
      { scenes: Array.from({ length: 8 }, (_, i) => ({ headline: `Scene ${i}`, seconds: i ? 3 : 29 })) },
      {
        brief: 'A product story',
        skill: 'swiss-editorial',
        aspect: '9:16',
        targetSeconds,
        sceneCount: 8,
      },
    );
    assert.ok(Math.abs(result.scenes.reduce((sum, s) => sum + s.seconds, 0) - targetSeconds) < 0.1);
    assert.equal(StoryboardSchema.safeParse(result).success, true);
  }
});

test('atomic persistence refuses to overwrite corrupt existing data', () => {
  const file = path.join(temp, 'store.json');
  writeJson(file, { version: 1 });
  assert.deepEqual(readJson(file), { version: 1 });
  fs.writeFileSync(file, '{broken');
  assert.throws(() => readJson(file), /Restore/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

const waitFor = async (condition: () => boolean) => {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Queue did not settle');
};
const output = { url: '/renders/test.mp4', fileName: 'test.mp4', bytes: 100, ms: 2 };

test('durable export queue serializes work, deduplicates, cancels, persists results and recovers after restart', async () => {
  let active = 0;
  let max = 0;
  const releases: (() => void)[] = [];
  const queue = new RenderQueue(path.join(temp, 'jobs.json'), async (_board, progress, signal) => {
    active++;
    max = Math.max(max, active);
    progress(0.5);
    await new Promise<void>((resolve, reject) => {
      releases.push(resolve);
      signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    });
    active--;
    return output;
  });
  const first = queue.enqueue(board);
  assert.equal(queue.enqueue(board).id, first.id);
  const second = queue.enqueue({ ...board, title: 'Second' });
  assert.equal(queue.get(second.id)?.status, 'queued');
  queue.cancel(second.id);
  releases.shift()!();
  await waitFor(() => queue.get(first.id)?.status === 'done');
  assert.equal(max, 1);
  assert.equal(queue.get(second.id)?.status, 'cancelled');
  await queue.stop();
  const restored = new RenderQueue(path.join(temp, 'jobs.json'), async () => output);
  assert.equal(restored.get(first.id)?.result?.url, output.url);
  await restored.stop();
  const interrupted = path.join(temp, 'interrupted.json');
  writeJson(interrupted, [{ ...first, status: 'rendering', storyboard: board }]);
  const recovering = new RenderQueue(interrupted, async () => output);
  assert.equal(recovering.get(first.id)?.status, 'failed');
  assert.match(recovering.get(first.id)?.error || '', /restart/);
  await recovering.stop();
});

test('production auth protects APIs and media; cookie tampering and cross-origin writes fail', async () => {
  const previous = process.env.STUDIO_PASSWORD;
  delete process.env.STUDIO_PASSWORD;
  assert.throws(() => installSecurity(express(), true), /STUDIO_PASSWORD/);
  process.env.STUDIO_PASSWORD = 'strong-workspace-test-password';
  const app = express();
  app.use(express.json());
  installSecurity(app, true);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/settings', (_req, res) => res.json({ secret: 'protected' }));
  app.get('/audio/clip.mp3', (_req, res) => res.send('clip'));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.equal((await fetch(`${base}/api/settings`)).status, 401);
    assert.equal((await fetch(`${base}/audio/clip.mp3`)).status, 401);
    assert.equal(
      (
        await fetch(`${base}/api/session`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'https://evil.com' },
          body: JSON.stringify({ password: process.env.STUDIO_PASSWORD }),
        })
      ).status,
      403,
    );
    const login = await fetch(`${base}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: process.env.STUDIO_PASSWORD }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    assert.match(login.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(login.headers.get('set-cookie')!, /SameSite=Strict/);
    assert.equal((await fetch(`${base}/api/settings`, { headers: { cookie } })).status, 200);
    assert.equal(
      (await fetch(`${base}/api/settings`, { headers: { cookie: cookie + 'broken' } })).status,
      401,
    );
    assert.ok(login.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previous === undefined) delete process.env.STUDIO_PASSWORD;
    else process.env.STUDIO_PASSWORD = previous;
  }
});
