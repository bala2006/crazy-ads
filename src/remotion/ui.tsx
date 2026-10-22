import React, { type CSSProperties, type ReactNode } from 'react';
import { progress, enterStyle } from './anim';
import { useSceneCtx } from './context';
import { fontFamily } from './fonts';
import type { Skill } from './skills';

/** Wraps children in the skill's entry animation, offset by `delay` frames. */
export const Enter: React.FC<{
  delay?: number;
  duration?: number;
  children: ReactNode;
  style?: CSSProperties;
}> = ({ delay = 0, duration = 18, children, style }) => {
  const { frame, skill, unit } = useSceneCtx();
  const q = progress(frame, delay, duration, skill.motion.ease);
  return <div style={{ ...enterStyle(skill.motion.enter, q, unit), ...style }}>{children}</div>;
};

/** Shrinks the type as the copy gets longer, so nothing ever overflows. */
export const fitHeading = (text: string, base: number, scale = 1) => {
  const len = text.replace(/\s+/g, ' ').trim().length;
  const factor = len <= 12 ? 1 : len <= 22 ? 0.86 : len <= 36 ? 0.7 : len <= 60 ? 0.56 : len <= 92 ? 0.46 : 0.38;
  return base * factor * scale;
};

export const Kicker: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { skill, unit } = useSceneCtx();
  return (
    <div
      style={{
        fontFamily: fontFamily(skill.fonts.body),
        fontSize: unit * 19,
        letterSpacing: `${skill.type.kickerTracking}em`,
        textTransform: 'uppercase',
        fontWeight: 600,
        color: skill.palette.muted,
        display: 'flex',
        alignItems: 'center',
        gap: unit * 12,
      }}
    >
      <span style={{ width: unit * 34, height: unit * 2, background: skill.palette.accent, display: 'inline-block' }} />
      {children}
    </div>
  );
};

/** Shared heading typography so `<Heading>` and kinetic-type layouts match. */
export const headingType = (
  skill: Skill,
  size: number,
  align: 'left' | 'center' = 'left',
  italic = false,
): CSSProperties => ({
  fontFamily: fontFamily(skill.fonts.heading),
  fontSize: size,
  fontWeight: skill.type.headingWeight,
  lineHeight: skill.type.headingLineHeight,
  letterSpacing: `${skill.type.headingTracking}em`,
  textTransform: skill.type.uppercase ? 'uppercase' : 'none',
  color: skill.palette.fg,
  textAlign: align,
  textWrap: 'balance',
  fontStyle: italic ? 'italic' : 'normal',
  marginLeft: align === 'center' ? 'auto' : undefined,
  marginRight: align === 'center' ? 'auto' : undefined,
});

export const Heading: React.FC<{
  children: ReactNode;
  size: number;
  color?: string;
  align?: 'left' | 'center';
  maxWidth?: number;
  italic?: boolean;
}> = ({ children, size, color, align = 'left', maxWidth, italic }) => {
  const { skill } = useSceneCtx();
  return <div style={{ ...headingType(skill, size, align, italic), color: color ?? skill.palette.fg, maxWidth }}>{children}</div>;
};

export const Sub: React.FC<{ children: ReactNode; maxWidth?: number; align?: 'left' | 'center' }> = ({
  children,
  maxWidth,
  align = 'left',
}) => {
  const { skill, unit } = useSceneCtx();
  return (
    <div
      style={{
        fontFamily: fontFamily(skill.fonts.body),
        fontSize: unit * 31,
        lineHeight: 1.42,
        color: skill.palette.muted,
        maxWidth,
        textAlign: align,
        marginLeft: align === 'center' ? 'auto' : undefined,
        marginRight: align === 'center' ? 'auto' : undefined,
        textWrap: 'pretty',
      }}
    >
      {children}
    </div>
  );
};

export const Rule: React.FC<{ width: number; color?: string; thickness?: number }> = ({ width, color, thickness }) => {
  const { frame, skill, unit } = useSceneCtx();
  const q = progress(frame, 6, 24, 'smooth');
  return (
    <div
      style={{
        width: width * q,
        height: thickness ?? unit * 4,
        background: color ?? skill.palette.accent,
        borderRadius: unit * 2,
      }}
    />
  );
};

/** Word-by-word mask reveal — the workhorse of kinetic typography. */
export const Words: React.FC<{ text: string; delay?: number; step?: number; style?: CSSProperties }> = ({
  text,
  delay = 0,
  step = 2.4,
  style,
}) => {
  const { frame, skill } = useSceneCtx();
  const lines = text.split('\n');
  return (
    <div style={style}>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} style={{ display: 'block' }}>
          {line.split(/\s+/).map((word, wordIndex) => {
            const offset = delay + (lineIndex * 6 + wordIndex) * step;
            const q = progress(frame, offset, 14, skill.motion.ease);
            return (
              <span key={wordIndex} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.06em' }}>
                <span
                  style={{
                    display: 'inline-block',
                    transform: `translateY(${(1 - q) * 105}%)`,
                    opacity: Math.min(1, q * 2.2),
                    marginRight: '0.24em',
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
