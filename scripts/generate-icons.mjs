// Génère les icônes PNG de l'application à partir de src/app/icon.svg.
// Lancer : node scripts/generate-icons.mjs (nécessite Playwright et Chromium).
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("../src/app/icon.svg", import.meta.url), "utf8");
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
);
const page = await browser.newPage();

const render = async (size, name, padding = 0) => {
  await page.setViewportSize({ width: size, height: size });
  // Icône « maskable » : marge de sécurité, fond plein.
  const inner = size - padding * 2;
  await page.setContent(
    `<body style="margin:0;background:#d2232a;display:grid;place-items:center;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body>`,
  );
  await page.screenshot({ path: out(name) });
};

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(512, "icon-maskable-512.png", 80);
await render(180, "apple-touch-icon.png");
await browser.close();
console.log("Icônes écrites dans public/icons/");
