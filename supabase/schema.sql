-- Pers Favourites v027f - one isolated Supabase project per rollout.
-- v027f retains separate Pers/User ratings and full backup support, and adds corrected nearby-first online search and cascading geography filters. Ordinary browsing remains public/read-only.
-- Run in a NEW Supabase project for each separately deployed GitHub instance.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'viewer' check (role in ('owner','admin','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  deployment_id text not null default 'UNCONFIGURED',
  app_name text not null default 'Pers Favourites',
  owner_display_name text,
  home_region text,
  allow_user_photos boolean not null default true,
  ask_pers_enabled boolean not null default false,
  ask_pers_endpoint text,
  places_search_endpoint text,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values (1) on conflict (id) do nothing;
alter table public.app_settings add column if not exists deployment_id text;
alter table public.app_settings add column if not exists allow_user_photos boolean not null default true;
alter table public.app_settings add column if not exists ask_pers_enabled boolean not null default false;
alter table public.app_settings add column if not exists ask_pers_endpoint text;
alter table public.app_settings add column if not exists places_search_endpoint text;
update public.app_settings set deployment_id='UNCONFIGURED' where deployment_id is null or btrim(deployment_id)='';
alter table public.app_settings alter column deployment_id set default 'UNCONFIGURED';
alter table public.app_settings alter column deployment_id set not null;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  place_type text, cuisine text, country text, state_region text, city text, suburb text,
  address text, lat double precision, lng double precision, price text, pers_rating numeric(2,1) check (pers_rating between 0 and 5),
  meal_types text[] not null default '{}', great_for text[] not null default '{}',
  features text[] not null default '{}', dietary text[] not null default '{}', tags text[] not null default '{}',
  must_try text, notes text, website text, google_maps_url text, phone text, booking_url text,
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists places_name_idx on public.places(lower(name));
create index if not exists places_city_idx on public.places(lower(city));

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

create table if not exists public.personal_place_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  rating int check (rating between 0 and 5),
  favourite boolean not null default false,
  want_to_visit boolean not null default false,
  visited boolean not null default false,
  private_note text,
  last_visited timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id, place_id)
);

create table if not exists public.venue_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, place_id)
);

create table if not exists public.venue_rating_summary (
  place_id uuid primary key references public.places(id) on delete cascade,
  average_rating numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visited_at timestamptz not null default now(),
  rating int check (rating between 0 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  reason text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin')); $$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='owner'); $$;

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.places enable row level security;
alter table public.venue_photos enable row level security;
alter table public.personal_place_data enable row level security;
alter table public.venue_ratings enable row level security;
alter table public.venue_rating_summary enable row level security;
alter table public.visits enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_snapshots enable row level security;

-- Least-privilege Data API grants. Signed-out visitors may read only the shared app identity, active venue catalogue and approved photo metadata.
revoke all on table public.profiles, public.app_settings, public.places, public.venue_photos, public.personal_place_data, public.venue_ratings, public.venue_rating_summary, public.visits, public.user_preferences, public.audit_snapshots from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.app_settings, public.places, public.venue_photos, public.venue_rating_summary to anon;
grant select, update on table public.profiles to authenticated;
grant select, update on table public.app_settings to authenticated;
grant select, insert, update, delete on table public.places to authenticated;
grant select, insert, update, delete on table public.venue_photos to authenticated;
grant select, insert, update, delete on table public.personal_place_data to authenticated;
grant select, insert, update, delete on table public.venue_ratings to authenticated;
grant select on table public.venue_rating_summary to authenticated;
grant select, insert, update, delete on table public.visits to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;
grant select, insert on table public.audit_snapshots to authenticated;

revoke all on function public.is_editor() from public, anon;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_editor() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- App identity is public/read-only.
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to anon, authenticated using (true);
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists places_read on public.places;
drop policy if exists places_public_read on public.places;
drop policy if exists places_authenticated_read on public.places;
create policy places_public_read on public.places for select to anon using (archived_at is null);
create policy places_authenticated_read on public.places for select to authenticated using (archived_at is null or public.is_editor());
drop policy if exists places_insert on public.places;
create policy places_insert on public.places for insert to authenticated with check (public.is_editor());
drop policy if exists places_update on public.places;
create policy places_update on public.places for update to authenticated using (public.is_editor()) with check (public.is_editor());
drop policy if exists places_delete on public.places;
create policy places_delete on public.places for delete to authenticated using (public.is_owner() and archived_at is not null);

-- Venue photos: viewers may contribute, but their photos stay pending until an editor approves them.
-- Editors (Owner/Admin) can moderate all venue photos. The Owner retains final control and can also
-- permanently delete the venue itself, which cascades the photo metadata after storage cleanup.
drop policy if exists venue_photos_read on public.venue_photos;
drop policy if exists venue_photos_public_read on public.venue_photos;
drop policy if exists venue_photos_authenticated_read on public.venue_photos;
create policy venue_photos_public_read on public.venue_photos for select to anon using (status='approved');
create policy venue_photos_authenticated_read on public.venue_photos for select to authenticated
using (status='approved' or uploaded_by=auth.uid() or public.is_editor());

drop policy if exists venue_photos_insert on public.venue_photos;
create policy venue_photos_insert on public.venue_photos for insert to authenticated
with check (uploaded_by=auth.uid() and (public.is_editor() or ((select coalesce(allow_user_photos,true) from public.app_settings where id=1) and status='pending' and is_cover=false)));

drop policy if exists venue_photos_update on public.venue_photos;
create policy venue_photos_update on public.venue_photos for update to authenticated
using (public.is_editor() or (uploaded_by=auth.uid() and status='pending'))
with check (public.is_editor() or (uploaded_by=auth.uid() and status='pending' and is_cover=false));

drop policy if exists venue_photos_delete on public.venue_photos;
create policy venue_photos_delete on public.venue_photos for delete to authenticated
using (public.is_editor() or uploaded_by=auth.uid());

-- Public User Ratings are separate from the Pers/Administrator rating.
-- Only ordinary viewer accounts may create User Ratings; Owner/Admin ratings are stored in places.pers_rating instead.
drop policy if exists venue_ratings_self on public.venue_ratings;
create policy venue_ratings_self on public.venue_ratings for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists venue_rating_summary_read on public.venue_rating_summary;
create policy venue_rating_summary_read on public.venue_rating_summary for select to anon, authenticated using (true);

create or replace function public.validate_viewer_rating()
returns trigger language plpgsql security definer set search_path=''
as $$
declare r text;
begin
  select p.role into r from public.profiles p where p.id=auth.uid();
  if r is distinct from 'viewer' then raise exception 'Owner/Admin ratings do not count as User Ratings'; end if;
  new.user_id=auth.uid(); new.updated_at=now(); return new;
end; $$;
revoke all on function public.validate_viewer_rating() from public, anon, authenticated;
drop trigger if exists venue_rating_before_write on public.venue_ratings;
create trigger venue_rating_before_write before insert or update on public.venue_ratings for each row execute procedure public.validate_viewer_rating();

create or replace function public.refresh_venue_rating_summary()
returns trigger language plpgsql security definer set search_path=''
as $$
declare pid uuid;
begin
  if TG_OP='DELETE' then pid=old.place_id; else pid=new.place_id; end if;
  insert into public.venue_rating_summary(place_id,average_rating,rating_count,updated_at)
  select pid,coalesce(round(avg(rating)::numeric,2),0),count(*),now() from public.venue_ratings where place_id=pid
  on conflict(place_id) do update set average_rating=excluded.average_rating,rating_count=excluded.rating_count,updated_at=excluded.updated_at;
  if TG_OP='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.refresh_venue_rating_summary() from public, anon, authenticated;
drop trigger if exists venue_rating_after_write on public.venue_ratings;
create trigger venue_rating_after_write after insert or update or delete on public.venue_ratings for each row execute procedure public.refresh_venue_rating_summary();

-- A user sees and changes only their own personal layer.
drop policy if exists personal_self_all on public.personal_place_data;
create policy personal_self_all on public.personal_place_data for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists visits_self_all on public.visits;
create policy visits_self_all on public.visits for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists prefs_self_all on public.user_preferences;
create policy prefs_self_all on public.user_preferences for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Users can read their own profile. Editors may read profiles for administration.
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using (id=auth.uid() or public.is_editor());
drop policy if exists profile_owner_update on public.profiles;
create policy profile_owner_update on public.profiles for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Snapshots are append/read only for editors from the browser.
drop policy if exists snapshots_editor on public.audit_snapshots;
drop policy if exists snapshots_editor_read on public.audit_snapshots;
drop policy if exists snapshots_editor_insert on public.audit_snapshots;
create policy snapshots_editor_read on public.audit_snapshots for select to authenticated using (public.is_editor());
create policy snapshots_editor_insert on public.audit_snapshots for insert to authenticated with check (public.is_editor());

-- Do not trust uploader role/display-name fields supplied by the browser. Derive them from the profile.
create or replace function public.prepare_venue_photo_insert()
returns trigger language plpgsql security definer set search_path=''
as $$
declare r text; n text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.role, p.display_name into r, n from public.profiles p where p.id=auth.uid();
  new.uploaded_by=auth.uid();
  new.uploader_role=coalesce(r,'viewer');
  new.uploader_display_name=coalesce(nullif(n,''),'User');
  if coalesce(r,'viewer') not in ('owner','admin') then
    new.status='pending'; new.is_cover=false; new.moderated_by=null; new.moderated_at=null;
  end if;
  new.updated_at=now();
  return new;
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

-- New sign-ups default to VIEWER. Promote the first owner/admin manually in the SQL editor.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.profiles(id,email,display_name,role)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),'viewer')
  on conflict(id) do nothing;
  return new;
end; $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- v026 rollout-specific venue-photo bucket. Approved photos are displayed to signed-out viewers through the public Storage URL. Every rollout
-- uses a separate Supabase project. Files are compressed in the browser before upload.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('venue-photos','venue-photos',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists venue_photos_storage_select on storage.objects;
-- The bucket is public only for image delivery. The app exposes URLs only for photo metadata rows it is allowed to read.
-- Pending/hidden photo metadata is not readable by signed-out viewers. Upload/update/delete remain authenticated and moderated.

drop policy if exists venue_photos_storage_insert on storage.objects;
create policy venue_photos_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='venue-photos'
  and (storage.foldername(name))[2]=(select auth.uid()::text)
  and (public.is_editor() or (select coalesce(allow_user_photos,true) from public.app_settings where id=1))
);

drop policy if exists venue_photos_storage_delete on storage.objects;
create policy venue_photos_storage_delete on storage.objects for delete to authenticated
using (bucket_id='venue-photos' and (owner_id=(select auth.uid()::text) or public.is_editor()));



-- v027e full logical database export. This does not expose Supabase Auth password hashes or secrets.
-- Owner/Admin may create an explicit backup that includes all application tables; photo binaries are
-- downloaded separately by the PWA and embedded in the exported backup file.
create or replace function public.export_full_backup()
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_editor() then raise exception 'Administrator access required'; end if;
  return jsonb_build_object(
    'schema_version', 276,
    'exported_at', now(),
    'app_settings', (select to_jsonb(x) from public.app_settings x where id=1),
    'profiles', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.profiles x),'[]'::jsonb),
    'places', coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.places x),'[]'::jsonb),
    'venue_photos', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.venue_photos x),'[]'::jsonb),
    'venue_ratings', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.venue_ratings x),'[]'::jsonb),
    'venue_rating_summary', coalesce((select jsonb_agg(to_jsonb(x) order by x.place_id) from public.venue_rating_summary x),'[]'::jsonb),
    'personal_place_data', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at) from public.personal_place_data x),'[]'::jsonb),
    'visits', coalesce((select jsonb_agg(to_jsonb(x) order by x.visited_at) from public.visits x),'[]'::jsonb),
    'user_preferences', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at) from public.user_preferences x),'[]'::jsonb),
    'audit_snapshots', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.audit_snapshots x),'[]'::jsonb)
  );
end; $$;
revoke all on function public.export_full_backup() from public, anon;
grant execute on function public.export_full_backup() to authenticated;

-- REQUIRED: set this project's rollout identity to EXACTLY match config.js before first production use:
-- update public.app_settings set deployment_id='YOUR-UNIQUE-ROLLOUT-ID' where id=1;
-- The PWA refuses to read catalogue data when the backend deployment_id and config.js deploymentId differ.

-- After creating the Owner account in Authentication > Users, run:
-- update public.profiles set role='owner', display_name='Per' where email='OWNER_EMAIL_HERE';
-- After creating Pat's testing/admin account, run:
-- update public.profiles set role='admin', display_name='Pat' where email='PAT_EMAIL_HERE';
