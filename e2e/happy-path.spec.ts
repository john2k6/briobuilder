import { expect, test } from "@playwright/test";

const shots = process.env.SHOTS_DIR;
const snap = async (page: import("@playwright/test").Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};

test("parcours principal : profil, caisse, circuit, construction, badge", async ({ page }) => {
  // 1. Profil enfant
  await page.goto("/fr/kids");
  await page.getByRole("button", { name: "Ajouter un enfant" }).click();
  await page.getByLabel("Surnom").fill("Lou");
  await page.getByText("5–6 ans").click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("heading", { name: "Lou" })).toBeVisible();

  // 2. Caisse : un coffret de démarrage, puis +2 rails droits longs
  await page.goto("/fr/box");
  await page.getByRole("button", { name: "Ajouter" }).first().click();
  await expect(page.getByText("14 pièces au total")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter une pièce : Rail droit long" }).click();
  await page.getByRole("button", { name: "Ajouter une pièce : Rail droit long" }).click();
  await expect(page.getByText("16 pièces au total")).toBeVisible();
  await page.getByRole("button", { name: "Annuler la dernière action" }).click();
  await expect(page.getByText("15 pièces au total")).toBeVisible();
  await snap(page, "1-box");

  // 3. Idées de circuits
  await page.getByRole("link", { name: "Voir mes circuits" }).click();
  await expect(page.getByRole("tab", { name: /Réalisables/ })).toContainText("5");
  await snap(page, "2-circuits");
  await page.getByRole("tab", { name: /Presque/ }).click();
  await expect(page.getByText("Il manque").first()).toBeVisible();
  await snap(page, "3-almost");
  await page.getByRole("tab", { name: /Réalisables/ }).click();

  // 4. Fiche circuit
  await page.getByRole("link", { name: /Le rond/ }).click();
  await expect(page.getByRole("heading", { name: "Le rond" })).toBeVisible();
  await page.getByRole("button", { name: "Ajouter aux favoris" }).click();
  await page.getByRole("checkbox").first().click();
  await expect(page.getByText("1 sur 1")).toBeVisible();
  await snap(page, "4-circuit");

  // 5. Construction pas à pas (mode enfant)
  await page.getByRole("link", { name: "On construit !" }).click();
  await expect(page.getByText("Étape 1 sur 8")).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("Étape 4 sur 8")).toBeVisible();
  await snap(page, "5-build");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("Bravo !")).toBeVisible();
  await page.getByRole("button", { name: /Je l'ai construit/ }).click();
  await expect(page.getByText("Nouveau badge !")).toBeVisible();
  await snap(page, "6-done");

  // 6. Badge et compteur sur le profil
  await page.getByRole("link", { name: "Choisir un autre circuit" }).click();
  await expect(page.getByText("Construit 1 fois")).toBeVisible();
  await page.goto("/fr/kids");
  await expect(page.getByText("1 circuit construit")).toBeVisible();
  await snap(page, "7-kids");

  // 7. Données conservées après rechargement, puis suppression
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
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(page.getByText("14 pieces in total")).toBeVisible();
  await page.goto("/en/circuits");
  await expect(page.getByRole("tab", { name: /Buildable/ })).toContainText("5");
  await snap(page, "8-en-circuits");
});
