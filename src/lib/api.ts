import type { RenderJob } from './jobs';
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
export type ModelUsage = { inputTokens: number; outputTokens: number; totalTokens: number };
export type PlanResponse = { storyboard: Storyboard; source: 'ai' | 'local'; notice?: string; usage?: ModelUsage };
export type ImageReference = { name: string; dataUrl: string };
export type RenderResult = { url: string; fileName: string; bytes: number; ms: number };

type Init = { method?: string; body?: unknown };

const request = async <T>(url: string, init: Init = {}): Promise<T> => {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (res.status === 401 && !url.includes('/api/session')) window.dispatchEvent(new Event('session-expired'));
  if (!res.ok) throw new Error(payload?.error ?? `Request failed (${res.status})`);
  return payload as T;
};

export const api = {
  session: () => request<{ authenticated: boolean; protected: boolean }>('/api/session'),
  login: (password: string) => request('/api/session', { method: 'POST', body: { password } }),
  logout: () => request('/api/session', { method: 'DELETE' }),
  jobs: () => request<{ jobs: RenderJob[] }>('/api/jobs'),
  export: (storyboard: Storyboard, projectId?: string) => request<{ job: RenderJob }>('/api/jobs', { method: 'POST', body: { storyboard, projectId } }),
  cancelExport: (id: string) => request<{ job: RenderJob }>(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  edit: (storyboard: Storyboard, instruction: string, sceneId?: string) => request<{ storyboard: Storyboard; summary: string; usage?: ModelUsage }>('/api/edit', { method: 'POST', body: { storyboard, instruction, sceneId } }),
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
  plan: (body: { brief: string; skill: SkillId; aspect: AspectId; targetSeconds: number; sceneCount: number; references?: ImageReference[] }) =>
    request<PlanResponse>('/api/plan', { method: 'POST', body }),
  voice: (body: { voiceId?: string; scenes: { id: string; text: string }[] }) =>
    request<{ clips: { id: string; audio: string; cached: boolean; seconds: number }[] }>('/api/voice', { method: 'POST', body }),
};

export type { Scene };
