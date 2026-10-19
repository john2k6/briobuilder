# Mettre en route « Circuits des internautes » (Supabase)

Les photos des circuits sont stockées chez **Supabase** (région Europe, gratuit au départ).
Tant que les deux clés ci-dessous ne sont pas dans Vercel, le site affiche « Bientôt » : rien ne casse.

## 1. Créer le projet (5 minutes)
1. Aller sur https://supabase.com, se connecter (avec GitHub par exemple).
2. **New project** : nom `rail-builder`, mot de passe de base de données (le garder de côté),
   **Region : West EU (Paris)** ou Central EU (Frankfurt). Offre gratuite.

## 2. Autoriser les comptes anonymes
Les familles ne créent pas de compte : chaque appareil reçoit un compte anonyme (aucun e-mail, aucun nom).
- **Authentication → Sign In / Providers → Allow anonymous sign-ins** : activer, puis **Save**.

## 3. Créer la table et le stockage
- **SQL Editor → New query**, coller tout le contenu de `supabase/migrations/001_circuit_photos.sql`, puis **Run**.
  Cela crée la table des photos, les règles de sécurité et le stockage privé `circuit-photos`.

## 4. Brancher le site
- Dans Supabase : **Project Settings → API**, copier **Project URL** et la clé **anon public**.
- Dans Vercel : **Settings → Environment Variables**, ajouter :
  - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = clé anon public
- Relancer un déploiement (**Deployments → … → Redeploy**).

La clé « anon » est faite pour être visible dans le site : la sécurité vient des règles de la base.
Ne jamais mettre la clé **service_role** dans Vercel ni dans le code.

## 5. Valider les photos
Chaque photo arrive « en attente » et n'est visible par personne d'autre que son auteur.
- **Table Editor → circuit_photos** : regarder la photo (colonne `photo_path`, à ouvrir dans **Storage → circuit-photos**).
- Si elle est correcte (pas de visage, de prénom, d'adresse) : mettre `status` à `approved`. Sinon : `rejected`.
- Une photo signalée deux fois repasse toute seule en `pending`.
