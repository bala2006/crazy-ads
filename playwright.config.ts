import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const remotionChrome = path.resolve(
  'node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell',
);
const chrome = process.env.CHROME_PATH || (fs.existsSync(remotionChrome) ? remotionChrome : undefined);
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: chrome },
  },
  webServer: {
    command: 'node --import tsx server/index.ts --prod',
    url: 'http://127.0.0.1:3101/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: '3101',
      STUDIO_PASSWORD: 'e2e-private-workspace-password',
      DATA_DIR: path.resolve('.data-e2e'),
      NODE_ENV: 'test',
      ...(chrome ? { CHROME_PATH: chrome } : {}),
    },
  },
});
