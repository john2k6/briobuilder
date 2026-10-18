# Rail Builder (nom provisoire) — contexte du projet

## Le projet
Site web (PWA) qui dit à un parent et à son enfant **quels circuits de train en bois ils peuvent construire avec les pièces qu'ils possèdent** (rails compatibles type BRIO®), puis guide l'enfant pas à pas.
Le **cahier des exigences** (PDF du 18 octobre 2026, identifiants EF-xx / ENF-xx) fait foi ; livraison par lots (0 à 5).

- Le porteur du projet (Jonathan) n'est pas développeur : explique simplement, une étape à la fois, en français.
- Langues : **français et anglais** ; d'autres viendront (allemand, suédois…). Aucun texte en dur dans les composants : tout passe par `messages/<langue>.json`.
- Hébergement : **Vercel** (déploiement automatique à chaque push sur `main`, région Paris pour les fonctions).

## Règles non négociables
- **Marque (ENF-08)** : jamais « BRIO » dans le nom du site, ni logo, ni photo ou visuel du fabricant (y compris les images de coffrets). On peut citer les références et noms des coffrets compatibles. Illustrations originales générées + photo de sa propre boîte (reste sur l'appareil). Mention « compatible avec les rails en bois de type BRIO® » + non-affiliation en pied de page.
- **Aucune proposition impossible** : chaque circuit proposé par le générateur est vérifié par le moteur (fermé, sans chevauchement, pièces disponibles). La nomenclature (piliers compris) se **déduit des placements**, jamais saisie.
- **Enfants (ENF-01)** : surnom, tranche d'âge et couleur seulement. Aucune donnée identifiante, aucun traceur publicitaire, jamais de publicité.
- **Mode enfant** : cibles ≥ 64 px, aucune saisie clavier, consignes lues à voix haute, ni achat, ni lien affilié, ni lien externe (EF-51). Animations < 600 ms, coupées si « réduire les animations ».
- Demande avant de créer une ressource en ligne ou d'activer un service payant (Supabase, Stripe, affiliation…).

## Stack
Next.js 16 (App Router) + TypeScript strict, Tailwind CSS 4, next-intl (`/fr`, `/en`), Vitest, Playwright, Prettier.
Prévu : Supabase région UE (lot 1 : comptes parents), Drizzle + Zod.

## Concept (18 octobre 2026)
Le parent ajoute ses **coffrets réels** (références 33512, 33815, 33052…) ; leurs pièces s'additionnent, toutes boîtes mélangées, avec des corrections pièce par pièce.
Le **générateur** invente les circuits selon la configuration (taille, pont, aiguillage, croisement, décors) et le moteur vérifie chacun.

## Organisation
- `src/lib/track-engine/` : moteur en TypeScript pur, sans dépendance UI, couverture ≥ 90 %.
  - Pièce = connecteurs (x, y en mm, angle, tenon/trou, niveau). On ne relie qu'un tenon à un trou. `Placement.level` = hauteur (piliers).
  - `analyzeJoints` : passage strict ±3 mm puis jeu des rails (`flexTolerance`) ; `maxGap` est affiché à l'utilisateur.
  - `generator.ts` : gabarits (rond, ovale, rectangle, colline, huit à croisement, huit à pont, voie de garage, voie d'évitement), lignes droites composées avec les pièces disponibles, codes de circuit `famille:jetons~accessoires` (ex. `oval:CCCCLSCCCCMM~T5`).
- Géométrie compatible : droites 54/108/144/216 mm, courbes E (r 202) et E1 (r 110) de 45°, aiguillages longueur A (144), croisement sur D (216), rampes de 216 mm.
- `data/catalog/pieces.json` : généré par `npm run catalog`. `data/catalog/sets.json` : coffrets réels, **contenu indicatif** (`verified: false`) à confirmer sur de vraies boîtes.
- `src/lib/store.ts` : coffrets, corrections, photos, profils, badges, réglages du générateur (localStorage, clé v2, reprise de la v1).
- `src/lib/circuits.ts` : décodage d'un code de circuit (adresse `/circuit?c=…`, favoris, historique).
- `src/views/` : écrans interactifs ; `src/app/[locale]/` : routes.
- `public/sw.js` : hors ligne (pages réseau d'abord, fiche circuit servie quel que soit `?c=`). Changer `VERSION` si la stratégie change.
- Style (inspiré du site de référence fourni) : fond blanc, rouge `#e2001a`, vert `#00843d`, gris ardoise `#3f4a56`, bleu nuit `#1b2a4a`, bois `#e2bd86` / `#a9783f` ; police Nunito Sans ; cartes à grand coin arrondi (`blob`). Couleurs dans `src/app/globals.css`.

## Vérifications avant chaque push
`npm run format && npm run lint && npm run typecheck && npm test && npm run coverage && npm run e2e`
(en environnement cloud : `CHROMIUM_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1) npm run e2e`).

## Avancement (18 octobre 2026)
- Fait : moteur (niveaux, piliers, jeu des rails), 22 pièces, 18 coffrets réels, générateur configurable (8 familles), caisse par coffrets + photos, fiche, mode enfant pas à pas, profils, badges, export/suppression, PWA hors ligne, design rouge/vert/blanc.
- À faire : vérifier le contenu des coffrets sur de vraies boîtes, lot 1 (comptes Supabase), back-office (EF-40 à 42), affiliation (EF-50, images officielles via un programme d'affiliation), premium (EF-52 à 55).
- Questions ouvertes : nom du site et domaine, qui mesure les pièces, programmes d'affiliation, prix du premium.
