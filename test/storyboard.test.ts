import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compositionSize,
  emptyStoryboard,
  formatBytes,
  formatSeconds,
  newScene,
  sceneFramesOf,
  startFrameOf,
  totalFrames,
  totalSeconds,
} from '../src/lib/storyboard';
import { ASPECT_SIZE, FPS, sceneFrames, storyboardFrames, type Storyboard } from '../src/remotion/types';

const board: Storyboard = {
  title: 'Timing',
  skill: 'mono-luxe',
  aspect: '16:9',
  fps: FPS,
  scenes: [
    { id: '1', layout: 'hero', headline: 'One', seconds: 4, transition: 'fade' },
    { id: '2', layout: 'bullets', headline: 'Two', seconds: 2.5, transition: 'zoom' },
    { id: '3', layout: 'outro', headline: 'Three', seconds: 3.5, transition: 'fade' },
  ],
};

test('frame maths matches the timeline the renderer builds', () => {
  assert.equal(sceneFramesOf(board.scenes[1]!), 75);
  assert.equal(totalFrames(board), 300);
  assert.equal(totalFrames(board), storyboardFrames(board));
  assert.equal(startFrameOf(board, 0), 0);
  assert.equal(startFrameOf(board, 1), 120);
  assert.equal(startFrameOf(board, 3), 300);
  assert.equal(totalSeconds(board), 10);
});

test('a zero or fractional length can never produce an empty composition', () => {
  assert.ok(sceneFrames({ id: 'x', layout: 'hero', headline: 'x', seconds: 0.1, transition: 'fade' }) >= 1);
  const broken: Storyboard = { ...board, fps: 24 };
  assert.equal(totalFrames(broken), Math.round(4 * 24) + Math.round(2.5 * 24) + Math.round(3.5 * 24));
});

test('composition sizes map every aspect ratio', () => {
  assert.deepEqual(compositionSize(board), { width: 1920, height: 1080 });
  assert.deepEqual(compositionSize({ ...board, aspect: '9:16' }), ASPECT_SIZE['9:16']);
  assert.deepEqual(compositionSize({ ...board, aspect: '1:1' }), { width: 1080, height: 1080 });
  for (const aspect of ['16:9', '9:16', '1:1'] as const) {
    const size = ASPECT_SIZE[aspect];
    assert.ok(size.width * size.height >= 1080 * 1080, aspect);
  }
});

test('new storyboards and scenes are usable immediately', () => {
  const empty = emptyStoryboard();
  assert.equal(empty.scenes.length, 0);
  assert.equal(empty.fps, FPS);

  const first = newScene();
  const second = newScene();
  assert.notEqual(first.id, second.id);
  assert.equal(typeof first.headline, 'string');
  assert.ok(first.seconds > 0 && first.transition);
});

test('the storyboard round-trips through JSON as the API sends it', () => {
  const restored = JSON.parse(JSON.stringify(board)) as Storyboard;
  assert.deepEqual(restored, board);
});

test('human formatting helpers stay short', () => {
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatSeconds(10), '10s');
  assert.equal(formatSeconds(2.55), '2.6s');
});
