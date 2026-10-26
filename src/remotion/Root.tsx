import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { MotionGraphic } from './Video';
import { DEMO_STORYBOARD } from './demo';
import { ASPECT_SIZE, storyboardFrames, type Storyboard } from './types';

type Props = { storyboard: Storyboard };

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const storyboard = props.storyboard ?? DEMO_STORYBOARD;
  const { width, height } = ASPECT_SIZE[storyboard.aspect] ?? ASPECT_SIZE['16:9'];
  return {
    durationInFrames: Math.max(1, storyboardFrames(storyboard)),
    fps: storyboard.fps,
    width,
    height,
    props: { storyboard },
  };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MotionGraphic"
    component={MotionGraphic}
    defaultProps={{ storyboard: DEMO_STORYBOARD }}
    calculateMetadata={calculateMetadata}
    durationInFrames={storyboardFrames(DEMO_STORYBOARD)}
    fps={DEMO_STORYBOARD.fps}
    width={ASPECT_SIZE[DEMO_STORYBOARD.aspect].width}
    height={ASPECT_SIZE[DEMO_STORYBOARD.aspect].height}
  />
);
