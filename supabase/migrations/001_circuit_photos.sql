-- Photos des circuits construits (« Circuits des internautes »), décidé le 19 octobre 2026.
-- Règles : seul le parent publie ; chaque photo est validée avant d'être visible ; aucune donnée sur l'enfant.
-- À coller dans Supabase → SQL Editor → Run (voir docs/supabase.md).

create table if not exists public.circuit_photos (
  id uuid primary key default gen_random_uuid(),
  -- Compte anonyme de l'appareil (aucun e-mail, aucun nom).
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Code du circuit (le plan est redessiné à partir de lui).
  circuit_code text not null check (char_length(circuit_code) between 3 and 2000),
  -- Chemin de la photo dans le stockage : <owner>/<id>.jpg
  photo_path text not null unique,
  -- pending : en attente de validation ; approved : visible par tous ; rejected : refusée.
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists circuit_photos_approved on public.circuit_photos (created_at desc) where status = 'approved';

alter table public.circuit_photos enable row level security;

-- Tout le monde voit les photos validées ; chacun voit aussi les siennes.
drop policy if exists "photos visibles" on public.circuit_photos;
create policy "photos visibles" on public.circuit_photos
  for select to anon, authenticated
  using (status = 'approved' or owner = auth.uid());

-- On publie seulement pour soi, toujours « en attente », 10 photos en attente au plus.
drop policy if exists "publier sa photo" on public.circuit_photos;
create policy "publier sa photo" on public.circuit_photos
  for insert to authenticated
  with check (
    owner = auth.uid()
    and status = 'pending'
    and photo_path like auth.uid()::text || '/%'
    and (select count(*) from public.circuit_photos p where p.owner = auth.uid() and p.status = 'pending') < 10
  );

-- On peut retirer ses propres photos. (La validation se fait dans le tableau de bord Supabase.)
drop policy if exists "retirer sa photo" on public.circuit_photos;
create policy "retirer sa photo" on public.circuit_photos
  for delete to authenticated
  using (owner = auth.uid());

-- Signalements : deux signalements de personnes différentes renvoient la photo en validation.
create table if not exists public.photo_reports (
  photo uuid not null references public.circuit_photos (id) on delete cascade,
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo, reporter)
);

alter table public.photo_reports enable row level security;

drop policy if exists "signaler" on public.photo_reports;
create policy "signaler" on public.photo_reports
  for insert to authenticated
  with check (reporter = auth.uid());

create or replace function public.hide_reported_photo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.photo_reports where photo = new.photo) >= 2 then
    update public.circuit_photos set status = 'pending' where id = new.photo;
  end if;
  return new;
end;
$$;

drop trigger if exists photo_reported on public.photo_reports;
create trigger photo_reported after insert on public.photo_reports
  for each row execute function public.hide_reported_photo();

-- Stockage privé : les photos ne sont lisibles que si elles sont validées (ou par leur auteur).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('circuit-photos', 'circuit-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

drop policy if exists "envoyer sa photo" on storage.objects;
create policy "envoyer sa photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'circuit-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "voir les photos validées" on storage.objects;
create policy "voir les photos validées" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'circuit-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.circuit_photos p where p.photo_path = name and p.status = 'approved')
    )
  );

drop policy if exists "effacer sa photo" on storage.objects;
create policy "effacer sa photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'circuit-photos' and (storage.foldername(name))[1] = auth.uid()::text);
