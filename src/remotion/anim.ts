import { Easing } from 'remotion';
import type { CSSProperties } from 'react';
import type { EaseId, EnterId } from './skills';

/** Motion grammar primitives shared by every layout. */

export const EASINGS: Record<EaseId, (input: number) => number> = {
  smooth: Easing.bezier(0.22, 1, 0.36, 1),
  snappy: Easing.bezier(0.16, 1, 0.3, 1),
  bouncy: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: Easing.linear,
};

/** Eased 0→1 progress for an element that starts at `start` and takes `duration`. */
export const progress = (frame: number, start: number, duration: number, ease: EaseId = 'smooth') => {
  if (duration <= 0) return 1;
  const t = Math.min(1, Math.max(0, (frame - start) / duration));
  return EASINGS[ease](t);
};

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Entry transform for a skill's motion style. `q` is eased 0→1 progress. */
export const enterStyle = (kind: EnterId, q: number, unit: number): CSSProperties => {
  const opacity = Math.min(1, Math.max(0, q * 1.8));
  switch (kind) {
    case 'fadeUp':
      return { opacity, transform: `translateY(${lerp(1, 0, q) * unit * 30}px)` };
    case 'clipUp':
      return {
        opacity: Math.min(1, Math.max(0, q * 3)),
        transform: `translateY(${lerp(1, 0, q) * unit * 34}px)`,
        clipPath: `inset(${lerp(1, 0, q) * 100}% 0% 0% 0%)`,
      };
    case 'slideRight':
      return { opacity, transform: `translateX(${lerp(-1, 0, q) * unit * 60}px)` };
    case 'pop':
      return { opacity: Math.min(1, Math.max(0, q * 2)), transform: `scale(${lerp(0.74, 1, q)})` };
    case 'blurIn':
      return {
        opacity,
        filter: `blur(${lerp(1, 0, Math.min(1, q)) * unit * 16}px)`,
        transform: `scale(${lerp(0.97, 1, q)})`,
      };
    case 'scaleIn':
      return { opacity, transform: `scale(${lerp(1.16, 1, q)})` };
    default:
      return { opacity, transform: `translateY(${lerp(1, 0, q) * unit * 30}px)` };
  }
};

/** Exit transform for the last `frames` of a scene. */
export const exitStyle = (
  frame: number,
  durationInFrames: number,
  frames: number,
  transition: 'fade' | 'slide' | 'wipe' | 'zoom' | 'cut',
): CSSProperties => {
  const start = durationInFrames - frames;
  const t = Math.min(1, Math.max(0, (frame - start) / Math.max(1, frames)));
  if (transition === 'cut' || t <= 0) return {};
  switch (transition) {
    case 'slide':
      return { opacity: 1 - t, transform: `translateX(${-t * 5}%)` };
    case 'zoom':
      return { opacity: 1 - t, transform: `scale(${1 + t * 0.07})` };
    case 'wipe':
      return { clipPath: `inset(0% 0% 0% ${t * 100}%)` };
    case 'fade':
    default:
      return { opacity: 1 - t * 0.98, transform: `scale(${1 + t * 0.015})` };
  }
};
