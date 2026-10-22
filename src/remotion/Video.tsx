import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop } from './Backdrop';
import { SceneCtx } from './context';
import { exitStyle } from './anim';
import { fontFamily } from './fonts';
import { LAYOUT_COMPONENTS } from './layouts';
import { getSkill, type Skill } from './skills';
import { sceneFrames, type Scene, type Storyboard } from './types';

/** Audio paths are relative in the app and absolute during server renders. */
const audioSrc = (source: string) => (/^https?:\/\//.test(source) ? source : staticFile(source));

const SceneFrame: React.FC<{
  scene: Scene;
  skill: Skill;
  index: number;
  count: number;
  title: string;
  durationInFrames: number;
}> = ({ scene, skill, index, count, title, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1000;
  const accent = scene.accent ?? skill.palette.accent;
  const Layout = LAYOUT_COMPONENTS[scene.layout] ?? LAYOUT_COMPONENTS.hero;
  const exit = exitStyle(frame, durationInFrames, skill.motion.exit, scene.transition);

  return (
    <SceneCtx.Provider value={{ scene, skill, unit, accent, frame, durationInFrames, index, count, width, height }}>
      <AbsoluteFill style={exit}>
        <Backdrop skill={skill} />
        <AbsoluteFill
          style={{
            padding: `${height * 0.085}px ${width * 0.075}px ${height * 0.06}px`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Layout />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: fontFamily(skill.fonts.body),
              fontSize: unit * 16,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: skill.palette.muted,
              opacity: 0.8,
              paddingTop: unit * 18,
              borderTop: `${unit * 1}px solid ${skill.palette.line}`,
            }}
          >
            <span style={{ maxWidth: '70%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{title}</span>
            <span>
              {String(index + 1).padStart(2, '0')}/{String(count).padStart(2, '0')}
            </span>
          </div>
        </AbsoluteFill>
        {scene.audio ? <Audio src={audioSrc(scene.audio)} /> : null}
      </AbsoluteFill>
    </SceneCtx.Provider>
  );
};

/**
 * The single composition. Everything visual comes from `storyboard` props, so
 * the renderer only ever needs JSON — no generated code, no rebuild.
 */
export const MotionGraphic: React.FC<{ storyboard: Storyboard }> = ({ storyboard }) => {
  const { fps } = useVideoConfig();
  const skill = getSkill(storyboard.skill);
  const title = storyboard.title || 'Untitled';
  const total = storyboard.scenes.length;

  let cursor = 0;
  return (
    <AbsoluteFill style={{ background: skill.palette.bg }}>
      {storyboard.scenes.map((scene, index) => {
        const durationInFrames = sceneFrames(scene, fps);
        const from = cursor;
        cursor += durationInFrames;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationInFrames} name={`${index + 1}. ${scene.headline.slice(0, 30)}`}>
            <SceneFrame scene={scene} skill={skill} index={index} count={total} title={title} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
