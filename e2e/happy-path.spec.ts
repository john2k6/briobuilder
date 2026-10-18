import { expect, test, type Page } from "@playwright/test";

const shots = process.env.SHOTS_DIR;
const snap = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};

test("parcours principal : profil, coffrets, générateur, construction, badge", async ({ page }) => {
  // 1. Profil enfant
  await page.goto("/fr/kids");
  await page.getByRole("button", { name: "Ajouter un enfant" }).click();
  await page.getByLabel("Surnom").fill("Lou");
  await page.getByText("5–6 ans").click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("heading", { name: "Lou" })).toBeVisible();

  // 2. Coffrets : deux boîtes réelles, mélangées
  await page.goto("/fr/box");
  await page.getByPlaceholder("Rechercher un coffret").fill("33512");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Circuit Plateforme Voyageurs ajouté")).toBeVisible();
  await page.getByPlaceholder("Rechercher un coffret").fill("33815");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("2 coffrets · 30 rails")).toBeVisible();
  await page.getByRole("button", { name: "Annuler la dernière action" }).click();
  await expect(page.getByText("1 coffret · 19 rails")).toBeVisible();
  await page.getByPlaceholder("Rechercher un coffret").fill("33815");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await snap(page, "1-box");

  // 3. Générateur : un circuit avec un pont
  await page.getByRole("link", { name: "Créer un circuit" }).last().click();
  await expect(page.getByText("Chaque circuit a été vérifié par le moteur.")).toBeVisible();
  await page.getByRole("button", { name: "Un pont" }).click();
  await expect(page.getByText("Chaque circuit a été vérifié par le moteur.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /La grande montée/ }).first()).toBeVisible();
  await snap(page, "2-generator");
  await page.getByRole("tab", { name: /pièces en plus/ }).click();
  await expect(page.getByText("Il manque").first()).toBeVisible();
  await page.getByRole("tab", { name: /Je peux le construire/ }).click();

  // 4. Fiche du circuit
  await page
    .getByRole("link", { name: /La grande montée/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("La grande montée");
  await expect(page.getByText("Pilier")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter aux favoris" }).click();
  await snap(page, "3-circuit");

  // 5. Construction pas à pas (mode enfant)
  await page.getByRole("link", { name: "On construit !" }).click();
  await expect(page.getByText(/Étape 1 sur \d+/)).toBeVisible();
  const total = Number((await page.getByText(/Étape 1 sur \d+/).textContent())!.match(/sur (\d+)/)![1]);
  for (let i = 1; i < total; i++) await page.getByRole("button", { name: "Suivant" }).click();
  await snap(page, "4-build");
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("Bravo !")).toBeVisible();
  await page.getByRole("button", { name: /Je l'ai construit/ }).click();
  await expect(page.getByText("Nouveau badge !")).toBeVisible();
  await snap(page, "5-done");

  // 6. Badge sur le profil, données gardées après rechargement, puis suppression
  await page.goto("/fr/kids");
  await expect(page.getByText("1 circuit construit")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 circuit construit")).toBeVisible();
  await page.goto("/fr/settings");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Tout supprimer" }).click();
  await expect(page.getByText("Toutes les données ont été supprimées.")).toBeVisible();
  await page.goto("/fr/circuits");
  await expect(page.getByText("Votre caisse est vide")).toBeVisible();
});

test("la version anglaise affiche les mêmes écrans", async ({ page }) => {
  await page.goto("/en/box");
  await page.getByPlaceholder("Search for a set").fill("33815");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("1 set · 11 tracks")).toBeVisible();
  await page.goto("/en/circuits");
  await expect(page.getByText("Every layout has been checked by the engine.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /The big wander/ }).first()).toBeVisible();
  await snap(page, "6-en-generator");
});

test("un code de circuit invalide affiche un message clair", async ({ page }) => {
  await page.goto("/fr/circuit?c=oval:CCCCL");
  await expect(page.getByText("Ce circuit est introuvable ou ne se referme pas.")).toBeVisible();
});
