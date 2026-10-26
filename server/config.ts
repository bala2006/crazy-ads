import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './storage';

// Load before resolving DATA_DIR; exported process variables keep precedence.
try {
  process.loadEnvFile(path.join(process.cwd(), '.env'));
} catch {
  /* optional */
}
export const ROOT = process.cwd();
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, '.data'));
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const AUDIO_DIR = path.join(DATA_DIR, 'audio');
export const RENDER_DIR = path.join(DATA_DIR, 'renders');

export type Settings = {
  ai: { baseUrl: string; apiKey: string; model: string; temperature: number };
  elevenlabs: { apiKey: string; voiceId: string; modelId: string; stability: number; similarity: number };
  render: { concurrency: number; crf: number };
};

const DEFAULTS: Settings = {
  ai: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', temperature: 0.85 },
  elevenlabs: {
    apiKey: '',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    modelId: 'eleven_multilingual_v2',
    stability: 0.45,
    similarity: 0.75,
  },
  render: { concurrency: 1, crf: 23 },
};

const env = process.env;

/**
 * Precedence: saved settings → environment variables → defaults.
 * Keys never leave the server except as a `••••1234` hint.
 */
export const readSettings = (): Settings => {
  const file = (readJson(CONFIG_FILE) ?? {}) as Partial<Settings>;

  const ai = {
    ...DEFAULTS.ai,
    baseUrl: env.AI_BASE_URL || env.OPENAI_BASE_URL || DEFAULTS.ai.baseUrl,
    model: env.AI_MODEL || env.OPENAI_MODEL || DEFAULTS.ai.model,
    ...(file.ai ?? {}),
  };
  const el = {
    ...DEFAULTS.elevenlabs,
    voiceId: env.ELEVENLABS_VOICE_ID || DEFAULTS.elevenlabs.voiceId,
    modelId: env.ELEVENLABS_MODEL_ID || DEFAULTS.elevenlabs.modelId,
    ...(file.elevenlabs ?? {}),
  };
  const render = { ...DEFAULTS.render, ...(file.render ?? {}) };

  ai.apiKey = file.ai?.apiKey ?? env.AI_API_KEY ?? env.OPENAI_API_KEY ?? '';
  ai.baseUrl = ai.baseUrl || env.AI_BASE_URL || env.OPENAI_BASE_URL || DEFAULTS.ai.baseUrl;
  ai.model = ai.model || env.AI_MODEL || env.OPENAI_MODEL || DEFAULTS.ai.model;

  el.apiKey = file.elevenlabs?.apiKey ?? env.ELEVENLABS_API_KEY ?? '';
  el.voiceId = el.voiceId || env.ELEVENLABS_VOICE_ID || DEFAULTS.elevenlabs.voiceId;
  el.modelId = el.modelId || env.ELEVENLABS_MODEL_ID || DEFAULTS.elevenlabs.modelId;

  return { ai, elevenlabs: el, render };
};

export const writeSettings = (next: Settings) => {
  writeJson(CONFIG_FILE, next);
};

const hint = (key: string) => (key ? `••••${key.slice(-4)}` : null);

export type PublicSettings = {
  ai: { baseUrl: string; model: string; temperature: number; hasKey: boolean; keyHint: string | null };
  elevenlabs: {
    voiceId: string;
    modelId: string;
    stability: number;
    similarity: number;
    hasKey: boolean;
    keyHint: string | null;
  };
  render: { concurrency: number; crf: number };
  runtime: { chromeReady: boolean; node: string };
};

export const publicSettings = (): PublicSettings => {
  const s = readSettings();
  return {
    ai: {
      baseUrl: s.ai.baseUrl,
      model: s.ai.model,
      temperature: s.ai.temperature,
      hasKey: Boolean(s.ai.apiKey),
      keyHint: hint(s.ai.apiKey),
    },
    elevenlabs: {
      voiceId: s.elevenlabs.voiceId,
      modelId: s.elevenlabs.modelId,
      stability: s.elevenlabs.stability,
      similarity: s.elevenlabs.similarity,
      hasKey: Boolean(s.elevenlabs.apiKey),
      keyHint: hint(s.elevenlabs.apiKey),
    },
    render: s.render,
    runtime: {
      chromeReady: fs.existsSync(path.join(ROOT, 'node_modules', '.remotion')),
      node: process.version,
    },
  };
};

export const ensureDirs = () => {
  for (const dir of [DATA_DIR, AUDIO_DIR, RENDER_DIR]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
};
