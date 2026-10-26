// Fonts are bundled from npm (@fontsource), not fetched at render time, so a
// render works on an air-gapped machine and never hangs on a slow CDN.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import { continueRender, delayRender } from 'remotion';
import type { FontKey } from './skills';

const FAMS: Record<FontKey, string> = {
  inter: 'Inter',
  grotesk: 'Space Grotesk',
  bebas: 'Bebas Neue',
  playfair: 'Playfair Display',
  mono: 'IBM Plex Mono',
};

const FALLBACK: Record<FontKey, string> = {
  inter: 'system-ui, -apple-system, Segoe UI, sans-serif',
  grotesk: 'system-ui, -apple-system, Segoe UI, sans-serif',
  bebas: '"Arial Narrow", Impact, system-ui, sans-serif',
  playfair: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

export const fontFamily = (key: FontKey) => `${FAMS[key]}, ${FALLBACK[key]}`;

/** Every family/weight the skills actually use. */
const REQUIRED: [FontKey, string][] = [
  ['inter', '400'],
  ['inter', '500'],
  ['inter', '600'],
  ['inter', '700'],
  ['inter', '800'],
  ['grotesk', '400'],
  ['grotesk', '500'],
  ['grotesk', '600'],
  ['grotesk', '700'],
  ['bebas', '400'],
  ['playfair', '400'],
  ['playfair', '500'],
  ['playfair', '600'],
  ['mono', '400'],
  ['mono', '500'],
  ['mono', '600'],
];

let startPromise: Promise<void> | null = null;

/**
 * `@font-face` alone is not enough: a render can capture a frame before the
 * browser has downloaded the glyphs, and on a machine with no system fonts
 * that means invisible text. Register a delayRender handle and force-load
 * every face before the first frame is captured.
 */
export const fontsReady = (): Promise<void> => {
  if (startPromise) return startPromise;
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();

  const handle = delayRender('Loading MotionForge fonts');
  startPromise = Promise.all(
    REQUIRED.map(([key, weight]) => document.fonts.load(`${weight} 32px "${FAMS[key]}"`).catch(() => undefined)),
  )
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
  return startPromise;
};

// Kick off with the module so fonts are already in flight when the first frame paints.
fontsReady();
