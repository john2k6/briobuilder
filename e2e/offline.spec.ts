import { expect, test } from "@playwright/test";

const code = encodeURIComponent("eight-crossing:Xrrrrrr@1.3cccccc");

test("un circuit déjà ouvert se rouvre sans réseau (PWA)", async ({ page, context }) => {
  await page.goto(`/fr/circuit?c=${code}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Le huit");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Le huit");

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Le huit");
  await page.getByRole("link", { name: "On construit !" }).click();
  await expect(page.getByText("Étape 1 sur 13")).toBeVisible();
  await context.setOffline(false);
});

test("le manifeste de l'application est servi", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});
