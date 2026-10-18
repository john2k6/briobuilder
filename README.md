# Rail Builder (nom provisoire)

Site web (PWA à venir) qui dit aux familles quels circuits de train en bois elles peuvent construire
avec les pièces qu'elles possèdent (rails compatibles type BRIO®), et guide l'enfant pas à pas.
Le cahier des exigences fait foi (identifiants EF-xx / ENF-xx).

## Démarrer
```bash
npm install
npm run dev        # http://localhost:3000 → redirige vers /fr ou /en
npm test           # tests du moteur et des traductions
npm run coverage   # couverture du moteur (seuil 90 %)
npm run catalog    # régénère data/catalog/pieces.json
```

## Organisation
- `src/lib/track-engine/` : moteur géométrique en TypeScript pur — `transform()`, `connect()`,
  `isClosed()`, `overlaps()`, `billOfMaterials()`, `matchInventory()`, `chain()`.
- `data/catalog/` : pièces (générées par `scripts/generate-catalog.mjs`) et coffrets, en JSON.
  `verified: false` = dimensions ou contenu à mesurer sur de vraies pièces.
- `src/app/[locale]/` : pages Next.js, une URL par langue (`/fr`, `/en`).
- `messages/` : tous les textes, un fichier par langue.

## Ajouter une langue
1. Copier `messages/en.json` en `messages/de.json` (par ex.) et traduire.
2. Ajouter `"de"` dans `src/i18n/routing.ts`.
3. `npm test` vérifie que le nouveau fichier a exactement les mêmes clés.

## Avancement
- [x] Lot 0 — moteur géométrique + 10 pièces + 3 coffrets (critères validés par les tests)
- [x] Socle bilingue français / anglais
- [ ] Lot 1 — comptes et inventaire (Supabase, région UE)
- [ ] Lot 2 — bibliothèque et matching
- [ ] Lot 3 — fiche et pas à pas
