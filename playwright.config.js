import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 180_000,
  fullyParallel: true,
  forbidOnly: CI,
  // el juego es determinista con ?seed, así que un fallo es un fallo real: sin reintentos
  retries: 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    hasTouch: true,
    // también desactiva las animaciones infinitas de la UI, que impedirían hacer clic de forma estable
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx http-server -p 4173 -c-1 -s .',
    url: 'http://localhost:4173',
    reuseExistingServer: !CI,
  },
});
