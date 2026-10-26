import { RenderInternals } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';
import type { Storyboard } from '../src/remotion/types';

const login = async (page: Page) => {
  await page.goto('/#/create');
  await page.getByLabel('Workspace password').fill('e2e-private-workspace-password');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.getByLabel('Project title')).toBeVisible();
};
const sample: Storyboard = {
  title: 'Motion quality check',
  aspect: '16:9',
  skill: 'swiss-editorial',
  fps: 30,
  scenes: [
    {
      id: 'render-scene',
      layout: 'split',
      headline: 'Ideas in motion',
      sub: 'Made with text, vectors, and Remotion.',
      seconds: 2,
      transition: 'fade',
      visualSvg:
        '<svg viewBox="0 0 400 400"><circle cx="200" cy="200" r="130" fill="#468c62"/><path d="M150 250L250 150M150 150H250V250" stroke="#ffffff" stroke-width="14" fill="none"/></svg>',
      visualMotion: 'float',
    },
  ],
};

test('deployed API requires authentication and rejects untrusted writes and media', async ({ request }) => {
  expect((await request.get('/api/settings')).status()).toBe(401);
  expect((await request.get('/renders/private.mp4')).status()).toBe(401);
  expect(
    (
      await request.post('/api/session', {
        headers: { origin: 'https://evil.example' },
        data: { password: 'e2e-private-workspace-password' },
      })
    ).status(),
  ).toBe(403);
  await request.post('/api/session', { data: { password: 'e2e-private-workspace-password' } });
  const response = await request.post('/api/jobs', {
    data: {
      storyboard: { ...sample, scenes: [{ ...sample.scenes[0], audio: 'http://169.254.169.254/secret' }] },
    },
  });
  expect(response.status()).toBe(400);
});

test('manual editing, history, timeline, project save, and refresh work in the production build', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await page.getByRole('button', { name: 'Edit this example' }).click();
  const headline = page.getByLabel('Scene headline');
  await headline.fill('A clearer idea');
  await expect(headline).toHaveValue('A clearer idea');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(headline).not.toHaveValue('A clearer idea');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(headline).toHaveValue('A clearer idea');
  await page.getByRole('button', { name: 'Duplicate scene' }).click();
  await expect(page.getByRole('button', { name: /^Select scene/ })).toHaveCount(7);
  await page.getByRole('button', { name: 'Delete scene' }).click();
  await expect(page.getByRole('button', { name: /^Select scene/ })).toHaveCount(6);
  await page.getByRole('button', { name: /^Select scene 1:/ }).click();
  await headline.fill('A clearer idea');
  await page.getByLabel('Project title').fill('Browser verified film');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      (await (await page.request.get('/api/workspace')).json()).generations.some(
        (item: { title: string }) => item.title === 'Browser verified film',
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel('Project title')).toHaveValue('Browser verified film');
  await expect(page.getByLabel('Scene headline')).toHaveValue('A clearer idea');
  await page.getByRole('button', { name: /^Select scene 4:/ }).click();
  await expect(page.getByLabel('Scene layout')).toHaveValue('stat');
  await page.setViewportSize({ width: 1720, height: 1100 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/editor-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test('AI editing sends selected scene scope and supports undo of the response', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Edit this example' }).click();
  // Provider spend is mocked; the live endpoint contract is covered in model unit tests.
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      json: {
        ai: { hasKey: true, model: 'test-text-model' },
        elevenlabs: { hasKey: false, voiceId: 'test' },
        render: { concurrency: 1, crf: 23 },
        runtime: { node: 'test' },
      },
    }),
  );
  await page.reload();
  await page.route('**/api/edit', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.sceneId).toBe('demo-1');
    const storyboard = {
      ...body.storyboard,
      scenes: body.storyboard.scenes.map((scene: { id: string }) =>
        scene.id === body.sceneId ? { ...scene, headline: 'Your next big idea' } : scene,
      ),
    };
    await route.fulfill({
      json: {
        storyboard,
        summary: 'Updated the selected headline.',
        usage: { inputTokens: 420, outputTokens: 80, totalTokens: 500 },
      },
    });
  });
  await page.getByLabel('AI edit instruction').fill('Make the opening headline punchier');
  await page.getByRole('button', { name: 'Apply AI edit' }).click();
  await expect(page.getByLabel('Scene headline')).toHaveValue('Your next big idea');
  await expect(page.getByText('Updated the selected headline.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Scene headline')).not.toHaveValue('Your next big idea');
});

test('image-only creation compresses references and produces an editable storyboard', async ({ page }) => {
  await login(page);
  let seen = false;
  await page.route('**/api/plan', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.brief).toBe('');
    expect(body.references).toHaveLength(1);
    expect(body.references[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    seen = true;
    await route.fulfill({ json: { storyboard: sample, source: 'ai' } });
  });
  await page
    .getByLabel('Reference images')
    .setInputFiles({
      name: 'reference.png',
      mimeType: 'image/png',
      buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 40, height: 40 } }),
    });
  await expect(page.getByAltText('reference.png')).toBeVisible();
  await page.getByRole('button', { name: 'Create sample outline' }).click();
  await expect(page.getByLabel('Scene headline')).toHaveValue('Ideas in motion');
  expect(seen).toBe(true);
});

test('mobile editor is usable without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('tab', { name: 'Preview & timeline' }).click();
  await page.getByRole('button', { name: 'Edit this example' }).click();
  await page.getByRole('tab', { name: 'Properties', exact: true }).click();
  await page.getByLabel('Scene headline').fill('Mobile first');
  await expect(page.getByLabel('Scene headline')).toHaveValue('Mobile first');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/editor-mobile.png', fullPage: true });
});

test('real Remotion render produces a playable MP4 with video and audio tracks', async ({
  request,
  page,
}) => {
  test.setTimeout(180_000);
  await request.post('/api/session', { data: { password: 'e2e-private-workspace-password' } });
  const audioDir = path.resolve('.data-e2e/audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const audioName = 'abcdef0123456789.mp3';
  const ffmpeg = RenderInternals.getExecutablePath({ type: 'ffmpeg', indent: false, logLevel: 'error', binariesDirectory: null });
  execFileSync(
    ffmpeg,
    [
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=0.6',
      '-c:a',
      'libmp3lame',
      '-y',
      path.join(audioDir, audioName),
    ],
    { stdio: 'ignore' },
  );
  const withAudio = {
    ...sample,
    scenes: sample.scenes.map((scene) => ({ ...scene, audio: `audio/${audioName}` })),
  };
  const start = await request.post('/api/jobs', { data: { storyboard: withAudio } });
  expect(start.status()).toBe(202);
  const { job } = await start.json();
  let result: { status: string; error?: string; result?: { url: string } } = { status: 'queued' };
  await expect
    .poll(
      async () => {
        result = (await (await request.get(`/api/jobs/${job.id}`)).json()).job;
        if (result.status === 'failed') throw new Error(result.error);
        return result.status;
      },
      { timeout: 150_000, intervals: [1000] },
    )
    .toBe('done');
  const download = await request.get(result.result!.url);
  const bytes = await download.body();
  expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
  expect(bytes.length).toBeGreaterThan(5000);
  expect(bytes.includes(Buffer.from('vide'))).toBe(true);
  expect(bytes.includes(Buffer.from('soun'))).toBe(true);
  expect(download.headers()['cache-control']).toBe('no-store');
  const volume = spawnSync(ffmpeg, ['-i', 'pipe:0', '-vn', '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1'], {
    input: bytes,
  });
  expect(volume.status).toBe(0);
  // Decode real PCM and confirm the test tone survived the export, rather than
  // merely checking that a silent audio track exists.
  let peak = 0;
  for (let offset = 256; offset + 1 < volume.stdout.length; offset += 2) peak = Math.max(peak, Math.abs(volume.stdout.readInt16LE(offset)));
  expect(peak).toBeGreaterThan(500);
  const tooShort = await request.post('/api/jobs', {
    data: {
      storyboard: { ...withAudio, scenes: [{ ...withAudio.scenes[0], audio: 'audio/0000000000000000.mp3' }] },
    },
  });
  const missingId = (await tooShort.json()).job.id;
  await expect
    .poll(async () => (await (await request.get(`/api/jobs/${missingId}`)).json()).job.status, {
      timeout: 20_000,
    })
    .toBe('failed');
  // Decode the actual exported file in Chromium, not just the composition preview.
  await login(page);
  await page.evaluate(async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(blob);
    video.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('MP4 decode failed'));
    });
    if (video.videoWidth !== 1920 || video.videoHeight !== 1080 || Math.abs(video.duration - 2) > 0.2)
      throw new Error('Unexpected MP4 metadata');
    URL.revokeObjectURL(objectUrl);
  }, result.result!.url);
});
