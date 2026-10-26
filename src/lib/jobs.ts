import type { Storyboard } from '../remotion/types';
import type { RenderResult } from './api';

export type RenderJob = {
  id: string;
  projectId?: string;
  title: string;
  status: 'queued' | 'rendering' | 'done' | 'failed' | 'cancelled';
  progress: number;
  createdAt: string;
  updatedAt: string;
  result?: RenderResult;
  error?: string;
};
export type StoredJob = RenderJob & { storyboard: Storyboard };
export const isActiveJob = (job: RenderJob) => job.status === 'queued' || job.status === 'rendering';
