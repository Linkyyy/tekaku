import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', use: { baseURL: 'http://127.0.0.1:5173', launchOptions: process.env.TEKAKU_CHROMIUM ? { executablePath: process.env.TEKAKU_CHROMIUM } : {} }, webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI }, workers: 1, timeout: 60000 });
