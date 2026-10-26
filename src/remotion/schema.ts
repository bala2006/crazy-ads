import { z } from 'zod';
import { ASPECTS, LAYOUTS, MAX_SCENE_SECONDS, MIN_SCENE_SECONDS, SKILL_IDS, TRANSITIONS, VISUAL_MOTIONS } from './types';
import { sanitizeInlineSvg } from '../lib/svg';

/** Strict schema for anything the app stores, sends to the renderer, or trusts. */
export const SceneSchema = z.object({
  id: z.string().min(1).max(100),
  layout: z.enum(LAYOUTS),
  kicker: z.string().max(80).optional(),
  headline: z.string().min(1).max(200),
  sub: z.string().max(300).optional(),
  items: z.array(z.string().max(160)).max(6).optional(),
  value: z.string().max(24).optional(),
  narration: z.string().max(600).optional(),
  seconds: z.number().min(MIN_SCENE_SECONDS).max(MAX_SCENE_SECONDS),
  transition: z.enum(TRANSITIONS),
  audio: z.string().regex(/^audio\/[a-f0-9]{16,64}\.mp3$/, 'Use an audio clip generated in this workspace.').optional(),
  visualSvg: z.string().max(16_000).optional().refine((value) => !value || Boolean(sanitizeInlineSvg(value)), 'Unsafe or invalid inline SVG'),
  visualMotion: z.enum(VISUAL_MOTIONS).optional(),
  accent: z.string().regex(/^#[a-f\d]{6}$/i, 'Use a six-digit hex color.').optional(),
});

export const StoryboardSchema = z.object({
  title: z.string().min(1).max(120),
  skill: z.enum(SKILL_IDS),
  aspect: z.enum(ASPECTS),
  fps: z.number().int().min(12).max(60),
  scenes: z.array(SceneSchema).min(1).max(24),
}).refine((board) => new Set(board.scenes.map((scene) => scene.id)).size === board.scenes.length, 'Scene IDs must be unique.')
  .refine((board) => board.scenes.reduce((sum, scene) => sum + Math.round(scene.seconds * board.fps), 0) <= 180 * board.fps, 'Videos can be up to 180 seconds.');

/** Tolerant schema for model output: the model is asked for JSON, we repair the rest. */
export const AiSceneSchema = z.object({
  layout: z.string().optional(),
  kicker: z.string().optional(),
  headline: z.string().optional(),
  sub: z.string().optional(),
  items: z.array(z.string()).optional(),
  value: z.string().optional(),
  narration: z.string().optional(),
  seconds: z.number().optional(),
  visualSvg: z.string().max(16_000).optional(),
  visualMotion: z.enum(VISUAL_MOTIONS).optional(),
  accent: z.string().regex(/^#[a-f\d]{6}$/i).optional(),
});

export const AiPlanSchema = z.object({
  title: z.string().optional(),
  scenes: z.array(AiSceneSchema).min(1).max(24),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;
