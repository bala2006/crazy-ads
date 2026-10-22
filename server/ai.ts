import { AiPlanSchema, type AiPlan } from '../src/remotion/schema';
import {
  LAYOUTS,
  MAX_SCENE_SECONDS,
  MIN_SCENE_SECONDS,
  type AspectId,
  type LayoutId,
  type Scene,
  type SkillId,
  type Storyboard,
  type TransitionId,
} from '../src/remotion/types';
import { getSkill } from '../src/remotion/skills';
import { readSettings } from './config';

export type PlanRequest = {
  brief: string;
  skill: SkillId;
  aspect: AspectId;
  targetSeconds: number;
  sceneCount: number;
};

const LAYOUT_HINTS = `
- "hero": opening title — kicker + headline + sub. Use once, first.
- "statement": one huge kinetic line (2–7 words). Great for a turning point.
- "bullets": headline + 3–4 short items. Use for steps, features, benefits.
- "stat": one metric — put it in "value" ("12x", "98%", "$4.2M") + headline explaining it.
- "quote": a single testimonial line + attribution in "sub".
- "split": headline + sub + up to 4 short tags in "items" next to an animated graphic.
- "outro": closing call to action — headline + sub + CTA text in "items"[0].
`.trim();

const systemPrompt = (req: PlanRequest, skillName: string, voice: string) => `You are a senior motion-graphics director and copywriter. You write tight, storyboarded video scripts.

Return ONLY a JSON object, no markdown, with this shape:
{
  "title": "string, 2-6 words",
  "scenes": [
    {
      "layout": ${LAYOUTS.map((l) => `"${l}"`).join(' | ')},
      "kicker": "optional 1-3 word label, UPPERCASE",
      "headline": "the main on-screen line",
      "sub": "optional supporting line",
      "items": ["optional", "short", "list", "or CTA"],
      "value": "only for stat layout, e.g. 12x",
      "narration": "the spoken line for this scene, 8-30 words, natural spoken English",
      "seconds": number
    }
  ]
}

Layouts:
${LAYOUT_HINTS}

Rules:
- Exactly ${req.sceneCount} scenes, in a narrative arc: hook → tension → how → proof → close.
- Total duration must be about ${req.targetSeconds} seconds; seconds per scene between 2.5 and 8.
- Match the art direction "${skillName}": ${voice}
- Headlines are short enough to read in one glance. No emojis, no hashtags, no markdown, no quotes around the whole line.
- "narration" must be speakable: no emoji, no symbols like %/× written awkwardly, expand ranges (say "twelve times", not "12x") when it helps speech.
- Never repeat the same layout more than twice in a row and always open with hero, close with outro.
- If layout is "stat", "value" is mandatory and short.
- Keep it factual and specific to the brief; invent plausible detail only when needed.`;

/** Trims a sentence at a word boundary without leaving a dangling comma. */
const clip = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').replace(/[,;:\-–—]+$/, '').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > 20 ? cut.slice(0, space) : cut).replace(/[,;:\-–—]+$/, '')}…`;
};

/**
 * A decent draft with no AI at all: the brief is split into lines, then mapped
 * onto a narrative arc so the offline path still produces a watchable video.
 */
const fallbackScenes = (brief: string, count: number, target: number): Scene[] => {
  const clean = brief.replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const fragments = clean
    .split(/[,;•\n]|(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/[.?!]+$/, ''))
    .filter((s) => s.length > 3 && s.length < 110);

  const title = clip(sentences[0] ?? clean, 64) || 'Untitled film';
  const sub = sentences[1] ? clip(sentences[1], 120) : 'One clear idea, in motion.';
  const per = Math.min(8, Math.max(MIN_SCENE_SECONDS * 2, target / Math.max(3, count)));
  const mids: LayoutId[] = ['statement', 'bullets', 'split', 'quote', 'statement', 'bullets'];
  const listItems = fragments.length >= 3 ? fragments.slice(0, 4) : ['A clear visual story', 'On-brand motion', 'A finished MP4'];
  const stamp = Date.now().toString(36);
  const fillers = ['One clear idea', 'Built to move fast', 'Made to be watched', 'Every frame counts'];
  const used = new Set<string>([title.toLowerCase()]);

  const scenes: Scene[] = [
    {
      id: `local-${stamp}-0`,
      layout: 'hero',
      kicker: 'Presenting',
      headline: title,
      sub: sentences[1] ? clip(sentences[1], 120) : undefined,
      narration: title.replace(/…$/, ''),
      seconds: per,
      transition: 'fade',
    },
  ];

  const middle = Math.max(0, count - 2);
  for (let index = 0; index < middle; index += 1) {
    const layout = mids[index % mids.length]!;
    const candidate = clip(fragments[index + 1] ?? sentences[index + 1] ?? '', 80);
    const line = !candidate || used.has(candidate.toLowerCase()) ? fillers[index % fillers.length]! : candidate;
    used.add(line.toLowerCase());
    const scene: Scene = {
      id: `local-${stamp}-${index + 1}`,
      layout,
      kicker: index === 0 ? 'The idea' : index === middle - 1 ? 'The detail' : 'In practice',
      headline: line || 'One clear idea',
      sub: layout === 'bullets' ? undefined : sub,
      narration: line.replace(/…$/, '') || sub,
      seconds: per,
      transition: 'fade',
    };
    if (layout === 'bullets') {
      scene.items = listItems;
      scene.headline = index === 0 ? 'What you get' : 'How it works';
      scene.narration = listItems.join('. ');
    }
    if (layout === 'quote') {
      scene.sub = 'Straight from the brief';
      scene.headline = line || 'Exactly what you asked for.';
    }
    scenes.push(scene);
  }

  if (count > 1) {
    scenes.push({
      id: `local-${stamp}-last`,
      layout: 'outro',
      kicker: 'Next',
      headline: (() => {
        const candidate = clip(sentences[2] ?? '', 60);
        return candidate && !used.has(candidate.toLowerCase()) ? candidate : 'Ready when you are';
      })(),
      sub: 'Self-hosted motion graphics, rendered on your machine.',
      items: ['Get started'],
      narration: 'Ready when you are.',
      seconds: per,
      transition: 'fade',
    });
  }

  return scenes;
};

const normalizeLayout = (raw: string | undefined): LayoutId => {
  const value = (raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const direct = (LAYOUTS as readonly string[]).includes(value) ? (value as LayoutId) : null;
  if (direct) return direct;
  const aliases: Record<string, LayoutId> = {
    title: 'hero',
    intro: 'hero',
    opening: 'hero',
    text: 'statement',
    big: 'statement',
    kinetic: 'statement',
    list: 'bullets',
    features: 'bullets',
    steps: 'bullets',
    bullet: 'bullets',
    number: 'stat',
    metric: 'stat',
    data: 'stat',
    kpi: 'stat',
    testimonial: 'quote',
    review: 'quote',
    twocolumn: 'split',
    twocol: 'split',
    columns: 'split',
    featuresplit: 'split',
    end: 'outro',
    cta: 'outro',
    closing: 'outro',
    thanks: 'outro',
  };
  return aliases[value] ?? 'statement';
};

/** Scene-to-scene energy: keep the moves that suit the layout. */
const transitionFor = (layout: LayoutId, index: number): TransitionId => {
  if (index === 0) return 'fade';
  if (layout === 'stat' || layout === 'bullets') return 'zoom';
  if (layout === 'statement' || layout === 'quote') return 'wipe';
  if (layout === 'split') return 'slide';
  return 'fade';
};

export const normalizePlan = (plan: AiPlan, req: PlanRequest): Storyboard => {
  const raw = plan.scenes.slice(0, 12);
  const weights = raw.map((s) => (Number.isFinite(s.seconds) ? Number(s.seconds) : 0));
  const known = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  const unknown = weights.filter((w) => w <= 0).length;
  const fallbackEach = Math.max(MIN_SCENE_SECONDS, (req.targetSeconds - known) / Math.max(1, unknown || raw.length));
  const seconds = weights.map((w) => Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, w > 0 ? w : fallbackEach)));
  /** scale toward the requested total, keeping the model's relative pacing */
  const total = seconds.reduce((a, b) => a + b, 0);
  const factor = total > 0 ? Math.min(1.6, Math.max(0.5, req.targetSeconds / total)) : 1;
  const rounded = seconds.map((s) => Math.round(Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, s * factor)) * 2) / 2);

  const scenes: Scene[] = raw.map((scene, index) => {
    const layout = normalizeLayout(scene.layout);
    const headline = (scene.headline ?? '').replace(/\s+/g, ' ').trim();
    const sub = scene.sub?.replace(/\s+/g, ' ').trim();
    const items = (scene.items ?? []).map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6);
    const normalized: Scene = {
      id: `s${Date.now().toString(36)}${index}`,
      layout,
      headline: headline || sub || `Scene ${index + 1}`,
      seconds: rounded[index] ?? Math.max(MIN_SCENE_SECONDS, req.targetSeconds / raw.length),
      transition: transitionFor(layout, index),
      kicker: scene.kicker?.replace(/\s+/g, ' ').trim().slice(0, 60) || undefined,
      sub: sub || undefined,
      items: items.length ? items : undefined,
      narration: scene.narration?.replace(/\s+/g, ' ').trim() || [headline, sub].filter(Boolean).join('. '),
      value: scene.value?.trim() || (layout === 'stat' ? headline.slice(0, 8) : undefined),
    };
    return normalized;
  });

  return {
    title: (plan.title ?? 'Untitled film').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled film',
    skill: req.skill,
    aspect: req.aspect,
    fps: 30,
    scenes: scenes.length ? scenes : fallbackScenes(req.brief, req.sceneCount, req.targetSeconds),
  };
};

const stripFences = (text: string) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? trimmed).trim();
};

export type PlanResult = { storyboard: Storyboard; source: 'ai' | 'local'; notice?: string };

export const planStoryboard = async (req: PlanRequest): Promise<PlanResult> => {
  const settings = readSettings();
  const skill = getSkill(req.skill);

  if (!settings.ai.apiKey) {
    return {
      storyboard: normalizePlan({ scenes: fallbackScenes(req.brief, req.sceneCount, req.targetSeconds) }, req),
      source: 'local',
      notice: 'No AI key saved — drafted an offline outline. Add a key in Settings for written scripts.',
    };
  }

  const base = settings.ai.baseUrl.replace(/\/+$/, '');
  const body = {
    model: settings.ai.model,
    temperature: settings.ai.temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt(req, skill.name, skill.voice) },
      {
        role: 'user',
        content: `Brief:\n${req.brief}\n\nAspect ratio: ${req.aspect}. Target length: ${req.targetSeconds}s. Scenes: ${req.sceneCount}. Skill: ${skill.name}.`,
      },
    ],
  };

  let text = '';
  const callModel = async (payload: Record<string, unknown>) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.ai.apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000),
    });
    const json = (await res.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;
    if (!res.ok) throw new Error(json?.error?.message ?? `AI provider responded ${res.status}`);
    return json?.choices?.[0]?.message?.content ?? '';
  };

  try {
    text = await callModel(body);
  } catch (error) {
    // Some OpenAI-compatible servers reject response_format; retry once without it.
    const message = error instanceof Error ? error.message : String(error);
    if (!/response_format|json_object|unsupported|400/i.test(message)) {
      return {
        storyboard: normalizePlan({ scenes: fallbackScenes(req.brief, req.sceneCount, req.targetSeconds) }, req),
        source: 'local',
        notice: `AI request failed (${message}). Used an offline draft instead.`,
      };
    }
    const retryBody = { model: body.model, temperature: body.temperature, messages: body.messages };
    try {
      text = await callModel(retryBody);
    } catch (retryError) {
      const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
      return {
        storyboard: normalizePlan({ scenes: fallbackScenes(req.brief, req.sceneCount, req.targetSeconds) }, req),
        source: 'local',
        notice: `AI request failed (${retryMessage}). Used an offline draft instead.`,
      };
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    throw new Error('The model returned text that was not valid JSON. Try again, or switch to a stronger model.');
  }

  const plan = AiPlanSchema.safeParse(parsed);
  if (!plan.success) throw new Error('The model returned JSON in an unexpected shape. Try again.');

  return { storyboard: normalizePlan(plan.data, req), source: 'ai' };
};
