import { ensureBrowser } from '@remotion/renderer';
const browser = await ensureBrowser({ browserExecutable: process.env.CHROME_PATH || undefined });
if (browser.type === 'no-browser') throw new Error('Chrome is unavailable.');
console.log(`Render browser ready: ${'path' in browser ? browser.path : browser.type}`);
