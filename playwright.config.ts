import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // SwiftShader draws a dressed room at about a frame a second, and the workers run in parallel on
  // one machine: the heavy tests here spend a minute on the preloader before they test anything.
  timeout: 180_000,
  // SwiftShader under load occasionally drops a browser context right after a heavy WebGL test.
  // One retry clears that without masking a real failure, which fails again on the retry too.
  retries: process.env.CI ? 2 : 1,
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4321',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
});
