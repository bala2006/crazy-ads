import { useEffect, useRef, useState } from 'react';
import { StoryboardSchema } from '../remotion/schema';
import type { Storyboard } from '../remotion/types';
import type { Generation } from './workspace';
import { saveActiveProjectId, saveBoard, saveDraftMeta } from './storyboard';

export const useAutosave = (
  board: Storyboard,
  initial: Generation | undefined,
  onSave: (generation: Generation) => Promise<Generation>,
) => {
  const [status, setStatus] = useState('Saved');
  const [projectId, setProjectId] = useState(initial?.id);
  const project = useRef<Generation | undefined>(initial);
  const latest = useRef(board);
  latest.current = board;
  const callback = useRef(onSave);
  callback.current = onSave;
  const saved = useRef(initial ? JSON.stringify(initial.storyboard) : '');
  const source = useRef<Generation['source']>(initial?.source || 'manual');
  const pending = useRef<Promise<Generation | undefined> | undefined>(undefined);
  const mounted = useRef(true);
  const blocked = useRef(false);
  const flush = async (): Promise<Generation | undefined> => {
    if (pending.current) {
      await pending.current;
      if (JSON.stringify(latest.current) !== saved.current) return flush();
      return project.current;
    }
    if (blocked.current)
      throw new Error(
        'Resolve the save conflict by reloading this project. Your draft is kept in this browser.',
      );
    const parsed = StoryboardSchema.safeParse(latest.current);
    if (!parsed.success || JSON.stringify(parsed.data) === saved.current) return project.current;
    const task = async () => {
      if (mounted.current) setStatus('Saving…');
      const now = new Date().toISOString();
      const current = project.current;
      const generation: Generation = {
        id: current?.id || crypto.randomUUID(),
        title: parsed.data.title,
        storyboard: parsed.data,
        source: source.current,
        createdAt: current?.createdAt || now,
        updatedAt: now,
        revision: current?.revision || 0,
        ...(current?.render && JSON.stringify(current.storyboard) === JSON.stringify(parsed.data)
          ? { render: current.render }
          : {}),
      };
      try {
        const result = await callback.current(generation);
        project.current = result;
        saved.current = JSON.stringify(parsed.data);
        saveActiveProjectId(result.id);
        saveDraftMeta(result);
        if (mounted.current) {
          setProjectId(result.id);
          setStatus('Saved');
        }
        return result;
      } catch (error) {
        const message = (error as Error).message;
        if (/another tab/.test(message)) blocked.current = true;
        if (mounted.current) setStatus(`Save failed: ${message}`);
        throw error;
      } finally {
        pending.current = undefined;
      }
    };
    pending.current = task();
    return pending.current;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    saveBoard(board);
    saveDraftMeta(project.current);
    if (JSON.stringify(board) !== saved.current) setStatus('Unsaved changes');
    const timer = window.setTimeout(() => {
      void flushRef.current().catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [board]);
  useEffect(() => {
    mounted.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.scenes.length && JSON.stringify(latest.current) !== saved.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      mounted.current = false;
      window.removeEventListener('beforeunload', beforeUnload);
      void flushRef.current().catch(() => undefined);
    };
  }, []);
  return {
    status,
    projectId,
    flush,
    setSource: (next: Generation['source']) => {
      source.current = next;
    },
  };
};
