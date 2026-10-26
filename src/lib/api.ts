import type { AspectId, Scene, SkillId, Storyboard } from '../remotion/types';
import type { Generation, WorkspaceProfile } from './workspace';

export type PublicSettings = {
  ai: { baseUrl: string; model: string; temperature: number; hasKey: boolean; keyHint: string | null };
  elevenlabs: { voiceId: string; modelId: string; stability: number; similarity: number; hasKey: boolean; keyHint: string | null };
  render: { concurrency: number; crf: number };
  runtime: { chromeReady: boolean; node: string };
};

export type SettingsPatch = {
  ai?: { baseUrl?: string; model?: string; apiKey?: string; temperature?: number };
  elevenlabs?: { apiKey?: string; voiceId?: string; modelId?: string; stability?: number; similarity?: number };
  render?: { concurrency?: number; crf?: number };
};

export type Voice = { id: string; name: string; accent: string | null; description: string | null };
export type PlanResponse = { storyboard: Storyboard; source: 'ai' | 'local'; notice?: string };
export type RenderResult = { url: string; fileName: string; bytes: number; ms: number };

type Init = { method?: string; body?: unknown };

const request = async <T>(url: string, init: Init = {}): Promise<T> => {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(payload?.error ?? `Request failed (${res.status})`);
  return payload as T;
};

export const api = {
  generations: () => request<{ generations: Generation[]; profile: WorkspaceProfile }>('/api/workspace'),
  saveGeneration: (generation: Generation) =>
    request<{ generation: Generation }>('/api/workspace/generations', { method: 'PUT', body: generation }),
  saveProfile: (profile: WorkspaceProfile) =>
    request<{ profile: WorkspaceProfile }>('/api/workspace/profile', { method: 'PUT', body: profile }),
  settings: () => request<PublicSettings>('/api/settings'),
  saveSettings: (patch: SettingsPatch) => request<PublicSettings>('/api/settings', { method: 'PUT', body: patch }),
  clearKey: (provider: 'ai' | 'elevenlabs') =>
    request<PublicSettings>(`/api/settings/key/${provider}`, { method: 'DELETE' }),
  voices: () => request<{ voices: Voice[]; defaultVoiceId: string }>('/api/voices'),
  plan: (body: { brief: string; skill: SkillId; aspect: AspectId; targetSeconds: number; sceneCount: number }) =>
    request<PlanResponse>('/api/plan', { method: 'POST', body }),
  voice: (body: { voiceId?: string; scenes: { id: string; text: string }[] }) =>
    request<{ clips: { id: string; audio: string; cached: boolean }[] }>('/api/voice', { method: 'POST', body }),
};

/**
 * Renders over a streaming NDJSON response so the progress bar reflects the
 * real encoder progress instead of a fake spinner.
 */
export const renderVideo = async (
  storyboard: Storyboard,
  onProgress: (progress: number) => void,
): Promise<RenderResult> => {
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ storyboard }),
  });

  if (!res.ok || !res.body) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Render failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: RenderResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (!line) continue;
      const event = JSON.parse(line) as
        | { type: 'progress'; progress: number }
        | ({ type: 'done' } & RenderResult)
        | { type: 'error'; message: string };
      if (event.type === 'progress') onProgress(event.progress);
      else if (event.type === 'done') {
        result = { url: event.url, fileName: event.fileName, bytes: event.bytes, ms: event.ms };
        onProgress(1);
      } else throw new Error(event.message);
    }
  }

  if (!result) throw new Error('The render finished without producing a file.');
  return result;
};

/** Reads a generated clip's duration in the browser so scenes can be retimed. */
export const audioDuration = (url: string): Promise<number> =>
  new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const settle = (value: number) => {
      audio.src = '';
      resolve(value);
    };
    audio.onloadedmetadata = () => settle(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => settle(0);
    audio.src = url;
  });

export type { Scene };
