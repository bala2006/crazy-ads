import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { responsiveSvg } from '../lib/svg';
import type { Scene } from './types';

/** Every movement is a pure function of the frame: preview and export are identical. */
export const VectorArt = ({ scene, size }: { scene: Scene; size: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const svg = responsiveSvg(scene.visualSvg);
  if (!svg) return null;
  const time = frame / fps;
  const motion = scene.visualMotion || 'float';
  return <div aria-hidden style={{ width: size, height: size,
    opacity: interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' }),
    translate: motion === 'float' ? `0 ${Math.sin(time * 1.7) * size * 0.025}px` : undefined,
    scale: motion === 'pulse' ? 1 + Math.sin(time * 2) * 0.035 : 1,
    rotate: motion === 'rotate' ? `${time * 12}deg` : undefined,
    clipPath: motion === 'reveal' ? `inset(0 ${interpolate(frame, [0, fps], [100, 0], { extrapolateRight: 'clamp' })}% 0 0)` : undefined,
  }} dangerouslySetInnerHTML={{ __html: svg }} />;
};
