import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Circuits des internautes : photos de circuits construits, publiées par un parent et validées avant
 * d'être visibles (décidé le 19 octobre 2026). Stockage Supabase (région UE), compte anonyme par appareil :
 * aucun nom, aucun e-mail, aucune donnée sur l'enfant. Schéma : supabase/migrations/001_circuit_photos.sql.
 * Sans les deux variables d'environnement, la fonction est simplement indisponible (« Bientôt »).
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = "circuit-photos";
/** Plus grand côté de la photo envoyée (px) : assez pour voir le circuit, léger à charger. */
const MAX_SIDE = 1600;

export const communityEnabled = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!communityEnabled) throw new Error("Circuits des internautes indisponibles");
  client ??= createClient(URL!, KEY!, { auth: { persistSession: true, storageKey: "rail-builder:community" } });
  return client;
}

/** Compte anonyme de l'appareil, créé à la première publication. */
async function me(): Promise<string> {
  const { data } = await db().auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signed, error } = await db().auth.signInAnonymously();
  if (error || !signed.user) throw error ?? new Error("Connexion impossible");
  return signed.user.id;
}

async function currentUser(): Promise<string | null> {
  const { data } = await db().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Réduit la photo et la réenregistre en JPEG : le nouveau fichier ne garde aucune métadonnée
 * (ni position GPS, ni appareil, ni date).
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Photo illisible"))), "image/jpeg", 0.82),
  );
}

export interface CommunityPhoto {
  id: string;
  code: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  url: string | null;
  path: string;
}

interface Row {
  id: string;
  circuit_code: string;
  status: CommunityPhoto["status"];
  created_at: string;
  photo_path: string;
}

async function withUrls(rows: Row[]): Promise<CommunityPhoto[]> {
  if (rows.length === 0) return [];
  const { data } = await db()
    .storage.from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.photo_path),
      3600,
    );
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    code: r.circuit_code,
    status: r.status,
    createdAt: r.created_at,
    path: r.photo_path,
    url: urls.get(r.photo_path) ?? null,
  }));
}

const COLUMNS = "id, circuit_code, status, created_at, photo_path";

/** Publie la photo d'un circuit : elle reste « en attente » jusqu'à sa validation. */
export async function sharePhoto(code: string, file: Blob): Promise<void> {
  const owner = await me();
  const photo = await shrinkPhoto(file);
  const path = `${owner}/${crypto.randomUUID()}.jpg`;
  const upload = await db().storage.from(BUCKET).upload(path, photo, { contentType: "image/jpeg" });
  if (upload.error) throw upload.error;
  const insert = await db().from("circuit_photos").insert({ circuit_code: code, photo_path: path });
  if (insert.error) {
    await db().storage.from(BUCKET).remove([path]);
    throw insert.error;
  }
}

/** Photos validées, des plus récentes aux plus anciennes. */
export async function approvedPhotos(page = 0, size = 24): Promise<CommunityPhoto[]> {
  const { data, error } = await db()
    .from("circuit_photos")
    .select(COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);
  if (error) throw error;
  return withUrls(data as Row[]);
}

/** Photos publiées depuis cet appareil (pour un circuit, ou toutes). */
export async function myPhotos(code?: string): Promise<CommunityPhoto[]> {
  const owner = await currentUser();
  if (!owner) return [];
  let query = db().from("circuit_photos").select(COLUMNS).eq("owner", owner);
  if (code) query = query.eq("circuit_code", code);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return withUrls(data as Row[]);
}

/** Retire une de ses photos (fichier et fiche). */
export async function deletePhoto(photo: CommunityPhoto): Promise<void> {
  await db().from("circuit_photos").delete().eq("id", photo.id);
  await db().storage.from(BUCKET).remove([photo.path]);
}

/** Retire toutes les photos publiées depuis cet appareil (« Tout supprimer » des réglages). */
export async function deleteAllMyPhotos(): Promise<void> {
  if (!communityEnabled) return;
  for (const photo of await myPhotos()) await deletePhoto(photo);
  await db().auth.signOut();
}

/** Signale une photo : deux signalements la renvoient en validation. */
export async function reportPhoto(id: string): Promise<void> {
  await me();
  const { error } = await db().from("photo_reports").insert({ photo: id });
  // Déjà signalée par cet appareil : rien à faire.
  if (error && error.code !== "23505") throw error;
}
