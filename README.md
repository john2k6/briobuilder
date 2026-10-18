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
npm run e2e        # parcours complet dans un navigateur (Playwright)
npm run catalog    # régénère data/catalog/pieces.json
```

## Organisation
- `src/lib/track-engine/` : moteur géométrique en TypeScript pur — `transform()`, `connect()`,
  `isClosed()`, `overlaps()`, `billOfMaterials()`, `matchInventory()`, `chain()`.
- `data/catalog/` : pièces (générées par `scripts/generate-catalog.mjs`) et coffrets, en JSON.
  `verified: false` = dimensions ou contenu à mesurer sur de vraies pièces.
- `data/layouts/layouts.json` : circuits modèles, une lettre par pièce (`C` grande courbe, `R` grande courbe
  retournée, `c`/`r` petite courbe, `L`/`M`/`S` droites longue/moyenne/courte). Chaque circuit est vérifié
  automatiquement par un test : il doit se refermer sans chevauchement.
- `src/lib/store.ts` : caisse, profils enfants, favoris et badges, enregistrés dans le navigateur
  (version sans compte, remplacée par Supabase au lot 1).
- `src/app/[locale]/` : pages Next.js, une URL par langue (`/fr`, `/en`) ; `src/views/` : écrans interactifs.
- `messages/` : tous les textes, un fichier par langue.

## Ajouter une langue
1. Copier `messages/en.json` en `messages/de.json` (par ex.) et traduire.
2. Ajouter `"de"` dans `src/i18n/routing.ts`.
3. `npm test` vérifie que le nouveau fichier a exactement les mêmes clés.

## Avancement — version 0.1 (sans compte)
- [x] Lot 0 — moteur géométrique + 10 pièces + 3 coffrets (critères validés par les tests)
- [x] Socle bilingue français / anglais
- [x] Ma caisse : ajout par coffret, compteurs +/−, recherche, annuler (EF-10 à 13, EF-15)
- [x] Idées de circuits : Réalisables / Presque, filtres, tri, « Quelle pièce acheter ? » (EF-20 à 23, EF-25)
- [x] Fiche circuit : plan, nomenclature cochable, favoris, impression (EF-30, 31, 35, 37)
- [x] Mode enfant pas à pas : boutons géants, lecture audio, sortie protégée, badges (EF-06, 32 à 34)
- [x] Profils enfants (6 max, surnom seulement), export JSON et suppression des données (EF-03, EF-05)
- [ ] Lot 1 — comptes parents et sauvegarde en ligne (Supabase, région UE)
- [ ] Bibliothèque : passer de 11 à 20+ circuits (objectif : 10 circuits avec un coffret + 1 extension ; 6 aujourd'hui)
- [ ] Mesurer les vraies pièces (dimensions marquées « À mesurer »), back-office (EF-40 à 42), PWA hors ligne
