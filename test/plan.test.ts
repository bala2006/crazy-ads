import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePlan } from '../server/ai';
import { StoryboardSchema } from '../src/remotion/schema';
import { MAX_SCENE_SECONDS, MIN_SCENE_SECONDS, type Storyboard } from '../src/remotion/types';

const request = {
  brief: 'A launch film for a self-hosted motion graphics studio.',
  skill: 'bold-pop' as const,
  aspect: '9:16' as const,
  targetSeconds: 30,
  sceneCount: 6,
};

const total = (storyboard: Storyboard) => storyboard.scenes.reduce((sum, scene) => sum + scene.seconds, 0);

test('layout aliases from a model become real layouts', () => {
  const storyboard = normalizePlan(
    {
      title: 'Alias check',
      scenes: [
        { layout: 'title', headline: 'Open' },
        { layout: 'list', headline: 'Steps', items: ['one', 'two'] },
        { layout: 'number', headline: 'Metric', value: '98%' },
        { layout: 'testimonial', headline: 'Great tool', sub: 'A customer' },
        { layout: 'cta', headline: 'Start now' },
        { layout: 'two-col', headline: 'Built to scale', items: ['fast'] },
      ],
    },
    request,
  );
  assert.deepEqual(
    storyboard.scenes.map((scene) => scene.layout),
    ['hero', 'bullets', 'stat', 'quote', 'outro', 'split'],
  );
  assert.equal(StoryboardSchema.safeParse(storyboard).success, true);
});

test('total duration tracks the requested length', () => {
  const storyboard = normalizePlan(
    { title: 'Pacing', scenes: Array.from({ length: 6 }, (_, index) => ({ layout: 'statement', headline: `Line ${index}`, seconds: 10 })) },
    request,
  );
  assert.ok(Math.abs(total(storyboard) - request.targetSeconds) <= 6, `total was ${total(storyboard)}`);
  for (const scene of storyboard.scenes) {
    assert.ok(scene.seconds >= MIN_SCENE_SECONDS && scene.seconds <= MAX_SCENE_SECONDS, `${scene.seconds}s`);
  }
});

test('missing or absurd durations still produce a valid video', () => {
  const storyboard = normalizePlan(
    {
      title: 'No seconds',
      scenes: [
        { layout: 'hero', headline: 'One' },
        { layout: 'statement', headline: 'Two' },
        { layout: 'bullets', headline: 'Three', items: ['a'] },
        { layout: 'outro', headline: 'Four' },
      ],
    },
    { ...request, targetSeconds: 20 },
  );
  assert.equal(storyboard.scenes.length, 4);
  assert.ok(total(storyboard) >= 10 && total(storyboard) <= 30, `total was ${total(storyboard)}`);
  assert.equal(StoryboardSchema.safeParse(storyboard).success, true);
});

test('scene ids are unique and headlines are never empty', () => {
  const storyboard = normalizePlan(
    { title: 'IDs', scenes: [{ layout: 'hero' }, { layout: 'quote' }, { layout: 'split' }] },
    request,
  );
  const ids = storyboard.scenes.map((scene) => scene.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const scene of storyboard.scenes) assert.ok(scene.headline.trim().length > 0);
  assert.equal(storyboard.skill, request.skill);
  assert.equal(storyboard.aspect, request.aspect);
  assert.equal(storyboard.fps, 30);
});

test('narration is filled in when the model omits it', () => {
  const storyboard = normalizePlan(
    { title: 'Voices', scenes: [{ layout: 'hero', headline: 'Speak this' }, { layout: 'outro', headline: 'And this' }] },
    request,
  );
  for (const scene of storyboard.scenes) assert.ok(scene.narration && scene.narration.length > 0, scene.id);
});

test('the stat layout always carries a value', () => {
  const storyboard = normalizePlan(
    { title: 'Stats', scenes: [{ layout: 'number', headline: '98% retention' }] },
    request,
  );
  assert.ok(storyboard.scenes[0]!.value && storyboard.scenes[0]!.value.length <= 24);
  assert.equal(StoryboardSchema.safeParse(storyboard).success, true);
});
