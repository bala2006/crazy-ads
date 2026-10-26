import { createContext, useContext } from 'react';
import type { Skill } from './skills';
import type { Scene } from './types';

export type SceneContextValue = {
  scene: Scene;
  skill: Skill;
  /** layout unit: 1/1000th of the shorter edge, so sizes work in any aspect */
  unit: number;
  accent: string;
  frame: number;
  durationInFrames: number;
  index: number;
  count: number;
  width: number;
  height: number;
};

export const SceneCtx = createContext<SceneContextValue | null>(null);

export const useSceneCtx = () => {
  const ctx = useContext(SceneCtx);
  if (!ctx) throw new Error('useSceneCtx must be used inside a scene');
  return ctx;
};
