# Rail Builder (nom provisoire) — contexte du projet

## Le projet
Site web (PWA) qui dit à un parent et à son enfant **quels circuits de train en bois ils peuvent construire avec les pièces qu'ils possèdent** (rails compatibles type BRIO®), puis guide l'enfant pas à pas.
Le **cahier des exigences** (PDF du 18 octobre 2026, identifiants EF-xx / ENF-xx) fait foi ; livraison par lots (0 à 5).

- Le porteur du projet (Jonathan) n'est pas développeur : explique simplement, une étape à la fois, en français.
- Langues : **français et anglais** ; d'autres viendront (allemand, suédois…). Aucun texte en dur dans les composants : tout passe par `messages/<langue>.json`.
- Hébergement : **Vercel** (déploiement automatique à chaque push sur `main`, région Paris pour les fonctions).

## Règles non négociables
- **Marque (ENF-08, assoupli par Jonathan le 18 octobre 2026)** : jamais « BRIO » dans le nom du site ni logo du fabricant. On peut citer les références et noms des coffrets. **Images officielles autorisées** : affichées par lien direct depuis le site du fabricant (jamais copiées sur notre serveur), toujours avec le crédit © BRIO AB / Ravensburger et un lien vers la page officielle (`src/lib/official.ts`, adresses dans `data/catalog/official-images.json`), retirées sur demande. À défaut : illustration originale. Pas de photo de sa propre boîte (retiré le 18 octobre 2026). Mentions « compatible… », non-affiliation et propriété des images en pied de page. Jamais de lien externe en mode enfant.
- **Aucune proposition impossible** : chaque circuit proposé par le générateur est vérifié par le moteur (fermé, sans chevauchement, pièces disponibles). La nomenclature (piliers compris) se **déduit des placements**, jamais saisie.
- **Enfants (ENF-01)** : surnom, tranche d'âge et couleur seulement. Aucune donnée identifiante, aucun traceur publicitaire, jamais de publicité.
- **Mode enfant** : cibles ≥ 64 px, aucune saisie clavier, consignes lues à voix haute, ni achat, ni lien affilié, ni lien externe (EF-51). Animations < 600 ms, coupées si « réduire les animations ».
- Demande avant de créer une ressource en ligne ou d'activer un service payant (Supabase, Stripe, affiliation…).
- **Circuits des internautes (19 octobre 2026)** : photos de circuits construits, publiées **par le parent seulement** (jamais depuis le mode enfant), avec la case « ni visage, ni prénom, ni adresse », **validées avant publication**, signalables (2 signalements → retour en validation), métadonnées supprimées (photo réencodée). Supabase région UE, compte anonyme par appareil (`src/lib/community.ts`, `supabase/migrations/`, guide `docs/supabase.md`). Sans `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, le site affiche « Bientôt ».

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
  - `generator.ts` : plus aucun rond/ovale/rectangle proposé (décidé le 18 octobre 2026, codes anciens encore lisibles). Formes au hasard (`wanders`, graine fixe : codes stables), formes biscornues à 8 courbes (`crooked`), formes en L/U/haricot/triangle/maison/octogone (`shape`), serpent, huit. Sur ces formes (`derived`) : colline, voie de garage, terminus, fourche (aiguillage en Y), gare de triage ; raccourcis et voies d'évitement (`linkTemplates`) ; grands réseaux ; villes des trains à 2–4 embranchements (`megas`). Les circuits qui ne correspondent pas aux filtres sont cachés mais servent de base. Codes `famille:jetons~accessoires` ; `|` = voie sans issue ouverte. Gares (9 sortes), bâtiments et tunnels (5 sortes) tous dessinés différemment (`AccessoryShape`).
- Géométrie compatible : droites 54/108/144/216 mm, courbes E (r 212, d'après les cercles officiels de 46,4 cm) et E1 (r 110) de 45°, jeu des rails jusqu'à ~3 cm sur une boucle, aiguillages longueur A (144), croisement sur D (216), rampes de 216 mm.
- `data/catalog/pieces.json` : généré par `npm run catalog`. `data/catalog/sets.json` : 202 produits officiels (coffrets, extensions, sachets, ponts, bâtiments et décors, trains ; liste tirée des sitemaps brio.fr et brio.co.uk), **contenu indicatif** (`verified: false`) à confirmer sur de vraies boîtes.
- `src/lib/store.ts` : coffrets, corrections, profils, badges, réglages du générateur (localStorage, clé v2, reprise de la v1).
- `src/lib/circuits.ts` : décodage d'un code de circuit (adresse `/circuit?c=…`, favoris, historique).
- `src/views/` : écrans interactifs ; `src/app/[locale]/` : routes.
- `public/sw.js` : hors ligne (pages réseau d'abord, fiche circuit servie quel que soit `?c=`). Changer `VERSION` si la stratégie change.
- Style (inspiré du site de référence fourni) : fond blanc, rouge `#e2001a`, vert `#00843d`, gris ardoise `#3f4a56`, bleu nuit `#1b2a4a`, bois `#e2bd86` / `#a9783f` ; police Nunito Sans ; cartes à grand coin arrondi (`blob`). Couleurs dans `src/app/globals.css`.

## Vérifications avant chaque push
`npm run format && npm run lint && npm run typecheck && npm test && npm run coverage && npm run e2e`
(en environnement cloud : `CHROMIUM_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1) npm run e2e`).

## Avancement (18 octobre 2026)
- Fait : moteur (niveaux, piliers, jeu des rails), 51 pièces (dont 9 gares, 5 tunnels et 7 bâtiments, chacun son dessin), 202 produits officiels, page Ma collection, liens et crédits des images officielles, générateur sans ovale (formes au hasard jusqu'à ~100 pièces, villes des trains, filtre gares), caisse par coffrets, fiche, mode enfant pas à pas (bouton Quitter en un appui), profils, badges, export/suppression, PWA hors ligne, design rouge/vert/blanc.
- À faire : renseigner les adresses des images officielles (réseau de l'environnement à ouvrir vers brio.fr / brio.co.uk / ravensburger.fr), vérifier le contenu des coffrets sur de vraies boîtes (notices `<EAN>_PINFO_<ref>_layout.pdf` sur brio.co.nl), lot 1 (comptes Supabase), back-office (EF-40 à 42), affiliation (EF-50, images officielles via un programme d'affiliation), premium (EF-52 à 55).
- Questions ouvertes : nom du site et domaine, qui mesure les pièces, programmes d'affiliation, prix du premium.
