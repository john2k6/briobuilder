# Rail Builder (nom provisoire) — contexte du projet

## Le projet
Site web (PWA) qui dit à un parent et à son enfant **quels circuits de train en bois ils peuvent construire avec les pièces qu'ils possèdent** (rails compatibles type BRIO®), puis guide l'enfant pas à pas.
Le **cahier des exigences** (PDF du 18 octobre 2026, identifiants EF-xx / ENF-xx) fait foi ; livraison par lots (0 à 5).

- Le porteur du projet (Jonathan) n'est pas développeur : explique simplement, une étape à la fois, en français.
- Langues : **français et anglais** ; d'autres viendront (allemand, suédois…). Aucun texte en dur dans les composants : tout passe par `messages/<langue>.json`.
- Hébergement : **Vercel** (déploiement automatique à chaque push sur `main`, région Paris pour les fonctions).

## Règles non négociables
- **Marque (ENF-08)** : jamais « BRIO » dans le nom du site, ni logo ni visuel du fabricant. Seulement « compatible avec les rails en bois de type BRIO® » + mention de non-affiliation (pied de page).
- **Aucune proposition impossible** : chaque circuit de `data/layouts/layouts.json` est vérifié par un test (fermé, sans chevauchement). La nomenclature se **déduit des placements**, jamais saisie.
- **Enfants (ENF-01)** : surnom, tranche d'âge et couleur seulement. Aucune donnée identifiante, aucun traceur publicitaire, jamais de publicité.
- **Mode enfant** : cibles ≥ 64 px, aucune saisie clavier, consignes lues à voix haute, ni achat, ni lien affilié, ni lien externe (EF-51). Animations < 600 ms, coupées si « réduire les animations ».
- Demande avant de créer une ressource en ligne ou d'activer un service payant (Supabase, Stripe, affiliation…).

## Stack
Next.js 16 (App Router) + TypeScript strict, Tailwind CSS 4, next-intl (`/fr`, `/en`), Vitest, Playwright, Prettier.
Prévu : Supabase région UE (lot 1 : comptes parents), Drizzle + Zod.

## Organisation
- `src/lib/track-engine/` : moteur géométrique en TypeScript pur, sans dépendance UI, couverture ≥ 90 % (aujourd'hui 100 % des lignes).
  Pièce = connecteurs (x, y en mm, angle, mâle/femelle, niveau). On ne relie qu'un mâle à une femelle.
- `data/catalog/pieces.json` : généré par `npm run catalog` (`scripts/generate-catalog.mjs`). `verified: false` = à mesurer sur une vraie pièce.
- `data/layouts/layouts.json` : circuits modèles en notation compacte (`C`/`R` grande courbe gauche/droite, `c`/`r` petite, `L`/`M`/`S` droites, `X` croisement, `@2.3` = repartir du connecteur 3 de la 2e pièce). Ajouter le nom dans `messages/*.json` → `layouts`.
- `src/lib/store.ts` : données locales (localStorage) en attendant Supabase.
- `src/views/` : écrans interactifs ; `src/app/[locale]/` : routes.
- `public/sw.js` : hors ligne (pages réseau d'abord, fichiers statiques en cache). Changer `VERSION` si la stratégie change.
- Style : rouge `#d2232a`, vert `#1f8a4c`, gris foncé `#2e3236`, bois `#ddb67f` / `#a6773f`, fond crème `#f7f3ec`. Couleurs dans `src/app/globals.css`.

## Vérifications avant chaque push
`npm run format && npm run lint && npm run typecheck && npm test && npm run coverage && npm run e2e`
(en environnement cloud : `CHROMIUM_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1) npm run e2e`).

## Avancement (18 octobre 2026)
- Fait : lot 0 (moteur, 10 pièces, 3 coffrets), caisse, idées de circuits, fiche, mode enfant pas à pas, profils, badges, export/suppression, 20 circuits (dont un 8 avec croisement), PWA hors ligne.
- À faire : lot 1 (comptes Supabase), back-office (EF-40 à 42), affiliation (EF-50), circuits avec aiguillages et ponts (demande de mesurer les vraies pièces), premium (EF-52 à 55).
- Questions ouvertes : nom du site et domaine, qui mesure les pièces, programmes d'affiliation, prix du premium.
