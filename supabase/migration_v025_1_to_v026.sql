-- Pers Favourites v025.1 -> v026 production migration
-- Run in the EXISTING Supabase project for THIS rollout only, before deploying v026 production mode.
-- Do not run this against another owner's rollout.

create table if not exists public.venue_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  uploader_display_name text,
  uploader_role text not null default 'viewer' check (uploader_role in ('owner','admin','viewer')),
  caption text,
  storage_path text not null unique,
  mime_type text not null default 'image/jpeg',
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists venue_photos_place_idx on public.venue_photos(place_id, status, sort_order, created_at);
create unique index if not exists venue_photos_one_cover_idx on public.venue_photos(place_id) where is_cover and status='approved';
alter table public.venue_photos enable row level security;

alter table public.app_settings add column if not exists allow_user_photos boolean not null default true;

revoke all on table public.venue_photos from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.app_settings, public.places, public.venue_photos to anon;
grant select, insert, update, delete on table public.venue_photos to authenticated;

-- Tighten v026 Owner-only master controls.
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists places_delete on public.places;
create policy places_delete on public.places for delete to authenticated using (public.is_owner() and archived_at is not null);

-- v026 browsing is public/read-only. Owner/Admin protection applies to editing, not opening the app.
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to anon, authenticated using (true);
drop policy if exists places_read on public.places;
drop policy if exists places_public_read on public.places;
drop policy if exists places_authenticated_read on public.places;
create policy places_public_read on public.places for select to anon using (archived_at is null);
create policy places_authenticated_read on public.places for select to authenticated using (archived_at is null or public.is_editor());

drop policy if exists venue_photos_read on public.venue_photos;
drop policy if exists venue_photos_public_read on public.venue_photos;
drop policy if exists venue_photos_authenticated_read on public.venue_photos;
create policy venue_photos_public_read on public.venue_photos for select to anon using (status='approved');
create policy venue_photos_authenticated_read on public.venue_photos for select to authenticated using (status='approved' or uploaded_by=auth.uid() or public.is_editor());
drop policy if exists venue_photos_insert on public.venue_photos;
create policy venue_photos_insert on public.venue_photos for insert to authenticated with check (uploaded_by=auth.uid() and (public.is_editor() or ((select coalesce(allow_user_photos,true) from public.app_settings where id=1) and status='pending' and is_cover=false)));
drop policy if exists venue_photos_update on public.venue_photos;
create policy venue_photos_update on public.venue_photos for update to authenticated using (public.is_editor() or (uploaded_by=auth.uid() and status='pending')) with check (public.is_editor() or (uploaded_by=auth.uid() and status='pending' and is_cover=false));
drop policy if exists venue_photos_delete on public.venue_photos;
create policy venue_photos_delete on public.venue_photos for delete to authenticated using (public.is_editor() or uploaded_by=auth.uid());

create or replace function public.prepare_venue_photo_insert()
returns trigger language plpgsql security definer set search_path=''
as $$
declare r text; n text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.role, p.display_name into r, n from public.profiles p where p.id=auth.uid();
  new.uploaded_by=auth.uid(); new.uploader_role=coalesce(r,'viewer'); new.uploader_display_name=coalesce(nullif(n,''),'User');
  if coalesce(r,'viewer') not in ('owner','admin') then new.status='pending'; new.is_cover=false; new.moderated_by=null; new.moderated_at=null; end if;
  new.updated_at=now(); return new;
end; $$;
revoke all on function public.prepare_venue_photo_insert() from public, anon, authenticated;
drop trigger if exists venue_photo_before_insert on public.venue_photos;
create trigger venue_photo_before_insert before insert on public.venue_photos for each row execute procedure public.prepare_venue_photo_insert();


create or replace function public.protect_venue_photo_update()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  -- Upload identity and file linkage are immutable after insert.
  new.id=old.id; new.place_id=old.place_id; new.uploaded_by=old.uploaded_by;
  new.uploader_display_name=old.uploader_display_name; new.uploader_role=old.uploader_role;
  new.storage_path=old.storage_path; new.mime_type=old.mime_type; new.created_at=old.created_at;
  if not public.is_editor() then
    new.status='pending'; new.is_cover=false; new.sort_order=old.sort_order;
    new.moderated_by=null; new.moderated_at=null;
  end if;
  new.updated_at=now();
  return new;
end; $$;
revoke all on function public.protect_venue_photo_update() from public, anon, authenticated;
drop trigger if exists venue_photo_before_update on public.venue_photos;
create trigger venue_photo_before_update before update on public.venue_photos for each row execute procedure public.protect_venue_photo_update();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('venue-photos','venue-photos',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists venue_photos_storage_select on storage.objects;
-- Public image delivery is used for approved photos; metadata RLS controls what the signed-out app discovers.
drop policy if exists venue_photos_storage_insert on storage.objects;
create policy venue_photos_storage_insert on storage.objects for insert to authenticated
with check (bucket_id='venue-photos' and (storage.foldername(name))[2]=(select auth.uid()::text) and (public.is_editor() or (select coalesce(allow_user_photos,true) from public.app_settings where id=1)));
drop policy if exists venue_photos_storage_delete on storage.objects;
create policy venue_photos_storage_delete on storage.objects for delete to authenticated
using (bucket_id='venue-photos' and (owner_id=(select auth.uid()::text) or public.is_editor()));

-- Verify the rollout identity still matches deploy/config.js after migration:
select id,deployment_id,app_name,owner_display_name,home_region from public.app_settings where id=1;
