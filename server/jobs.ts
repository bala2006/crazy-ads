import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from './config';
import { renderStoryboard } from './render';
import { readJson, writeJson } from './storage';
import { StoryboardSchema } from '../src/remotion/schema';
import { attachRender } from './workspace';
import type { Storyboard } from '../src/remotion/types';
import { isActiveJob, type RenderJob, type StoredJob } from '../src/lib/jobs';

type Renderer = typeof renderStoryboard;
const publicJob = ({ storyboard: _board, ...job }: StoredJob): RenderJob => job;

/** One durable queue per mounted workspace; run exactly one application replica. */
export class RenderQueue {
  private jobs: StoredJob[];
  private running = false;
  private stopped = false;
  private controller?: AbortController;
  private currentId?: string;
  private idle?: Promise<void>;
  constructor(
    private file = path.join(DATA_DIR, 'jobs.json'),
    private renderer: Renderer = renderStoryboard,
  ) {
    const raw = readJson(file);
    this.jobs =
      raw === undefined
        ? []
        : (z
            .array(
              z
                .object({
                  id: z.string(),
                  storyboard: StoryboardSchema,
                  title: z.string(),
                  status: z.enum(['queued', 'rendering', 'done', 'failed', 'cancelled']),
                  progress: z.number(),
                  createdAt: z.string(),
                  updatedAt: z.string(),
                })
                .passthrough(),
            )
            .parse(raw) as StoredJob[]);
    for (const job of this.jobs) {
      if (job.status === 'rendering') {
        job.status = 'failed';
        job.error = 'Export interrupted by a server restart. Export again to retry.';
      }
    }
    this.persist();
  }
  private persist() {
    writeJson(this.file, this.jobs);
  }
  list() {
    return this.jobs.map(publicJob).reverse();
  }
  get(id: string) {
    const job = this.jobs.find((item) => item.id === id);
    return job && publicJob(job);
  }
  start() {
    if (!this.stopped && !this.running) this.idle = this.drain();
  }
  enqueue(storyboard: Storyboard, projectId?: string) {
    if (this.stopped)
      throw Object.assign(new Error('Server is shutting down. Try again shortly.'), { status: 503 });
    if (this.jobs.filter(isActiveJob).length >= 4)
      throw Object.assign(new Error('The export queue is full. Wait for a render to finish.'), {
        status: 429,
      });
    const existing = this.jobs.find(
      (job) =>
        isActiveJob(job) &&
        job.projectId === projectId &&
        JSON.stringify(job.storyboard) === JSON.stringify(storyboard),
    );
    if (existing) return publicJob(existing);
    const now = new Date().toISOString();
    const job: StoredJob = {
      id: crypto.randomUUID(),
      projectId,
      title: storyboard.title,
      storyboard: structuredClone(storyboard),
      status: 'queued',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.push(job);
    // Keep completed history bounded; output files are retained until explicitly removed.
    const completed = this.jobs.filter((item) => !isActiveJob(item));
    if (completed.length > 100)
      this.jobs = this.jobs.filter(
        (item) => isActiveJob(item) || completed.indexOf(item) >= completed.length - 100,
      );
    this.persist();
    this.start();
    return publicJob(job);
  }
  cancel(id: string) {
    const job = this.jobs.find((item) => item.id === id);
    if (!job) return undefined;
    if (!isActiveJob(job)) return publicJob(job);
    job.status = 'cancelled';
    job.updatedAt = new Date().toISOString();
    this.persist();
    if (this.currentId === id) this.controller?.abort();
    return publicJob(job);
  }
  async stop() {
    this.stopped = true;
    this.controller?.abort();
    await this.idle;
  }
  private async drain() {
    this.running = true;
    try {
      while (!this.stopped) {
        const job = this.jobs.find((item) => item.status === 'queued');
        if (!job) break;
        job.status = 'rendering';
        this.currentId = job.id;
        this.controller = new AbortController();
        this.persist();
        try {
          const result = await this.renderer(
            job.storyboard,
            (progress) => {
              if (job.status !== 'rendering') return;
              const step = Math.floor(progress * 100) / 100;
              if (step > job.progress) {
                job.progress = step;
                job.updatedAt = new Date().toISOString();
                this.persist();
              }
            },
            this.controller.signal,
          );
          if (job.status === 'rendering') {
            job.status = 'done';
            job.result = result;
            job.progress = 1;
            if (job.projectId) {
              try {
                attachRender(job.projectId, job.storyboard, result);
              } catch {
                job.error = 'Video ready. Project metadata could not be saved; download the video here.';
              }
            }
          }
        } catch (error) {
          if (isActiveJob(job)) {
            job.status = 'failed';
            job.error = this.stopped
              ? 'Export interrupted by server shutdown. Export again to retry.'
              : error instanceof Error
                ? error.message
                : 'Export failed.';
          }
        }
        job.updatedAt = new Date().toISOString();
        this.persist();
      }
    } finally {
      this.running = false;
      this.controller = undefined;
      this.currentId = undefined;
    }
  }
}
