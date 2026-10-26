import { ASPECT_SIZE, FPS, type LayoutId, type Scene, type SkillId, type Storyboard } from '../remotion/types';
import { StoryboardSchema } from '../remotion/schema';
import type { Generation } from './workspace';

const KEY = 'motionforge:storyboard:v1';
const ACTIVE_PROJECT_KEY = 'motionforge:active-project:v1';
const DRAFT_META_KEY = 'motionforge:draft-meta:v1';

export const saveDraftMeta = (project?: Generation) => {
  try { localStorage.setItem(DRAFT_META_KEY, JSON.stringify({ id: project?.id, revision: project?.revision ?? 0 })); } catch { /* optional cache */ }
};
export const restoreDraft = (project?: Generation): Storyboard => {
  if (!project) return loadBoard();
  try {
    const meta = JSON.parse(localStorage.getItem(DRAFT_META_KEY) || '{}');
    const draft = loadBoard();
    if (draft.scenes.length && meta.id === project.id && meta.revision === (project.revision ?? 0)) return draft;
  } catch { /* use server's authoritative revision */ }
  return project.storyboard;
};

export const emptyStoryboard = (): Storyboard => ({
  title: 'Untitled film',
  skill: 'neon-cyber' as SkillId,
  aspect: '16:9',
  fps: FPS,
  scenes: [],
});

export const newScene = (layout: LayoutId = 'statement'): Scene => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  layout,
  headline: 'New scene',
  seconds: 4,
  transition: 'fade',
});

export const sceneFramesOf = (scene: Scene, fps = FPS) => Math.max(1, Math.round(scene.seconds * fps));

export const totalFrames = (storyboard: Storyboard) =>
  storyboard.scenes.reduce((sum, scene) => sum + sceneFramesOf(scene, storyboard.fps), 0);

export const startFrameOf = (storyboard: Storyboard, index: number) =>
  storyboard.scenes.slice(0, index).reduce((sum, scene) => sum + sceneFramesOf(scene, storyboard.fps), 0);

export const compositionSize = (storyboard: Storyboard) => ASPECT_SIZE[storyboard.aspect] ?? ASPECT_SIZE['16:9'];

export const totalSeconds = (storyboard: Storyboard) => storyboard.scenes.reduce((sum, scene) => sum + scene.seconds, 0);

export const loadBoard = (): Storyboard => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStoryboard();
    const parsed = StoryboardSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyStoryboard();
  } catch {
    return emptyStoryboard();
  }
};

export const saveBoard = (storyboard: Storyboard) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(storyboard));
  } catch {
    /* private mode — the studio still works, it just won't persist */
  }
};

export const loadActiveProjectId = () => {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
};

export const saveActiveProjectId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    else localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } catch {
    /* private mode — active project selection is optional */
  }
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatSeconds = (seconds: number) => {
  const value = Math.round(seconds * 10) / 10;
  return `${value}s`;
};
