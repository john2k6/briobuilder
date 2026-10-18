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
node scripts/generate-icons.mjs  # régénère les icônes de l'application
```

## Organisation
- `src/lib/track-engine/` : moteur géométrique et générateur de circuits, en TypeScript pur.
- `data/catalog/` : pièces (générées par `scripts/generate-catalog.mjs`) et coffrets réels (contenu indicatif).
- `src/lib/store.ts` : coffrets, corrections, profils, badges (dans le navigateur, en attendant Supabase).
- `src/app/[locale]/` : pages Next.js, une URL par langue (`/fr`, `/en`) ; `src/views/` : écrans interactifs.
- `messages/` : tous les textes, un fichier par langue.
- Voir `CLAUDE.md` pour les règles et la géométrie.

## Ajouter une langue
1. Copier `messages/en.json` en `messages/de.json` (par ex.) et traduire.
2. Ajouter `"de"` dans `src/i18n/routing.ts`.
3. `npm test` vérifie que le nouveau fichier a exactement les mêmes clés.

## Avancement — version 0.3 (sans compte)
- [x] Moteur : raccords tenon/trou, niveaux et piliers, jeu des rails, chevauchements
- [x] 55 coffrets, extensions, sachets et ponts réels (contenu indicatif) et 29 pièces : rails, aiguillages (dont petit et en Y), croisements (droit et courbe), rampes et courbe montante, ponts (suspendu, levant, courbe), butoir, plaque tournante, décors
- [x] Liens vers les pages officielles et crédit © des images officielles (adresses des images à renseigner)
- [x] Mes coffrets : catalogue, recherche, quantités, corrections pièce par pièce
- [x] Générateur : taille, pont, aiguillage, croisement, décors ; 18 familles de circuits vérifiés (formes en L, U, haricot, triangle, maison, octogone ; terminus, fourche, gare de triage, ligne ; voies sans issue)
- [x] Fiche, mode enfant pas à pas, profils, badges, export/suppression, PWA hors ligne
- [ ] Vérifier le contenu des coffrets sur de vraies boîtes
- [ ] Lot 1 — comptes parents et sauvegarde en ligne (Supabase, région UE)
- [ ] Back-office (EF-40 à 42), affiliation (EF-50), premium (EF-52 à 55)
