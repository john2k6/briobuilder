import { expect, test } from "@playwright/test";

test("un circuit déjà ouvert se rouvre sans réseau (PWA)", async ({ page, context }) => {
  await page.goto("/fr/circuits/figure-eight");
  await expect(page.getByRole("heading", { name: "Le huit" })).toBeVisible();
  // Attendre que le service worker contrôle la page, puis recharger pour remplir le cache.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Le huit" })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Le huit" })).toBeVisible();
  await page.getByRole("link", { name: "On construit !" }).click();
  await expect(page.getByText("Étape 1 sur 17")).toBeVisible();
  await context.setOffline(false);
});

test("le manifeste de l'application est servi", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});
