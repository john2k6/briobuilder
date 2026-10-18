import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:3200",
    ...devices["iPad (gen 7) landscape"],
    browserName: "chromium",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  webServer: {
    command: "npm run build && npx next start -p 3200",
    url: "http://localhost:3200/fr",
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
