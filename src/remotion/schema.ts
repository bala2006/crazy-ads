import { z } from 'zod';
import { ASPECTS, LAYOUTS, MAX_SCENE_SECONDS, MIN_SCENE_SECONDS, SKILL_IDS, TRANSITIONS } from './types';
import { sanitizeInlineSvg } from '../lib/svg';

/** Strict schema for anything the app stores, sends to the renderer, or trusts. */
export const SceneSchema = z.object({
  id: z.string().min(1),
  layout: z.enum(LAYOUTS),
  kicker: z.string().max(80).optional(),
  headline: z.string().min(1).max(200),
  sub: z.string().max(300).optional(),
  items: z.array(z.string().max(160)).max(6).optional(),
  value: z.string().max(24).optional(),
  narration: z.string().max(600).optional(),
  seconds: z.number().min(MIN_SCENE_SECONDS).max(MAX_SCENE_SECONDS),
  transition: z.enum(TRANSITIONS),
  audio: z.string().max(300).optional(),
  visualSvg: z.string().max(16_000).optional().refine((value) => !value || Boolean(sanitizeInlineSvg(value)), 'Unsafe or invalid inline SVG'),
  accent: z.string().max(32).optional(),
});

export const StoryboardSchema = z.object({
  title: z.string().min(1).max(120),
  skill: z.enum(SKILL_IDS),
  aspect: z.enum(ASPECTS),
  fps: z.number().int().min(12).max(60),
  scenes: z.array(SceneSchema).min(1).max(24),
});

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
});

export const AiPlanSchema = z.object({
  title: z.string().optional(),
  scenes: z.array(AiSceneSchema).min(1),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;
