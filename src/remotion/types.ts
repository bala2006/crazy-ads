/**
 * Shared, dependency-free types. Imported by the SPA, the API server and the
 * Remotion renderer, so this file must never import Node or browser code.
 */

export const ASPECTS = ['16:9', '9:16', '1:1'] as const;
export type AspectId = (typeof ASPECTS)[number];

export const LAYOUTS = ['hero', 'statement', 'bullets', 'stat', 'quote', 'split', 'outro'] as const;
export type LayoutId = (typeof LAYOUTS)[number];

export const TRANSITIONS = ['fade', 'slide', 'wipe', 'zoom', 'cut'] as const;
export type TransitionId = (typeof TRANSITIONS)[number];

export const SKILL_IDS = [
  'swiss-editorial',
  'neon-cyber',
  'paper-craft',
  'glass-aurora',
  'retro-future',
  'mono-luxe',
  'data-dash',
  'bold-pop',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export type Scene = {
  id: string;
  layout: LayoutId;
  /** small label above the headline */
  kicker?: string;
  headline: string;
  sub?: string;
  /** bullet / list content, max 6 */
  items?: string[];
  /** big number for the `stat` layout */
  value?: string;
  /** spoken line, sent to ElevenLabs */
  narration?: string;
  seconds: number;
  transition: TransitionId;
  /** path returned by POST /api/voice, relative to the public dir */
  audio?: string;
  accent?: string;
};

export type Storyboard = {
  title: string;
  skill: SkillId;
  aspect: AspectId;
  fps: number;
  scenes: Scene[];
};

export const ASPECT_SIZE: Record<AspectId, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  hero: 'Hero',
  statement: 'Statement',
  bullets: 'List',
  stat: 'Big number',
  quote: 'Quote',
  split: 'Split',
  outro: 'Outro',
};

export const FPS = 30;
export const MAX_SCENE_SECONDS = 30;
export const MIN_SCENE_SECONDS = 1.5;

export const sceneFrames = (scene: Scene, fps = FPS) => Math.max(1, Math.round(scene.seconds * fps));
export const storyboardFrames = (storyboard: Storyboard) =>
  storyboard.scenes.reduce((total, scene) => total + sceneFrames(scene, storyboard.fps), 0);
