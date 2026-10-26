import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Skill } from './skills';

const noiseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>`;
const NOISE_URI = `url("data:image/svg+xml;utf8,${encodeURIComponent(noiseSvg)}")`;

const Grain: React.FC<{ amount: number; opacity?: number }> = ({ amount, opacity = 1 }) =>
  amount <= 0 ? null : (
    <AbsoluteFill
      style={{
        backgroundImage: NOISE_URI,
        backgroundSize: '180px 180px',
        opacity: amount * 0.55 * opacity,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );

/**
 * The backdrop is the single biggest differentiator between skills: same
 * layout, same copy, but a grid-locked paper page reads nothing like a
 * scanline-lit void.
 */
export const Backdrop: React.FC<{ skill: Skill }> = ({ skill }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1000;
  const p = skill.palette;
  const drift = Math.sin(frame / 52);
  const drift2 = Math.cos(frame / 74);

  const shellStyle: React.CSSProperties = { background: `linear-gradient(165deg, ${p.bg} 0%, ${p.bg2} 100%)` };

  return (
    <AbsoluteFill style={shellStyle}>
      {skill.bgId === 'grid' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, ${p.line} 0 1px, transparent 1px ${u * 92}px), repeating-linear-gradient(90deg, ${p.line} 0 1px, transparent 1px ${u * 92}px)`,
              opacity: 0.55,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${46 + drift * 3}%`,
              top: `${7 + drift2 * 2}%`,
              width: u * 360,
              height: u * 360,
              borderRadius: '50%',
              border: `${u * 2.6}px solid ${p.accent}`,
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: `-${u * 60}px`,
              bottom: `-${u * 60}px`,
              width: u * 300,
              height: u * 300,
              background: p.accent2,
              opacity: 0.12,
              transform: `rotate(${18 + drift * 3}deg)`,
            }}
          />
          <div style={{ position: 'absolute', left: u * 74, top: 0, bottom: 0, width: u * 2, background: p.accent, opacity: 0.35 }} />
        </>
      )}

      {skill.bgId === 'scanlines' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, ${p.line} 0 2px, transparent 2px ${u * 8}px)`,
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${-10 + drift * 8}%`,
              top: `${-15 + drift2 * 6}%`,
              width: u * 800,
              height: u * 800,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${p.accent}44 0%, transparent 62%)`,
              filter: `blur(${u * 30}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: `${-15 - drift * 6}%`,
              bottom: `${-20 + drift * 5}%`,
              width: u * 760,
              height: u * 760,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${p.accent2}3d 0%, transparent 60%)`,
              filter: `blur(${u * 30}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${((frame * 3) % (height + u * 300)) - u * 150}px`,
              height: u * 150,
              background: `linear-gradient(180deg, transparent, ${p.accent2}14, transparent)`,
            }}
          />
        </>
      )}

      {skill.bgId === 'paper' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: `${-6 + drift * 2}%`,
              top: `${-8 + drift2 * 2}%`,
              width: u * 520,
              height: u * 480,
              background: p.accent2,
              opacity: 0.22,
              borderRadius: '52% 48% 62% 38%',
              transform: `rotate(${-8 + drift * 2}deg)`,
              filter: `blur(${u * 2}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: `${-8 - drift * 2}%`,
              bottom: `${-10 + drift2 * 3}%`,
              width: u * 600,
              height: u * 520,
              background: p.accent,
              opacity: 0.18,
              borderRadius: '40% 60% 45% 55%',
              transform: `rotate(${12 - drift * 3}deg)`,
              filter: `blur(${u * 2}px)`,
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, ${p.line} 0 1px, transparent 1px ${u * 10}px)`,
              opacity: 0.25,
            }}
          />
        </>
      )}

      {skill.bgId === 'mesh' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: `${5 + drift * 7}%`,
              top: `${-20 + drift2 * 6}%`,
              width: u * 900,
              height: u * 900,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${p.accent}66 0%, transparent 58%)`,
              filter: `blur(${u * 26}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: `${-10 - drift2 * 7}%`,
              bottom: `${-25 + drift * 5}%`,
              width: u * 820,
              height: u * 820,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${p.accent2}59 0%, transparent 56%)`,
              filter: `blur(${u * 30}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${35 + drift * 5}%`,
              bottom: `${5 + drift2 * 4}%`,
              width: u * 500,
              height: u * 500,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ff4fa344 0%, transparent 60%)',
              filter: `blur(${u * 30}px)`,
            }}
          />
        </>
      )}

      {skill.bgId === 'sunset' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: '72%',
              top: '60%',
              width: u * 640,
              height: u * 640,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${p.accent2} 0%, ${p.accent}cc 38%, transparent 68%)`,
              opacity: 0.75,
              filter: `blur(${u * 4}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '72%',
              top: '60%',
              width: u * 640,
              height: u * 640,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              overflow: 'hidden',
              opacity: 0.4,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `repeating-linear-gradient(0deg, ${p.bg} 0 ${u * 22}px, transparent ${u * 22}px ${u * 44}px)`,
              }}
            />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '66%', height: u * 2, background: p.accent2, opacity: 0.7 }} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '66%',
              bottom: 0,
              backgroundImage: `repeating-linear-gradient(0deg, ${p.accent} 0 2px, transparent 2px ${u * 70}px), repeating-linear-gradient(90deg, ${p.line} 0 2px, transparent 2px ${u * 90}px)`,
              transform: 'perspective(700px) rotateX(62deg)',
              transformOrigin: 'top center',
              opacity: 0.85,
              maskImage: 'linear-gradient(180deg, black 0%, rgba(0,0,0,0.15) 85%)',
            }}
          />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.bg} 0%, ${p.bg}66 14%, transparent 52%)` }} />
        </>
      )}

      {skill.bgId === 'orbit' && (
        <>
          <div
            style={{
              position: 'absolute',
              right: `-${u * 120}px`,
              top: `-${u * 120}px`,
              width: u * 900,
              height: u * 900,
              borderRadius: '50%',
              border: `${u * 1.5}px solid ${p.line}`,
              transform: `scale(${1 + drift * 0.02})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: `-${u * 40}px`,
              top: `-${u * 40}px`,
              width: u * 700,
              height: u * 700,
              borderRadius: '50%',
              border: `${u * 1.5}px dashed ${p.accent}44`,
              transform: `rotate(${frame * 0.25}deg)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `-${u * 100}px`,
              bottom: `-${u * 200}px`,
              width: u * 620,
              height: u * 620,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${p.accent}2e 0%, transparent 62%)`,
              filter: `blur(${u * 24}px)`,
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, ${p.line} 0 1px, transparent 1px ${u * 120}px)`,
              opacity: 0.4,
            }}
          />
        </>
      )}

      {skill.bgId === 'blocks' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: `-${u * 40}px`,
              top: `${-6 + drift * 3}%`,
              width: `${38 + drift * 2}%`,
              height: `${28 + drift2 * 2}%`,
              background: p.accent,
              opacity: 0.16,
              transform: `rotate(${-6 + drift * 2}deg)`,
              borderRadius: u * 8,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: `-${u * 30}px`,
              bottom: `-${u * 20}px`,
              width: `${34 + drift2 * 3}%`,
              height: `${26 + drift * 2}%`,
              background: p.accent2,
              opacity: 0.14,
              transform: `rotate(${8 + drift2 * 2}deg)`,
              borderRadius: u * 8,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '12%',
              top: '14%',
              width: u * 110,
              height: u * 110,
              background: p.accent,
              opacity: 0.9,
              transform: `rotate(${12 + frame * 0.3}deg)`,
              borderRadius: u * 6,
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(${p.line} 1px, transparent 1px)`,
              backgroundSize: `${u * 26}px ${u * 26}px`,
              opacity: 0.55,
            }}
          />
        </>
      )}

      {skill.bgId === 'plain' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: u * 1100,
              height: u * 1100,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${p.accent}1f 0%, transparent 58%)`,
              filter: `blur(${u * 20}px)`,
            }}
          />
          <AbsoluteFill
            style={{
              inset: u * 40,
              border: `${u * 1}px solid ${p.line}`,
            }}
          />
        </>
      )}

      {/* soft vignette keeps the eye on the type */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 45%, transparent 40%, ${p.bg}aa 100%)`,
          opacity: 0.9,
        }}
      />
      <Grain amount={skill.grain} />
    </AbsoluteFill>
  );
};
