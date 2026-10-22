import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiPlanSchema, StoryboardSchema } from '../src/remotion/schema';
import type { Storyboard } from '../src/remotion/types';

const valid: Storyboard = {
  title: 'Launch film',
  skill: 'neon-cyber',
  aspect: '16:9',
  fps: 30,
  scenes: [
    { id: 'a', layout: 'hero', headline: 'Big idea', kicker: 'Open', seconds: 4, transition: 'fade' },
    { id: 'b', layout: 'stat', headline: 'Faster', value: '12x', seconds: 3.5, transition: 'zoom' },
  ],
};

test('accepts a well-formed storyboard', () => {
  assert.equal(StoryboardSchema.safeParse(valid).success, true);
});

test('rejects an unknown layout and skill', () => {
  const badSkill = StoryboardSchema.safeParse({ ...valid, skill: 'pixel-art' });
  const badLayout = StoryboardSchema.safeParse({
    ...valid,
    scenes: [{ ...valid.scenes[0]!, layout: 'marquee' }],
  });
  assert.equal(badSkill.success, false);
  assert.equal(badLayout.success, false);
});

test('rejects durations outside the supported range', () => {
  for (const seconds of [0, 1, 31, Number.NaN]) {
    const parsed = StoryboardSchema.safeParse({
      ...valid,
      scenes: [{ ...valid.scenes[0]!, seconds }],
    });
    assert.equal(parsed.success, false, `seconds=${seconds} should be rejected`);
  }
});

test('rejects an empty storyboard and a footer-only one', () => {
  assert.equal(StoryboardSchema.safeParse({ ...valid, scenes: [] }).success, false);
});

test('the AI plan schema is tolerant about optional scene fields', () => {
  const plan = AiPlanSchema.parse({ scenes: [{ headline: 'Just a headline' }, { layout: 'outro' }] });
  assert.equal(plan.scenes.length, 2);
  assert.equal(AiPlanSchema.safeParse({ scenes: [] }).success, false);
  assert.equal(AiPlanSchema.safeParse({ title: 'no scenes' }).success, false);
});
