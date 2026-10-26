import { RenderInternals } from '@remotion/renderer';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motionforge-providers-'));
process.env.DATA_DIR = dir;
process.env.AI_API_KEY = 'private-test-model-key';
process.env.AI_BASE_URL = 'https://text.example/v1';
process.env.AI_MODEL = 'text-test-model';
process.env.ELEVENLABS_API_KEY = 'private-test-voice-key';
process.env.ELEVENLABS_VOICE_ID = 'test-voice';
const { readSettings, writeSettings, publicSettings, CONFIG_FILE } = await import('../server/config');
const { completeJson } = await import('../server/model');
const { editStoryboard } = await import('../server/editor');
const { synthesizeScenes } = await import('../server/tts');
const { saveGeneration, getWorkspace, attachRender } = await import('../server/workspace');
const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
  fs.rmSync(dir, { recursive: true, force: true });
});
const response = (content: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );

test('environment settings work, saved overrides win, cleared keys stay cleared and keys are masked', () => {
  const settings = readSettings();
  assert.equal(settings.ai.baseUrl, 'https://text.example/v1');
  assert.equal(settings.ai.model, 'text-test-model');
  assert.equal(settings.elevenlabs.voiceId, 'test-voice');
  writeSettings({ ...settings, ai: { ...settings.ai, model: 'saved-model' } });
  assert.equal(readSettings().ai.model, 'saved-model');
  assert.ok(!JSON.stringify(publicSettings()).includes('private-test-model-key'));
  writeSettings({ ...settings, ai: { ...settings.ai, apiKey: '' } });
  assert.equal(readSettings().ai.apiKey, '');
  writeSettings(settings);
  if (process.platform !== 'win32') assert.equal(fs.statSync(CONFIG_FILE).mode & 0o777, 0o600);
});

test('text model receives image references and emits JSON with provider-reported usage', async () => {
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), 'https://text.example/v1/chat/completions');
    const payload = JSON.parse(init!.body as string);
    assert.equal(payload.messages[1].content[1].type, 'image_url');
    assert.equal(payload.messages[1].content[1].image_url.url, 'data:image/png;base64,test');
    assert.ok(!('tools' in payload)); // No remote visual generation or arbitrary code tools.
    return response({ title: 'Image story', scenes: [] });
  };
  const result = await completeJson('JSON only', 'Use my reference', [
    { name: 'ref', dataUrl: 'data:image/png;base64,test' },
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(result.usage, { inputTokens: 120, outputTokens: 30, totalTokens: 150 });
});

test('provider failure is surfaced, no fake AI success; only explicit JSON-format incompatibility retries', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: 'secret upstream error' } }), { status: 401 });
  };
  await assert.rejects(completeJson('JSON', 'test'), /401/);
  assert.equal(calls, 1);
  globalThis.fetch = async (_url, init) => {
    calls++;
    const payload = JSON.parse(init!.body as string);
    if (payload.response_format)
      return new Response(JSON.stringify({ error: { param: 'response_format', message: 'unsupported' } }), {
        status: 400,
      });
    return response({ ok: true });
  };
  calls = 0;
  assert.deepEqual((await completeJson('JSON', 'test')).value, { ok: true });
  assert.equal(calls, 2);
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content: '{truncated' }, finish_reason: 'length' }] }),
    );
  await assert.rejects(completeJson('JSON', 'test'), /incomplete/);
  globalThis.fetch = originalFetch;
});

const board = {
  title: 'Project',
  skill: 'swiss-editorial' as const,
  aspect: '16:9' as const,
  fps: 30,
  scenes: [
    {
      id: 'a',
      layout: 'hero' as const,
      headline: 'Opening',
      narration: 'A line',
      seconds: 3,
      transition: 'fade' as const,
    },
    { id: 'b', layout: 'outro' as const, headline: 'Ending', seconds: 3, transition: 'fade' as const },
  ],
};

test('selected-scene editor sends only selected scene context and preserves the other scene', async () => {
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(init!.body as string);
    const prompt = payload.messages[1].content as string;
    assert.ok(prompt.includes('Opening'));
    assert.ok(!prompt.includes('Ending'));
    return response({ summary: 'Changed headline', scenes: [{ ...board.scenes[0], headline: 'Changed' }] });
  };
  const result = await editStoryboard(board, 'Change the headline', 'a');
  assert.equal(result.storyboard.scenes[0]?.headline, 'Changed');
  assert.deepEqual(result.storyboard.scenes[1], board.scenes[1]);
  globalThis.fetch = originalFetch;
});

test('project revisions reject stale writes and output linking never replaces a newer edit', () => {
  const now = new Date().toISOString();
  const first = saveGeneration({
    id: 'p1',
    title: board.title,
    storyboard: board,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(first.revision, 1);
  const second = saveGeneration({ ...first, storyboard: { ...board, title: 'New edit' } });
  assert.equal(second.revision, 2);
  assert.throws(() => saveGeneration({ ...first, title: 'Stale edit' }), /another tab/);
  const artifact = { url: '/renders/test.mp4', fileName: 'test.mp4', bytes: 200, ms: 10 };
  attachRender('p1', board, artifact);
  assert.equal(getWorkspace().generations[0]?.render, undefined);
  attachRender('p1', second.storyboard, artifact);
  assert.equal(getWorkspace().generations[0]?.render?.url, artifact.url);
});

test('ElevenLabs speech has measured duration, caching, and concurrent deduplication', async () => {
  // Real MP3 fixture made locally; no paid speech call is made by the test.
  const binary = RenderInternals.getExecutablePath({ type: 'ffmpeg', indent: false, logLevel: 'error', binariesDirectory: null });
  const mp3 = path.join(dir, 'fixture.mp3');
  execFileSync(
    binary,
    ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.6', '-c:a', 'libmp3lame', '-y', mp3],
    { stdio: 'ignore' },
  );
  const bytes = fs.readFileSync(mp3);
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.ok(String(input).includes('/text-to-speech/test-voice'));
    assert.equal(JSON.parse(init!.body as string).text, 'Hello world.');
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response(bytes, { headers: { 'content-type': 'audio/mpeg' } });
  };
  const [one, two] = await Promise.all([
    synthesizeScenes([{ id: 'one', text: 'Hello world.' }]),
    synthesizeScenes([{ id: 'two', text: 'Hello world.' }]),
  ]);
  assert.equal(calls, 1);
  assert.equal(one[0]?.audio, two[0]?.audio);
  assert.ok(one[0]!.seconds > 0.5 && one[0]!.seconds < 1);
  const cached = await synthesizeScenes([{ id: 'three', text: 'Hello world.' }]);
  assert.equal(cached[0]?.cached, true);
  assert.equal(calls, 1);
  globalThis.fetch = originalFetch;
});
