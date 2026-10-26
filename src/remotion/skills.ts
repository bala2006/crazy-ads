import type { SkillId } from './types';

/**
 * A "skill" is a complete art direction: palette, typography, background
 * treatment and a motion grammar (what enters, how fast, how it eases).
 * Picking a skill re-themes every scene of a video, and its `voice` line also
 * steers the AI's copy tone — a `bold-pop` script reads differently from a
 * `mono-luxe` one.
 */

export type FontKey = 'inter' | 'grotesk' | 'bebas' | 'playfair' | 'mono';
export type BgId = 'grid' | 'scanlines' | 'paper' | 'mesh' | 'sunset' | 'plain' | 'blocks' | 'orbit';
export type EnterId = 'fadeUp' | 'clipUp' | 'slideRight' | 'pop' | 'blurIn' | 'scaleIn';
export type EaseId = 'smooth' | 'snappy' | 'bouncy' | 'linear';

export type Palette = {
  bg: string;
  bg2: string;
  surface: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  line: string;
};

export type Skill = {
  id: SkillId;
  name: string;
  blurb: string;
  tags: string[];
  /** Art-direction note injected into the AI prompt. */
  voice: string;
  bgId: BgId;
  palette: Palette;
  fonts: { heading: FontKey; body: FontKey };
  type: {
    uppercase: boolean;
    headingWeight: number;
    headingScale: number;
    headingTracking: number;
    headingLineHeight: number;
    kickerTracking: number;
  };
  motion: { enter: EnterId; ease: EaseId; stagger: number; exit: number };
  shape: { radius: number; border: number };
  /** 0–1 film grain, 0–1 accent bloom */
  grain: number;
  glow: number;
  swatches: string[];
};

export const SKILLS: Skill[] = [
  {
    id: 'swiss-editorial',
    name: 'Swiss Editorial',
    blurb: 'Grid-locked type, paper white, one screaming red accent. Hard, confident cuts.',
    tags: ['editorial', 'grid', 'type-led'],
    voice:
      'Confident magazine editor. Short declarative sentences, numbers over adjectives, no hype words. Headlines can be 2–6 words.',
    bgId: 'grid',
    palette: {
      bg: '#f2efe6',
      bg2: '#e5e0d3',
      surface: '#fffdf7',
      fg: '#111110',
      muted: '#6d675b',
      accent: '#e2231a',
      accent2: '#12408c',
      line: 'rgba(17,17,16,0.16)',
    },
    fonts: { heading: 'inter', body: 'inter' },
    type: {
      uppercase: true,
      headingWeight: 800,
      headingScale: 1,
      headingTracking: -0.035,
      headingLineHeight: 0.94,
      kickerTracking: 0.28,
    },
    motion: { enter: 'clipUp', ease: 'smooth', stagger: 4, exit: 8 },
    shape: { radius: 4, border: 2 },
    grain: 0.1,
    glow: 0,
    swatches: ['#f2efe6', '#111110', '#e2231a', '#12408c'],
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    blurb: 'Near-black void, magenta and cyan bloom, scanlines. Built for launches.',
    tags: ['tech', 'glow', 'dark'],
    voice:
      'Futuristic product voice. Punchy fragments, tech nouns, a touch of swagger. Think terminal readouts and launch trailers.',
    bgId: 'scanlines',
    palette: {
      bg: '#05060c',
      bg2: '#0a1020',
      surface: '#101728',
      fg: '#eaf6ff',
      muted: '#7d8fb8',
      accent: '#ff2bd6',
      accent2: '#22e6ff',
      line: 'rgba(120,220,255,0.18)',
    },
    fonts: { heading: 'grotesk', body: 'mono' },
    type: {
      uppercase: true,
      headingWeight: 700,
      headingScale: 1.02,
      headingTracking: -0.02,
      headingLineHeight: 0.98,
      kickerTracking: 0.36,
    },
    motion: { enter: 'pop', ease: 'snappy', stagger: 3, exit: 7 },
    shape: { radius: 14, border: 1 },
    grain: 0.06,
    glow: 0.85,
    swatches: ['#05060c', '#ff2bd6', '#22e6ff', '#eaf6ff'],
  },
  {
    id: 'paper-craft',
    name: 'Paper Craft',
    blurb: 'Warm cut-paper shapes, soft shadows, springy reveals. Friendly and human.',
    tags: ['warm', 'illustrated', 'friendly'],
    voice:
      'Warm and human, like a well-made explainer. Plain words, second person, short sentences. Small concrete details.',
    bgId: 'paper',
    palette: {
      bg: '#fbf1e2',
      bg2: '#f2dcc0',
      surface: '#fffaf0',
      fg: '#2b2118',
      muted: '#8a7461',
      accent: '#e0663c',
      accent2: '#3f7d6a',
      line: 'rgba(43,33,24,0.14)',
    },
    fonts: { heading: 'bebas', body: 'inter' },
    type: {
      uppercase: true,
      headingWeight: 400,
      headingScale: 1.16,
      headingTracking: 0.01,
      headingLineHeight: 0.98,
      kickerTracking: 0.24,
    },
    motion: { enter: 'pop', ease: 'bouncy', stagger: 5, exit: 9 },
    shape: { radius: 26, border: 3 },
    grain: 0.14,
    glow: 0,
    swatches: ['#fbf1e2', '#e0663c', '#3f7d6a', '#2b2118'],
  },
  {
    id: 'glass-aurora',
    name: 'Glass Aurora',
    blurb: 'Frosted panels floating over a slow violet mesh. Calm, premium, SaaS.',
    tags: ['premium', 'soft', 'gradient'],
    voice:
      'Calm premium brand voice. Measured, benefit-first, no exclamation marks. Sentences may be slightly longer and rhythmic.',
    bgId: 'mesh',
    palette: {
      bg: '#070b16',
      bg2: '#141c31',
      surface: 'rgba(255,255,255,0.07)',
      fg: '#f3f7ff',
      muted: '#9eb0d2',
      accent: '#7c5cff',
      accent2: '#2dd4bf',
      line: 'rgba(255,255,255,0.16)',
    },
    fonts: { heading: 'grotesk', body: 'inter' },
    type: {
      uppercase: false,
      headingWeight: 600,
      headingScale: 0.98,
      headingTracking: -0.025,
      headingLineHeight: 1.02,
      kickerTracking: 0.22,
    },
    motion: { enter: 'blurIn', ease: 'smooth', stagger: 6, exit: 10 },
    shape: { radius: 30, border: 1 },
    grain: 0.05,
    glow: 0.5,
    swatches: ['#070b16', '#7c5cff', '#2dd4bf', '#f3f7ff'],
  },
  {
    id: 'retro-future',
    name: 'Retro Future',
    blurb: 'Sunset horizon, perspective grid, chrome display type. Pure 1985 VHS.',
    tags: ['retro', 'neon', 'playful'],
    voice:
      'Retro trailer voice. Big promises, short bursts, exclamation-friendly. Wordplay allowed, 80s energy.',
    bgId: 'sunset',
    palette: {
      bg: '#150321',
      bg2: '#2b0740',
      surface: 'rgba(255,255,255,0.07)',
      fg: '#ffeaf9',
      muted: '#bd93cc',
      accent: '#ff6ac1',
      accent2: '#ffd166',
      line: 'rgba(255,255,255,0.18)',
    },
    fonts: { heading: 'bebas', body: 'mono' },
    type: {
      uppercase: true,
      headingWeight: 400,
      headingScale: 1.2,
      headingTracking: 0.02,
      headingLineHeight: 0.95,
      kickerTracking: 0.34,
    },
    motion: { enter: 'scaleIn', ease: 'snappy', stagger: 4, exit: 8 },
    shape: { radius: 10, border: 2 },
    grain: 0.12,
    glow: 0.9,
    swatches: ['#150321', '#ff6ac1', '#ffd166', '#ffeaf9'],
  },
  {
    id: 'mono-luxe',
    name: 'Mono Luxe',
    blurb: 'Ivory serif on charcoal, wide airy tracking, very slow fades. Watch-brand calm.',
    tags: ['luxury', 'serif', 'minimal'],
    voice:
      'Understated luxury. Few words, no brag, quiet precision. Headlines of 2–5 words; let the sub carry the detail.',
    bgId: 'plain',
    palette: {
      bg: '#0f0e0c',
      bg2: '#191712',
      surface: '#1b1915',
      fg: '#f4efe2',
      muted: '#9a9184',
      accent: '#c9a227',
      accent2: '#dcd3bf',
      line: 'rgba(244,239,226,0.16)',
    },
    fonts: { heading: 'playfair', body: 'inter' },
    type: {
      uppercase: false,
      headingWeight: 400,
      headingScale: 1.04,
      headingTracking: -0.01,
      headingLineHeight: 1.06,
      kickerTracking: 0.4,
    },
    motion: { enter: 'fadeUp', ease: 'smooth', stagger: 8, exit: 14 },
    shape: { radius: 2, border: 1 },
    grain: 0.08,
    glow: 0.25,
    swatches: ['#0f0e0c', '#c9a227', '#f4efe2', '#9a9184'],
  },
  {
    id: 'data-dash',
    name: 'Data Dash',
    blurb: 'Slate dashboards, ticking counters, animated bars and mono labels. Decks in motion.',
    tags: ['product', 'charts', 'b2b'],
    voice:
      'Analyst who respects the audience. Lead with the metric, then the implication. Precise, zero fluff.',
    bgId: 'orbit',
    palette: {
      bg: '#0b1118',
      bg2: '#101b26',
      surface: '#152232',
      fg: '#e9f2f8',
      muted: '#8096a9',
      accent: '#34d399',
      accent2: '#60a5fa',
      line: 'rgba(255,255,255,0.12)',
    },
    fonts: { heading: 'inter', body: 'mono' },
    type: {
      uppercase: false,
      headingWeight: 700,
      headingScale: 0.96,
      headingTracking: -0.03,
      headingLineHeight: 1,
      kickerTracking: 0.26,
    },
    motion: { enter: 'slideRight', ease: 'snappy', stagger: 3, exit: 7 },
    shape: { radius: 8, border: 1 },
    grain: 0.04,
    glow: 0.35,
    swatches: ['#0b1118', '#34d399', '#60a5fa', '#e9f2f8'],
  },
  {
    id: 'bold-pop',
    name: 'Bold Pop',
    blurb: 'Cream paper, fat blocks of ink and primary colour, overshoot springs. Loud.',
    tags: ['loud', 'social', 'playful'],
    voice:
      'Hook-first social copy. Very short lines, second person, one idea per scene, no filler. Headlines max 4 words.',
    bgId: 'blocks',
    palette: {
      bg: '#fdf6e9',
      bg2: '#ffe9c9',
      surface: '#fffdf6',
      fg: '#0b0b0f',
      muted: '#6b6355',
      accent: '#ff3d1f',
      accent2: '#2f5bff',
      line: 'rgba(11,11,15,0.16)',
    },
    fonts: { heading: 'bebas', body: 'inter' },
    type: {
      uppercase: true,
      headingWeight: 400,
      headingScale: 1.22,
      headingTracking: 0.005,
      headingLineHeight: 0.86,
      kickerTracking: 0.2,
    },
    motion: { enter: 'pop', ease: 'bouncy', stagger: 4, exit: 8 },
    shape: { radius: 18, border: 3 },
    grain: 0.16,
    glow: 0.15,
    swatches: ['#fdf6e9', '#ff3d1f', '#2f5bff', '#0b0b0f'],
  },
];

const byId = new Map(SKILLS.map((skill) => [skill.id, skill]));

export const getSkill = (id: SkillId): Skill => byId.get(id) ?? SKILLS[0]!;
