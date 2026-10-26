import path from 'node:path';
import { bundle } from '@remotion/bundler';

/**
 * CI smoke test: builds the Remotion webpack bundle (no browser needed) so a
 * broken composition entry, a bad import or a missing asset fails the pipeline
 * instead of the first time somebody renders.
 */
const startedAt = Date.now();

try {
  const serveUrl = await bundle({
    entryPoint: path.resolve('src/remotion/index.ts'),
    publicDir: path.resolve('public'),
    outDir: path.resolve('render-bundle'),
    onProgress: () => undefined,
  });
  if (!serveUrl) throw new Error('bundler returned no serve URL');
  console.log(`✔ Remotion bundle ready in ${((Date.now() - startedAt) / 1000).toFixed(1)}s → ${serveUrl}`);
} catch (error) {
  console.error('✖ Remotion bundle failed:', error);
  process.exit(1);
}
